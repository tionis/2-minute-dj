import {
  closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { GameStateSnapshot, PublicSummary } from "../src/lib/types.js";

export interface PersistedRoom {
  version: 1;
  state: GameStateSnapshot;
  hostToken: string;
  playerTokens: Record<string, string>;
  revokedTokens: string[];
  processedCommands: string[];
  updatedAt: number;
}

export interface RoomStore {
  load(code: string): PersistedRoom | null;
  save(code: string, room: PersistedRoom): void;
  delete(code: string): void;
  cleanupExpired(): number;
  healthCheck(): boolean;
  loadSummary(id: string): PublicSummary | null;
  saveSummary(summary: PublicSummary): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRoom(value: unknown): PersistedRoom {
  if (!isObject(value) || !isObject(value.state) || !isObject(value.state.room)) throw new Error("Invalid room snapshot");
  const state = value.state as unknown as GameStateSnapshot;
  if (!Array.isArray(state.players) || !Array.isArray(state.queueItems)) throw new Error("Invalid room collections");
  if (state.players.length > 50 || state.queueItems.length > 200) throw new Error("Room snapshot exceeds limits");
  if (typeof state.room.id !== "string" || !/^[A-Z]{4}$/.test(String(state.room.code))) throw new Error("Invalid room identity");
  if (!["LOBBY", "PLAYING", "PAUSED", "FINISHED"].includes(state.room.status) ||
      typeof state.room.creatorId !== "string" || typeof state.room.createdAt !== "number") throw new Error("Invalid room state");
  if (!state.players.every((player) => isObject(player) && typeof player.id === "string" &&
      typeof player.userId === "string" && typeof player.nickname === "string" &&
      typeof player.avatarSeed === "string" && typeof player.joinedAt === "number")) throw new Error("Invalid player record");
  if (!state.queueItems.every((item) => isObject(item) && typeof item.id === "string" &&
      typeof item.playerId === "string" && /^[A-Za-z0-9_-]{11}$/.test(String(item.videoId)) &&
      typeof item.highlightStart === "number" && Number.isFinite(item.highlightStart) &&
      ["PENDING", "PLAYED", "SKIPPED"].includes(item.status) && typeof item.createdAt === "number")) {
    throw new Error("Invalid queue record");
  }
  if (!isObject(value.playerTokens) || typeof value.hostToken !== "string" || value.hostToken.length < 16) throw new Error("Invalid room credentials");
  if (!Array.isArray(value.processedCommands) || !value.processedCommands.every((id) => typeof id === "string")) throw new Error("Invalid command history");
  if (value.revokedTokens !== undefined && (!Array.isArray(value.revokedTokens) || !value.revokedTokens.every((token) => typeof token === "string"))) throw new Error("Invalid revocation list");
  if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) throw new Error("Invalid room timestamp");
  return { ...value, version: 1, revokedTokens: value.revokedTokens ?? [] } as unknown as PersistedRoom;
}

function validateSummary(value: unknown): PublicSummary {
  if (!isObject(value) || typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id) ||
      typeof value.roomCode !== "string" || typeof value.createdAt !== "number" || !Array.isArray(value.songs) || value.songs.length > 200) {
    throw new Error("Invalid public summary");
  }
  if (!value.songs.every((song) => isObject(song) && typeof song.id === "string" &&
      /^[A-Za-z0-9_-]{11}$/.test(String(song.video_id)) && typeof song.video_title === "string" &&
      typeof song.player_nickname === "string" && Array.isArray(song.votes) &&
      song.votes.every((vote) => typeof vote === "number" && Number.isFinite(vote) && vote >= 0 && vote <= 100) &&
      ["PLAYED", "SKIPPED"].includes(String(song.status)))) throw new Error("Invalid summary song");
  return value as unknown as PublicSummary;
}

export class FileRoomStore implements RoomStore {
  constructor(
    private readonly directory: string,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly summaryTtlMs = 90 * 24 * 60 * 60 * 1000,
  ) {
    mkdirSync(directory, { recursive: true });
    mkdirSync(this.summaryDirectory(), { recursive: true });
  }

  private path(code: string): string {
    return join(this.directory, `${code.replace(/[^A-Z]/g, "")}.json`);
  }

  private summaryDirectory(): string { return join(this.directory, "summaries"); }
  private summaryPath(id: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid summary ID");
    return join(this.summaryDirectory(), `${id}.json`);
  }

  private read(path: string): PersistedRoom {
    if (statSync(path).size > 2 * 1024 * 1024) throw new Error("Room snapshot is too large");
    return validateRoom(JSON.parse(readFileSync(path, "utf8")));
  }

  load(code: string): PersistedRoom | null {
    const target = this.path(code);
    if (!existsSync(target)) return null;
    let room: PersistedRoom;
    try {
      room = this.read(target);
    } catch (error) {
      const backup = `${target}.bak`;
      if (!existsSync(backup)) throw error;
      room = this.read(backup);
      this.writeAtomic(target, room, false);
    }
    if (Date.now() - room.updatedAt > this.ttlMs) {
      this.delete(code);
      return null;
    }
    return room;
  }

  save(code: string, room: PersistedRoom): void {
    this.writeAtomic(this.path(code), validateRoom(room), true);
  }

  delete(code: string): void {
    const target = this.path(code);
    rmSync(target, { force: true });
    rmSync(`${target}.bak`, { force: true });
  }

  cleanupExpired(): number {
    let removed = 0;
    const cutoff = Date.now() - this.ttlMs;
    for (const name of readdirSync(this.directory)) {
      if (!/^[A-Z]{4}\.json$/.test(name)) continue;
      const target = join(this.directory, name);
      try {
        const room = this.read(target);
        if (room.updatedAt < cutoff) { this.delete(name.slice(0, 4)); removed++; }
      } catch {
        if (statSync(target).mtimeMs < cutoff) { this.delete(name.slice(0, 4)); removed++; }
      }
    }
    const summaryCutoff = Date.now() - this.summaryTtlMs;
    for (const name of readdirSync(this.summaryDirectory())) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue;
      const target = join(this.summaryDirectory(), name);
      try {
        const summary = validateSummary(JSON.parse(readFileSync(target, "utf8")));
        if (summary.createdAt < summaryCutoff) { rmSync(target, { force: true }); removed++; }
      } catch {
        if (statSync(target).mtimeMs < summaryCutoff) { rmSync(target, { force: true }); removed++; }
      }
    }
    return removed;
  }

  loadSummary(id: string): PublicSummary | null {
    const target = this.summaryPath(id);
    if (!existsSync(target)) return null;
    const summary = validateSummary(JSON.parse(readFileSync(target, "utf8")));
    if (Date.now() - summary.createdAt > this.summaryTtlMs) { rmSync(target, { force: true }); return null; }
    return summary;
  }

  saveSummary(summary: PublicSummary): void {
    const validated = validateSummary(summary);
    this.writeAtomic(this.summaryPath(validated.id), validated, false, this.summaryDirectory());
  }

  healthCheck(): boolean {
    const probe = join(this.directory, `.health-${process.pid}`);
    try {
      writeFileSync(probe, "ok", { mode: 0o600 });
      unlinkSync(probe);
      return true;
    } catch {
      return false;
    }
  }

  private writeAtomic(target: string, room: unknown, backupExisting: boolean, syncDirectory = this.directory): void {
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const descriptor = openSync(temporary, "w", 0o600);
    try {
      writeFileSync(descriptor, JSON.stringify(room));
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    if (backupExisting && existsSync(target)) copyFileSync(target, `${target}.bak`);
    renameSync(temporary, target);
    const directoryDescriptor = openSync(syncDirectory, "r");
    try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  }
}
