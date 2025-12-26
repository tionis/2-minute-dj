"use client";

import { AppSchema } from "@/instant.schema";
import { InstaQLEntity } from "@instantdb/react";
import { Music, Trophy, ExternalLink, RotateCcw, ThumbsUp, Share, Download } from "lucide-react";
import { useState } from "react";
import AlertModal from "@/components/ui/AlertModal";

type Room = InstaQLEntity<AppSchema, "rooms">;
type Player = InstaQLEntity<AppSchema, "players">;
type QueueItem = InstaQLEntity<AppSchema, "queue_items">;

interface SummaryViewProps {
  room: Room & { players: Player[]; queue_items: QueueItem[] };
}

export default function SummaryView({ room }: SummaryViewProps) {
  const [showLinkAlert, setShowLinkAlert] = useState(false);

  const playedSongs = room.queue_items
    .filter(q => q.status === "PLAYED" || q.status === "SKIPPED") // Include skipped songs
    .sort((a, b) => a.created_at - b.created_at);

  const calculateScore = (votes: any) => {
      if (!votes) return null;
      const values = Object.values(votes) as number[];
      if (values.length === 0) return null;
      const sum = values.reduce((a, b) => a + b, 0);
      return Math.round(sum / values.length);
  };

  const handleDownload = () => {
      const data = JSON.stringify(room, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `2mdj-session-${room.code}.json`;
      link.click();
  };

  const handleCopyLink = () => {
      const url = `${window.location.origin}/summary/${room.id}`;
      navigator.clipboard.writeText(url);
      setShowLinkAlert(true);
  };

  return (
    <div className="max-w-4xl mx-auto w-full py-12 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-block p-4 rounded-full bg-yellow-500/10 text-yellow-500 mb-2">
            <Trophy size={48} />
        </div>
        <h1 className="text-6xl font-black tracking-tighter">Session Summary</h1>
        <p className="text-neutral-500 text-xl font-medium">
            {playedSongs.length} tracks shared. What a set!
        </p>
      </div>

      {/* Songs List */}
      <div className="bg-neutral-900/50 rounded-[2.5rem] border border-neutral-800 p-8">
        <div className="space-y-4">
            {playedSongs.length === 0 ? (
                <div className="text-center py-12 text-neutral-600 italic">
                    No songs were played in this session.
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
                                <div className="truncate">
                                    <h3 className="font-bold text-lg flex items-center space-x-2">
                                        <span className="truncate">{song.video_title || `ID: ${song.video_id}`}</span>
                                        {song.status === "SKIPPED" && (
                                            <span className="text-[10px] uppercase tracking-widest bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold">Skipped</span>
                                        )}
                                    </h3>
                                    <p className="text-neutral-500 text-sm font-medium">
                                        DJ { (song as any).player?.nickname || "Unknown" }
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
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <button 
            onClick={() => window.location.reload()}
            className="flex items-center space-x-2 px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:bg-neutral-200 transition-all"
        >
            <RotateCcw size={20} />
            <span>New Session</span>
        </button>

        <button 
            onClick={handleCopyLink}
            className="flex items-center space-x-2 px-8 py-4 rounded-full border border-neutral-700 text-neutral-300 font-bold text-lg hover:bg-neutral-800 transition-all"
        >
            <Share size={20} />
            <span>Share Link</span>
        </button>

        <button 
            onClick={handleDownload}
            className="flex items-center space-x-2 px-8 py-4 rounded-full border border-neutral-700 text-neutral-300 font-bold text-lg hover:bg-neutral-800 transition-all"
        >
            <Download size={20} />
            <span>JSON</span>
        </button>
      </div>

      <AlertModal
        isOpen={showLinkAlert}
        onClose={() => setShowLinkAlert(false)}
        title="Link Copied"
        description="The summary link has been copied to your clipboard."
      />
    </div>
  );
}
