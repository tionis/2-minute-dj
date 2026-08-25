import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createInitialState } from "./game-engine.js";
import { FileRoomStore, type PersistedRoom } from "./room-store.js";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function setup(ttlMs?: number): [string, FileRoomStore] {
  const directory = mkdtempSync(join(tmpdir(), "two-minute-dj-")); directories.push(directory);
  return [directory, new FileRoomStore(directory, ttlMs)];
}

function record(updatedAt = Date.now()): PersistedRoom {
  return { version: 1, state: createInitialState("TEST", "host"), hostToken: "host-secret-token-long",
    playerTokens: { alice: "player-secret" }, revokedTokens: [], processedCommands: ["command"], updatedAt };
}

describe("FileRoomStore", () => {
  it("durably persists and restores validated room snapshots", () => {
    const [directory, store] = setup(); const value = record(); store.save("TEST", value);
    expect(store.load("TEST")).toEqual(value);
    expect(JSON.parse(readFileSync(join(directory, "TEST.json"), "utf8"))).toEqual(value);
    expect(store.healthCheck()).toBe(true);
  });

  it("recovers the previous snapshot when the primary file is corrupt", () => {
    const [directory, store] = setup(); const first = record(); store.save("TEST", first);
    const second = record(Date.now() + 1); second.state.room.status = "PLAYING"; store.save("TEST", second);
    writeFileSync(join(directory, "TEST.json"), "not json");
    expect(store.load("TEST")?.state.room.status).toBe("LOBBY");
  });

  it("expires and deletes stale rooms", () => {
    const [directory, store] = setup(10); store.save("TEST", record(Date.now() - 100));
    expect(store.load("TEST")).toBeNull();
    expect(() => readFileSync(join(directory, "TEST.json"))).toThrow();
  });

  it("deletes room credentials and snapshots", () => {
    const [, store] = setup(); store.save("TEST", record()); store.delete("TEST"); expect(store.load("TEST")).toBeNull();
  });

  it("stores expiring public summaries separately from room credentials", () => {
    const [, store] = setup();
    const summary = { id: "00000000-0000-4000-8000-000000000099", roomCode: "TEST", createdAt: Date.now(), songs: [{
      id: "song", video_id: "dQw4w9WgXcQ", video_title: "Song", player_nickname: "Alice", votes: [80], status: "PLAYED" as const,
    }] };
    store.saveSummary(summary);
    expect(store.loadSummary(summary.id)).toEqual(summary);
    expect(store.load("TEST")).toBeNull();
  });

  it("returns null for unknown rooms", () => { const [, store] = setup(); expect(store.load("NONE")).toBeNull(); });
});
