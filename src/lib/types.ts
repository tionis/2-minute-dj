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
  createdAt: number;
}

export interface Player {
  id: string;
  userId: string;
  nickname: string;
  avatarSeed: string;
  isVip?: boolean;
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
