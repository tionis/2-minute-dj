"use client";

import { createContext, useContext } from "react";
import type { GameStateSnapshot } from "./types";
import type { ConnectionStatus } from "./realtime-client";

export interface GameStoreContextType {
  user: { id: string } | null;
  isLoadingAuth: boolean;
  authError: { message: string } | null;
  peerId: string;
  snapshot: GameStateSnapshot | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  actionError: string | null;
  clearActionError: () => void;
  connectHost: (code: string, authToken: string) => Promise<GameStateSnapshot>;
  connectPlayer: (code: string, playerId: string, authToken: string, nickname: string) => Promise<GameStateSnapshot>;
  disconnect: () => Promise<void>;
}

export const GameStoreContext = createContext<GameStoreContextType | null>(null);

export function useGameStore() {
  const context = useContext(GameStoreContext);
  if (!context) {
    throw new Error("useGameStore must be used within a GameProvider");
  }
  return context;
}
