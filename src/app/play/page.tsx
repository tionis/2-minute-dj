"use client";

import { useGameStore } from "@/lib/game-context";
import { useSearchParams } from "next/navigation";
import { Loader2, Music4, Radio, Languages, Clock, Crown, Play, SkipForward } from "lucide-react";
import { Suspense, useState, useEffect } from "react";
import SearchStep from "@/components/player/SearchStep";
import ClipperStep from "@/components/player/ClipperStep";
import SuccessStep from "@/components/player/SuccessStep";
import { Trash2, Home, ThumbsUp, ThumbsDown, Edit2, Pause } from "lucide-react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import InputModal from "@/components/ui/InputModal";
import VIPControls from "@/components/player/VIPControls";
import { Slider } from "@/components/ui/slider";
import SummaryView from "@/components/host/SummaryView";
import { useI18n } from "@/components/LanguageProvider";

function PlayContent() {
  const { t, language, setLanguage } = useI18n();
  const searchParams = useSearchParams();
  const urlRoomId = searchParams.get("roomId");
  
  const { state, updateState, peerId, setRoomId, roomId, isConnected } = useGameStore();

  // If we arrived here with a room ID in URL but not connected, connect.
  useEffect(() => {
      if (urlRoomId && urlRoomId !== roomId) {
          setRoomId(urlRoomId);
      }
  }, [urlRoomId, roomId, setRoomId]);

  // Game State
  const [step, setStep] = useState<"SEARCH" | "CLIP" | "SUCCESS">("SEARCH");
  const [videoData, setVideoData] = useState<{ id: string, startTime: number, title: string } | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [deleteItemId, setDeleteItem] = useState<string | null>(null);
  const [localVote, setLocalVote] = useState(50);

  const room = state.room;
  const player = state.players[peerId];
  
  // Derived data
  const myQueue = Object.values(state.queue_items)
      .filter(q => q.player_id === peerId && q.status === "PENDING")
      .sort((a,b) => a.created_at - b.created_at);
      
  const isVip = player?.is_vip || false;
  
  const activeQueueItem = state.queue_items[room.active_queue_item_id || ""];
  const isMyTurn = room.active_player_id === peerId;

  // Get or initialize player order (helper for skip logic)
  const getPlayerOrder = (currentPlayers: typeof state.players[string][], currentOrder?: string[]): string[] => {
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
        
        // Mark as played/skipped so it doesn't play again immediately
        if (activeItem) {
            activeItem.status = "SKIPPED";
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

        // Try to find next player with a song
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

        // If no one has songs, just pass turn to next player in circle
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

  // Sync local vote with DB when song changes or DB updates
  useEffect(() => {
      if (player && activeQueueItem?.votes?.[player.id] !== undefined) {
          setLocalVote(activeQueueItem.votes[player.id]);
      } else {
          setLocalVote(50);
      }
  }, [activeQueueItem?.id, player?.id]);

  if (!roomId || !peerId) {
    return <div className="text-white p-8">Missing parameters. Please join again.</div>;
  }

  // We don't have explicit loading state for "query", but we can check if room code is synced
  if (!room.code || !isConnected) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <p className="text-neutral-500 text-sm">Syncing party state...</p>
      </div>
    );
  }

  if (!player) {
    // Player not found in state (maybe kicked or state lost)
    // We could redirect to join?
    return <div className="text-white p-8">Player not found in room. You may have been kicked or the room was closed.</div>;
  }

  const commitVote = () => {
      if (!activeQueueItem) return;
      updateState(doc => {
          const item = doc.queue_items[activeQueueItem.id];
          if (item) {
              if (!item.votes) item.votes = {};
              item.votes[peerId] = localVote;
          }
      });
  };

  const handleQueue = (startTime: number) => {
    if (!videoData) return;

    const queueId = crypto.randomUUID();
    updateState(doc => {
        doc.queue_items[queueId] = {
            id: queueId,
            video_id: videoData.id,
            video_title: videoData.title,
            highlight_start: startTime,
            status: "PENDING",
            created_at: Date.now(),
            player_id: peerId,
            room_id: roomId,
        };
    });
    setStep("SUCCESS");
  };

  const handleDeleteClick = (itemId: string) => {
      setDeleteItem(itemId);
  };

  const handleDeleteConfirm = () => {
      if (deleteItemId) {
          updateState(doc => {
              delete doc.queue_items[deleteItemId];
          });
          setDeleteItem(null);
      }
  };

  const handleChangeName = (newName: string) => {
      updateState(doc => {
          if (doc.players[peerId]) {
              doc.players[peerId].nickname = newName;
          }
      });
      setShowNameModal(false);
  };

  const handleQuitConfirm = () => {
      setRoomId(""); // Disconnect
      window.location.href = "/";
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

  // Lobby View
  if (room.status === "LOBBY") {
    const handleStartParty = () => {
      updateState(doc => {
          doc.room.status = "PLAYING";
          doc.room.playback_started_at = Date.now();
      });
    };

    const updateTimer = (sec: number) => {
      updateState(doc => doc.room.timer_duration = sec);
    };

    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col p-6">
        <header className="flex justify-between items-center mb-8 opacity-50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setShowQuitModal(true)}>
                <Home size={16} />
                <div className="font-mono text-xs uppercase">EXIT</div>
            </div>
            {renderLangSwitcher()}
          </div>
          <div 
            className="flex items-center space-x-2 font-mono text-xs cursor-pointer hover:text-white transition-colors"
            onClick={() => setShowNameModal(true)}
          >
            <span>{player.nickname}</span>
            <Edit2 size={12} className="opacity-50" />
          </div>
        </header>

        <ConfirmationModal 
            isOpen={showQuitModal}
            onCancel={() => setShowQuitModal(false)}
            onConfirm={handleQuitConfirm}
            title={t("leaveParty")}
            description={t("leaveDesc")}
            confirmText={t("leave")}
            cancelText={t("cancel")}
        />

        <InputModal
            isOpen={showNameModal}
            onCancel={() => setShowNameModal(false)}
            onConfirm={handleChangeName}
            title={t("changeName")}
            placeholder={language === "de" ? "Neuer Name..." : "New name..."}
            initialValue={player.nickname}
            confirmText={t("save")}
            cancelText={t("cancel")}
        />

        <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative bg-neutral-900 border border-neutral-800 p-8 rounded-full">
              <Radio size={48} className="text-indigo-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <h2 className="text-2xl font-bold">{language === "de" ? "Du bist drin!" : "You're in!"}</h2>
            <p className="text-neutral-500">
              {isVip 
                ? (language === "de" ? "Als VIP kannst du die Party starten und Einstellungen ändern!" : "As VIP, you can start the party and change settings!")
                : (language === "de" ? "Warte auf den Host, um das Spiel zu starten. Überleg dir schonmal deine Lieblingssongs!" : "Waiting for the host to start the game. Get your favorite songs ready in your mind!")
              }
            </p>
          </div>

          {/* VIP Lobby Controls */}
          {isVip && (
            <div className="w-full max-w-sm space-y-6 bg-neutral-900/80 border border-yellow-500/30 rounded-2xl p-6 animate-in fade-in zoom-in">
              <div className="flex items-center justify-center space-x-2 text-yellow-500 font-bold uppercase tracking-widest text-xs">
                <Crown size={14} fill="currentColor" />
                <span>{language === "de" ? "VIP Steuerung" : "VIP Controls"}</span>
              </div>
              
              {/* Timer Setting */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center justify-center space-x-1">
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
              </div>

              {/* Auto-Skip Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
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
              <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
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

              {/* Start Button */}
              <button 
                onClick={handleStartParty}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl font-bold text-white flex items-center justify-center space-x-2 hover:opacity-90 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Play size={20} fill="currentColor" />
                <span>{t("startParty")}</span>
              </button>
            </div>
          )}

          <div className="pt-8 flex items-center space-x-2 text-xs text-neutral-600 uppercase tracking-widest">
            <Music4 size={12} />
            <span>{language === "de" ? "Lobby Phase" : "Lobby Phase"}</span>
          </div>
        </div>
      </div>
    );
  }

  if (room.status === "FINISHED") {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-6 overflow-y-auto">
        <header className="flex justify-between items-center mb-8 opacity-50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setShowQuitModal(true)}>
                <Home size={16} />
                <div className="font-mono text-xs uppercase">EXIT</div>
            </div>
            {renderLangSwitcher()}
          </div>
          <div 
            className="flex items-center space-x-2 font-mono text-xs cursor-pointer hover:text-white transition-colors"
            onClick={() => setShowNameModal(true)}
          >
            <span>{player.nickname}</span>
            <Edit2 size={12} className="opacity-50" />
          </div>
        </header>
        <SummaryView goHome={true} />
        <ConfirmationModal 
            isOpen={showQuitModal}
            onCancel={() => setShowQuitModal(false)}
            onConfirm={handleQuitConfirm}
            title={t("leaveParty")}
            description={t("leaveDesc")}
            confirmText={t("leave")}
            cancelText={t("cancel")}
        />
        <InputModal
            isOpen={showNameModal}
            onCancel={() => setShowNameModal(false)}
            onConfirm={handleChangeName}
            title={t("changeName")}
            placeholder={language === "de" ? "Neuer Name..." : "New name..."}
            initialValue={player.nickname}
            confirmText={t("save")}
            cancelText={t("cancel")}
        />
      </div>
    );
  }

  // Game View (PLAYING or PAUSED)
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col p-6">
      <header className="flex flex-col space-y-4 mb-8 opacity-100">
        <div className="flex justify-between items-center opacity-50">
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setShowQuitModal(true)}>
                    <Home size={16} />
                </div>
                {renderLangSwitcher()}
            </div>
            <div className="font-mono text-xs font-bold text-indigo-400 uppercase tracking-widest">2-MINUTE DJ</div>
            <div 
                className="flex items-center space-x-2 font-mono text-xs cursor-pointer hover:text-white transition-colors"
                onClick={() => setShowNameModal(true)}
            >
                <span>{player.nickname}</span>
                <Edit2 size={12} className="opacity-50" />
            </div>
        </div>

        {/* Paused indicator */}
        {room.status === "PAUSED" && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center justify-center space-x-2 text-yellow-500 animate-in fade-in">
            <Pause size={16} />
            <span className="font-bold text-sm">{language === "de" ? "Party pausiert" : "Party paused"}</span>
          </div>
        )}

        {/* It's your turn indicator */}
        {isMyTurn && !activeQueueItem && room.status !== "PAUSED" && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex flex-col items-center justify-center space-y-2 text-indigo-400 animate-in fade-in animate-pulse">
            <span className="font-bold text-lg">
              {language === "de" ? "🎵 Du bist dran!" : "🎵 It's your turn!"}
            </span>
            <span className="text-sm text-indigo-300/70">
              {myQueue.length > 0 
                ? (language === "de" ? "Dein Song wird gleich abgespielt..." : "Your song will play soon...")
                : (language === "de" ? "Füge schnell einen Song hinzu!" : "Quick, add a song!")}
            </span>
          </div>
        )}

        {/* Skip My Song Control (When Playing) */}
        {isMyTurn && activeQueueItem && room.status !== "PAUSED" && (
             <div className="bg-neutral-900/80 p-4 rounded-2xl flex flex-col items-center space-y-3 border border-indigo-500/30 animate-in fade-in">
                 <div className="text-center">
                    <div className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-1">{t("nowSpinning")}</div>
                    <div className="text-sm font-bold text-white max-w-[250px] truncate">{activeQueueItem.video_title || t("unknownTrack")}</div>
                 </div>
                 <button 
                    onClick={handleSkip}
                    className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all border border-neutral-700"
                 >
                    <SkipForward size={16} />
                    <span>{language === "de" ? "Meinen Song überspringen" : "Skip My Song"}</span>
                 </button>
             </div>
        )}

        {/* Voting UI - Shown if not my turn OR if self-voting is allowed */}
        {activeQueueItem && room.status !== "PAUSED" && (!isMyTurn || room.allow_self_voting) && (
            <div className="bg-neutral-900/80 p-4 rounded-2xl flex flex-col space-y-4 border border-neutral-800 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col overflow-hidden mr-4">
                        <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">{t("nowSpinning")}</span>
                        <span className="text-sm font-bold truncate text-white">{activeQueueItem.video_title || t("unknownTrack")}</span>
                    </div>
                    <div className={`text-xl font-bold transition-colors ${localVote > 75 ? 'text-green-500' : localVote < 25 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {localVote}%
                    </div>
                </div>
                
                <div className="flex items-center space-x-3">
                    <ThumbsDown 
                        size={20} 
                        className={`transition-colors ${localVote < 25 ? "text-red-500 fill-current" : "text-neutral-600"}`} 
                    />
                    <div className="flex-1 relative h-6 flex items-center">
                        <div className="absolute inset-0 h-2 bg-gradient-to-r from-red-900 via-neutral-700 to-green-900 rounded-full my-auto" />
                        <Slider 
                            min={0}
                            max={100}
                            value={localVote}
                            onChange={(e) => setLocalVote(Number(e.target.value))}
                            onMouseUp={commitVote}
                            onTouchEnd={commitVote}
                            className="relative z-10"
                        />
                    </div>
                    <ThumbsUp 
                        size={20} 
                        className={`transition-colors ${localVote > 75 ? "text-green-500 fill-current" : "text-neutral-600"}`} 
                    />
                </div>
            </div>
        )}
      </header>

      <ConfirmationModal 
        isOpen={showQuitModal}
        onCancel={() => setShowQuitModal(false)}
        onConfirm={handleQuitConfirm}
        title={t("leaveParty")}
        description={t("leaveDesc")}
        confirmText={t("leave")}
        cancelText={t("cancel")}
      />

      <ConfirmationModal 
        isOpen={!!deleteItemId}
        onCancel={() => setDeleteItem(null)}
        onConfirm={handleDeleteConfirm}
        title={language === "de" ? "Song löschen?" : "Delete Song?"}
        description={language === "de" ? "Bist du sicher, dass du diesen Song aus deiner Warteschlange entfernen willst?" : "Are you sure you want to remove this song from your queue?"}
        confirmText={language === "de" ? "Löschen" : "Delete"}
        cancelText={t("cancel")}
      />

      <InputModal
        isOpen={showNameModal}
        onCancel={() => setShowNameModal(false)}
        onConfirm={handleChangeName}
        title={t("changeName")}
        placeholder={language === "de" ? "Neuer Name..." : "New name..."}
        initialValue={player.nickname}
        confirmText={t("save")}
        cancelText={t("cancel")}
      />

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center mb-8">
            {step === "SEARCH" && (
                <SearchStep 
                    onNext={(vid, start, title) => {
                        setVideoData({ id: vid, startTime: start, title });
                        setStep("CLIP");
                    }} 
                />
            )}

            {step === "CLIP" && videoData && (
                <ClipperStep 
                    videoId={videoData.id}
                    timerDuration={room.timer_duration || 120}
                    onQueue={handleQueue}
                    onBack={() => setStep("SEARCH")}
                />
            )}

            {step === "SUCCESS" && (
                <SuccessStep 
                    onAddAnother={() => {
                        setVideoData(null);
                        setStep("SEARCH");
                    }}
                />
            )}
        </div>

        {/* My Queue Section - Always Visible */}
        {myQueue.length > 0 && (
            <div className="w-full max-w-md mx-auto bg-neutral-900/50 rounded-2xl border border-neutral-800 p-4 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">{t("myQueue")}</h3>
                <div className="space-y-3">
                    {myQueue.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-neutral-800 p-3 rounded-xl">
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <img 
                                    src={`https://img.youtube.com/vi/${item.video_id}/default.jpg`} 
                                    className="w-10 h-10 rounded object-cover"
                                />
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-xs font-bold truncate text-white">
                                        {item.video_title || t("unknownTrack")}
                                    </span>
                                    <span className="text-xs font-mono truncate text-neutral-400">
                                        Start: {Math.floor(item.highlight_start / 60)}:{(item.highlight_start % 60).toString().padStart(2, "0")}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDeleteClick(item.id)}
                                className="p-2 text-neutral-600 hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

        {/* VIP Controls */}
        {isVip && (
            <VIPControls room={room} players={Object.values(state.players)} queueItems={Object.values(state.queue_items)} />
        )}
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    }>
      <PlayContent />
    </Suspense>
  );
}
