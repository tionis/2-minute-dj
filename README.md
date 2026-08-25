# 2-Minute DJ

A second-screen music party game. A host runs the TV view while players join with a four-letter code, queue YouTube highlights, vote, and take turns as DJ.

## Architecture

- **Application server:** one self-hosted Express/Colyseus process serves the statically exported Next.js 16 frontend and authoritative WebSocket rooms on the same origin.
- **Persistence:** validated, versioned, fsync-backed room snapshots with a last-known-good backup on a mounted filesystem volume.
- **Identity:** random host and player credentials stored locally in each browser. No external identity provider is required.

Clients send explicit commands such as `queueSong`, `pause`, `kickPlayer`, and `endSession`. Only the server mutates shared state, creates timestamps, advances tracks, validates permissions, revokes kicked sessions, creates shareable summaries, and persists snapshots. Commands are retried with the same ID until acknowledged, making an acknowledgement lost during reconnect safe.

Rooms are disposed from memory after the final client leaves and expire from disk after 24 hours by default. Public, credential-free session summaries use short server-backed links and expire after 90 days.

## Requirements

- Node.js 22 or newer; Node.js 24 is used in CI and the container image.
- npm.
- Podman or another OCI-compatible container runtime for deployment.

## Local development

Install dependencies:

```bash
npm ci
```

Start the realtime server:

```bash
DATA_DIR=./data npm run dev:server
```

In another terminal, start Next.js:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run build:server
```

The test suite covers authoritative commands and timestamps, queue limits and ownership, voting windows, single-player advancement, kick revocation, command retry/deduplication, reconnect reservations, session summaries, expiry, corruption recovery, and persistent storage.

## Container

The `Containerfile` builds the frontend and server into one image. Room data is written to `/data`, which must be mounted persistently.

```bash
podman build --format docker -f Containerfile -t 2-minute-dj .
podman run --rm \
  --name 2-minute-dj \
  -p 2567:2567 \
  -v 2-minute-dj-data:/data:Z \
  2-minute-dj
```

Open `http://localhost:2567`. `GET /healthz` is the process liveness endpoint; `GET /readyz` additionally verifies that persistent storage is writable. In production, put this single port behind your own TLS terminator. [deploy/Caddyfile.example](deploy/Caddyfile.example) contains the complete Caddy configuration; WebSockets require no separate route.

## Deployment

The `Test and publish application image` workflow runs type checks, tests, both builds, and a combined-container HTTP/readiness smoke test. On `main` and version tags it publishes multi-architecture AMD64/ARM64 images using GitHub's automatic `GITHUB_TOKEN`:

```text
ghcr.io/tionis/2-minute-dj:latest
ghcr.io/tionis/2-minute-dj:sha-<commit>
ghcr.io/tionis/2-minute-dj:v<version>
```

No repository secret or frontend build variable is needed. If the GHCR package is private, authenticate Podman to GHCR on the deployment machine once; alternatively, make the package public.

### Podman Quadlet

Copy the supplied units to the rootless Quadlet directory and start the service:

```bash
mkdir -p ~/.config/containers/systemd
cp deploy/2-minute-dj.container deploy/2-minute-dj-data.volume \
  deploy/2-minute-dj-backup.service deploy/2-minute-dj-backup.timer \
  deploy/2-minute-dj-backup.sh ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user enable --now 2-minute-dj.service 2-minute-dj-backup.timer podman-auto-update.timer
```

For a rootless service that must start before login, enable lingering once as root with `loginctl enable-linger <user>`. The Quadlet is read-only, drops all Linux capabilities, mounts persistent room data, and opts into registry auto-updates. Pin the `Image=` line to a version tag if you prefer manual upgrades over `latest`.

Daily backups are written to `~/.local/state/2-minute-dj/backups` and retained for 14 days. Restore one while the service is stopped:

```bash
systemctl --user stop 2-minute-dj.service
podman volume import 2-minute-dj-data ~/.local/state/2-minute-dj/backups/<timestamp>.tar
systemctl --user start 2-minute-dj.service
```

The server listens on `0.0.0.0:2567` by default. `HOST`, `PORT`, `DATA_DIR`, `STATIC_DIR`, `ROOM_TTL_HOURS`, `SUMMARY_TTL_DAYS`, `ALLOWED_ORIGINS`, and `TRUST_PROXY` are configurable. Requests and WebSocket upgrades are restricted to their own public origin by default; `ALLOWED_ORIGINS` is a comma-separated escape hatch for intentional additional origins.

## License

MIT
