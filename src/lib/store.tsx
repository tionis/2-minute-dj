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

  // Helper to update doc and trigger React re-render
  const updateDoc = useCallback((newDoc: Automerge.Doc<GameState>) => {
    docRef.current = newDoc;
    setDocState(newDoc);
    
    // Persist to localStorage
    try {
        const bytes = Automerge.save(newDoc);
        // We need to store it as a string. Base64 is better than JSON array.
        const base64 = btoa(String.fromCharCode(...bytes));
        localStorage.setItem('2mdj_doc_backup', base64);
    } catch (e) {
        console.error("Failed to save state", e);
    }
  }, []);

  // Load initial state
  useEffect(() => {
      const saved = localStorage.getItem('2mdj_doc_backup');
      if (saved) {
          try {
              const binary = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
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
    
    updateSyncState(targetPeerId, nextSyncState);
    
    if (message && sendSyncRef.current) {
      sendSyncRef.current(message, targetPeerId);
    }
  }, [updateSyncState]);

  // Broadcast changes to all peers
  const broadcastChanges = useCallback(() => {
    peers.forEach(p => syncWithPeer(p));
  }, [peers, syncWithPeer]);

  // Initialize Room when roomId changes
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
      syncWithPeer(joinedPeerId);
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

      updateDoc(newDoc);
      updateSyncState(senderPeerId, newSyncState);
      
      // Reply if needed (sync protocol is a conversation)
      syncWithPeer(senderPeerId);
    });

    setIsConnected(true);

    return () => {
      room.leave();
      roomRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, updateDoc, updateSyncState, syncWithPeer]);

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