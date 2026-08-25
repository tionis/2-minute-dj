import { Client, type Room as ColyseusRoom } from "@colyseus/sdk";
import type { CommandAck, CommandEnvelope, GameCommand, GameStateSnapshot } from "./types";
import { GameRoomState } from "./realtime-schema";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface ClientView {
  snapshot: GameStateSnapshot | null;
  status: ConnectionStatus;
  error: string | null;
  actionError: string | null;
}

interface PendingCommand {
  envelope: CommandEnvelope;
  attempts: number;
  deadline: number;
  timer?: ReturnType<typeof setTimeout>;
  resolve: () => void;
  reject: (error: Error) => void;
}

type Listener = (view: ClientView) => void;

export class RealtimeGameClient {
  private room: ColyseusRoom<any, GameRoomState> | null = null;
  private listeners = new Set<Listener>();
  private pending = new Map<string, PendingCommand>();
  private view: ClientView = { snapshot: null, status: "idle", error: null, actionError: null };
  private identity = "";
  private connecting: Promise<GameStateSnapshot> | null = null;
  private connectingIdentity = "";
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private intentionalDisconnect = false;
  private terminalReason: string | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.view);
    return () => this.listeners.delete(listener);
  }

  clearActionError(): void {
    if (this.view.actionError) this.setView({ ...this.view, actionError: null });
  }

  connectHost(code: string, peerId: string, authToken: string): Promise<GameStateSnapshot> {
    return this.connect("host", { code, peerId, authToken });
  }

  connectPlayer(code: string, peerId: string, playerId: string, authToken: string, nickname: string): Promise<GameStateSnapshot> {
    return this.connect("player", { code, peerId, playerId, authToken, nickname });
  }

  send(command: GameCommand): Promise<void> {
    if (!this.room || this.view.status === "idle" || this.view.status === "error") {
      const error = new Error("Not connected to the room server");
      this.setView({ ...this.view, actionError: error.message });
      return Promise.reject(error);
    }
    const envelope: CommandEnvelope = { id: crypto.randomUUID(), command };
    return new Promise<void>((resolve, reject) => {
      this.pending.set(envelope.id, {
        envelope, attempts: 0, deadline: Date.now() + 45_000,
        resolve: () => { this.setView({ ...this.view, actionError: null }); resolve(); },
        reject: (error) => { this.setView({ ...this.view, actionError: error.message }); reject(error); },
      });
      this.transmit(envelope.id);
    });
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const room = this.room;
    this.room = null;
    this.identity = "";
    this.rejectPending("Disconnected from room");
    if (room) await room.leave(true);
    this.setView({ snapshot: null, status: "idle", error: null, actionError: null });
  }

  private transmit(id: string): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    if (Date.now() >= pending.deadline || pending.attempts >= 6) {
      this.pending.delete(id);
      pending.reject(new Error("The room server did not acknowledge the action"));
      return;
    }
    if (this.room && this.view.status === "connected") {
      this.room.send("command", pending.envelope);
      pending.attempts += 1;
    }
    const delay = this.view.status === "connected" ? Math.min(8_000, 1_000 * 2 ** pending.attempts) : 500;
    pending.timer = setTimeout(() => this.transmit(id), delay);
  }

  private flushPending(): void {
    for (const id of this.pending.keys()) this.transmit(id);
  }

  private rejectPending(message: string): void {
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }

  private async connect(mode: "host" | "player", options: Record<string, string>): Promise<GameStateSnapshot> {
    const code = options.code.toUpperCase();
    const identity = `${mode}:${code}:${options.playerId ?? options.peerId}`;
    if (this.room && this.identity === identity && this.view.snapshot) return this.view.snapshot;
    if (this.connecting && this.connectingIdentity === identity) return this.connecting;
    if (this.room && this.identity !== identity) await this.disconnect();
    this.intentionalDisconnect = false;
    this.terminalReason = null;
    this.connectingIdentity = identity;
    const task = this.performConnect(mode, { ...options, code }, identity);
    this.connecting = task;
    try { return await task; }
    finally {
      if (this.connecting === task) { this.connecting = null; this.connectingIdentity = ""; }
    }
  }

  private async performConnect(mode: "host" | "player", options: Record<string, string>, identity: string): Promise<GameStateSnapshot> {
    const staleSnapshot = this.identity === identity ? this.view.snapshot : null;
    this.identity = identity;
    this.setView({ ...this.view, snapshot: staleSnapshot, status: staleSnapshot ? "reconnecting" : "connecting", error: null });
    try {
      const endpoint = window.location.port === "3000"
        ? `${window.location.protocol}//${window.location.hostname}:2567`
        : window.location.origin;
      const client = new Client(endpoint);
      const room = await client.joinOrCreate("game", { ...options, code: options.code, mode }, GameRoomState);
      this.room = room;
      this.reconnectAttempts = 0;
      room.reconnection.maxRetries = 30;
      room.reconnection.maxDelay = 5_000;
      room.reconnection.maxEnqueuedMessages = 32;

      room.onStateChange((state) => this.consumeState(state));
      room.onMessage<CommandAck>("ack", (ack) => this.consumeAck(ack));
      room.onMessage<{ reason?: string }>("kicked", (message) => this.markTerminal(message.reason || "You were removed from the room"));
      room.onMessage<{ reason?: string }>("roomClosed", (message) => this.markTerminal(message.reason || "The room was closed"));
      room.onDrop(() => this.setView({ ...this.view, status: "reconnecting", error: null }));
      room.onReconnect(() => { this.setView({ ...this.view, status: "connected", error: null }); this.flushPending(); });
      room.onLeave((_code, reason) => {
        if (this.room !== room) return;
        this.room = null;
        if (this.intentionalDisconnect || this.terminalReason) return;
        this.setView({ ...this.view, status: "reconnecting", error: null });
        this.scheduleReconnect(mode, options, reason || "Disconnected from room");
      });
      room.onError((_code, message) => this.setView({ ...this.view, status: "reconnecting", error: message || "Room connection failed" }));

      this.consumeState(room.state);
      if (!this.view.snapshot) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Room state timed out")), 5_000);
          room.onStateChange.once(() => { clearTimeout(timer); resolve(); });
        });
      }
      if (!this.view.snapshot) throw new Error("Room state is unavailable");
      this.flushPending();
      return this.view.snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to connect to the room";
      this.setView({ ...this.view, snapshot: staleSnapshot, status: staleSnapshot ? "reconnecting" : "error", error: message });
      throw error;
    }
  }

  private scheduleReconnect(mode: "host" | "player", options: Record<string, string>, lastReason: string): void {
    if (this.intentionalDisconnect || this.terminalReason || this.reconnectTimer) return;
    const delay = Math.min(10_000, 500 * 2 ** Math.min(this.reconnectAttempts, 5));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.reconnectAttempts += 1;
      void this.connect(mode, options).catch(() => {
        if (this.reconnectAttempts >= 30) {
          this.setView({ ...this.view, status: "error", error: lastReason });
          this.rejectPending(lastReason);
          return;
        }
        this.scheduleReconnect(mode, options, lastReason);
      });
    }, delay);
  }

  private markTerminal(reason: string): void {
    this.terminalReason = reason;
    this.setView({ ...this.view, status: "error", error: reason, actionError: reason });
    this.rejectPending(reason);
  }

  private consumeState(state: GameRoomState): void {
    if (!state?.snapshot) return;
    try {
      this.setView({ ...this.view, snapshot: JSON.parse(state.snapshot) as GameStateSnapshot, status: "connected", error: null });
    } catch {
      this.setView({ ...this.view, status: "error", error: "The room sent invalid state" });
    }
  }

  private consumeAck(ack: CommandAck): void {
    const pending = this.pending.get(ack.id);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    this.pending.delete(ack.id);
    if (ack.ok) pending.resolve();
    else pending.reject(new Error(ack.error || "Action rejected"));
  }

  private setView(view: ClientView): void {
    this.view = view;
    for (const listener of this.listeners) listener(view);
  }
}

export const realtimeGameClient = new RealtimeGameClient();
