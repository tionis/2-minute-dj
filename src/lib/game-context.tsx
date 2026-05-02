"use client";

import { createContext, useContext } from "react";
import type { InstaQLEntity, User } from "@instantdb/react";
import type { MySchema } from "./db";

export type RoomEntity = InstaQLEntity<MySchema, "rooms">;
export type PlayerEntity = InstaQLEntity<MySchema, "players">;
export type QueueItemEntity = InstaQLEntity<MySchema, "queueItems">;

export interface GameStoreContextType {
  user: User | null;
  isLoadingAuth: boolean;
  authError: { message: string } | null;
  peerId: string;
}

export const GameStoreContext = createContext<GameStoreContextType | null>(null);

export function useGameStore() {
  const context = useContext(GameStoreContext);
  if (!context) {
    throw new Error("useGameStore must be used within a GameProvider");
  }
  return context;
}
