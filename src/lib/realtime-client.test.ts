import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const messageHandlers = new Map<string, (message: any) => void>();
const room = {
  state: { snapshot: JSON.stringify({ room: { id: "r", code: "TEST", creatorId: "host", status: "LOBBY", createdAt: 1 }, players: [], queueItems: [] }), revision: 1 },
  reconnection: {},
  send: vi.fn(),
  leave: vi.fn(async () => undefined),
  onStateChange: Object.assign(vi.fn(), { once: vi.fn() }),
  onMessage: vi.fn((type: string, handler: (message: any) => void) => { messageHandlers.set(type, handler); }),
  onDrop: vi.fn(), onReconnect: vi.fn(), onLeave: vi.fn(), onError: vi.fn(),
};

vi.mock("@colyseus/sdk", () => ({
  Client: class { async joinOrCreate() { return room; } },
}));

import { RealtimeGameClient } from "./realtime-client";

describe("RealtimeGameClient command delivery", () => {
  beforeEach(() => {
    vi.useFakeTimers(); room.send.mockClear(); messageHandlers.clear();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { port: "2567", origin: "https://dj.example", protocol: "https:", hostname: "dj.example" } } });
  });
  afterEach(() => vi.useRealTimers());

  it("retries with the same command ID until the server acknowledges it", async () => {
    const client = new RealtimeGameClient();
    await client.connectHost("TEST", "host", "host-secret-token-long");
    const result = client.send({ type: "startGame" });
    expect(room.send).toHaveBeenCalledTimes(1);
    const firstEnvelope = room.send.mock.calls[0][1];
    await vi.advanceTimersByTimeAsync(2_100);
    expect(room.send).toHaveBeenCalledTimes(2);
    expect(room.send.mock.calls[1][1]).toEqual(firstEnvelope);
    messageHandlers.get("ack")?.({ id: firstEnvelope.id, ok: true });
    await expect(result).resolves.toBeUndefined();
  });
});
