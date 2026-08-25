import { defineRoom, defineServer, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { GameRoom } from "./game-room.js";

const port = Number(process.env.PORT ?? 2567);
const hostname = process.env.HOST ?? "0.0.0.0";
const configuredOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean),
);

function forwardedHost(headers: { get(name: string): string | null }): string {
  return (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0].trim();
}

function originAllowed(origin: string | undefined | null, host: string): boolean {
  if (!origin) return true;
  if (configuredOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.host === host) return true;
    return process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.port === "3000";
  } catch { return false; }
}

matchMaker.controller.getCorsHeaders = (headers) => {
  const origin = headers.get("origin");
  const allowed = originAllowed(origin, forwardedHost(headers));
  return {
    "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": allowed && origin ? origin : "null",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const metadataCache = new Map<string, { title: string; expiresAt: number }>();

const server = defineServer({
  gracefullyShutdown: false,
  transport: new WebSocketTransport({
    maxPayload: 16 * 1024,
    verifyClient: ({ origin, req }: { origin: string; req: IncomingMessage }) =>
      originAllowed(origin, String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "")),
  }),
  rooms: {
    game: defineRoom(GameRoom).filterBy(["code"]),
  },
  express: (app) => {
    app.set("trust proxy", process.env.TRUST_PROXY ?? "loopback");
    app.disable("x-powered-by");
    app.use((request: Request, response: Response, next: NextFunction) => {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
      response.setHeader("Content-Security-Policy", [
        "default-src 'self'", "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com",
        "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https://i.ytimg.com https://img.youtube.com",
        "frame-src https://www.youtube.com https://www.youtube-nocookie.com", "connect-src 'self'",
        "font-src 'self' data:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
      ].join("; "));
      if (process.env.NODE_ENV === "production") response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      const origin = request.get("origin");
      if (origin && !originAllowed(origin, request.get("x-forwarded-host") ?? request.get("host") ?? "")) {
        response.status(403).json({ error: "Origin not allowed" });
        return;
      }
      if (origin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Vary", "Origin");
      }
      if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response.status(204).end();
        return;
      }
      next();
    });
    app.use(["/matchmake", "/api"], (request: Request, response: Response, next: NextFunction) => {
      const now = Date.now();
      const key = request.ip || "unknown";
      const bucket = rateBuckets.get(key);
      const current = !bucket || bucket.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : bucket;
      current.count += 1;
      rateBuckets.set(key, current);
      response.setHeader("RateLimit-Limit", "120");
      response.setHeader("RateLimit-Remaining", String(Math.max(0, 120 - current.count)));
      if (current.count > 120) { response.status(429).json({ error: "Too many room requests" }); return; }
      next();
    });
    app.get("/healthz", (_request: Request, response: Response) => response.json({ ok: true }));
    app.get("/readyz", (_request: Request, response: Response) => {
      const ready = GameRoom.store.healthCheck();
      response.status(ready ? 200 : 503).json({ ok: ready });
    });
    app.get("/api/youtube-metadata", async (request: Request, response: Response) => {
      const videoId = String(request.query.videoId ?? "");
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) { response.status(400).json({ error: "Invalid YouTube video ID" }); return; }
      const cached = metadataCache.get(videoId);
      if (cached && cached.expiresAt > Date.now()) { response.json({ title: cached.title }); return; }
      try {
        const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
        const upstream = await fetch(url, { signal: AbortSignal.timeout(5_000) });
        if (!upstream.ok) throw new Error(`YouTube returned ${upstream.status}`);
        const data = await upstream.json() as { title?: unknown };
        const title = String(data.title ?? "Unknown Track").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || "Unknown Track";
        if (metadataCache.size >= 1_000) metadataCache.delete(metadataCache.keys().next().value!);
        metadataCache.set(videoId, { title, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
        response.json({ title });
      } catch (error) {
        console.error(JSON.stringify({ event: "youtube_metadata_failed", videoId, error: String(error) }));
        response.status(502).json({ error: "YouTube metadata is unavailable" });
      }
    });
    app.get("/api/summaries/:id", (request: Request, response: Response) => {
      try {
        const summary = GameRoom.store.loadSummary(String(request.params.id));
        if (!summary) { response.status(404).json({ error: "Summary not found" }); return; }
        response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
        response.json(summary);
      } catch {
        response.status(400).json({ error: "Invalid summary ID" });
      }
    });

    const staticDirectory = path.resolve(process.env.STATIC_DIR ?? "public");
    if (existsSync(staticDirectory)) app.use(express.static(staticDirectory, { extensions: ["html"] }));
  },
});

const maintenance = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key);
  for (const [key, entry] of metadataCache) if (entry.expiresAt <= now) metadataCache.delete(key);
  const removed = GameRoom.store.cleanupExpired();
  if (removed) console.log(JSON.stringify({ event: "expired_rooms_removed", count: removed }));
}, 60 * 60 * 1000);
maintenance.unref();

server.listen(port, hostname).then(() => {
  console.log(JSON.stringify({ event: "server_started", hostname, port }));
}).catch((error) => {
  console.error(JSON.stringify({ event: "server_start_failed", error: String(error) }));
  process.exitCode = 1;
});

let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(maintenance);
    console.log(JSON.stringify({ event: "server_stopping", signal }));
    void server.gracefullyShutdown(false).finally(() => process.exit(0));
  });
}
