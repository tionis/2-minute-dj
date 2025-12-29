"use client";

import { useGameStore } from "@/lib/game-context";
import { Trophy, ExternalLink, RotateCcw, ThumbsUp, Share, Download, FileCode } from "lucide-react";
import { useState } from "react";
import ShareLinkModal from "@/components/ui/ShareLinkModal";
import { useI18n } from "@/components/LanguageProvider";
import LZString from "lz-string";

interface SummarySong {
    id: string; // ID used for key
    video_id: string;
    video_title: string;
    player_nickname: string;
    votes: number[]; // Just the values
    status: "PLAYED" | "SKIPPED";
}

interface SummaryData {
    roomCode: string;
    songs: SummarySong[];
}

interface SummaryViewProps {
    data?: SummaryData;
    goHome?: boolean;
}

export default function SummaryView({ data, goHome }: SummaryViewProps) {
  const { t, language } = useI18n();
  const { state, setRoomId } = useGameStore();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  // If data is provided (static view), use it. Otherwise derive from store.
  const roomCode = data ? data.roomCode : state.room.code;
  
  const playedSongs: SummarySong[] = data 
    ? data.songs 
    : Object.values(state.queue_items)
        .filter(q => q.status === "PLAYED" || q.status === "SKIPPED")
        .sort((a, b) => a.created_at - b.created_at)
        .map(q => ({
            id: q.id,
            video_id: q.video_id,
            video_title: q.video_title || "Unknown Track",
            player_nickname: state.players[q.player_id]?.nickname || "Unknown",
            votes: q.votes ? Object.values(q.votes) : [],
            status: q.status as "PLAYED" | "SKIPPED"
        }));

  const calculateScore = (votes: number[]) => {
      if (!votes || votes.length === 0) return null;
      const sum = votes.reduce((a, b) => a + b, 0);
      return Math.round(sum / votes.length);
  };

  const handleDownloadJSON = () => {
      const exportData = {
          roomCode,
          songs: playedSongs,
          generatedAt: new Date().toISOString()
      };
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `2mdj-session-${roomCode}.json`;
      link.click();
      URL.revokeObjectURL(url);
  };

  const handleDownloadHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2-Minute DJ Session - ${roomCode}</title>
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
    <p class="subtitle">${playedSongs.length} tracks shared • Room: ${roomCode}</p>
    
    ${playedSongs.map((song, index) => {
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
    
    <p class="footer">Generated by 2-Minute DJ • ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `2mdj-session-${roomCode}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShareLink = () => {
      let url = "";
      
      if (data) {
          // If we are already viewing a static summary, just share the current URL
          url = typeof window !== "undefined" ? window.location.href : "";
      } else {
          // We are the host, generate the compressed link
          const summaryData: SummaryData = {
              roomCode: state.room.code,
              songs: playedSongs
          };
          const json = JSON.stringify(summaryData);
          const compressed = LZString.compressToEncodedURIComponent(json);
          url = `${typeof window !== "undefined" ? window.location.origin : ""}/summary?data=${compressed}`;
      }
      
      setShareUrl(url);
      setShowLinkModal(true);
  };

  const handleNewSession = () => {
    // Clear the stored room from localStorage and redirect to host page
    if (typeof window !== "undefined") {
      localStorage.removeItem("2mdj_host_roomId");
      localStorage.removeItem("2mdj_host_roomCode");
      localStorage.removeItem("2mdj_doc_backup");
      window.location.href = "/host";
    }
  };

  const handleGoHome = () => {
    setRoomId(""); // Disconnect
    window.location.href = "/";
  };

  return (
    <div className="max-w-4xl mx-auto w-full py-12 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-block p-4 rounded-full bg-yellow-500/10 text-yellow-500 mb-2">
            <Trophy size={48} />
        </div>
        <h1 className="text-6xl font-black tracking-tighter">{t("sessionSummary")}</h1>
        <p className="text-neutral-500 text-xl font-medium">
            {playedSongs.length} {t("tracksShared")}
        </p>
      </div>

      {/* Songs List */}
      <div className="bg-neutral-900/50 rounded-[2.5rem] border border-neutral-800 p-8">
        <div className="space-y-4">
            {playedSongs.length === 0 ? (
                <div className="text-center py-12 text-neutral-600 italic">
                    {t("noSongsPlayed")}
                </div>
            ) : (
                playedSongs.map((song, index) => {
                    const score = calculateScore(song.votes);
                    return (
                        <div 
                            key={song.id} 
                            className="group flex items-center justify-between p-4 rounded-2xl bg-neutral-800/30 border border-neutral-700/50 hover:bg-neutral-800 hover:border-indigo-500/50 transition-all"
                        >
                            <div className="flex items-center space-x-4 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-500 font-mono text-sm shrink-0">
                                    {index + 1}
                                </div>
                                {/* YouTube Thumbnail */}
                                <img
                                  src={`https://img.youtube.com/vi/${song.video_id}/mqdefault.jpg`}
                                  alt=""
                                  className="w-20 h-14 rounded-lg object-cover bg-neutral-800 shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <div className="truncate">
                                    <h3 className="font-bold text-lg flex items-center space-x-2">
                                        <span className="truncate">{song.video_title || `${t("unknownTrack")} (${song.video_id})`}</span>
                                        {song.status === "SKIPPED" && (
                                            <span className="text-[10px] uppercase tracking-widest bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold">{t("skipped")}</span>
                                        )}
                                    </h3>
                                    <p className="text-neutral-500 text-sm font-medium">
                                        DJ { song.player_nickname }
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-4 shrink-0">
                                {score !== null && (
                                    <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border ${
                                        score > 75 ? "bg-green-500/10 border-green-500/30 text-green-500" :
                                        score < 25 ? "bg-red-500/10 border-red-500/30 text-red-500" :
                                        "bg-neutral-800 border-neutral-700 text-neutral-400"
                                    }`}>
                                        <ThumbsUp size={14} className={score < 25 ? "rotate-180" : ""} />
                                        <span className="font-mono font-bold">{score}%</span>
                                    </div>
                                )}

                                <a 
                                    href={`https://youtube.com/watch?v=${song.video_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3 rounded-xl bg-neutral-900 text-neutral-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all"
                                >
                                    <ExternalLink size={20} />
                                </a>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 flex-wrap">
        {!data && (
            <button 
                onClick={goHome ? handleGoHome : handleNewSession}
                className="flex items-center space-x-2 px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:bg-neutral-200 transition-all"
            >
                <RotateCcw size={20} className={goHome ? "rotate-0" : "rotate-ccw"} />
                <span>{goHome ? (language === "de" ? "Startseite" : "Go Home") : t("newSession")}</span>
            </button>
        )}

        <button 
            onClick={handleShareLink}
            className="flex items-center space-x-2 px-8 py-4 rounded-full border border-neutral-700 text-neutral-300 font-bold text-lg hover:bg-neutral-800 transition-all"
        >
            <Share size={20} />
            <span>{t("shareLink")}</span>
        </button>

        <button 
            onClick={handleDownloadJSON}
            className="flex items-center space-x-2 px-8 py-4 rounded-full border border-neutral-700 text-neutral-300 font-bold text-lg hover:bg-neutral-800 transition-all"
        >
            <Download size={20} />
            <span>{t("json")}</span>
        </button>

        <button 
            onClick={handleDownloadHTML}
            className="flex items-center space-x-2 px-8 py-4 rounded-full border border-neutral-700 text-neutral-300 font-bold text-lg hover:bg-neutral-800 transition-all"
        >
            <FileCode size={20} />
            <span>HTML</span>
        </button>
      </div>

      <ShareLinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title={language === "de" ? "Link teilen" : "Share Link"}
        link={shareUrl}
        buttonText={t("confirm")}
      />
    </div>
  );
}
