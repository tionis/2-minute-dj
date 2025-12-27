"use client";

import { db } from "@/lib/db";
import { useSearchParams } from "next/navigation";
import { Loader2, Music4, Radio, Languages, Clock, Crown, Play } from "lucide-react";
import { Suspense, useState, useEffect } from "react";
import { id } from "@instantdb/react";
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
  const roomId = searchParams.get("roomId");
  const playerId = searchParams.get("playerId");

  // Game State
  const [step, setStep] = useState<"SEARCH" | "CLIP" | "SUCCESS">("SEARCH");
  const [videoData, setVideoData] = useState<{ id: string, startTime: number, title: string } | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [deleteItemId, setDeleteItem] = useState<string | null>(null);
  const [localVote, setLocalVote] = useState(50);

  const { data, isLoading, error } = db.useQuery(
    roomId && playerId
      ? {
          rooms: {
            $: { where: { id: roomId } },
            players: {}, 
            queue_items: { 
                 $: { where: {  } } 
            }
          },
          players: {
            $: { where: { id: playerId } },
            queue_items: { 
                $: { where: { status: "PENDING" } }
            }
          },
        }
      : null
  );

  const room = data?.rooms?.[0];
  const player = data?.players?.[0];
  const myQueue = player?.queue_items || [];
  const isVip = player?.is_vip || false;
  
  const activeQueueItem = room?.queue_items?.find(q => q.id === room?.active_queue_item_id);
  const isMyTurn = room?.active_player_id === playerId;

  // Sync local vote with DB when song changes or DB updates
  useEffect(() => {
      if (player && activeQueueItem?.votes?.[player.id] !== undefined) {
          setLocalVote(activeQueueItem.votes[player.id]);
      } else {
          setLocalVote(50);
      }
  }, [activeQueueItem?.id, player?.id]);

  if (!roomId || !playerId) {
    return <div className="text-white p-8">Missing parameters. Please join again.</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-8">Error: {error.message}</div>;
  }

  if (!room || !player) {
    return <div className="text-white p-8">Room or Player not found.</div>;
  }

  const commitVote = () => {
      if (!activeQueueItem) return;
      const currentVotes = activeQueueItem.votes || {};
      const newVotes = { ...currentVotes, [player.id]: localVote };
      db.transact(db.tx.queue_items[activeQueueItem.id].update({ votes: newVotes }));
  };

  const handleQueue = (startTime: number) => {
    if (!videoData) return;

    const queueId = id();
    db.transact(
        db.tx.queue_items[queueId].update({
            video_id: videoData.id,
            video_title: videoData.title,
            highlight_start: startTime,
            status: "PENDING",
            created_at: Date.now(),
        })
        .link({ room: roomId, player: playerId })
    );
    setStep("SUCCESS");
  };

  const handleDeleteClick = (itemId: string) => {
      setDeleteItem(itemId);
  };

  const handleDeleteConfirm = () => {
      if (deleteItemId) {
          db.transact(db.tx.queue_items[deleteItemId].delete());
          setDeleteItem(null);
      }
  };

  const handleChangeName = (newName: string) => {
      db.transact(db.tx.players[player.id].update({ nickname: newName }));
      setShowNameModal(false);
  };

  const handleQuitConfirm = () => {
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
      db.transact(db.tx.rooms[roomId].update({ 
        status: "PLAYING", 
        playback_started_at: Date.now() 
      }));
    };

    const updateTimer = (sec: number) => {
      db.transact(db.tx.rooms[roomId].update({ timer_duration: sec }));
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
        <SummaryView room={room as any} />
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

        {/* Voting UI - Only when song is playing */}
        {activeQueueItem && room.status !== "PAUSED" && (
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
            <VIPControls room={room as any} queueItems={room.queue_items} />
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