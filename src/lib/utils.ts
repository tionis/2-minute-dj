import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Player, QueueItem, GameState } from "./types";

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

/**
 * Get or initialize player order for turn-based gameplay.
 * Maintains existing order while adding new players at the end.
 */
export function getPlayerOrder(
  currentPlayers: Player[], 
  currentOrder?: string[]
): string[] {
  if (currentOrder && Array.isArray(currentOrder)) {
    // Keep existing players in their order
    const validPlayers = currentOrder.filter(
      pid => currentPlayers.some(p => p.id === pid)
    );
    // Add any new players at the end, sorted by join time
    const newPlayers = currentPlayers
      .filter(p => !validPlayers.includes(p.id))
      .sort((a, b) => a.joined_at - b.joined_at)
      .map(p => p.id);
    return [...validPlayers, ...newPlayers];
  }
  // Initial order: sort by join time
  return currentPlayers
    .sort((a, b) => a.joined_at - b.joined_at)
    .map(p => p.id);
}

/**
 * Advance to the next song in the queue.
 * This function mutates the Automerge doc directly.
 * Should be called inside an updateState callback.
 */
export function advanceToNextSong(doc: GameState, markCurrentAsPlayed = true): void {
  const currentActiveItem = doc.queue_items[doc.room.active_queue_item_id || ""];

  // Mark current item as played if requested
  if (currentActiveItem && markCurrentAsPlayed) {
    currentActiveItem.status = "PLAYED";
  }

  const currentPlayers = Object.values(doc.players);
  const playerOrder = getPlayerOrder(currentPlayers, doc.room.player_order);

  if (playerOrder.length === 0) {
    delete doc.room.current_video_id;
    delete doc.room.active_player_id;
    delete doc.room.active_queue_item_id;
    delete doc.room.playback_started_at;
    return;
  }

  // Find the next player with a song
  let nextTurnIndex = doc.room.current_turn_index ?? -1;
  let foundSong = false;
  let attempts = 0;

  while (attempts < playerOrder.length) {
    nextTurnIndex = nextTurnIndex + 1;
    const nextPlayerId = playerOrder[nextTurnIndex % playerOrder.length];
    
    // Find pending songs for this player
    const nextPlayerQueue = Object.values(doc.queue_items)
      .filter(q => q.status === "PENDING" && q.player_id === nextPlayerId)
      .sort((a, b) => a.created_at - b.created_at);
    
    if (nextPlayerQueue.length > 0) {
      const nextItem = nextPlayerQueue[0];
      doc.room.current_video_id = nextItem.video_id;
      doc.room.current_start_time = nextItem.highlight_start;
      doc.room.current_video_offset = nextItem.highlight_start;
      doc.room.playback_started_at = Date.now();
      doc.room.active_player_id = nextPlayerId;
      doc.room.active_queue_item_id = nextItem.id;
      doc.room.player_order = playerOrder;
      doc.room.current_turn_index = nextTurnIndex % playerOrder.length;
      foundSong = true;
      break;
    }
    attempts++;
  }

  if (!foundSong) {
    // No songs found for any player - just advance turn
    nextTurnIndex = (doc.room.current_turn_index ?? -1) + 1;
    const nextPlayerId = playerOrder[nextTurnIndex % playerOrder.length];

    delete doc.room.current_video_id;
    doc.room.active_player_id = nextPlayerId;
    delete doc.room.active_queue_item_id;
    delete doc.room.playback_started_at;
    delete doc.room.current_video_offset;
    doc.room.player_order = playerOrder;
    doc.room.current_turn_index = nextTurnIndex % playerOrder.length;
  }
}
