// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $streams: i.entity({
      abortReason: i.string().optional(),
      clientId: i.string().unique().indexed(),
      done: i.boolean().optional(),
      size: i.number().optional(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    players: i.entity({
      avatarSeed: i.string(),
      isVip: i.boolean().optional(),
      joinedAt: i.number(),
      nickname: i.string(),
      userId: i.string().indexed(),
    }),
    queueItems: i.entity({
      createdAt: i.number(),
      highlightStart: i.number(),
      playerId: i.string().indexed(),
      status: i.string(),
      videoId: i.string(),
      videoTitle: i.string().optional(),
      votes: i.any().optional(),
    }),
    rooms: i.entity({
      activePlayerId: i.string().optional(),
      activeQueueItemId: i.string().optional(),
      allowSelfVoting: i.boolean().optional(),
      autoSkip: i.boolean().optional(),
      code: i.string().unique().indexed(),
      createdAt: i.number(),
      creatorId: i.string().indexed(),
      currentStartTime: i.number().optional(),
      currentTurnIndex: i.number().optional(),
      currentVideoId: i.string().optional(),
      currentVideoOffset: i.number().optional(),
      pausedAt: i.number().optional(),
      playbackStartedAt: i.number().optional(),
      playerOrder: i.any().optional(),
      preEndState: i.any().optional(),
      previousQueueItemId: i.string().optional(),
      status: i.string(),
      timerDuration: i.number().optional(),
    }),
  },
  links: {
    $streams$files: {
      forward: {
        on: "$streams",
        has: "many",
        label: "$files",
      },
      reverse: {
        on: "$files",
        has: "one",
        label: "$stream",
        onDelete: "cascade",
      },
    },
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    playersRoom: {
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
    queueItemsPlayer: {
      forward: {
        on: "queueItems",
        has: "one",
        label: "player",
      },
      reverse: {
        on: "players",
        has: "many",
        label: "queueItems",
      },
    },
    queueItemsRoom: {
      forward: {
        on: "queueItems",
        has: "one",
        label: "room",
      },
      reverse: {
        on: "rooms",
        has: "many",
        label: "queueItems",
      },
    },
  },
  rooms: {},
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
