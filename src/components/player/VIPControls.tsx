"use client";

import { db } from "@/lib/db";
import { AppSchema } from "@/instant.schema";
import { InstaQLEntity } from "@instantdb/react";
import { SkipForward, Pause, Play, Users, Clock, Trash2, Crown, Plus } from "lucide-react";
import { useState } from "react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useI18n } from "@/components/LanguageProvider";

type Room = InstaQLEntity<AppSchema, "rooms">;
type Player = InstaQLEntity<AppSchema, "players">;
type QueueItem = InstaQLEntity<AppSchema, "queue_items">;

interface VIPControlsProps {
  room: Room & { players: Player[] };
  queueItems: QueueItem[]; // Need full queue for skip logic
}

export default function VIPControls({ room, queueItems }: VIPControlsProps) {
  const { t, language } = useI18n();
  const [kickPlayerId, setKickPlayerId] = useState<string | null>(null);
  const [kickPlayerName, setKickPlayerName] = useState("");

  // Get or initialize player order
  const getPlayerOrder = (): string[] => {
    if (room.player_order && Array.isArray(room.player_order)) {
      const validPlayers = (room.player_order as string[]).filter(
        pid => room.players.some(p => p.id === pid)
      );
      const newPlayers = room.players
        .filter(p => !validPlayers.includes(p.id))
        .map(p => p.id);
      return [...validPlayers, ...newPlayers];
    }
    return room.players.map(p => p.id);
  };

  const handleSkip = () => {
    const activeItem = queueItems.find(q => q.id === room.active_queue_item_id);
    const txs = [];
    
    if (activeItem) {
      txs.push(db.tx.queue_items[activeItem.id].update({ status: "PLAYED" }));
    }

    const playerOrder = getPlayerOrder();
    if (playerOrder.length === 0) {
      txs.push(db.tx.rooms[room.id].update({
        current_video_id: null,
        active_player_id: null,
        active_queue_item_id: null,
        playback_started_at: null,
      }));
      db.transact(txs);
      return;
    }

    // Calculate next turn
    let nextTurnIndex = ((room.current_turn_index as number) ?? -1) + 1;
    const nextPlayerId = playerOrder[nextTurnIndex % playerOrder.length];
    
    // Find the next player's pending queue item
    const nextPlayerQueue = queueItems
      .filter(q => 
        q.status === "PENDING" && 
        (q as any).player?.id === nextPlayerId
      )
      .sort((a, b) => a.created_at - b.created_at);

    if (nextPlayerQueue.length > 0) {
      const nextItem = nextPlayerQueue[0];
      txs.push(db.tx.rooms[room.id].update({
        current_video_id: nextItem.video_id,
        current_start_time: nextItem.highlight_start,
        playback_started_at: Date.now(),
        active_player_id: nextPlayerId,
        active_queue_item_id: nextItem.id,
        player_order: playerOrder,
        current_turn_index: nextTurnIndex % playerOrder.length,
      }));
    } else {
      txs.push(db.tx.rooms[room.id].update({
        current_video_id: null,
        active_player_id: nextPlayerId,
        active_queue_item_id: null,
        playback_started_at: null,
        player_order: playerOrder,
        current_turn_index: nextTurnIndex % playerOrder.length,
      }));
    }
    
    db.transact(txs);
  };

  const togglePause = () => {
      if (room.status === "PLAYING") {
          db.transact(db.tx.rooms[room.id].update({ 
              status: "PAUSED",
              paused_at: Date.now()
          }));
      } else {
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
      setKickPlayerId(pId);
      setKickPlayerName(name);
  };

  const confirmKick = () => {
      if (kickPlayerId) {
          db.transact(db.tx.players[kickPlayerId].delete());
          setKickPlayerId(null);
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
            <span>{t("toggleVip")}</span>
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
                <span>{room.status === "PAUSED" ? (language === "de" ? "Fortsetzen" : "Resume") : (language === "de" ? "Pause" : "Pause")}</span>
            </button>

            <button 
                onClick={handleSkip}
                className="p-4 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 font-bold flex items-center justify-center space-x-2 transition-all"
            >
                <SkipForward size={20} fill="currentColor" />
                <span>{language === "de" ? "Überspringen" : "Skip"}</span>
            </button>
        </div>

        {/* Timer Controls */}
        <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center space-x-1">
                <Clock size={10} />
                <span>{t("timerDuration")}</span>
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
                <span>{language === "de" ? "30s zur Runde hinzufügen" : "Add 30s to Round"}</span>
            </button>
            
            {/* Auto-Skip Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-300">
                        {language === "de" ? "Auto-Skip" : "Auto-Skip"}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                        {language === "de" ? "Automatisch weiter bei 00:00" : "Auto advance at 00:00"}
                    </span>
                </div>
                <button 
                    onClick={() => db.transact(db.tx.rooms[room.id].update({ auto_skip: (room as any).auto_skip === false }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                        (room as any).auto_skip !== false 
                            ? "bg-indigo-500" 
                            : "bg-neutral-700"
                    }`}
                >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        (room as any).auto_skip !== false 
                            ? "translate-x-6" 
                            : "translate-x-0.5"
                    }`} />
                </button>
            </div>
        </div>

        {/* Player Management */}
        <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center space-x-1">
                <Users size={10} />
                <span>{t("managePlayers")}</span>
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

        <ConfirmationModal 
            isOpen={!!kickPlayerId}
            onCancel={() => setKickPlayerId(null)}
            onConfirm={confirmKick}
            title={`${t("kick")} ${kickPlayerName}?`}
            description={language === "de" ? "Bist du sicher, dass du diesen Spieler hinauswerfen willst?" : "Are you sure you want to kick this player?"}
            confirmText={t("kick")}
            cancelText={t("cancel")}
        />
    </div>
  );
}
