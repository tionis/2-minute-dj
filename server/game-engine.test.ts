import { describe, expect, it } from "vitest";
import type { GameStateSnapshot, Player, QueueItem } from "../src/lib/types.js";
import { advanceState, applyCommand, shouldAutoAdvance, shouldStartQueuedSong, startQueuedSong } from "./game-engine.js";

const SONG_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_SONG_ID = "00000000-0000-4000-8000-000000000002";

function fixture(): GameStateSnapshot {
  const players: Player[] = [
    { id: "alice", userId: "a", nickname: "Alice", avatarSeed: "a", joinedAt: 1 },
    { id: "bob", userId: "b", nickname: "Bob", avatarSeed: "b", joinedAt: 2 },
  ];
  return {
    room: { id: "room", code: "TEST", creatorId: "host", status: "LOBBY", createdAt: 1, timerDuration: 120 },
    players,
    queueItems: [],
  };
}

function song(id = SONG_ID, playerId = "alice"): QueueItem {
  return { id, playerId, videoId: "dQw4w9WgXcQ", highlightStart: 10, status: "PENDING", createdAt: 1 };
}

describe("authoritative game engine", () => {
  it("validates and queues a song only for an active player", () => {
    const next = applyCommand(fixture(), { role: "player", playerId: "alice" }, {
      type: "queueSong", queueItemId: SONG_ID, videoId: "dQw4w9WgXcQ", videoTitle: "Song", highlightStart: 12,
    }, 100);
    expect(next.queueItems[0]).toMatchObject({ playerId: "alice", status: "PENDING", highlightStart: 12, createdAt: 100 });
    expect(() => applyCommand(fixture(), { role: "player", playerId: "removed" }, {
      type: "queueSong", queueItemId: SONG_ID, videoId: "dQw4w9WgXcQ", highlightStart: 0,
    })).toThrow("no longer");
    expect(() => applyCommand(fixture(), { role: "player", playerId: "alice" }, {
      type: "queueSong", queueItemId: SONG_ID, videoId: "bad!", highlightStart: 0,
    })).toThrow("YouTube");
  });

  it("uses explicit moderator commands and server time", () => {
    const state = fixture();
    expect(() => applyCommand(state, { role: "player", playerId: "alice" }, { type: "startGame" }, 500)).toThrow("Moderator");
    state.players[0].isVip = true;
    const started = applyCommand(state, { role: "player", playerId: "alice" }, { type: "startGame" }, 500);
    expect(started.room.status).toBe("PLAYING");
    const withSong = { ...started, queueItems: [song()] };
    advanceState(withSong, true, 1_000);
    const paused = applyCommand(withSong, { role: "host" }, { type: "pause", videoOffset: 42 }, 2_000);
    expect(paused.room).toMatchObject({ status: "PAUSED", pausedAt: 2_000, currentVideoOffset: 42 });
    const resumed = applyCommand(paused, { role: "host" }, { type: "resume" }, 5_000);
    expect(resumed.room.playbackStartedAt).toBe(4_000);
  });

  it("allows only the submitting player to vote and only during the voting window", () => {
    const state = fixture();
    state.room.allowSelfVoting = true;
    state.queueItems.push(song(SONG_ID, "bob"));
    state.room.activeQueueItemId = SONG_ID;
    const next = applyCommand(state, { role: "player", playerId: "alice" }, { type: "vote", queueItemId: SONG_ID, value: 82 });
    expect(next.queueItems[0].votes).toEqual({ alice: 82 });
    state.room.activeQueueItemId = undefined;
    expect(() => applyCommand(state, { role: "player", playerId: "alice" }, { type: "vote", queueItemId: SONG_ID, value: 50 })).toThrow("closed");
  });

  it("does not replay the active song when no other player has music", () => {
    const state = fixture();
    state.players = [state.players[0]];
    state.queueItems = [song()];
    state.room.status = "PLAYING";
    advanceState(state, true, 1_000);
    expect(state.room.activeQueueItemId).toBe(SONG_ID);
    advanceState(state, true, 2_000);
    expect(state.queueItems[0].status).toBe("PLAYED");
    expect(state.room.activeQueueItemId).toBeNull();
    expect(state.room.currentVideoId).toBeNull();
  });

  it("advances fairly and detects server timer transitions", () => {
    const state = fixture();
    state.queueItems = [song(), { ...song(SECOND_SONG_ID, "bob"), createdAt: 2 }];
    state.room.status = "PLAYING";
    expect(shouldStartQueuedSong(state)).toBe(true);
    advanceState(state, true, 1_000);
    expect(state.room.activeQueueItemId).toBe(SONG_ID);
    expect(shouldAutoAdvance(state, 121_000)).toBe(true);
    advanceState(state, true, 121_000);
    expect(state.queueItems[0].status).toBe("PLAYED");
    expect(state.room.activeQueueItemId).toBe(SECOND_SONG_ID);
  });

  it("starts a song added by the player whose empty turn is waiting", () => {
    const state = fixture(); state.room.status = "PLAYING"; state.room.activePlayerId = "alice";
    state.room.playerOrder = ["alice", "bob"]; state.room.currentTurnIndex = 0;
    state.queueItems = [song(), { ...song(SECOND_SONG_ID, "bob"), createdAt: 2 }];
    expect(shouldStartQueuedSong(state)).toBe(true); startQueuedSong(state, 5_000);
    expect(state.room.activeQueueItemId).toBe(SONG_ID); expect(state.room.currentTurnIndex).toBe(0);
  });

  it("prevents deleting the active or completed song", () => {
    const state = fixture(); state.queueItems = [song()]; state.room.activeQueueItemId = SONG_ID;
    expect(() => applyCommand(state, { role: "player", playerId: "alice" }, { type: "removeQueueItem", queueItemId: SONG_ID })).toThrow("currently playing");
    state.room.activeQueueItemId = undefined; state.queueItems[0].status = "PLAYED";
    expect(() => applyCommand(state, { role: "player", playerId: "alice" }, { type: "removeQueueItem", queueItemId: SONG_ID })).toThrow("pending");
  });

  it("removes an active kicked player without dangling playback state", () => {
    const state = fixture(); state.room.status = "PLAYING"; state.queueItems = [song(), { ...song(SECOND_SONG_ID, "bob"), createdAt: 2 }];
    advanceState(state, true, 1_000);
    const next = applyCommand(state, { role: "host" }, { type: "kickPlayer", playerId: "alice" }, 2_000);
    expect(next.players.map((player) => player.id)).toEqual(["bob"]);
    expect(next.queueItems.map((item) => item.playerId)).toEqual(["bob"]);
    expect(next.room.activeQueueItemId).toBe(SECOND_SONG_ID);
  });

  it("restricts VIP assignment to the host", () => {
    const state = fixture(); state.players[0].isVip = true;
    expect(() => applyCommand(state, { role: "player", playerId: "alice" }, { type: "setVip", playerId: "bob", enabled: true })).toThrow("Host");
    expect(applyCommand(state, { role: "host" }, { type: "setVip", playerId: "bob", enabled: true }).players[1].isVip).toBe(true);
  });

  it("ends and resumes a session without losing the active queue state", () => {
    const state = fixture(); state.room.status = "PLAYING"; state.queueItems = [song()]; advanceState(state, true, 1_000);
    const ended = applyCommand(state, { role: "host" }, { type: "endSession" }, 2_000);
    expect(ended.room.status).toBe("FINISHED"); expect(ended.queueItems[0].status).toBe("PLAYED");
    const resumed = applyCommand(ended, { role: "host" }, { type: "resumeSession" }, 3_000);
    expect(resumed.room.status).toBe("PAUSED"); expect(resumed.room.activeQueueItemId).toBe(SONG_ID); expect(resumed.queueItems[0].status).toBe("PENDING");
  });
});
