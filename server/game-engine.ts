import type { GameCommand, GameStateSnapshot, Player } from "../src/lib/types.js";
import { computeAdvanceToNextSong, getPlayerOrder } from "../src/lib/utils.js";

export interface Actor {
  role: "host" | "player";
  playerId?: string;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_QUEUE_ITEMS = 200;
const MAX_QUEUE_ITEMS_PER_PLAYER = 20;

export function createInitialState(code: string, creatorId: string): GameStateSnapshot {
  return {
    room: {
      id: crypto.randomUUID(), code, creatorId, status: "LOBBY", timerDuration: 120,
      autoSkip: true, allowSelfVoting: false, createdAt: Date.now(),
    },
    players: [],
    queueItems: [],
  };
}

function playerFor(state: GameStateSnapshot, actor: Actor): Player | undefined {
  return actor.playerId ? state.players.find((player) => player.id === actor.playerId) : undefined;
}

function requirePlayer(state: GameStateSnapshot, actor: Actor): Player {
  const player = playerFor(state, actor);
  if (actor.role !== "player" || !player) throw new Error("Player is no longer in this room");
  return player;
}

export function isModerator(state: GameStateSnapshot, actor: Actor): boolean {
  return actor.role === "host" || Boolean(playerFor(state, actor)?.isVip);
}

function requireModerator(state: GameStateSnapshot, actor: Actor): void {
  if (!isModerator(state, actor)) throw new Error("Moderator permission required");
}

function requireHost(actor: Actor): void {
  if (actor.role !== "host") throw new Error("Host permission required");
}

function cleanNickname(value: unknown): string {
  const nickname = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 12);
  if (!nickname) throw new Error("Nickname is required");
  return nickname;
}

function cleanOffset(value: unknown): number {
  const offset = Number(value);
  if (!Number.isFinite(offset)) throw new Error("Video offset must be finite");
  return Math.min(43_200, Math.max(0, Math.floor(offset)));
}

function removePlayer(state: GameStateSnapshot, playerId: string): void {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index === -1) throw new Error("Player not found");
  const wasActive = state.room.activePlayerId === playerId;
  const oldOrder = getPlayerOrder([...state.players], state.room.playerOrder);
  const oldIndex = oldOrder.indexOf(playerId);
  state.players.splice(index, 1);
  state.queueItems = state.queueItems.filter((item) => item.playerId !== playerId);
  state.room.playerOrder = state.room.playerOrder?.filter((id) => id !== playerId);
  if (wasActive) {
    state.room.currentTurnIndex = Math.max(-1, oldIndex - 1);
    state.room.currentVideoId = undefined;
    state.room.activePlayerId = undefined;
    state.room.activeQueueItemId = undefined;
    state.room.playbackStartedAt = undefined;
    state.room.currentStartTime = undefined;
    state.room.currentVideoOffset = undefined;
    if (state.room.status === "PLAYING") advanceState(state, false);
  }
}

function forceTurn(state: GameStateSnapshot, playerId: string, now: number): void {
  if (!state.players.some((player) => player.id === playerId)) throw new Error("Player not found");
  const order = getPlayerOrder([...state.players], state.room.playerOrder);
  const index = order.indexOf(playerId);
  if (state.room.activeQueueItemId) {
    const active = state.queueItems.find((item) => item.id === state.room.activeQueueItemId);
    if (active?.status === "PENDING") active.status = "PLAYED";
  }
  const next = state.queueItems
    .filter((item) => item.playerId === playerId && item.status === "PENDING")
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  state.room.playerOrder = order;
  state.room.currentTurnIndex = index;
  state.room.previousQueueItemId = state.room.activeQueueItemId;
  state.room.activePlayerId = playerId;
  state.room.activeQueueItemId = next?.id;
  state.room.currentVideoId = next?.videoId;
  state.room.currentStartTime = next?.highlightStart;
  state.room.currentVideoOffset = next?.highlightStart;
  state.room.playbackStartedAt = next ? now : undefined;
}

export function advanceState(state: GameStateSnapshot, markCurrentAsPlayed = true, now = Date.now()): void {
  const result = computeAdvanceToNextSong(state.room, state.players, state.queueItems, markCurrentAsPlayed);
  if (result.queueItemUpdates) {
    for (const [id, patch] of Object.entries(result.queueItemUpdates)) {
      const item = state.queueItems.find((candidate) => candidate.id === id);
      if (item) Object.assign(item, patch);
    }
  }
  Object.assign(state.room, result.roomUpdates);
  if (state.room.currentVideoId) state.room.playbackStartedAt = now;
}

export function applyCommand(state: GameStateSnapshot, actor: Actor, command: GameCommand, now = Date.now()): GameStateSnapshot {
  const next = structuredClone(state);
  if (!command || typeof command.type !== "string") throw new Error("Malformed command");

  switch (command.type) {
    case "queueSong": {
      const player = requirePlayer(next, actor);
      if (!/^[0-9a-f-]{36}$/i.test(command.queueItemId)) throw new Error("Invalid queue item ID");
      if (!VIDEO_ID.test(command.videoId)) throw new Error("Invalid YouTube video ID");
      if (next.queueItems.some((item) => item.id === command.queueItemId)) throw new Error("Queue item already exists");
      if (next.queueItems.length >= MAX_QUEUE_ITEMS) throw new Error("The room queue is full");
      const ownPending = next.queueItems.filter((item) => item.playerId === player.id && item.status === "PENDING").length;
      if (ownPending >= MAX_QUEUE_ITEMS_PER_PLAYER) throw new Error("You already have too many queued songs");
      const title = String(command.videoTitle ?? "Unknown Track").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
      next.queueItems.push({
        id: command.queueItemId, playerId: player.id, videoId: command.videoId,
        videoTitle: title || "Unknown Track", highlightStart: cleanOffset(command.highlightStart),
        status: "PENDING", createdAt: now,
      });
      break;
    }
    case "removeQueueItem": {
      const player = requirePlayer(next, actor);
      const item = next.queueItems.find((entry) => entry.id === command.queueItemId);
      if (!item) return next;
      if (!isModerator(next, actor) && item.playerId !== player.id) throw new Error("Cannot remove another player's song");
      if (item.id === next.room.activeQueueItemId) throw new Error("The currently playing song cannot be removed");
      if (item.status !== "PENDING") throw new Error("Only pending songs can be removed");
      next.queueItems = next.queueItems.filter((entry) => entry.id !== item.id);
      break;
    }
    case "vote": {
      const player = requirePlayer(next, actor);
      const item = next.queueItems.find((entry) => entry.id === command.queueItemId);
      if (!item) throw new Error("Song not found");
      if (item.id !== next.room.activeQueueItemId && item.id !== next.room.previousQueueItemId) throw new Error("Voting has closed for this song");
      if (!next.room.allowSelfVoting && item.playerId === player.id) throw new Error("Self-voting is disabled");
      const value = Number(command.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Vote must be between 0 and 100");
      item.votes = { ...(item.votes ?? {}), [player.id]: Math.round(value) };
      break;
    }
    case "renamePlayer":
      requirePlayer(next, actor).nickname = cleanNickname(command.nickname);
      break;
    case "leaveRoom":
      removePlayer(next, requirePlayer(next, actor).id);
      break;
    case "startGame":
      requireModerator(next, actor);
      if (next.room.status !== "LOBBY") throw new Error("The game has already started");
      next.room.status = "PLAYING";
      next.room.playbackStartedAt = undefined;
      break;
    case "pause":
      requireModerator(next, actor);
      if (next.room.status !== "PLAYING") throw new Error("The game is not playing");
      next.room.status = "PAUSED";
      next.room.pausedAt = now;
      if (command.videoOffset !== undefined) next.room.currentVideoOffset = cleanOffset(command.videoOffset);
      break;
    case "resume":
      requireModerator(next, actor);
      if (next.room.status !== "PAUSED") throw new Error("The game is not paused");
      next.room.status = "PLAYING";
      if (next.room.playbackStartedAt) next.room.playbackStartedAt += Math.max(0, now - (next.room.pausedAt ?? now));
      next.room.pausedAt = undefined;
      break;
    case "setTimer": {
      requireModerator(next, actor);
      const seconds = Math.round(Number(command.seconds));
      if (!Number.isFinite(seconds) || seconds < 15 || seconds > 600) throw new Error("Timer must be between 15 and 600 seconds");
      next.room.timerDuration = seconds;
      break;
    }
    case "addTime": {
      requireModerator(next, actor);
      const seconds = Math.round(Number(command.seconds));
      if (!next.room.playbackStartedAt || !Number.isFinite(seconds) || seconds < 1 || seconds > 300) throw new Error("Extra time must be between 1 and 300 seconds");
      next.room.playbackStartedAt += seconds * 1000;
      break;
    }
    case "setAutoSkip":
      requireModerator(next, actor);
      next.room.autoSkip = command.enabled === true;
      break;
    case "setSelfVoting":
      requireModerator(next, actor);
      next.room.allowSelfVoting = command.enabled === true;
      break;
    case "advance":
      requireModerator(next, actor);
      if (command.expectedQueueItemId && next.room.activeQueueItemId !== command.expectedQueueItemId) return next;
      if (command.currentStatus && next.room.activeQueueItemId) {
        const active = next.queueItems.find((item) => item.id === next.room.activeQueueItemId);
        if (active) active.status = command.currentStatus;
      }
      advanceState(next, command.currentStatus === undefined, now);
      break;
    case "kickPlayer":
      requireModerator(next, actor);
      removePlayer(next, command.playerId);
      break;
    case "setVip": {
      requireHost(actor);
      const player = next.players.find((entry) => entry.id === command.playerId);
      if (!player) throw new Error("Player not found");
      player.isVip = command.enabled || undefined;
      break;
    }
    case "forceTurn":
      requireModerator(next, actor);
      forceTurn(next, command.playerId, now);
      break;
    case "endSession": {
      requireModerator(next, actor);
      if (next.room.status === "FINISHED") return next;
      const active = next.queueItems.find((item) => item.id === next.room.activeQueueItemId);
      next.room.preEndState = {
        currentVideoId: next.room.currentVideoId, currentStartTime: next.room.currentStartTime,
        currentVideoOffset: next.room.currentVideoOffset, playbackStartedAt: next.room.playbackStartedAt,
        activePlayerId: next.room.activePlayerId, activeQueueItemId: next.room.activeQueueItemId,
        currentTurnIndex: next.room.currentTurnIndex, playerOrder: next.room.playerOrder,
        activeItemStatus: active?.status,
      };
      if (active?.status === "PENDING") active.status = "PLAYED";
      next.room.summaryId ??= crypto.randomUUID();
      next.room.status = "FINISHED";
      next.room.currentVideoId = undefined;
      next.room.activePlayerId = undefined;
      next.room.playbackStartedAt = undefined;
      next.room.pausedAt = undefined;
      break;
    }
    case "resumeSession": {
      requireModerator(next, actor);
      if (next.room.status !== "FINISHED") throw new Error("The session has not ended");
      const saved = next.room.preEndState;
      if (!saved) { next.room.status = "LOBBY"; break; }
      const activeId = typeof saved.activeQueueItemId === "string" ? saved.activeQueueItemId : undefined;
      const active = next.queueItems.find((item) => item.id === activeId);
      if (active && saved.activeItemStatus === "PENDING") active.status = "PENDING";
      next.room.status = "PAUSED";
      next.room.currentVideoId = typeof saved.currentVideoId === "string" ? saved.currentVideoId : undefined;
      next.room.currentStartTime = typeof saved.currentStartTime === "number" ? saved.currentStartTime : undefined;
      next.room.currentVideoOffset = typeof saved.currentVideoOffset === "number" ? saved.currentVideoOffset : next.room.currentStartTime;
      next.room.activePlayerId = typeof saved.activePlayerId === "string" ? saved.activePlayerId : undefined;
      next.room.activeQueueItemId = activeId;
      next.room.currentTurnIndex = typeof saved.currentTurnIndex === "number" ? saved.currentTurnIndex : undefined;
      next.room.playerOrder = Array.isArray(saved.playerOrder) ? saved.playerOrder.filter((id): id is string => typeof id === "string") : undefined;
      next.room.playbackStartedAt = typeof saved.playbackStartedAt === "number" ? saved.playbackStartedAt : undefined;
      next.room.pausedAt = now;
      next.room.preEndState = undefined;
      break;
    }
    case "closeRoom":
      requireHost(actor);
      break;
    default:
      throw new Error("Unknown command");
  }
  return next;
}

export function shouldAutoAdvance(state: GameStateSnapshot, now = Date.now()): boolean {
  if (state.room.status !== "PLAYING" || state.room.autoSkip === false || !state.room.currentVideoId || !state.room.playbackStartedAt) return false;
  return now - state.room.playbackStartedAt >= (state.room.timerDuration ?? 120) * 1000;
}

export function shouldStartQueuedSong(state: GameStateSnapshot): boolean {
  if (state.room.status !== "PLAYING" || state.room.currentVideoId) return false;
  const pending = state.queueItems.filter((item) => item.status === "PENDING");
  if (!state.room.activePlayerId) return pending.length > 0;
  return pending.some((item) => item.playerId === state.room.activePlayerId);
}

export function startQueuedSong(state: GameStateSnapshot, now = Date.now()): void {
  const waitingPlayer = state.room.activePlayerId;
  if (waitingPlayer && state.queueItems.some((item) => item.status === "PENDING" && item.playerId === waitingPlayer)) {
    forceTurn(state, waitingPlayer, now);
  } else {
    advanceState(state, true, now);
  }
}
