"use client";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Room, Player, QueueItem } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getPlayerOrder(
  currentPlayers: Player[],
  currentOrder?: string[]
): string[] {
  if (currentOrder && Array.isArray(currentOrder) && currentOrder.length > 0) {
    const validPlayers = currentOrder.filter((pid) =>
      currentPlayers.some((p) => p.id === pid)
    );
    const newPlayers = currentPlayers
      .filter((p) => !validPlayers.includes(p.id))
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => p.id);
    return [...validPlayers, ...newPlayers];
  }
  return currentPlayers
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => p.id);
}

interface AdvanceResult {
  roomUpdates: Record<string, unknown>;
  queueItemUpdates: Record<string, unknown> | null;
}

export function computeAdvanceToNextSong(
  room: Room,
  players: Player[],
  queueItems: QueueItem[],
  markCurrentAsPlayed: boolean
): AdvanceResult {
  const queueItemUpdates: Record<string, unknown> = {};
  const roomUpdates: Record<string, unknown> = {};
  const pendingQueue = queueItems.filter((q) => q.status === "PENDING");

  const currentActiveItem = queueItems.find(
    (q) => q.id === room.activeQueueItemId
  );

  if (currentActiveItem && markCurrentAsPlayed) {
    queueItemUpdates[currentActiveItem.id] = { status: "PLAYED" };
  }

  const playerOrder = getPlayerOrder(players, room.playerOrder);
  roomUpdates.playerOrder = playerOrder;

  if (playerOrder.length === 0) {
    roomUpdates.currentVideoId = null;
    roomUpdates.activePlayerId = null;
    roomUpdates.activeQueueItemId = null;
    roomUpdates.playbackStartedAt = null;
    roomUpdates.currentStartTime = null;
    roomUpdates.currentVideoOffset = null;
    return { roomUpdates, queueItemUpdates: null };
  }

  let nextTurnIndex = room.currentTurnIndex ?? -1;
  let foundSong = false;
  let attempts = 0;

  while (attempts < playerOrder.length) {
    nextTurnIndex = nextTurnIndex + 1;
    const nextPlayerId = playerOrder[nextTurnIndex % playerOrder.length];

    const nextPlayerQueue = pendingQueue
      .filter((q) => q.playerId === nextPlayerId)
      .sort((a, b) => a.createdAt - b.createdAt);

    if (nextPlayerQueue.length > 0) {
      const nextItem = nextPlayerQueue[0];
      roomUpdates.currentVideoId = nextItem.videoId;
      roomUpdates.currentStartTime = nextItem.highlightStart;
      roomUpdates.currentVideoOffset = nextItem.highlightStart;
      roomUpdates.playbackStartedAt = Date.now();
      roomUpdates.activePlayerId = nextPlayerId;
      roomUpdates.activeQueueItemId = nextItem.id;
      roomUpdates.currentTurnIndex = nextTurnIndex % playerOrder.length;
      roomUpdates.previousQueueItemId = room.activeQueueItemId ?? null;
      foundSong = true;
      break;
    }
    attempts++;
  }

  if (!foundSong) {
    nextTurnIndex = (room.currentTurnIndex ?? -1) + 1;
    const nextPlayerId = playerOrder[nextTurnIndex % playerOrder.length];

    roomUpdates.currentVideoId = null;
    roomUpdates.activePlayerId = nextPlayerId;
    roomUpdates.activeQueueItemId = null;
    roomUpdates.playbackStartedAt = null;
    roomUpdates.currentStartTime = null;
    roomUpdates.currentVideoOffset = null;
    roomUpdates.currentTurnIndex = nextTurnIndex % playerOrder.length;
    roomUpdates.previousQueueItemId = room.activeQueueItemId ?? null;
  }

  return { roomUpdates, queueItemUpdates };
}
