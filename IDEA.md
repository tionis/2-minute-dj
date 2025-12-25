# Project Specification: "2-Minute DJ" Web App

## 1. Core Concept

A "second-screen" party game where users join a session hosted on a TV/Laptop using their phones. Each player queues music videos, but only a specific **2-minute highlight** of each song plays. The goal is high-energy, rapid-fire music sharing.

## 2. Tech Stack

* **Frontend:** React (Vite), TypeScript, Tailwind CSS.
* **Backend/State:** **InstantDB** (for real-time sync, presence, and relational data).
* **Media:** YouTube IFrame Player API.
* **Hosting:** Vercel/Netlify (Static Web App).

## 3. Architecture Pattern: "Host Authority"

Since we are using a serverless DB (InstantDB) without a dedicated backend worker:

* **The Host (TV):** Is the "Source of Truth." It runs the game loop, manages the timer, enforces the 2-minute limit, and writes state transitions to the DB.
* **The Clients (Phones):** Are "Remote Controls." They write songs to the DB and read the current state to display UI.

---

## 4. Data Schema (InstantDB)

**Table: `rooms**`

* `id` (UUID): Unique ID.
* `code` (String): 4-letter join code (e.g., "ABCD").
* `status` (String): "LOBBY" | "PLAYING".
* `current_video_id` (String): YouTube Video ID currently playing.
* `current_start_time` (Number): The timestamp where the video started (seconds).
* `playback_started_at` (Number): Server timestamp (Date.now()) when the current song began.
* `active_player_id` (UUID): ID of the player whose song is playing.

**Table: `players**`

* `id` (UUID): User ID.
* `room_id` (UUID): Foreign Key.
* `nickname` (String).
* `avatar_seed` (String): For generating consistent avatars (e.g., DiceBear).
* `is_online` (Boolean): Managed via InstantDB presence/heartbeat.

**Table: `queue_items**`

* `id` (UUID).
* `room_id` (UUID).
* `player_id` (UUID).
* `video_id` (String): YouTube ID.
* `highlight_start` (Number): The user-selected start time (e.g., 120s).
* `status` (String): "PENDING" | "PLAYED" | "SKIPPED".
* `created_at` (Number).

---

## 5. Implementation Phases

### Phase 1: Connection & Lobby

**Goal:** A user can create a room on a laptop and join via phone.

1. **Landing Page:** Two buttons: "Host a Game" and "Join Game".
2. **Host View:** Generates a random 4-letter code. Creates a `room` entry. Subscribes to `players` where `room_id` matches. Displays list of joined players.
3. **Player View:** Input for `Code` and `Nickname`. Creates a `player` entry.
4. **InstantDB:** Set up `init` and basic permissions (anyone can create, only room members can read).

### Phase 2: The Player Logic (Phone)

**Goal:** Users can search and queue specific 2-minute chunks of songs.

1. **Search UI:** A text input that queries the YouTube Data API (or just accepts a URL for MVP to save quota).
2. **The "Clipper" UI:**
* Once a video is selected, show a slider representing the video duration.
* The "window" is fixed at 120 seconds wide.
* User drags the window to select their favorite part (e.g., 01:10 to 03:10).


3. **Queue Action:** Writes to `queue_items` table with `{ highlight_start: 70 }`.

### Phase 3: The Host Logic (TV)

**Goal:** The TV plays the video and handles the queue rotation.

1. **Queue Algorithm (Round Robin):**
* Get unique list of `players`.
* Find the next player in the cycle who has a `PENDING` song.
* Pick their oldest `PENDING` song.


2. **Playback Engine:**
* Embed YouTube IFrame.
* On `room.current_video_id` change -> Load video -> Seek to `current_start_time` -> Play.


3. **The Timer:**
* Host runs a `setInterval` checking `Date.now() - room.playback_started_at`.
* If `diff > 120 seconds` (or video ends), trigger "Next Song" logic.
* **Crucial:** "Next Song" logic marks current song `PLAYED` and updates `room` with new song details.



### Phase 4: Polish & "Juice"

1. **QR Code:** Host displays a QR code for the join URL.
2. **Sleep Prevention:** Use `navigator.wakeLock` on the Phone client.
3. **Visuals:** Dark mode interface. Large typography on TV.
4. **Skip Button:** If the song is bad, the Host (or a majority vote from Phones) can trigger the "Next Song" logic immediately.

---

## 6. Prompt for the Agent

*Copy and paste this into your coding agent to start Phase 1:*

> "I am building a web-based music party game using React, TypeScript, and InstantDB.
> **The App:**
> 1. **Host:** Runs on a TV/Laptop. Creates a room, displays a join code, manages the music queue, and plays YouTube videos.
> 2. **Client:** Runs on phones. Joins via code, searches YouTube videos, selects a 2-minute playback window, and adds to queue.
> 
> 
> **Task:**
> Set up the project structure using Vite. Install `instantdb` SDK.
> Create the basic `schema.ts` for InstantDB defining `rooms` and `players`.
> Implement the **Lobby Phase**:
> * A Host view that generates a room code and listens for players.
> * A Client view that inputs a code and adds a player to the DB.
> * Use Tailwind for basic styling (Dark mode).
> 
> 
> Please generate the code for the schema, the routing setup, and the basic Host/Client lobby components."
