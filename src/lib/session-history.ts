/**
 * Session History Management
 * Stores session snapshots in localStorage for later viewing/downloading
 */

export interface SessionSong {
  id: string;
  video_id: string;
  video_title: string;
  player_nickname: string;
  votes: number[];
  status: "PLAYED" | "SKIPPED";
}

export interface SessionSnapshot {
  id: string;
  roomCode: string;
  songs: SessionSong[];
  playerCount: number;
  endedAt: number;
  role: "host" | "player";
}

const STORAGE_KEY = "2mdj_session_history";
const MAX_SESSIONS = 20; // Keep last 20 sessions

/**
 * Get all stored sessions
 */
export function getSessionHistory(): SessionSnapshot[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const sessions = JSON.parse(stored) as SessionSnapshot[];
    // Sort by endedAt descending (newest first)
    return sessions.sort((a, b) => b.endedAt - a.endedAt);
  } catch {
    console.error("Failed to load session history");
    return [];
  }
}

/**
 * Save a new session to history
 */
export function saveSession(session: Omit<SessionSnapshot, "id">): void {
  if (typeof window === "undefined") return;
  
  try {
    const sessions = getSessionHistory();
    
    // Check if we already have this session (same roomCode and similar endedAt)
    const existingIndex = sessions.findIndex(
      s => s.roomCode === session.roomCode && 
           Math.abs(s.endedAt - session.endedAt) < 60000 // Within 1 minute
    );
    
    const newSession: SessionSnapshot = {
      ...session,
      id: crypto.randomUUID(),
    };
    
    if (existingIndex >= 0) {
      // Update existing session
      sessions[existingIndex] = { ...newSession, id: sessions[existingIndex].id };
    } else {
      // Add new session at the beginning
      sessions.unshift(newSession);
    }
    
    // Keep only the last MAX_SESSIONS
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to save session:", error);
  }
}

/**
 * Delete a specific session by ID
 */
export function deleteSession(sessionId: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const sessions = getSessionHistory();
    const filtered = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to delete session:", error);
  }
}

/**
 * Clear all session history
 */
export function clearAllSessions(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear sessions:", error);
  }
}

/**
 * Get a specific session by ID
 */
export function getSession(sessionId: string): SessionSnapshot | null {
  const sessions = getSessionHistory();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Generate shareable URL for a session
 */
export function generateShareUrl(session: SessionSnapshot): string {
  if (typeof window === "undefined") return "";
  
  // Use the same compression as SummaryView
  const LZString = require("lz-string");
  
  const summaryData = {
    roomCode: session.roomCode,
    songs: session.songs,
  };
  
  const json = JSON.stringify(summaryData);
  const compressed = LZString.compressToEncodedURIComponent(json);
  
  return `${window.location.origin}/summary?data=${compressed}`;
}

/**
 * Generate HTML content for a session (for download)
 */
export function generateSessionHTML(session: SessionSnapshot): string {
  const calculateScore = (votes: number[]) => {
    if (!votes || votes.length === 0) return null;
    const sum = votes.reduce((a, b) => a + b, 0);
    return Math.round(sum / votes.length);
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2-Minute DJ Session - ${session.roomCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 40px 20px; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 2.5rem; text-align: center; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #888; margin-bottom: 40px; font-size: 1.1rem; }
    .song { display: flex; align-items: center; gap: 16px; padding: 16px; background: #1a1a1a; border-radius: 12px; margin-bottom: 12px; border: 1px solid #333; }
    .song:hover { border-color: #6366f1; }
    .thumbnail { width: 80px; height: 60px; border-radius: 8px; object-fit: cover; background: #333; flex-shrink: 0; }
    .info { flex: 1; min-width: 0; }
    .title { font-weight: 600; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dj { color: #888; font-size: 0.875rem; }
    .score { padding: 6px 12px; border-radius: 8px; font-weight: 600; font-size: 0.875rem; }
    .score.good { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .score.bad { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .score.neutral { background: #333; color: #888; }
    .skipped { font-size: 0.65rem; background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 999px; margin-left: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .link { color: #6366f1; text-decoration: none; padding: 8px; border-radius: 8px; background: #1a1a1a; }
    .link:hover { background: rgba(99, 102, 241, 0.2); }
    .index { width: 32px; height: 32px; border-radius: 50%; background: #262626; display: flex; align-items: center; justify-content: center; color: #888; font-size: 0.875rem; flex-shrink: 0; }
    .footer { text-align: center; margin-top: 40px; color: #666; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎧 Session Summary</h1>
    <p class="subtitle">${session.songs.length} tracks shared • Room: ${session.roomCode} • ${session.playerCount} players</p>
    
    ${session.songs.map((song, index) => {
      const score = calculateScore(song.votes);
      const scoreClass = score !== null ? (score > 75 ? 'good' : score < 25 ? 'bad' : 'neutral') : '';
      return `
    <div class="song">
      <div class="index">${index + 1}</div>
      <img class="thumbnail" src="https://img.youtube.com/vi/${song.video_id}/mqdefault.jpg" alt="" onerror="this.style.display='none'">
      <div class="info">
        <div class="title">${song.video_title || `Unknown Track (${song.video_id})`}${song.status === 'SKIPPED' ? '<span class="skipped">Skipped</span>' : ''}</div>
        <div class="dj">DJ ${song.player_nickname}</div>
      </div>
      ${score !== null ? `<div class="score ${scoreClass}">${score}%</div>` : ''}
      <a class="link" href="https://youtube.com/watch?v=${song.video_id}" target="_blank" rel="noopener">▶</a>
    </div>`;
    }).join('')}
    
    <p class="footer">Generated by 2-Minute DJ • ${new Date(session.endedAt).toLocaleDateString()}</p>
  </div>
</body>
</html>`;
}

/**
 * Generate JSON content for a session (for download)
 */
export function generateSessionJSON(session: SessionSnapshot): string {
  return JSON.stringify({
    roomCode: session.roomCode,
    songs: session.songs,
    playerCount: session.playerCount,
    endedAt: new Date(session.endedAt).toISOString(),
    generatedAt: new Date().toISOString(),
  }, null, 2);
}
