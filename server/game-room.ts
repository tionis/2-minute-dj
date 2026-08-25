import { type Client, Room, ServerError } from "@colyseus/core";
import { defineTypes, Schema } from "@colyseus/schema";
import type { CommandEnvelope, PublicSummary } from "../src/lib/types.js";
import { advanceState, applyCommand, createInitialState, shouldAutoAdvance, shouldStartQueuedSong, startQueuedSong, type Actor } from "./game-engine.js";
import { FileRoomStore, type PersistedRoom, type RoomStore } from "./room-store.js";

export class GameRoomState extends Schema {
  snapshot = "";
  revision = 0;
}
defineTypes(GameRoomState, { snapshot: "string", revision: "number" });

interface JoinOptions {
  code: string;
  mode: "host" | "player";
  authToken: string;
  peerId: string;
  playerId?: string;
  nickname?: string;
}

interface AuthenticatedActor extends Actor {
  isNew?: boolean;
  nickname?: string;
  peerId: string;
  authToken: string;
}

export class GameRoom extends Room<{
  state: GameRoomState;
  metadata: { code: string };
}> {
  static store: RoomStore = new FileRoomStore(
    process.env.DATA_DIR ?? "./data",
    Number(process.env.ROOM_TTL_HOURS ?? 24) * 60 * 60 * 1000,
    Number(process.env.SUMMARY_TTL_DAYS ?? 90) * 24 * 60 * 60 * 1000,
  );

  private code = "";
  private persisted!: PersistedRoom;
  private closed = false;

  async onCreate(options: JoinOptions): Promise<void> {
    this.code = String(options.code ?? "").toUpperCase();
    if (!/^[A-Z]{4}$/.test(this.code)) throw new ServerError(400, "Invalid room code");

    let existing: PersistedRoom | null;
    try { existing = GameRoom.store.load(this.code); }
    catch (error) {
      console.error(JSON.stringify({ event: "room_load_failed", code: this.code, error: String(error) }));
      throw new ServerError(500, "Room data could not be restored");
    }
    if (existing) {
      this.persisted = existing;
    } else {
      if (options.mode !== "host" || !options.authToken || !options.peerId) {
        throw new ServerError(404, "Room not found");
      }
      this.persisted = {
        version: 1,
        state: createInitialState(this.code, options.peerId),
        hostToken: options.authToken,
        playerTokens: {},
        revokedTokens: [],
        processedCommands: [],
        updatedAt: Date.now(),
      };
      this.save();
    }

    // The host is a connection but is not part of the 50-player gameplay cap.
    // Leave a little headroom for reconnects while duplicate identities are rejected.
    this.maxClients = 64;
    this.maxMessagesPerSecond = 20;
    this.autoDispose = true;
    this.setState(new GameRoomState());
    await this.setMetadata({ code: this.code });
    this.publish();

    this.onMessage<CommandEnvelope>("command", (client, envelope) => {
      this.handleCommand(client, envelope);
    });

    this.setSimulationInterval(() => {
      if (shouldAutoAdvance(this.persisted.state) || shouldStartQueuedSong(this.persisted.state)) {
        const state = structuredClone(this.persisted.state);
        if (shouldStartQueuedSong(state)) startQueuedSong(state);
        else advanceState(state);
        try { this.commit({ ...this.persisted, state }); }
        catch (error) { console.error(JSON.stringify({ event: "room_tick_save_failed", code: this.code, error: String(error) })); }
      }
    }, 500);
  }

  onAuth(_client: Client, options: JoinOptions): AuthenticatedActor {
    if (String(options.code).toUpperCase() !== this.code) throw new ServerError(404, "Room not found");
    if (!options.authToken || !options.peerId) throw new ServerError(401, "Missing client identity");

    if (options.mode === "host") {
      if (options.authToken !== this.persisted.hostToken) throw new ServerError(403, "Host identity rejected");
      return { role: "host", peerId: options.peerId, authToken: options.authToken };
    }

    if (!options.playerId || !options.nickname?.trim()) throw new ServerError(400, "Player details are required");
    if (this.persisted.revokedTokens.includes(options.authToken)) throw new ServerError(403, "Player was removed from this room");
    const knownToken = this.persisted.playerTokens[options.playerId];
    if (knownToken && knownToken !== options.authToken) throw new ServerError(403, "Player identity rejected");
    if (!knownToken && this.persisted.state.players.length >= 50) throw new ServerError(429, "Room is full");
    if (this.clients.some((connected) => (connected.auth as AuthenticatedActor | undefined)?.playerId === options.playerId)) {
      throw new ServerError(409, "Player is already connected");
    }
    return {
      role: "player",
      playerId: options.playerId,
      peerId: options.peerId,
      authToken: options.authToken,
      nickname: options.nickname.trim().slice(0, 12),
      isNew: !knownToken,
    };
  }

  onJoin(client: Client): void {
    const actor = client.auth as AuthenticatedActor;
    if (actor.role === "player" && actor.playerId) {
      this.persisted.playerTokens[actor.playerId] = actor.authToken;
      const existing = this.persisted.state.players.find((player) => player.id === actor.playerId);
      if (existing) {
        existing.connected = true;
      } else {
        this.persisted.state.players.push({
          id: actor.playerId,
          userId: actor.peerId,
          nickname: actor.nickname ?? "DJ",
          avatarSeed: actor.nickname ?? actor.playerId,
          joinedAt: Date.now(),
          connected: true,
        });
      }
      this.saveAndPublish();
    }
  }

  async onDrop(client: Client): Promise<void> {
    this.setConnected(client, false);
    try { await this.allowReconnection(client, 90); } catch { /* terminal leave follows */ }
  }

  onReconnect(client: Client): void {
    this.setConnected(client, true);
  }

  onLeave(client: Client): void {
    this.setConnected(client, false);
  }

  private setConnected(client: Client, connected: boolean): void {
    if (this.closed) return;
    const actor = client.auth as AuthenticatedActor;
    if (actor?.playerId) {
      const player = this.persisted.state.players.find((candidate) => candidate.id === actor.playerId);
      if (player && player.connected !== connected) {
        player.connected = connected;
        this.saveAndPublish();
      }
    }
  }

  private handleCommand(client: Client, envelope: CommandEnvelope): void {
    try {
      if (!envelope?.id || envelope.id.length > 64 || !envelope.command) throw new Error("Malformed command");
      if (JSON.stringify(envelope).length > 8_192) throw new Error("Command is too large");
      if (this.persisted.processedCommands.includes(envelope.id)) {
        client.send("ack", { id: envelope.id, ok: true });
        return;
      }
      const state = applyCommand(this.persisted.state, client.auth as Actor, envelope.command);
      if (envelope.command.type === "closeRoom") {
        client.send("ack", { id: envelope.id, ok: true });
        this.closed = true;
        GameRoom.store.delete(this.code);
        this.broadcast("roomClosed", { reason: "The host closed this room" });
        this.clock.setTimeout(() => void this.disconnect(4000), 50);
        return;
      }
      const next = {
        ...this.persisted,
        state,
        playerTokens: { ...this.persisted.playerTokens },
        revokedTokens: [...this.persisted.revokedTokens],
        processedCommands: [...this.persisted.processedCommands.slice(-1023), envelope.id],
      };
      if (envelope.command.type === "kickPlayer") {
        const revoked = next.playerTokens[envelope.command.playerId];
        if (revoked) next.revokedTokens = [...next.revokedTokens.slice(-255), revoked];
        delete next.playerTokens[envelope.command.playerId];
      }
      if (envelope.command.type === "leaveRoom" && (client.auth as AuthenticatedActor).playerId) {
        delete next.playerTokens[(client.auth as AuthenticatedActor).playerId!];
      }
      if (envelope.command.type === "endSession") GameRoom.store.saveSummary(this.createSummary(state));
      this.commit(next);
      client.send("ack", { id: envelope.id, ok: true });
      if (envelope.command.type === "kickPlayer") this.disconnectPlayer(envelope.command.playerId, "You were removed from the room");
      if (envelope.command.type === "leaveRoom") this.clock.setTimeout(() => client.leave(4000, "Left room"), 25);
    } catch (error) {
      client.send("ack", { id: envelope?.id, ok: false, error: error instanceof Error ? error.message : "Command rejected" });
    }
  }

  private publish(): void {
    this.state.snapshot = JSON.stringify(this.persisted.state);
    this.state.revision += 1;
  }

  private save(): void {
    this.persisted.updatedAt = Date.now();
    GameRoom.store.save(this.code, this.persisted);
  }

  private saveAndPublish(): void {
    this.save();
    this.publish();
  }

  private commit(next: PersistedRoom): void {
    next.updatedAt = Date.now();
    GameRoom.store.save(this.code, next);
    this.persisted = next;
    this.publish();
  }

  private disconnectPlayer(playerId: string, reason: string): void {
    for (const connected of this.clients) {
      if ((connected.auth as AuthenticatedActor | undefined)?.playerId === playerId) {
        connected.send("kicked", { reason });
        connected.leave(4003, reason);
      }
    }
  }

  private createSummary(state: PersistedRoom["state"]): PublicSummary {
    const id = state.room.summaryId;
    if (!id) throw new Error("Summary ID is missing");
    return {
      id,
      roomCode: state.room.code,
      createdAt: Date.now(),
      songs: state.queueItems
        .filter((item) => item.status === "PLAYED" || item.status === "SKIPPED")
        .map((item) => ({
          id: item.id,
          video_id: item.videoId,
          video_title: item.videoTitle ?? "Unknown Track",
          player_nickname: state.players.find((player) => player.id === item.playerId)?.nickname ?? "Unknown",
          votes: Object.values(item.votes ?? {}),
          status: item.status as "PLAYED" | "SKIPPED",
        })),
    };
  }
}
