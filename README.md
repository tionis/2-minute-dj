# 2-Minute DJ

A "second-screen" party game where users join a session hosted on a TV/Laptop using their phones. Each player queues music videos, but only a specific **2-minute highlight** of each song plays. The goal is high-energy, rapid-fire music sharing.

## How it Works

### Host (TV/Laptop)
- Acts as the main display and audio source.
- Generates a 4-letter room code for players to join.
- Plays the music video queue.
- Manages the game loop (2-minute timer, next song).

### Player (Phone)
- Joins the room using the 4-letter code.
- Searches for YouTube videos.
- Selects a specific 2-minute "clipper" window for the song.
- Submits the song to the queue.

## Tech Stack

- **Framework:** Next.js (React, TypeScript)
- **Styling:** Tailwind CSS
- **Database/Real-time:** InstantDB
- **Media:** YouTube IFrame Player API
- **Deployment:** Vercel

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd 2-minute-dj
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    - Create a `.env.local` file in the root directory.
    - Add your InstantDB App ID:
      ```env
      NEXT_PUBLIC_INSTANT_APP_ID=your_app_id_here
      ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Open the app:**
    - Navigate to `http://localhost:3000` in your browser.

## InstantDB Management

- **Push Schema:** `npx instant-cli push schema`
- **Push Permissions:** `npx instant-cli push perms`
- **Pull Changes:** `npx instant-cli pull`

## Contributing

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature`).
3.  Commit your changes (`git commit -m 'Add some feature'`).
4.  Push to the branch (`git push origin feature/your-feature`).
5.  Open a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Feedback

Got any feedback or questions? Join our [Discord](https://discord.gg/hgVf9R6SBm).
