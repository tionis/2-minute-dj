// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    rooms: i.entity({
      code: i.string().unique().indexed(),
      status: i.string(), // "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED"
      current_video_id: i.string().optional(),
      current_start_time: i.number().optional(),
      current_video_offset: i.number().optional(), // Offset in video when paused (in seconds)
      playback_started_at: i.number().optional(),
      active_player_id: i.string().optional(), // Currently whose turn it is (player id)
      active_queue_item_id: i.string().optional(), // Currently playing queue item id
      timer_duration: i.number().optional(), // Default 120
      paused_at: i.number().optional(), // For pause functionality
      auto_skip: i.boolean().optional(), // Whether to auto-skip when timer ends (default true)
      player_order: i.json().optional(), // Array of player IDs for turn order
      current_turn_index: i.number().optional(), // Index in player_order for whose turn it is
      created_at: i.number(),
    }),
    players: i.entity({
      nickname: i.string(),
      avatar_seed: i.string(),
      is_online: i.boolean().optional(),
      is_vip: i.boolean().optional(), // VIP status
      joined_at: i.number(),
    }),
    queue_items: i.entity({
      video_id: i.string(),
      video_title: i.string().optional(), // Added title
      highlight_start: i.number(),
      status: i.string(), // "PENDING" | "PLAYED" | "SKIPPED"
      votes: i.json().optional(), // { [playerId]: 1 | -1 }
      created_at: i.number(),
    }),
  },
  links: {
    roomPlayers: {
      forward: {
        on: "players",
        has: "one",
        label: "room",
      },
      reverse: {
        on: "rooms",
        has: "many",
        label: "players",
      },
    },
    roomQueue: {
      forward: {
        on: "queue_items",
        has: "one",
        label: "room",
      },
      reverse: {
        on: "rooms",
        has: "many",
        label: "queue_items",
      },
    },
    playerQueue: {
      forward: {
        on: "queue_items",
        has: "one",
        label: "player",
      },
      reverse: {
        on: "players",
        has: "many",
        label: "queue_items",
      },
    },
  },
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
