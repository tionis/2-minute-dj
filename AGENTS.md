Act as a world-class senior frontend and realtime systems engineer. Generate complete, functional, reliable, and visually stunning applications.

# Core stack

- Next.js 16+ with React, TypeScript, App Router, and static export.
- Tailwind CSS with a mobile-first, responsive design.
- A self-hosted Colyseus 0.17 server for authoritative realtime rooms.
- Atomic filesystem snapshots for room recovery.
- YouTube IFrame Player API for host playback.
- A self-contained Podman-compatible OCI image serving both the frontend and realtime API.

# Architecture

This is a server-authoritative party game. Browsers never directly mutate canonical shared state.

- The host creates or restores a room identified by a four-letter code.
- Players connect to that room over WebSockets and send typed commands.
- `server/game-room.ts` authenticates the browser identity, acknowledges and deduplicates commands, persists state, and publishes snapshots.
- `server/game-engine.ts` validates permissions and performs deterministic state transitions.
- The server owns timers and automatic track advancement. Clients derive countdown displays from timestamps.
- `src/lib/realtime-client.ts` owns connection and reconnection behavior.
- `src/lib/store.tsx` exposes connection state to React.
- `src/lib/db.ts` exposes the explicit typed command surface used by components. Never reintroduce generic client-authored state patches.
- The exported frontend and WebSocket server share one origin in production. Local development uses Next.js on port 3000 and Colyseus on port 2567.

# Authority and permissions

- The host may manage the room, players, and queue.
- VIP players may perform moderator operations.
- Regular players may rename/remove themselves, manage their own pending songs, and cast only their own votes.
- Validate every command on the server even if the UI hides the corresponding control.
- Important client commands require acknowledgements and stable command IDs for safe retry/deduplication.
- Timestamps, playback transitions, session summaries, moderation side effects, and room lifecycle are server-owned.

# Reliability

- Preserve player records during temporary disconnects and allow reconnection.
- Treat server snapshots as the source of truth after reconnecting.
- Persist structural changes before acknowledging them.
- Bound and validate all client input and persisted data at runtime.
- Use absolute timestamps instead of broadcasting timer ticks.
- Keep rooms small and avoid storing media blobs; store YouTube metadata only.
- Do not introduce hosted databases, hosted realtime platforms, public P2P trackers, Automerge, or Trystero.

# Media and visuals

- Use the YouTube IFrame Player API directly.
- Account for mobile autoplay restrictions; playback occurs on the interacted-with host display.
- Preserve the high-energy dark neon visual language: indigo, purple, pink, responsive motion, and clear connection/recovery feedback.

# Verification

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:server`. Container changes must also pass `podman build --format docker -f Containerfile .` when Podman is available.
