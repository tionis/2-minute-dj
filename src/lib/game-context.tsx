"use client";

import { createContext, useContext } from 'react';
import type * as Automerge from '@automerge/automerge'; // Type only import is safe
import { GameState } from './types';

export interface StoreContextType {
  state: Automerge.Doc<GameState>;
  updateState: (callback: (doc: GameState) => void) => void;
  roomId: string | null;
  setRoomId: (id: string) => void;
  peerId: string;
  peers: string[];
  isConnected: boolean;
}

export const StoreContext = createContext<StoreContextType | null>(null);

export function useGameStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useGameStore must be used within a GameProvider');
  }
  return context;
}
