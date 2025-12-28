export interface Room {
  id: string;
  code: string;
  status: "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED";
  current_video_id?: string;
  current_start_time?: number;
  current_video_offset?: number;
  playback_started_at?: number;
  active_player_id?: string;
  active_queue_item_id?: string;
  timer_duration?: number;
  paused_at?: number;
  auto_skip?: boolean;
  allow_self_voting?: boolean;
  player_order?: string[];
  current_turn_index?: number;
  created_at: number;
}

export interface Player {
  id: string;
  nickname: string;
  avatar_seed: string;
  is_online?: boolean;
  is_vip?: boolean;
  joined_at: number;
}

export interface QueueItem {
  id: string;
  video_id: string;
  video_title?: string;
  highlight_start: number;
  status: "PENDING" | "PLAYED" | "SKIPPED";
  votes?: Record<string, number>;
  created_at: number;
  player_id: string;
  room_id: string; // Kept for compatibility, though implied by document context
}

export interface GameState {
  room: Room;
  players: Record<string, Player>;
  queue_items: Record<string, QueueItem>;
}
