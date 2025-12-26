"use client";

import { AppSchema } from "@/instant.schema";
import { InstaQLEntity } from "@instantdb/react";
import { Music, Trophy, ExternalLink, RotateCcw } from "lucide-react";

type Room = InstaQLEntity<AppSchema, "rooms">;
type Player = InstaQLEntity<AppSchema, "players">;
type QueueItem = InstaQLEntity<AppSchema, "queue_items">;

interface SummaryViewProps {
  room: Room & { players: Player[]; queue_items: QueueItem[] };
}

export default function SummaryView({ room }: SummaryViewProps) {
  const playedSongs = room.queue_items
    .filter(q => q.status === "PLAYED")
    .sort((a, b) => a.created_at - b.created_at);

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
                playedSongs.map((song, index) => (
                    <div 
                        key={song.id} 
                        className="group flex items-center justify-between p-4 rounded-2xl bg-neutral-800/30 border border-neutral-700/50 hover:bg-neutral-800 hover:border-indigo-500/50 transition-all"
                    >
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-500 font-mono text-sm">
                                {index + 1}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg flex items-center space-x-2">
                                    <span>{ (song as any).player?.nickname || "Unknown DJ" }'s Selection</span>
                                </h3>
                                <p className="text-neutral-500 text-sm font-medium truncate max-w-xs">
                                    {song.video_title || `ID: ${song.video_id}`}
                                </p>
                            </div>
                        </div>
                        
                        <a 
                            href={`https://youtube.com/watch?v=${song.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-xl bg-neutral-900 text-neutral-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all"
                        >
                            <ExternalLink size={20} />
                        </a>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Action */}
      <div className="flex justify-center">
        <button 
            onClick={() => window.location.reload()}
            className="flex items-center space-x-2 px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:bg-neutral-200 transition-all"
        >
            <RotateCcw size={20} />
            <span>New Session</span>
        </button>
      </div>
    </div>
  );
}
