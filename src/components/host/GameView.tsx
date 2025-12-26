"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { db } from "@/lib/db";
import { AppSchema } from "@/instant.schema";
import { InstaQLEntity } from "@instantdb/react";
import { Loader2, Music, User, SkipForward, Clock, Play, Settings, X, Crown } from "lucide-react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useI18n } from "@/components/LanguageProvider";

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

type Room = InstaQLEntity<AppSchema, "rooms">;
type Player = InstaQLEntity<AppSchema, "players">;
type QueueItem = InstaQLEntity<AppSchema, "queue_items">;

interface GameViewProps {
  room: Room & { players: Player[]; queue_items: QueueItem[] };
}

export default function GameView({ room }: GameViewProps) {
  const { t, language } = useI18n();
  const [timeLeft, setTimeLeft] = useState(room.timer_duration || 120);
  const [isEnding, setIsEnding] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [kickPlayerId, setKickPlayerId] = useState<string | null>(null);
  const [kickPlayerName, setKickPlayerName] = useState("");
  
  const roomRef = useRef(room);
  const isEndingRef = useRef(isEnding);
  
  useEffect(() => {
      roomRef.current = room;
      isEndingRef.current = isEnding;
  }, [room, isEnding]);

  useEffect(() => {
    setIsPlayerReady(false);
    const timer = setTimeout(() => setIsPlayerReady(true), 5000);
    return () => clearTimeout(timer);
  }, [room.current_video_id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentRoom = roomRef.current;
      if (currentRoom.status !== "PLAYING" || !currentRoom.playback_started_at) return;

      const duration = currentRoom.timer_duration || 120;
      const elapsed = Math.floor((Date.now() - currentRoom.playback_started_at!) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !isEndingRef.current) {
        setIsEnding(true); 
        handleNextSong(); 
      }
    }, 500); 

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pendingCount = room.queue_items.filter(q => q.status === "PENDING").length;
    if (room.status === "PLAYING" && !room.current_video_id && pendingCount > 0) {
        handleNextSong();
    }
  }, [room.status, room.current_video_id, room.queue_items]);

  const handleNextSong = async () => {
    const currentRoom = roomRef.current;
    const pendingItems = currentRoom.queue_items.filter(q => q.status === "PENDING");
    const currentActiveItem = currentRoom.queue_items.find(q => q.id === currentRoom.active_player_id);

    const txs = [];
    if (currentActiveItem) {
        txs.push(db.tx.queue_items[currentActiveItem.id].update({ status: "PLAYED" }));
    }

    if (pendingItems.length === 0) {
        txs.push(db.tx.rooms[currentRoom.id].update({
            current_video_id: null,
            active_player_id: null,
            playback_started_at: null,
        }));
    } else {
        const nextItem = pendingItems.sort((a, b) => a.created_at - b.created_at)[0];
        txs.push(db.tx.rooms[currentRoom.id].update({
            current_video_id: nextItem.video_id,
            current_start_time: nextItem.highlight_start,
            playback_started_at: Date.now(),
            active_player_id: nextItem.id, 
        }));
    }
    await db.transact(txs);
    setIsEnding(false);
  };

  const endSession = () => {
    const txs = [];
    const currentActiveItem = roomRef.current.queue_items.find(q => q.id === roomRef.current.active_player_id);
    if (currentActiveItem) {
        txs.push(db.tx.queue_items[currentActiveItem.id].update({ status: "PLAYED" }));
    }
    txs.push(db.tx.rooms[room.id].update({ 
        status: "FINISHED",
        current_video_id: null,
        active_player_id: null,
        playback_started_at: null,
    }));
    db.transact(txs);
  };

  const updateTimer = (seconds: number) => {
      db.transact(db.tx.rooms[room.id].update({ timer_duration: seconds }));
  };

  const addTime = (seconds: number) => {
      if (!room.playback_started_at) return;
      const newStart = room.playback_started_at + (seconds * 1000);
      db.transact(db.tx.rooms[room.id].update({ playback_started_at: newStart }));
  };

  const handleKick = (playerId: string, name: string) => {
      setKickPlayerId(playerId);
      setKickPlayerName(name);
  };

  const confirmKick = () => {
      if (kickPlayerId) {
          db.transact(db.tx.players[kickPlayerId].delete());
          setKickPlayerId(null);
      }
  };

  const handleToggleVIP = (player: any) => {
      db.transact(db.tx.players[player.id].update({ is_vip: !player.is_vip }));
  };

  const renderModals = () => (
    <>
      {showSettings && (
        <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-lg w-full space-y-8 relative">
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white">
                    <X size={24} />
                </button>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold flex items-center space-x-2">
                        <Settings className="text-indigo-500" />
                        <span>{t("settings")}</span>
                    </h2>
                    <p className="text-neutral-400">{language === "de" ? "Passe die Party-Regeln an." : "Customize the party rules."}</p>
                </div>
                <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t("timerDuration")}</label>
                    <div className="grid grid-cols-4 gap-2">
                        {[60, 90, 120, 180].map((sec) => (
                            <button key={sec} onClick={() => updateTimer(sec)}
                                className={`py-3 rounded-xl font-bold border-2 transition-all ${
                                    (room.timer_duration || 120) === sec 
                                        ? "border-indigo-500 bg-indigo-500/20 text-white" 
                                        : "border-neutral-800 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600"
                                }`}>
                                {sec}s
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-4 pt-4 border-t border-neutral-800">
                    <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t("addTime")}</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => addTime(30)} className="py-3 rounded-xl font-bold border-2 border-neutral-800 bg-neutral-800/50 text-white hover:border-indigo-500 hover:bg-indigo-500/20 transition-all">+30s</button>
                        <button onClick={() => addTime(60)} className="py-3 rounded-xl font-bold border-2 border-neutral-800 bg-neutral-800/50 text-white hover:border-indigo-500 hover:bg-indigo-500/20 transition-all">+60s</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showPlayers && (
        <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-2xl w-full space-y-8 relative max-h-[80vh] flex flex-col">
                <button onClick={() => setShowPlayers(false)} className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white">
                    <X size={24} />
                </button>
                <div className="space-y-2 shrink-0">
                    <h2 className="text-2xl font-bold flex items-center space-x-2">
                        <User className="text-indigo-500" />
                        <span>{t("managePlayers")}</span>
                    </h2>
                    <p className="text-neutral-400">{language === "de" ? "Spieler entfernen oder VIP-Status vergeben." : "Kick players or grant VIP status."}</p>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-2">
                    {room.players.map((player) => (
                        <div key={player.id} className="flex items-center justify-between bg-neutral-800/50 p-4 rounded-2xl border border-neutral-700/50">
                            <div className="flex items-center space-x-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${player.is_vip ? 'bg-yellow-500 text-black' : 'bg-neutral-700 text-white'}`}>
                                    {player.nickname[0].toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold">{player.nickname}</h3>
                                    <p className="text-xs text-neutral-500">{player.is_vip ? "VIP DJ" : (language === "de" ? "Gast" : "Guest")}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => handleToggleVIP(player)}
                                    className={`p-2 rounded-xl border transition-colors ${player.is_vip ? "bg-yellow-500/10 border-yellow-500 text-yellow-500" : "border-neutral-700 text-neutral-500 hover:text-yellow-500 hover:border-yellow-500"}`}
                                    title={t("toggleVip")}>
                                    <Crown size={16} fill={player.is_vip ? "currentColor" : "none"} />
                                </button>
                                <button onClick={() => handleKick(player.id, player.nickname)}
                                    className="p-2 rounded-xl border border-neutral-700 text-neutral-500 hover:text-red-500 hover:border-red-500 transition-colors"
                                    title={t("kick")}>
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!kickPlayerId}
        onCancel={() => setKickPlayerId(null)}
        onConfirm={confirmKick}
        title={`${t("kick")} ${kickPlayerName}?`}
        description={language === "de" ? "Bist du sicher, dass du diesen Spieler hinauswerfen willst?" : "Are you sure you want to kick this player?"}
        confirmText={t("kick")}
        cancelText={t("cancel")}
      />
    </>
  );

  const activeQueueItem = room.queue_items.find(q => q.id === room.active_player_id); 
  const activePlayer = room.players.find(p => p.id === (activeQueueItem as any)?.player?.id);

  if (!room.current_video_id) {
    return (
      <div className="w-full h-full flex flex-col animate-in fade-in duration-1000 relative overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-pulse text-center">
            <div className="p-8 rounded-full bg-indigo-500/10 text-indigo-500">
                <Music size={64} />
            </div>
            <div className="space-y-2">
                <h2 className="text-3xl font-bold italic text-neutral-400">{language === "de" ? "Warte auf Tracks..." : "Waiting for tracks..."}</h2>
                <p className="text-neutral-600">{language === "de" ? "Die Warteschlange ist leer. Füge Songs auf deinem Handy hinzu!" : "The queue is empty. Add some fire on your phones!"}</p>
            </div>
        </div>
        <div className="flex items-center justify-between px-4 py-4 shrink-0 h-20 border-t border-neutral-900/50">
            <div className="flex items-center space-x-8 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowPlayers(true)}>
                <div className="flex -space-x-3">
                    {room.players.map((p, i) => (
                        <div key={p.id} className={`w-10 h-10 rounded-full border-2 bg-neutral-800 flex items-center justify-center font-bold text-xs ${p.is_vip ? 'border-yellow-500 text-yellow-500' : 'border-neutral-950 text-white'}`} style={{ zIndex: room.players.length - i }}>
                            {p.nickname[0].toUpperCase()}
                        </div>
                    ))}
                </div>
                <div className="text-neutral-500 text-sm font-medium">{room.players.length} {t("djsOnline")}</div>
            </div>
            <div className="flex items-center space-x-6">
                <button onClick={() => setShowPlayers(true)} className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors" title={t("managePlayers")}>
                    <User size={20} />
                </button>
                <button onClick={() => setShowSettings(true)} className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors" title={t("settings")}>
                    <Settings size={20} />
                </button>
                <button onClick={endSession} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
                    {t("endSession")}
                </button>
            </div>
        </div>
        {renderModals()}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-1000 relative overflow-hidden">
      <div className="flex justify-between items-center px-4 py-4 shrink-0 h-20">
        <div className="space-y-0.5">
            <div className="flex items-center space-x-2 text-indigo-400 font-bold uppercase tracking-widest text-[10px]">
                <Music size={12} />
                <span>{t("nowSpinning")}</span>
            </div>
            <h1 className="text-3xl font-black max-w-xl truncate leading-none">{activePlayer ? (language === "de" ? `${activePlayer.nickname}s Wahl` : `${activePlayer.nickname}'s Pick`) : t("nextUp")}</h1>
        </div>
        <div className="flex flex-col items-end">
            <div className={`flex items-center space-x-3 px-5 py-1.5 rounded-2xl border-2 font-mono text-3xl font-black transition-colors ${timeLeft < 20 ? "border-red-500 text-red-500 animate-pulse" : "border-neutral-800 text-white"}`}>
                <Clock size={20} />
                <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}</span>
            </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 w-full relative bg-black rounded-3xl overflow-hidden border border-neutral-800 shadow-[0_0_100px_rgba(79,70,229,0.1)]">
        {!isPlayerReady && <div className="absolute inset-0 z-30 bg-neutral-900 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>}
        <iframe key={room.current_video_id} className="absolute inset-0 w-full h-full border-none" src={`https://www.youtube.com/embed/${room.current_video_id}?autoplay=1&start=${room.current_start_time}&controls=0&modestbranding=1&rel=0`} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" onLoad={() => setIsPlayerReady(true)} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>
      <div className="flex items-center justify-between px-4 py-4 shrink-0 h-20">
        <div className="flex items-center space-x-8 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowPlayers(true)}>
            <div className="flex -space-x-3">
                {room.players.map((p, i) => (
                    <div key={p.id} className={`w-10 h-10 rounded-full border-2 bg-neutral-800 flex items-center justify-center font-bold text-xs ${p.is_vip ? 'border-yellow-500 text-yellow-500' : 'border-neutral-950 text-white'}`} style={{ zIndex: room.players.length - i }}>
                        {p.nickname[0].toUpperCase()}
                    </div>
                ))}
            </div>
            <div className="text-neutral-500 text-sm font-medium">{room.players.length} {t("djsOnline")}</div>
        </div>
        <div className="flex items-center space-x-6">
            <button onClick={() => setShowPlayers(true)} className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors" title={t("managePlayers")}>
                <User size={20} />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors" title={t("settings")}>
                <Settings size={20} />
            </button>
            <button onClick={handleNextSong} className="group flex items-center space-x-2 text-neutral-500 hover:text-white transition-colors">
                <span className="font-bold uppercase tracking-widest text-xs">{language === "de" ? "Überspringen" : "Skip Song"}</span>
                <SkipForward className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={endSession} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
                {t("endSession")}
            </button>
        </div>
      </div>
      {renderModals()}
    </div>
  );
}