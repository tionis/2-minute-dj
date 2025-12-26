"use client";

import { db } from "@/lib/db";
import { AppSchema } from "@/instant.schema";
import { InstaQLEntity } from "@instantdb/react";
import { SkipForward, Pause, Play, Users, Clock, Trash2, Crown, Plus } from "lucide-react";

type Room = InstaQLEntity<AppSchema, "rooms">;
type Player = InstaQLEntity<AppSchema, "players">;
type QueueItem = InstaQLEntity<AppSchema, "queue_items">;

interface VIPControlsProps {
  room: Room & { players: Player[] };
  queueItems: QueueItem[]; // Need full queue for skip logic
}

export default function VIPControls({ room, queueItems }: VIPControlsProps) {
  
  const handleSkip = () => {
    // Replicate skip logic client-side
    // 1. Mark current as PLAYED
    const activeItem = queueItems.find(q => q.id === room.active_player_id);
    const txs = [];
    
    if (activeItem) {
        txs.push(db.tx.queue_items[activeItem.id].update({ status: "PLAYED" }));
    }

    // 2. Find next
    const pendingItems = queueItems.filter(q => q.status === "PENDING");
    if (pendingItems.length === 0) {
        // Pause
        txs.push(db.tx.rooms[room.id].update({
            current_video_id: null,
            active_player_id: null,
            playback_started_at: null,
        }));
    } else {
        const nextItem = pendingItems.sort((a, b) => a.created_at - b.created_at)[0];
        txs.push(db.tx.rooms[room.id].update({
            current_video_id: nextItem.video_id,
            current_start_time: nextItem.highlight_start,
            playback_started_at: Date.now(),
            active_player_id: nextItem.id,
        }));
    }
    
    db.transact(txs);
  };

  const togglePause = () => {
      if (room.status === "PLAYING") {
          // Pause: Save state? Actually just stop timer.
          // For simple pause, we change status. Host timer will stop ticking.
          // But when we resume, we need to adjust playback_started_at so we don't jump ahead.
          // Complex. For MVP "Pause" just freezes the room state.
          // Host GameView check: if (status !== "PLAYING") return;
          // So timer stops. When we set back to PLAYING, timer resumes?
          // No, elapsed = Date.now() - started_at. If we wait 10s, elapsed increases 10s.
          // To support Resume, we need to shift started_at by the pause duration.
          // Implemented simple Pause for now (stops skip, but timer might drift).
          // Actually user asked for "pause".
          // Let's store paused_at.
          
          db.transact(db.tx.rooms[room.id].update({ 
              status: "PAUSED",
              paused_at: Date.now()
          }));
      } else {
          // Resume
          const pauseDuration = room.paused_at ? Date.now() - room.paused_at : 0;
          const newStart = (room.playback_started_at || Date.now()) + pauseDuration;
          
          db.transact(db.tx.rooms[room.id].update({ 
              status: "PLAYING",
              playback_started_at: newStart,
              paused_at: null
          }));
      }
  };

  const updateTimer = (sec: number) => {
      db.transact(db.tx.rooms[room.id].update({ timer_duration: sec }));
  };

  const kickPlayer = (pId: string, name: string) => {
      if (confirm(`Kick ${name}?`)) {
          db.transact(db.tx.players[pId].delete());
      }
  };

  const addTime = (seconds: number) => {
      if (!room.playback_started_at) return;
      const newStart = room.playback_started_at + (seconds * 1000);
      db.transact(db.tx.rooms[room.id].update({ playback_started_at: newStart }));
  };

  return (
    <div className="bg-neutral-900 border border-yellow-500/30 rounded-2xl p-4 space-y-6 mt-8">
        <div className="flex items-center space-x-2 text-yellow-500 font-bold uppercase tracking-widest text-xs border-b border-neutral-800 pb-2">
            <Crown size={14} fill="currentColor" />
            <span>VIP Controls</span>
        </div>

        {/* Playback Controls */}
        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={togglePause}
                className={`p-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all ${
                    room.status === "PAUSED" 
                        ? "bg-green-500 text-white" 
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
            >
                {room.status === "PAUSED" ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
                <span>{room.status === "PAUSED" ? "Resume" : "Pause"}</span>
            </button>

            <button 
                onClick={handleSkip}
                className="p-4 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 font-bold flex items-center justify-center space-x-2 transition-all"
            >
                <SkipForward size={20} fill="currentColor" />
                <span>Skip</span>
            </button>
        </div>

        {/* Timer Controls */}
        <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center space-x-1">
                <Clock size={10} />
                <span>Round Timer</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
                {[60, 90, 120, 180].map((sec) => (
                    <button
                        key={sec}
                        onClick={() => updateTimer(sec)}
                        className={`py-2 rounded-lg font-bold text-xs border transition-all ${
                            (room.timer_duration || 120) === sec 
                                ? "border-indigo-500 bg-indigo-500/20 text-white" 
                                : "border-neutral-800 bg-neutral-800/50 text-neutral-400"
                        }`}
                    >
                        {sec}s
                    </button>
                ))}
            </div>
            
            {/* Add Time Button */}
            <button 
                onClick={() => addTime(30)}
                className="w-full py-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center space-x-2 hover:bg-indigo-500/20 transition-all"
            >
                <Plus size={14} />
                <span>Add 30s to Round</span>
            </button>
        </div>

        {/* Player Management */}
        <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center space-x-1">
                <Users size={10} />
                <span>Manage Players</span>
            </label>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {room.players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-neutral-800/50 p-2 rounded-lg">
                        <span className="text-sm font-medium truncate pl-1">{p.nickname}</span>
                        <button 
                            onClick={() => kickPlayer(p.id, p.nickname)}
                            className="p-1.5 text-neutral-500 hover:text-red-500 transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
}
