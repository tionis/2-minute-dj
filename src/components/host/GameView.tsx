"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { db } from "@/lib/db";
import { AppSchema } from "@/instant.schema";
import { InstaQLEntity } from "@instantdb/react";
import { Loader2, Music, User, SkipForward, Clock, Play, Settings, X, Crown, Pause } from "lucide-react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useI18n } from "@/components/LanguageProvider";
import HypeMeter from "./HypeMeter";

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
  const [iframeKey, setIframeKey] = useState(0); // Key to force iframe reload on resume
  
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

  // Reset isEnding when video changes
  useEffect(() => {
    setIsEnding(false);
  }, [room.active_queue_item_id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentRoom = roomRef.current;
      // Don't update timer when paused
      if (currentRoom.status === "PAUSED" || currentRoom.status !== "PLAYING" || !currentRoom.playback_started_at) return;
      // Don't update timer when no video is playing
      if (!currentRoom.current_video_id) return;

      const duration = currentRoom.timer_duration || 120;
      const elapsed = Math.floor((Date.now() - currentRoom.playback_started_at!) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      // Auto-skip when timer reaches 0 (if auto_skip is enabled, default true)
      const autoSkipEnabled = currentRoom.auto_skip !== false;
      if (remaining <= 0 && !isEndingRef.current && autoSkipEnabled) {
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

  const togglePause = () => {
    if (room.status === "PLAYING") {
      // Calculate how much video time has elapsed
      const elapsedSeconds = room.playback_started_at 
        ? Math.floor((Date.now() - room.playback_started_at) / 1000)
        : 0;
      const videoOffset = (room.current_start_time || 0) + elapsedSeconds;
      
      db.transact(db.tx.rooms[room.id].update({ 
        status: "PAUSED",
        paused_at: Date.now(),
        current_video_offset: videoOffset
      }));
    } else if (room.status === "PAUSED") {
      const pauseDuration = room.paused_at ? Date.now() - room.paused_at : 0;
      const newStart = (room.playback_started_at || Date.now()) + pauseDuration;
      
      db.transact(db.tx.rooms[room.id].update({ 
        status: "PLAYING",
        playback_started_at: newStart,
        paused_at: null
      }));
      
      // Force iframe reload with new offset
      setIframeKey(prev => prev + 1);
    }
  };

  // Get or initialize player order
  const getPlayerOrder = (): string[] => {
    if (room.player_order && Array.isArray(room.player_order)) {
      // Filter out players who have left
      const validPlayers = (room.player_order as string[]).filter(
        pid => room.players.some(p => p.id === pid)
      );
      // Add any new players who joined
      const newPlayers = room.players
        .filter(p => !validPlayers.includes(p.id))
        .sort((a, b) => a.joined_at - b.joined_at)
        .map(p => p.id);
      return [...validPlayers, ...newPlayers];
    }
    // Initialize from players sorted by join time
    return room.players
      .sort((a, b) => a.joined_at - b.joined_at)
      .map(p => p.id);
  };

  // Get the current turn player
  const getCurrentTurnPlayer = () => {
    const playerOrder = getPlayerOrder();
    if (playerOrder.length === 0) return null;
    const turnIndex = room.current_turn_index ?? 0;
    const playerId = playerOrder[turnIndex % playerOrder.length];
    return room.players.find(p => p.id === playerId);
  };

  const handleNextSong = async () => {
    const currentRoom = roomRef.current;
    const currentActiveItem = currentRoom.queue_items.find(
      q => q.id === currentRoom.active_queue_item_id
    );

    const txs = [];
    
    // Mark current item as played
    if (currentActiveItem) {
      txs.push(db.tx.queue_items[currentActiveItem.id].update({ status: "PLAYED" }));
    }

    // Get/update player order
    const playerOrder = getPlayerOrder();
    if (playerOrder.length === 0) {
      txs.push(db.tx.rooms[currentRoom.id].update({
        current_video_id: null,
        active_player_id: null,
        active_queue_item_id: null,
        playback_started_at: null,
      }));
      await db.transact(txs);
      setIsEnding(false);
      return;
    }

    // Calculate next turn
    let nextTurnIndex = (currentRoom.current_turn_index ?? -1) + 1;
    const nextPlayerId = playerOrder[nextTurnIndex % playerOrder.length];
    
    // Find the next player's pending queue item
    const nextPlayerQueue = currentRoom.queue_items
      .filter(q => 
        q.status === "PENDING" && 
        (q as any).player?.id === nextPlayerId
      )
      .sort((a, b) => a.created_at - b.created_at);

    if (nextPlayerQueue.length > 0) {
      // Play next player's song
      const nextItem = nextPlayerQueue[0];
      txs.push(db.tx.rooms[currentRoom.id].update({
        current_video_id: nextItem.video_id,
        current_start_time: nextItem.highlight_start,
        current_video_offset: nextItem.highlight_start, // Reset offset to start time
        playback_started_at: Date.now(),
        active_player_id: nextPlayerId,
        active_queue_item_id: nextItem.id,
        player_order: playerOrder,
        current_turn_index: nextTurnIndex % playerOrder.length,
      }));
    } else {
      // No song in this player's queue - check if anyone else has songs
      const anyPending = currentRoom.queue_items.some(q => q.status === "PENDING");
      
      if (anyPending) {
        // Skip this player's turn and try next player (recursive call after update)
        txs.push(db.tx.rooms[currentRoom.id].update({
          current_video_id: null,
          active_player_id: nextPlayerId,
          active_queue_item_id: null,
          playback_started_at: null,
          current_video_offset: null,
          player_order: playerOrder,
          current_turn_index: nextTurnIndex % playerOrder.length,
        }));
      } else {
        // No pending songs at all
        txs.push(db.tx.rooms[currentRoom.id].update({
          current_video_id: null,
          active_player_id: nextPlayerId,
          active_queue_item_id: null,
          playback_started_at: null,
          current_video_offset: null,
          player_order: playerOrder,
          current_turn_index: nextTurnIndex % playerOrder.length,
        }));
      }
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
                <div className="space-y-4 pt-4 border-t border-neutral-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                                {language === "de" ? "Auto-Skip" : "Auto-Skip"}
                            </label>
                            <p className="text-xs text-neutral-600 mt-1">
                                {language === "de" 
                                    ? "Automatisch zum nächsten Song wechseln wenn der Timer abläuft" 
                                    : "Automatically skip to next song when timer ends"}
                            </p>
                        </div>
                        <button 
                            onClick={() => db.transact(db.tx.rooms[room.id].update({ auto_skip: room.auto_skip === false }))}
                            className={`relative w-14 h-8 rounded-full transition-colors ${
                                room.auto_skip !== false 
                                    ? "bg-indigo-500" 
                                    : "bg-neutral-700"
                            }`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                                room.auto_skip !== false 
                                    ? "translate-x-7" 
                                    : "translate-x-1"
                            }`} />
                        </button>
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

  const activeQueueItem = room.queue_items.find(q => q.id === room.active_queue_item_id); 
  const activePlayer = room.players.find(p => p.id === room.active_player_id);
  const currentTurnPlayer = getCurrentTurnPlayer();

  if (!room.current_video_id) {
    // Show whose turn it is when waiting
    const turnPlayer = currentTurnPlayer;
    const turnPlayerQueue = turnPlayer 
      ? room.queue_items.filter(q => q.status === "PENDING" && (q as any).player?.id === turnPlayer.id)
      : [];
    
    return (
      <div className="w-full h-full flex flex-col animate-in fade-in duration-1000 relative overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="p-8 rounded-full bg-indigo-500/10 text-indigo-500">
                <Music size={64} />
            </div>
            <div className="space-y-2">
                {turnPlayer ? (
                  <>
                    <h2 className="text-3xl font-bold text-white">
                      {language === "de" 
                        ? `${turnPlayer.nickname} ist dran!` 
                        : `${turnPlayer.nickname}'s Turn!`}
                    </h2>
                    <p className="text-neutral-500">
                      {turnPlayerQueue.length > 0 
                        ? (language === "de" 
                            ? "Song wird gleich abgespielt..." 
                            : "Song playing soon...")
                        : (language === "de" 
                            ? "Warte auf einen Song von diesem DJ..." 
                            : "Waiting for a song from this DJ...")}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-bold italic text-neutral-400">
                      {language === "de" ? "Warte auf Tracks..." : "Waiting for tracks..."}
                    </h2>
                    <p className="text-neutral-600">
                      {language === "de" 
                        ? "Die Warteschlange ist leer. Füge Songs auf deinem Handy hinzu!" 
                        : "The queue is empty. Add some fire on your phones!"}
                    </p>
                  </>
                )}
            </div>
            
            {/* Skip turn button when waiting for someone with empty queue */}
            {turnPlayer && turnPlayerQueue.length === 0 && room.queue_items.some(q => q.status === "PENDING") && (
              <button 
                onClick={handleNextSong}
                className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold text-sm text-neutral-300 flex items-center space-x-2 transition-colors"
              >
                <SkipForward size={16} />
                <span>{language === "de" ? "Zug überspringen" : "Skip Turn"}</span>
              </button>
            )}
        </div>
        <div className="flex items-center justify-between px-4 py-4 shrink-0 h-20 border-t border-neutral-900/50">
            <div className="flex items-center space-x-8 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowPlayers(true)}>
                <div className="flex -space-x-3">
                    {room.players.map((p, i) => (
                        <div key={p.id} className={`w-10 h-10 rounded-full border-2 bg-neutral-800 flex items-center justify-center font-bold text-xs ${
                          p.id === turnPlayer?.id 
                            ? 'border-indigo-500 text-indigo-500 ring-2 ring-indigo-500/50' 
                            : p.is_vip 
                              ? 'border-yellow-500 text-yellow-500' 
                              : 'border-neutral-950 text-white'
                        }`} style={{ zIndex: room.players.length - i }}>
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
            <div className={`flex items-center space-x-3 px-5 py-1.5 rounded-2xl border-2 font-mono text-3xl font-black transition-colors ${
              room.status === "PAUSED" 
                ? "border-yellow-500 text-yellow-500" 
                : timeLeft <= 0 && room.auto_skip === false
                  ? "border-green-500 text-green-500"
                  : timeLeft < 20 
                    ? "border-red-500 text-red-500 animate-pulse" 
                    : "border-neutral-800 text-white"
            }`}>
                {room.status === "PAUSED" ? <Pause size={20} /> : <Clock size={20} />}
                <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}</span>
                {room.status === "PAUSED" && <span className="text-xs uppercase tracking-wider ml-2">{language === "de" ? "Pausiert" : "Paused"}</span>}
                {timeLeft <= 0 && room.auto_skip === false && room.status !== "PAUSED" && (
                  <span className="text-xs uppercase tracking-wider ml-2">{language === "de" ? "Bereit" : "Ready"}</span>
                )}
            </div>
        </div>
      </div>
      <div 
        className="flex-1 min-h-0 w-full relative bg-black rounded-3xl overflow-hidden border border-neutral-800 shadow-[0_0_100px_rgba(79,70,229,0.1)] cursor-pointer group"
        onClick={togglePause}
      >
        {!isPlayerReady && <div className="absolute inset-0 z-30 bg-neutral-900 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>}
        
        {/* Pause Overlay */}
        {room.status === "PAUSED" && (
          <div className="absolute inset-0 z-40 bg-black/70 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="bg-neutral-900/80 p-8 rounded-full border border-neutral-700 mb-4">
              <Play size={64} className="text-white" fill="currentColor" />
            </div>
            <p className="text-neutral-400 text-lg font-medium">{language === "de" ? "Klicken zum Fortsetzen" : "Click to resume"}</p>
          </div>
        )}
        
        {/* Click hint on hover when playing */}
        {room.status === "PLAYING" && (
          <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center space-x-2 text-neutral-400 text-xs">
              <Pause size={12} />
              <span>{language === "de" ? "Klicken zum Pausieren" : "Click to pause"}</span>
            </div>
          </div>
        )}
        
        <iframe 
          key={`${room.current_video_id}-${iframeKey}`} 
          className={`absolute inset-0 w-full h-full border-none transition-opacity ${room.status === "PAUSED" ? "opacity-50" : ""}`} 
          src={`https://www.youtube.com/embed/${room.current_video_id}?autoplay=${room.status === "PLAYING" ? 1 : 0}&start=${room.current_video_offset || room.current_start_time || 0}&controls=0&modestbranding=1&rel=0`} 
          title="YouTube video player" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          onLoad={() => setIsPlayerReady(true)} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        
        {/* Hype Meter Overlay */}
        {activeQueueItem && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-6">
                <HypeMeter votes={activeQueueItem.votes as any} />
            </div>
        )}
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
            <button onClick={togglePause} className={`p-3 rounded-full transition-colors ${room.status === "PAUSED" ? "bg-green-500 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"}`} title={room.status === "PAUSED" ? (language === "de" ? "Fortsetzen" : "Resume") : (language === "de" ? "Pause" : "Pause")}>
                {room.status === "PAUSED" ? <Play size={20} fill="currentColor" /> : <Pause size={20} />}
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