"use client";

import { useGameStore } from "@/lib/game-context";
import { SkipForward, Pause, Play, Users, Clock, Trash2, Crown, Plus } from "lucide-react";
import { useState } from "react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useI18n } from "@/components/LanguageProvider";
import { Room, Player, QueueItem } from "@/lib/types";

interface VIPControlsProps {
  room: Room;
  players: Player[]; // Array
  queueItems: QueueItem[]; // Array
}

export default function VIPControls({ room, players, queueItems }: VIPControlsProps) {
  const { t, language } = useI18n();
  const { updateState } = useGameStore();
  const [kickPlayerId, setKickPlayerId] = useState<string | null>(null);
  const [kickPlayerName, setKickPlayerName] = useState("");

  // Get or initialize player order
  const getPlayerOrder = (currentPlayers: Player[], currentOrder?: string[]): string[] => {
    if (currentOrder && Array.isArray(currentOrder)) {
      const validPlayers = currentOrder.filter(
        pid => currentPlayers.some(p => p.id === pid)
      );
      const newPlayers = currentPlayers
        .filter(p => !validPlayers.includes(p.id))
        .map(p => p.id);
      return [...validPlayers, ...newPlayers];
    }
    return currentPlayers.map(p => p.id);
  };

  const handleSkip = () => {
    updateState(doc => {
        const activeItem = doc.queue_items[doc.room.active_queue_item_id || ""];
        
        if (activeItem) {
            activeItem.status = "PLAYED";
        }

        const currentPlayers = Object.values(doc.players);
        const playerOrder = getPlayerOrder(currentPlayers, doc.room.player_order);

        if (playerOrder.length === 0) {
            delete doc.room.current_video_id;
            delete doc.room.active_player_id;
            delete doc.room.active_queue_item_id;
            delete doc.room.playback_started_at;
            return;
        }

        let nextTurnIndex = (doc.room.current_turn_index ?? -1);
        let foundSong = false;
        let attempts = 0;

        while (attempts < playerOrder.length) {
            nextTurnIndex = (nextTurnIndex + 1);
            const nextPlayerId = playerOrder[nextTurnIndex % playerOrder.length];
            
            const nextPlayerQueue = Object.values(doc.queue_items)
                .filter(q => q.status === "PENDING" && q.player_id === nextPlayerId)
                .sort((a, b) => a.created_at - b.created_at);
            
            if (nextPlayerQueue.length > 0) {
                const nextItem = nextPlayerQueue[0];
                doc.room.current_video_id = nextItem.video_id;
                doc.room.current_start_time = nextItem.highlight_start;
                doc.room.playback_started_at = Date.now();
                doc.room.active_player_id = nextPlayerId;
                doc.room.active_queue_item_id = nextItem.id;
                doc.room.player_order = playerOrder;
                doc.room.current_turn_index = nextTurnIndex % playerOrder.length;
                foundSong = true;
                break;
            }
            attempts++;
        }

        if (!foundSong) {
             nextTurnIndex = (doc.room.current_turn_index ?? -1) + 1;
             const nextPlayerId = playerOrder[nextTurnIndex % playerOrder.length];

             delete doc.room.current_video_id;
             doc.room.active_player_id = nextPlayerId;
             delete doc.room.active_queue_item_id;
             delete doc.room.playback_started_at;
             doc.room.player_order = playerOrder;
             doc.room.current_turn_index = nextTurnIndex % playerOrder.length;
        }
    });
  };

  const togglePause = () => {
      updateState(doc => {
          if (doc.room.status === "PLAYING") {
              doc.room.status = "PAUSED";
              doc.room.paused_at = Date.now();
          } else {
              const pauseDuration = doc.room.paused_at ? Date.now() - doc.room.paused_at : 0;
              const newStart = (doc.room.playback_started_at || Date.now()) + pauseDuration;
              
              doc.room.status = "PLAYING";
              doc.room.playback_started_at = newStart;
              delete doc.room.paused_at;
          }
      });
  };

  const updateTimer = (sec: number) => {
      updateState(doc => doc.room.timer_duration = sec);
  };

  const kickPlayer = (pId: string, name: string) => {
      setKickPlayerId(pId);
      setKickPlayerName(name);
  };

  const confirmKick = () => {
      if (kickPlayerId) {
          updateState(doc => {
              delete doc.players[kickPlayerId];
          });
          setKickPlayerId(null);
      }
  };

  const addTime = (seconds: number) => {
      updateState(doc => {
          if (!doc.room.playback_started_at) return;
          doc.room.playback_started_at += (seconds * 1000);
      });
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
                    onClick={() => updateState(doc => doc.room.auto_skip = doc.room.auto_skip === false)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                        room.auto_skip !== false 
                            ? "bg-indigo-500" 
                            : "bg-neutral-700"
                    }`}
                >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        room.auto_skip !== false 
                            ? "translate-x-6" 
                            : "translate-x-0.5"
                    }`} />
                </button>
            </div>

            {/* Allow Self Voting Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-300">
                        {language === "de" ? "Eigene Songs bewerten" : "Self-Voting"}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                        {language === "de" ? "Erlaubt DJs für ihre eigenen Songs zu stimmen" : "Allow DJs to vote for their own songs"}
                    </span>
                </div>
                <button 
                    onClick={() => updateState(doc => doc.room.allow_self_voting = !doc.room.allow_self_voting)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                        room.allow_self_voting 
                            ? "bg-indigo-500" 
                            : "bg-neutral-700"
                    }`}
                >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        room.allow_self_voting 
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
                {players.map((p) => (
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