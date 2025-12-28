"use client";

import { useEffect, useState, useRef } from "react";
import { useGameStore } from "@/lib/game-context";
import { generateRoomCode } from "@/lib/utils";
import { Copy, Users, Play, Loader2, X, Crown, LogOut, Languages, Clock, SkipForward } from "lucide-react";
import GameView from "@/components/host/GameView";
import SummaryView from "@/components/host/SummaryView";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/components/LanguageProvider";
import { saveSession, SessionSong } from "@/lib/session-history";

export default function HostPage() {
  const { t, language, setLanguage } = useI18n();
  const { state, updateState, roomId, setRoomId } = useGameStore();
  
  const [origin, setOrigin] = useState("");
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [kickPlayerId, setKickPlayerId] = useState<string | null>(null);
  const [kickPlayerName, setKickPlayerName] = useState("");

  const room = state.room;
  // Convert Record to Array and sort
  const players = Object.values(state.players || {}).sort((a, b) => a.joined_at - b.joined_at);

  const handleKickClick = (playerId: string, name: string) => {
      setKickPlayerId(playerId);
      setKickPlayerName(name);
  };

  const handleKickConfirm = () => {
      if (kickPlayerId) {
          updateState(doc => {
              delete doc.players[kickPlayerId];
              // Also remove their queue items?
              // In InstantDB this might cascade, here we should do it manually if we want clean state.
              // For now, keeping it simple.
          });
          setKickPlayerId(null);
      }
  };

  const handleToggleVIP = (playerId: string) => {
      updateState(doc => {
          if (doc.players[playerId]) {
              doc.players[playerId].is_vip = !doc.players[playerId].is_vip;
          }
      });
  };

  // Create room on mount or restore from local storage
  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
    
    const savedRoomId = localStorage.getItem("2mdj_host_roomId");
    const savedRoomCode = localStorage.getItem("2mdj_host_roomCode");

    if (savedRoomId && savedRoomCode) {
        if (roomId !== savedRoomId) {
            setRoomId(savedRoomId);
        }

        // If we have credentials but state is empty (migration or cleared cache),
        // re-initialize the room state so we don't get stuck loading.
        if (!room.code) {
            updateState(doc => {
                doc.room = {
                    id: savedRoomId,
                    code: savedRoomCode,
                    status: "LOBBY",
                    created_at: Date.now(),
                };
                if (!doc.players) doc.players = {};
                if (!doc.queue_items) doc.queue_items = {};
            });
        }
        return;
    }

    if (roomId) return;

    const code = generateRoomCode();
    const newRoomId = code; // Use code as ID for P2P discovery
    
    // Save to local storage
    localStorage.setItem("2mdj_host_roomId", newRoomId);
    localStorage.setItem("2mdj_host_roomCode", code);

    setRoomId(newRoomId);

    // Initialize state
    updateState(doc => {
        doc.room = {
            id: newRoomId,
            code: code,
            status: "LOBBY",
            created_at: Date.now(),
        };
        doc.players = {};
        doc.queue_items = {};
    });
  }, [roomId, setRoomId, updateState]);

  // Track if we've already saved this session to prevent duplicates
  const sessionSavedRef = useRef(false);

  // Save session to history when game ends
  useEffect(() => {
    if (room.status === "FINISHED" && !sessionSavedRef.current && room.code) {
      sessionSavedRef.current = true;
      
      const songs: SessionSong[] = Object.values(state.queue_items)
        .filter(q => q.status === "PLAYED" || q.status === "SKIPPED")
        .sort((a, b) => a.created_at - b.created_at)
        .map(q => ({
          id: q.id,
          video_id: q.video_id,
          video_title: q.video_title || "Unknown Track",
          player_nickname: state.players[q.player_id]?.nickname || "Unknown",
          votes: q.votes ? Object.values(q.votes) : [],
          status: q.status as "PLAYED" | "SKIPPED",
        }));

      saveSession({
        roomCode: room.code,
        songs,
        playerCount: Object.keys(state.players).length,
        endedAt: Date.now(),
        role: "host",
      });
    }
    
    // Reset the ref when status changes away from FINISHED
    if (room.status !== "FINISHED") {
      sessionSavedRef.current = false;
    }
  }, [room.status, room.code, state.queue_items, state.players]);

  const handleQuitConfirm = () => {
      localStorage.removeItem("2mdj_host_roomId");
      localStorage.removeItem("2mdj_host_roomCode");
      // Clear store persistence
      localStorage.removeItem("2mdj_doc_backup");
      window.location.href = "/";
  };

  const startGame = () => {
    updateState(doc => {
        doc.room.status = "PLAYING";
        doc.room.playback_started_at = Date.now();
    });
  };

  const updateTimer = (sec: number) => {
      updateState(doc => {
          doc.room.timer_duration = sec;
      });
  };

  const toggleAutoSkip = () => {
      updateState(doc => {
          doc.room.auto_skip = doc.room.auto_skip === false; // toggle logic inverted in UI
      });
  };

  const renderLangSwitcher = () => (
    <div className="flex items-center space-x-2 bg-neutral-900/50 p-1 rounded-full border border-neutral-800">
        <button 
          onClick={() => setLanguage("en")}
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${language === "en" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-neutral-500 hover:text-neutral-300"}`}
        >
          EN
        </button>
        <button 
          onClick={() => setLanguage("de")}
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${language === "de" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-neutral-500 hover:text-neutral-300"}`}
        >
          DE
        </button>
    </div>
  );

  // Loading state
  if (!room.code) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (room.status === "PLAYING" || room.status === "PAUSED") {
    return (
      <div className="h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 relative tv-scale">
        <div className="absolute top-6 left-6 z-50 flex items-center space-x-4">
            <div className="cursor-pointer" onClick={() => setShowQuitModal(true)}>
                <div className="flex items-center space-x-2 text-neutral-500 hover:text-white transition-colors opacity-50 hover:opacity-100">
                    <div className="p-2 rounded-full bg-neutral-900 border border-neutral-800">
                        <LogOut size={16} /> 
                    </div>
                </div>
            </div>
            {renderLangSwitcher()}
        </div>
        <div className="w-full max-w-7xl h-full flex flex-col justify-center">
            {/* We pass the room state to GameView, but GameView also uses store internally now */}
            <GameView />
        </div>
        <ConfirmationModal 
            isOpen={showQuitModal}
            onCancel={() => setShowQuitModal(false)}
            onConfirm={handleQuitConfirm}
            title={t("endParty")}
            description={language === "de" ? "Dies wird alle Spieler trennen und den Raum schließen. Bist du sicher?" : "This will disconnect all players and close the room. Are you sure?"}
            confirmText={t("endParty")}
            cancelText={t("cancel")}
        />
      </div>
    );
  }

  if (room.status === "FINISHED") {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-12 overflow-y-auto relative">
        <div className="absolute top-6 left-6 z-50 flex items-center space-x-4">
            <div className="cursor-pointer" onClick={() => setShowQuitModal(true)}>
                <div className="flex items-center space-x-2 text-neutral-500 hover:text-white transition-colors">
                    <div className="p-2 rounded-full bg-neutral-900 border border-neutral-800">
                        <LogOut size={16} /> 
                    </div>
                    <span className="font-bold text-sm tracking-widest uppercase">EXIT</span>
                </div>
            </div>
            {renderLangSwitcher()}
        </div>
        <SummaryView />
        <ConfirmationModal 
            isOpen={showQuitModal}
            onCancel={() => setShowQuitModal(false)}
            onConfirm={handleQuitConfirm}
            title={language === "de" ? "Zusammenfassung verlassen?" : "Leave Summary?"}
            description={language === "de" ? "Du verlässt gerade den Ergebnisbildschirm." : "You are about to leave the results screen."}
            confirmText={t("leave")}
            cancelText={t("cancel")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-8 relative">
      {/* Home Button */}
      <div className="absolute top-6 left-6 z-10 flex items-center space-x-4">
        <div className="cursor-pointer" onClick={() => setShowQuitModal(true)}>
            <div className="flex items-center space-x-2 text-neutral-500 hover:text-white transition-colors">
                <div className="p-2 rounded-full bg-neutral-900 border border-neutral-800">
                    <LogOut size={16} /> 
                </div>
                <span className="font-bold text-sm tracking-widest uppercase">EXIT</span>
            </div>
        </div>
        {renderLangSwitcher()}
      </div>

      <ConfirmationModal 
        isOpen={showQuitModal}
        onCancel={() => setShowQuitModal(false)}
        onConfirm={handleQuitConfirm}
        title={language === "de" ? "Party abbrechen?" : "Cancel Party?"}
        description={language === "de" ? "Bist du sicher, dass du diesen Raum schließen willst? Alle Spieler werden getrennt." : "Are you sure you want to close this room? Players will be disconnected."}
        confirmText={t("confirm")}
        cancelText={t("cancel")}
      />

      <ConfirmationModal 
        isOpen={!!kickPlayerId}
        onCancel={() => setKickPlayerId(null)}
        onConfirm={handleKickConfirm}
        title={`${t("kick")} ${kickPlayerName}?`}
        description={language === "de" ? "Bist du sicher, dass du diesen Spieler hinauswerfen willst?" : "Are you sure you want to kick this player?"}
        confirmText={t("kick")}
        cancelText={t("cancel")}
      />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
        
        {/* Left: Join Info */}
        <div className="lg:col-span-2 space-y-12 flex flex-col items-center lg:items-start">
            <div className="text-center lg:text-left space-y-4">
                <h2 className="text-neutral-400 font-medium tracking-widest uppercase text-sm">{t("joinAt")}</h2>
                <h1 className="text-4xl font-bold">{origin.replace(/^https?:\/\//, "")}</h1>
            </div>

            <div className="relative group cursor-pointer text-center lg:text-left" onClick={() => navigator.clipboard.writeText(room.code || "")}>
                <h2 className="text-neutral-500 font-bold uppercase text-xs tracking-[0.3em] mb-2">{t("roomCode")}</h2>
                <h1 className="text-9xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-400 select-none leading-none">
                {room.code}
                </h1>
            </div>

            {/* Game Settings */}
            <div className="w-full max-w-lg bg-neutral-900/50 rounded-2xl border border-neutral-800 p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 border-b border-neutral-800 pb-2">
                    {language === "de" ? "Einstellungen" : "Settings"}
                </h3>
                
                {/* Timer Duration */}
                <div className="space-y-2">
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
                                    (room?.timer_duration || 120) === sec 
                                        ? "border-indigo-500 bg-indigo-500/20 text-white" 
                                        : "border-neutral-800 bg-neutral-800/50 text-neutral-400 hover:border-neutral-700"
                                }`}
                            >
                                {sec}s
                            </button>
                        ))}
                    </div>
                </div>

                {/* Auto-Skip Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                    <div className="flex items-center space-x-2">
                        <SkipForward size={14} className="text-neutral-500" />
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-neutral-300">
                                {language === "de" ? "Auto-Skip" : "Auto-Skip"}
                            </span>
                            <span className="text-[10px] text-neutral-500">
                                {language === "de" ? "Automatisch weiter bei 00:00" : "Auto advance at 00:00"}
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={toggleAutoSkip}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                            room?.auto_skip !== false 
                                ? "bg-indigo-500" 
                                : "bg-neutral-700"
                        }`}
                    >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            room?.auto_skip !== false 
                                ? "translate-x-6" 
                                : "translate-x-0.5"
                        }`} />
                    </button>
                </div>
            </div>

            {/* Start Button */}
            <button 
                disabled={players.length === 0}
                onClick={startGame}
                className="cursor-pointer px-12 py-6 bg-white text-black rounded-full font-bold text-2xl hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-3 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
            >
                <span>{t("startParty")}</span>
                <Play size={24} fill="currentColor" />
            </button>
        </div>

        {/* Right: QR Code & Player Count */}
        <div className="flex flex-col items-center space-y-8 bg-neutral-900/50 p-10 rounded-[3rem] border border-neutral-800">
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_0_50px_rgba(79,70,229,0.2)]">
                <QRCodeSVG 
                    value={`${origin}/join?code=${room.code}`}
                    size={200}
                    level="H"
                    includeMargin={false}
                />
            </div>
            
            <div className="text-center space-y-2">
                <div className="flex items-center justify-center space-x-2 text-indigo-400">
                    <Users size={24} />
                    <span className="font-bold text-2xl">{players.length}</span>
                </div>
                <p className="text-neutral-500 font-medium">{t("playersJoined")}</p>
            </div>
        </div>

      </div>

      {/* Players List (Bottom) */}
      {players.length > 0 && (
        <div className="mt-16 w-full max-w-6xl">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {players.map((player) => (
                    <div key={player.id} className={`group relative bg-neutral-800/50 p-4 rounded-2xl flex items-center space-x-3 border animate-in fade-in zoom-in duration-300 transition-colors ${player.is_vip ? "border-yellow-500/50" : "border-neutral-700/50 hover:border-red-500/50"}`}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                            {player.nickname.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="font-medium truncate text-sm flex-1">{player.nickname}</span>
                        
                        <div className="absolute -top-2 -right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* VIP Button */}
                            <button 
                                onClick={() => handleToggleVIP(player.id)}
                                className={`p-1 rounded-full hover:scale-110 transition-transform ${player.is_vip ? "bg-yellow-500 text-black" : "bg-neutral-700 text-neutral-400 hover:bg-yellow-500 hover:text-black"}`}
                                title={t("toggleVip")}
                            >
                                <Crown size={12} fill={player.is_vip ? "currentColor" : "none"} />
                            </button>

                            {/* Kick Button */}
                            <button 
                                onClick={() => handleKickClick(player.id, player.nickname)}
                                className="bg-red-500 text-white p-1 rounded-full hover:scale-110 transition-transform"
                                title={t("kick")}
                            >
                                <X size={12} />
                            </button>
                        </div>
                        
                        {/* Always visible VIP indicator */}
                        {player.is_vip && (
                            <div className="absolute -top-3 -left-1 text-yellow-500 rotate-[-15deg]">
                                <Crown size={16} fill="currentColor" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}