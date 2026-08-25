import type { Client } from "@colyseus/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandEnvelope, GameStateSnapshot } from "../src/lib/types.js";
import type { PublicSummary } from "../src/lib/types.js";
import { createInitialState } from "./game-engine.js";
import { GameRoom, GameRoomState } from "./game-room.js";
import type { PersistedRoom, RoomStore } from "./room-store.js";

class MemoryStore implements RoomStore {
  records = new Map<string, PersistedRoom>();
  load(code: string) { return this.records.get(code) ?? null; }
  save(code: string, room: PersistedRoom) { this.records.set(code, structuredClone(room)); }
  delete(code: string) { this.records.delete(code); }
  cleanupExpired() { return 0; }
  healthCheck() { return true; }
  loadSummary(id: string) { return [...this.summaries.values()].find((summary) => summary.id === id) ?? null; }
  saveSummary(summary: PublicSummary) { this.summaries.set(summary.id, structuredClone(summary)); }
  summaries = new Map<string, PublicSummary>();
}

function persisted(): PersistedRoom {
  const state: GameStateSnapshot = createInitialState("TEST", "host");
  state.players.push({ id: "alice", userId: "peer", nickname: "Alice", avatarSeed: "a", joinedAt: 1, connected: true });
  return { version: 1, state, hostToken: "host-secret-token-long", playerTokens: { alice: "alice-secret-token" },
    revokedTokens: [], processedCommands: [], updatedAt: Date.now() };
}

function fakeClient(auth: unknown) {
  return { auth, send: vi.fn(), leave: vi.fn() } as unknown as Client;
}

function setup() {
  const store = new MemoryStore(); const value = persisted(); store.save("TEST", value); GameRoom.store = store;
  const room = new GameRoom();
  Object.assign(room as any, { code: "TEST", persisted: structuredClone(value) });
  room.setState(new GameRoomState());
  return { room, store };
}

describe("GameRoom protocol", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("deduplicates retried command IDs while acknowledging every delivery", () => {
    const { room, store } = setup();
    const client = fakeClient({ role: "player", playerId: "alice", peerId: "peer", authToken: "alice-secret-token" });
    const envelope: CommandEnvelope = { id: "same-command", command: { type: "queueSong",
      queueItemId: "00000000-0000-4000-8000-000000000001", videoId: "dQw4w9WgXcQ", videoTitle: "Song", highlightStart: 0 } };
    (room as any).handleCommand(client, envelope); (room as any).handleCommand(client, envelope);
    expect(store.load("TEST")?.state.queueItems).toHaveLength(1);
    expect((client.send as any).mock.calls).toEqual([["ack", { id: "same-command", ok: true }], ["ack", { id: "same-command", ok: true }]]);
  });

  it("revokes a kicked session and disconnects its active client", () => {
    const { room, store } = setup();
    const host = fakeClient({ role: "host", peerId: "host", authToken: "host-secret-token-long" });
    const player = fakeClient({ role: "player", playerId: "alice", peerId: "peer", authToken: "alice-secret-token" });
    room.clients.push(player);
    (room as any).handleCommand(host, { id: "kick", command: { type: "kickPlayer", playerId: "alice" } });
    expect(store.load("TEST")?.playerTokens.alice).toBeUndefined();
    expect(store.load("TEST")?.revokedTokens).toContain("alice-secret-token");
    expect(player.leave).toHaveBeenCalledWith(4003, "You were removed from the room");
    expect(() => room.onAuth(player, { code: "TEST", mode: "player", authToken: "alice-secret-token", peerId: "peer", playerId: "alice", nickname: "Alice" })).toThrow("removed");
  });

  it("rejects oversized commands before applying them", () => {
    const { room, store } = setup(); const client = fakeClient({ role: "player", playerId: "alice" });
    (room as any).handleCommand(client, { id: "large", command: { type: "renamePlayer", nickname: "x".repeat(9_000) } });
    expect(store.load("TEST")?.state.players[0].nickname).toBe("Alice");
    expect(client.send).toHaveBeenCalledWith("ack", expect.objectContaining({ id: "large", ok: false }));
  });

  it("reserves a dropped player's seat for reconnection", async () => {
    const { room, store } = setup();
    const player = fakeClient({ role: "player", playerId: "alice", peerId: "peer", authToken: "alice-secret-token" });
    const reconnect = vi.spyOn(room, "allowReconnection").mockResolvedValue(player);
    await room.onDrop(player);
    expect(reconnect).toHaveBeenCalledWith(player, 90);
    expect(store.load("TEST")?.state.players[0].connected).toBe(false);
  });

  it("persists a credential-free public summary when a session ends", () => {
    const { room, store } = setup();
    const current = (room as any).persisted as PersistedRoom;
    current.state.room.status = "PLAYING";
    current.state.queueItems.push({ id: "00000000-0000-4000-8000-000000000001", playerId: "alice",
      videoId: "dQw4w9WgXcQ", videoTitle: "Song", highlightStart: 0, status: "PENDING", createdAt: 1 });
    current.state.room.activeQueueItemId = current.state.queueItems[0].id;
    current.state.room.currentVideoId = current.state.queueItems[0].videoId;
    const host = fakeClient({ role: "host", peerId: "host", authToken: "host-secret-token-long" });
    (room as any).handleCommand(host, { id: "end", command: { type: "endSession" } });
    const summary = [...store.summaries.values()][0];
    expect(summary.songs[0]).toMatchObject({ video_title: "Song", player_nickname: "Alice", status: "PLAYED" });
    expect(JSON.stringify(summary)).not.toContain("secret-token");
  });
});
