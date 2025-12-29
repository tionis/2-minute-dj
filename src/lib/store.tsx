"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { joinRoom, Room as TrysteroRoom } from 'trystero/torrent';
import * as Automerge from '@automerge/automerge';
import { GameState } from './types';
import { StoreContext } from './game-context';

// Initial empty state
const initialState: GameState = {
  room: {
    id: "",
    code: "",
    status: "LOBBY",
    created_at: 0,
  },
  players: {},
  queue_items: {},
};

// Helper functions for safe base64 encoding/decoding of binary data
// Using chunked approach to avoid stack overflow with large arrays
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks to avoid stack overflow
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode(...chunk));
  }
  return btoa(chunks.join(''));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [peerId, setPeerId] = useState<string>("");

  // Automerge State
  const docRef = useRef<Automerge.Doc<GameState>>(Automerge.from(initialState as unknown as Record<string, unknown>) as Automerge.Doc<GameState>);
  const [docState, setDocState] = useState<Automerge.Doc<GameState>>(docRef.current);
  const syncStatesRef = useRef<Record<string, Automerge.SyncState>>({});
  
  // Trystero Room
  const roomRef = useRef<TrysteroRoom | null>(null);
  const sendSyncRef = useRef<((data: Uint8Array, target: string) => void) | null>(null);

  // Refs for functions used in useEffect to avoid dependency issues
  // This prevents unnecessary room reconnections when callbacks change
  const updateDocRef = useRef<(newDoc: Automerge.Doc<GameState>) => void>(() => {});
  const syncWithPeerRef = useRef<(targetPeerId: string) => void>(() => {});
  
  // Debounce timer for localStorage saves to avoid performance issues
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to update doc and trigger React re-render
  const updateDoc = useCallback((newDoc: Automerge.Doc<GameState>) => {
    docRef.current = newDoc;
    setDocState(newDoc);
    
    // Debounced persist to localStorage using safe base64 conversion
    // This prevents performance issues when state changes rapidly
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      try {
          const bytes = Automerge.save(docRef.current);
          const base64 = uint8ArrayToBase64(bytes);
          localStorage.setItem('2mdj_doc_backup', base64);
      } catch (e) {
          console.error("Failed to save state", e);
      }
    }, 500); // Debounce saves by 500ms
  }, []);

  // Keep ref in sync with latest callback
  useEffect(() => {
    updateDocRef.current = updateDoc;
  }, [updateDoc]);

  // Load initial state
  useEffect(() => {
      const saved = localStorage.getItem('2mdj_doc_backup');
      if (saved) {
          try {
              const binary = base64ToUint8Array(saved);
              const loadedDoc = Automerge.load<GameState>(binary);
              docRef.current = loadedDoc;
              setDocState(loadedDoc);
          } catch (e) {
              console.error("Failed to load state", e);
          }
      }
  }, []);

  // Update sync state for a peer
  const updateSyncState = useCallback((targetPeerId: string, newSyncState: Automerge.SyncState) => {
    syncStatesRef.current[targetPeerId] = newSyncState;
  }, []);

  // Check if we need to send a sync message to a peer
  const syncWithPeer = useCallback((targetPeerId: string) => {
    const currentDoc = docRef.current;
    const currentSyncState = syncStatesRef.current[targetPeerId] || Automerge.initSyncState();
    
    const [nextSyncState, message] = Automerge.generateSyncMessage(currentDoc, currentSyncState);
    
    syncStatesRef.current[targetPeerId] = nextSyncState;
    
    if (message && sendSyncRef.current) {
      sendSyncRef.current(message, targetPeerId);
    }
  }, []);

  // Keep ref in sync with latest callback
  useEffect(() => {
    syncWithPeerRef.current = syncWithPeer;
  }, [syncWithPeer]);

  // Broadcast changes to all peers
  const broadcastChanges = useCallback(() => {
    peers.forEach(p => syncWithPeerRef.current(p));
  }, [peers]);

  // Initialize Room when roomId changes
  // Uses refs for callbacks to avoid reconnection on callback changes
  useEffect(() => {
    if (!roomId) {
      if (roomRef.current) {
        roomRef.current.leave();
        roomRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const appId = '2-minute-dj-v1'; // Namespace
    const room = joinRoom({ appId }, roomId);
    roomRef.current = room;
    
    // Action for Sync Messages
    const [sendSync, getSync] = room.makeAction<Uint8Array>('sync');
    sendSyncRef.current = sendSync;

    // Handle Peer Join
    room.onPeerJoin((joinedPeerId) => {
      console.log('Peer joined:', joinedPeerId);
      setPeers(prev => [...prev, joinedPeerId]);
      syncStatesRef.current[joinedPeerId] = Automerge.initSyncState();
      // Use ref to get latest syncWithPeer without causing effect re-runs
      syncWithPeerRef.current(joinedPeerId);
    });

    // Handle Peer Leave
    room.onPeerLeave((leftPeerId) => {
      console.log('Peer left:', leftPeerId);
      setPeers(prev => prev.filter(p => p !== leftPeerId));
      delete syncStatesRef.current[leftPeerId];
    });

    // Handle Incoming Sync
    getSync((data, senderPeerId) => {
      const currentDoc = docRef.current;
      const currentSyncState = syncStatesRef.current[senderPeerId] || Automerge.initSyncState();

      const [newDoc, newSyncState] = Automerge.receiveSyncMessage(currentDoc, currentSyncState, data);

      // Use refs to get latest functions without causing effect re-runs
      updateDocRef.current(newDoc);
      syncStatesRef.current[senderPeerId] = newSyncState;
      
      // Reply if needed (sync protocol is a conversation)
      syncWithPeerRef.current(senderPeerId);
    });

    setIsConnected(true);

    return () => {
      room.leave();
      roomRef.current = null;
      setIsConnected(false);
    };
  }, [roomId]); // Only re-run when roomId changes

  // Public API to update state
  const updateState = useCallback((callback: (doc: GameState) => void) => {
    const newDoc = Automerge.change(docRef.current, callback);
    updateDoc(newDoc);
    broadcastChanges();
  }, [updateDoc, broadcastChanges]);

  // Generate a stable Peer ID for this session if not exists
  useEffect(() => {
    let id = localStorage.getItem('2mdj_peer_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('2mdj_peer_id', id);
    }
    setPeerId(id);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <StoreContext.Provider value={{ 
      state: docState, 
      updateState, 
      roomId, 
      setRoomId, 
      peerId,
      peers,
      isConnected
    }}>
      {children}
    </StoreContext.Provider>
  );
}