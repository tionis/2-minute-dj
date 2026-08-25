export interface Room {
  id: string;
  code: string;
  creatorId: string;
  status: "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED";
  currentVideoId?: string;
  currentStartTime?: number;
  currentVideoOffset?: number;
  playbackStartedAt?: number;
  activePlayerId?: string;
  activeQueueItemId?: string;
  previousQueueItemId?: string;
  timerDuration?: number;
  pausedAt?: number;
  autoSkip?: boolean;
  allowSelfVoting?: boolean;
  playerOrder?: string[];
  currentTurnIndex?: number;
  preEndState?: Record<string, unknown>;
  summaryId?: string;
  createdAt: number;
}

export interface Player {
  id: string;
  userId: string;
  nickname: string;
  avatarSeed: string;
  isVip?: boolean;
  connected?: boolean;
  joinedAt: number;
}

export interface QueueItem {
  id: string;
  playerId: string;
  videoId: string;
  videoTitle?: string;
  highlightStart: number;
  status: "PENDING" | "PLAYED" | "SKIPPED";
  votes?: Record<string, number>;
  createdAt: number;
}

export interface GameStateSnapshot {
  room: Room;
  players: Player[];
  queueItems: QueueItem[];
}

export interface PublicSummarySong {
  id: string;
  video_id: string;
  video_title: string;
  player_nickname: string;
  votes: number[];
  status: "PLAYED" | "SKIPPED";
}

export interface PublicSummary {
  id: string;
  roomCode: string;
  songs: PublicSummarySong[];
  createdAt: number;
}

export type GameCommand =
  | { type: "queueSong"; queueItemId: string; videoId: string; videoTitle?: string; highlightStart: number }
  | { type: "removeQueueItem"; queueItemId: string }
  | { type: "vote"; queueItemId: string; value: number }
  | { type: "renamePlayer"; nickname: string }
  | { type: "leaveRoom" }
  | { type: "startGame" }
  | { type: "pause"; videoOffset?: number }
  | { type: "resume" }
  | { type: "endSession" }
  | { type: "resumeSession" }
  | { type: "setTimer"; seconds: number }
  | { type: "addTime"; seconds: number }
  | { type: "setAutoSkip"; enabled: boolean }
  | { type: "setSelfVoting"; enabled: boolean }
  | { type: "advance"; expectedQueueItemId?: string; currentStatus?: "PLAYED" | "SKIPPED" }
  | { type: "kickPlayer"; playerId: string }
  | { type: "setVip"; playerId: string; enabled: boolean }
  | { type: "forceTurn"; playerId: string }
  | { type: "closeRoom" };

export interface CommandEnvelope {
  id: string;
  command: GameCommand;
}

export interface CommandAck {
  id: string;
  ok: boolean;
  error?: string;
}
