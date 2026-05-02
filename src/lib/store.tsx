"use client";

import React, { useEffect, useState, useCallback } from "react";
import { id } from "@instantdb/react";
import db from "./db";
import { GameStoreContext } from "./game-context";

function getOrCreatePeerId(): string {
  let pid = localStorage.getItem("2mdj_peer_id");
  if (!pid) {
    pid = crypto.randomUUID();
    localStorage.setItem("2mdj_peer_id", pid);
  }
  return pid;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, user, error } = db.useAuth();
  const [peerId] = useState<string>(() => getOrCreatePeerId());
  const [hasSignedIn, setHasSignedIn] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      setHasSignedIn(true);
      return;
    }
    if (hasSignedIn) return;

    db.auth.signInAsGuest().then(() => {
      setHasSignedIn(true);
    }).catch((err: unknown) => {
      console.error("Guest sign-in failed:", err);
    });
  }, [isLoading, user, peerId, hasSignedIn]);

  return (
    <GameStoreContext.Provider
      value={{
        user: user ?? null,
        isLoadingAuth: isLoading,
        authError: error ?? null,
        peerId,
      }}
    >
      {children}
    </GameStoreContext.Provider>
  );
}
