"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GameStoreContext } from "./game-context";
import { realtimeGameClient, type ConnectionStatus } from "./realtime-client";
import type { GameStateSnapshot } from "./types";

function getOrCreatePeerId(): string {
  let peerId = localStorage.getItem("2mdj_peer_id");
  if (!peerId) {
    peerId = crypto.randomUUID();
    localStorage.setItem("2mdj_peer_id", peerId);
  }
  return peerId;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [peerId] = useState(getOrCreatePeerId);
  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => realtimeGameClient.subscribe((view) => {
    setSnapshot(view.snapshot);
    setConnectionStatus(view.status);
    setConnectionError(view.error);
    setActionError(view.actionError);
  }), []);

  const connectHost = useCallback(
    (code: string, authToken: string) => realtimeGameClient.connectHost(code, peerId, authToken),
    [peerId],
  );
  const connectPlayer = useCallback(
    (code: string, playerId: string, authToken: string, nickname: string) =>
      realtimeGameClient.connectPlayer(code, peerId, playerId, authToken, nickname),
    [peerId],
  );

  return (
    <GameStoreContext.Provider value={{
      user: { id: peerId },
      isLoadingAuth: false,
      authError: null,
      peerId,
      snapshot,
      connectionStatus,
      connectionError,
      actionError,
      clearActionError: () => realtimeGameClient.clearActionError(),
      connectHost,
      connectPlayer,
      disconnect: () => realtimeGameClient.disconnect(),
    }}>
      {children}
      {actionError && (
        <div className="fixed bottom-4 left-1/2 z-[200] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between gap-4 rounded-2xl border border-red-500/40 bg-neutral-950/95 px-4 py-3 text-sm text-red-200 shadow-2xl backdrop-blur">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => realtimeGameClient.clearActionError()}
            className="shrink-0 rounded-lg px-2 py-1 font-bold text-white hover:bg-white/10"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
    </GameStoreContext.Provider>
  );
}
