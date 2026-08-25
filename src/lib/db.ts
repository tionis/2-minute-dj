"use client";

import { useGameStore } from "./game-context";
import { realtimeGameClient } from "./realtime-client";
import type { GameCommand } from "./types";

function send(command: GameCommand): Promise<void> {
  return realtimeGameClient.send(command);
}

const db = {
  useQuery(query: unknown) {
    const { snapshot, connectionStatus, connectionError } = useGameStore();
    if (!query) return { data: undefined, isLoading: false, error: null };
    const room = snapshot ? { ...snapshot.room, players: snapshot.players, queueItems: snapshot.queueItems } : null;
    return {
      data: room ? { rooms: [room] } : undefined,
      isLoading: (!snapshot && connectionStatus !== "error") || connectionStatus === "connecting" || connectionStatus === "reconnecting",
      error: connectionError ? new Error(connectionError) : null,
    };
  },

  queueSong: (queueItemId: string, videoId: string, videoTitle: string, highlightStart: number) =>
    send({ type: "queueSong", queueItemId, videoId, videoTitle, highlightStart }),
  removeQueueItem: (queueItemId: string) => send({ type: "removeQueueItem", queueItemId }),
  vote: (queueItemId: string, value: number) => send({ type: "vote", queueItemId, value }),
  renamePlayer: (nickname: string) => send({ type: "renamePlayer", nickname }),
  leaveRoom: () => send({ type: "leaveRoom" }),
  startGame: () => send({ type: "startGame" }),
  pause: (videoOffset?: number) => send({ type: "pause", videoOffset }),
  resume: () => send({ type: "resume" }),
  endSession: () => send({ type: "endSession" }),
  resumeSession: () => send({ type: "resumeSession" }),
  setTimer: (seconds: number) => send({ type: "setTimer", seconds }),
  addTime: (seconds: number) => send({ type: "addTime", seconds }),
  setAutoSkip: (enabled: boolean) => send({ type: "setAutoSkip", enabled }),
  setSelfVoting: (enabled: boolean) => send({ type: "setSelfVoting", enabled }),
  advance: (expectedQueueItemId?: string, currentStatus?: "PLAYED" | "SKIPPED") =>
    send({ type: "advance", expectedQueueItemId, currentStatus }),
  kickPlayer: (playerId: string) => send({ type: "kickPlayer", playerId }),
  setVip: (playerId: string, enabled: boolean) => send({ type: "setVip", playerId, enabled }),
  forceTurn: (playerId: string) => send({ type: "forceTurn", playerId }),
  closeRoom: () => send({ type: "closeRoom" }),
};

export default db;
