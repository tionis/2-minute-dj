"use client";

import { useGameStore } from "@/lib/game-context";
import { useSearchParams } from "next/navigation";
import { Loader2, Music4, Radio, Languages, Clock, Crown, Play, SkipForward } from "lucide-react";
import { Suspense, useState, useEffect, useRef } from "react";
import SearchStep from "@/components/player/SearchStep";
import ClipperStep from "@/components/player/ClipperStep";
import SuccessStep from "@/components/player/SuccessStep";
import { Trash2, Home, ThumbsUp, ThumbsDown, Edit2, Pause, RotateCcw } from "lucide-react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import InputModal from "@/components/ui/InputModal";
import VIPControls from "@/components/player/VIPControls";
import { Slider } from "@/components/ui/slider";
import SummaryView from "@/components/host/SummaryView";
import { useI18n } from "@/components/LanguageProvider";
import db from "@/lib/db";
import { id } from "@instantdb/react";
import { computeAdvanceToNextSong } from "@/lib/utils";

function PlayContent() {
  const { t, language, setLanguage } = useI18n();
  const searchParams = useSearchParams();
  const urlRoomId = searchParams.get("roomId");
  const urlPlayerId = searchParams.get("playerId");
  const { user, isLoadingAuth, peerId } = useGameStore();

  const [roomId] = useState<string | null>(
    urlRoomId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("2mdj_current_room_id")
        : null)
  );
  const [playerId] = useState<string | null>(
    urlPlayerId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("2mdj_current_player_id")
        : null)
  );

  const [step, setStep] = useState<"SEARCH" | "CLIP" | "SUCCESS">("SEARCH");
  const [videoData, setVideoData] = useState<{
    id: string;
    startTime: number;
    title: string;
  } | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [deleteItemId, setDeleteItem] = useState<string | null>(null);
  const [localVote, setLocalVote] = useState(50);
  const [localPrevVote, setLocalPrevVote] = useState(50);

  const { data, isLoading } = db.useQuery((
    roomId
      ? {
          rooms: {
            $: { where: { id: roomId } },
            players: {},
            queueItems: {},
          },
        }
      : null
  ) as any) as any;

  const room = (data?.rooms?.[0] ?? null) as any;
  const players: any[] = room?.players ?? [];
  const queueItems: any[] = room?.queueItems ?? [];
  const player = players.find((p: any) => p.id === playerId);

  const myQueue = queueItems
    .filter((q: any) => q.playerId === playerId && q.status === "PENDING")
    .sort((a: any, b: any) => a.createdAt - b.createdAt);

  const isVip = player?.isVip ?? false;
  const activeQueueItem = queueItems.find(
    (q: any) => q.id === room?.activeQueueItemId
  ) as any;
  const previousQueueItem = queueItems.find(
    (q: any) => q.id === room?.previousQueueItemId
  ) as any;
  const isMyTurn = room?.activePlayerId === playerId;

  const handleSkip = () => {
    if (!roomId || !room) return;

    const currentActiveItem = queueItems.find(
      (q: any) => q.id === room.activeQueueItemId
    );

    const result = computeAdvanceToNextSong(
      room,
      players,
      queueItems,
      false
    );

    const txns: any[] = [];

    if (currentActiveItem) {
      txns.push(
        db.tx.queueItems[currentActiveItem.id].update({
          status: "SKIPPED",
        })
      );
    }

    txns.push(
      db.tx.rooms[roomId].update({
        ...result.roomUpdates,
        previousQueueItemId: currentActiveItem?.id ?? null,
      })
    );

    db.transact(txns);
  };

  useEffect(() => {
    if (player && playerId && activeQueueItem?.votes?.[playerId] !== undefined) {
      setLocalVote(activeQueueItem.votes[playerId]);
    } else {
      setLocalVote(50);
    }
  }, [activeQueueItem?.id]);

  useEffect(() => {
    setLocalPrevVote(50);
  }, [previousQueueItem?.id]);

  if (isLoadingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <p className="text-neutral-500 text-sm">Loading party...</p>
      </div>
    );
  }

  if (!roomId || !playerId || !room) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="inline-block p-5 rounded-full bg-red-500/10 border border-red-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-500"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">
              {language === "de" ? "Parameter fehlen" : "Missing Parameters"}
            </h2>
            <p className="text-neutral-500 text-sm">
              {language === "de"
                ? "Die Verbindung wurde unterbrochen. Bitte tritt der Session erneut bei."
                : "The connection was lost. Please rejoin the session."}
            </p>
          </div>
          <a
            href="/join"
            className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors inline-flex items-center justify-center space-x-2"
          >
            <span>{language === "de" ? "Neu beitreten" : "Rejoin"}</span>
          </a>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="inline-block p-5 rounded-full bg-yellow-500/10 border border-yellow-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-yellow-500"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">{language === "de" ? "Nicht mehr in der Session" : "No Longer in Session"}</h2>
            <p className="text-neutral-500 text-sm">
              {language === "de" ? "Du wurdest möglicherweise entfernt oder die Session wurde beendet." : "You may have been removed or the session has ended."}
            </p>
          </div>
          <a
            href="/join"
            className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors inline-flex items-center justify-center space-x-2"
          >
            <span>{language === "de" ? "Erneut beitreten" : "Try Rejoining"}</span>
          </a>
        </div>
      </div>
    );
  }

  const commitVote = () => {
    if (!activeQueueItem) return;
    const votes = { ...(activeQueueItem.votes || {}), [playerId!]: localVote };
    db.transact(
      db.tx.queueItems[activeQueueItem.id].update({ votes })
    );
  };

  const commitPreviousVote = () => {
    if (!previousQueueItem) return;
    const votes = {
      ...(previousQueueItem.votes || {}),
      [playerId!]: localPrevVote,
    };
    db.transact(
      db.tx.queueItems[previousQueueItem.id].update({ votes })
    );
  };

  const handleQueue = (startTime: number) => {
    if (!videoData || !roomId || !playerId) return;

    const queueId = id();
    db.transact([
      db.tx.queueItems[queueId]
        .update({
          playerId,
          videoId: videoData.id,
          videoTitle: videoData.title,
          highlightStart: startTime,
          status: "PENDING",
          createdAt: Date.now(),
        })
        .link({ player: playerId, room: roomId }),
    ]);
    setStep("SUCCESS");
  };

  const handleDeleteClick = (itemId: string) => {
    setDeleteItem(itemId);
  };

  const handleDeleteConfirm = () => {
    if (deleteItemId) {
      db.transact(db.tx.queueItems[deleteItemId].delete());
      setDeleteItem(null);
    }
  };

  const handleChangeName = (newName: string) => {
    if (!playerId) return;
    db.transact(db.tx.players[playerId].update({ nickname: newName }));
    setShowNameModal(false);
  };

  const handleQuitConfirm = () => {
    if (playerId) {
      db.transact(db.tx.players[playerId].delete());
    }
    localStorage.removeItem("2mdj_current_player_id");
    localStorage.removeItem("2mdj_current_room_id");
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

  if (room.status === "LOBBY") {
    const handleStartParty = () => {
      db.transact(
        db.tx.rooms[roomId].update({
          status: "PLAYING",
          playbackStartedAt: Date.now(),
        })
      );
    };

    const updateTimer = (sec: number) => {
      db.transact(db.tx.rooms[roomId].update({ timerDuration: sec }));
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
                ? language === "de"
                  ? "Als VIP kannst du die Party starten und Einstellungen ändern!"
                  : "As VIP, you can start the party and change settings!"
                : language === "de"
                  ? "Warte auf den Host, um das Spiel zu starten. Überleg dir schonmal deine Lieblingssongs!"
                  : "Waiting for the host to start the game. Get your favorite songs ready in your mind!"}
            </p>
          </div>

          {isVip && (
            <div className="w-full max-w-sm space-y-6 bg-neutral-900/80 border border-yellow-500/30 rounded-2xl p-6 animate-in fade-in zoom-in">
              <div className="flex items-center justify-center space-x-2 text-yellow-500 font-bold uppercase tracking-widest text-xs">
                <Crown size={14} fill="currentColor" />
                <span>{language === "de" ? "VIP Steuerung" : "VIP Controls"}</span>
              </div>

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
                        (room.timerDuration || 120) === sec
                          ? "border-indigo-500 bg-indigo-500/20 text-white"
                          : "border-neutral-800 bg-neutral-800/50 text-neutral-400"
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

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
                  onClick={() =>
                    db.transact(
                      db.tx.rooms[roomId].update({
                        autoSkip: room.autoSkip === false ? null : false,
                      })
                    )
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    room.autoSkip !== false ? "bg-indigo-500" : "bg-neutral-700"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      room.autoSkip !== false ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

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
                  onClick={() =>
                    db.transact(
                      db.tx.rooms[roomId].update({
                        allowSelfVoting: !room.allowSelfVoting,
                      })
                    )
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    room.allowSelfVoting ? "bg-indigo-500" : "bg-neutral-700"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      room.allowSelfVoting ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

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
    const resumeSession = () => {
      if (!room) return;
      const pre = room.preEndState;
      if (pre) {
        db.transact(db.tx.rooms[roomId].update({
          status: "PAUSED",
          currentVideoId: pre.currentVideoId ?? null,
          currentStartTime: pre.currentStartTime ?? null,
          currentVideoOffset: pre.currentVideoOffset ?? null,
          activePlayerId: pre.activePlayerId ?? null,
          activeQueueItemId: pre.activeQueueItemId ?? null,
          currentTurnIndex: pre.currentTurnIndex ?? null,
          playerOrder: pre.playerOrder ?? null,
          playbackStartedAt: pre.playbackStartedAt ?? null,
          pausedAt: Date.now(),
          preEndState: null,
        }));
      } else {
        db.transact(db.tx.rooms[roomId].update({
          status: "LOBBY",
          preEndState: null,
        }));
      }
    };

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
        <SummaryView roomId={roomId} />
        {isVip && (
          <div className="flex justify-center mt-8">
            <button
              onClick={resumeSession}
              className="px-8 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-sm flex items-center space-x-2 hover:bg-indigo-500/20 transition-all"
            >
              <RotateCcw size={18} />
              <span>{language === "de" ? "Sitzung fortsetzen" : "Resume Session"}</span>
            </button>
          </div>
        )}
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

        {room.status === "PAUSED" && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center justify-center space-x-2 text-yellow-500 animate-in fade-in">
            <Pause size={16} />
            <span className="font-bold text-sm">{language === "de" ? "Party pausiert" : "Party paused"}</span>
          </div>
        )}

        {isMyTurn && !activeQueueItem && room.status !== "PAUSED" && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex flex-col items-center justify-center space-y-2 text-indigo-400 animate-in fade-in animate-pulse">
            <span className="font-bold text-lg">
              {language === "de" ? "🎵 Du bist dran!" : "🎵 It's your turn!"}
            </span>
            <span className="text-sm text-indigo-300/70">
              {myQueue.length > 0
                ? language === "de"
                  ? "Dein Song wird gleich abgespielt..."
                  : "Your song will play soon..."
                : language === "de"
                  ? "Füge schnell einen Song hinzu!"
                  : "Quick, add a song!"}
            </span>
          </div>
        )}

        {isMyTurn && activeQueueItem && room.status !== "PAUSED" && (
          <div className="bg-neutral-900/80 p-4 rounded-2xl flex flex-col items-center space-y-3 border border-indigo-500/30 animate-in fade-in">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-1">{t("nowSpinning")}</div>
              <div className="text-sm font-bold text-white max-w-[250px] truncate">{activeQueueItem.videoTitle || t("unknownTrack")}</div>
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

        {activeQueueItem && room.status !== "PAUSED" && (!isMyTurn || room.allowSelfVoting) && (
          <div className="bg-neutral-900/80 p-4 rounded-2xl flex flex-col space-y-4 border border-neutral-800 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col overflow-hidden mr-4">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">{t("nowSpinning")}</span>
                <span className="text-sm font-bold truncate text-white">
                  {activeQueueItem.videoTitle || t("unknownTrack")}
                </span>
              </div>
              <div
                className={`text-xl font-bold transition-colors ${localVote > 75 ? "text-green-500" : localVote < 25 ? "text-red-500" : "text-neutral-400"}`}
              >
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

        {previousQueueItem &&
          !previousQueueItem.votes?.[playerId] &&
          (previousQueueItem.playerId !== playerId || room.allowSelfVoting) && (
            <div className="bg-neutral-900/50 p-3 rounded-2xl flex flex-col space-y-2 border border-neutral-800 animate-in fade-in mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                  {language === "de" ? "Letzten Song bewerten" : "Rate Last Song"}
                </span>
                <span className="text-xs font-bold truncate text-white max-w-[150px]">
                  {previousQueueItem.videoTitle}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <ThumbsDown
                  size={16}
                  className={`transition-colors ${localPrevVote < 25 ? "text-red-500 fill-current" : "text-neutral-600"}`}
                />
                <div className="flex-1 relative h-4 flex items-center">
                  <div className="absolute inset-0 h-1.5 bg-gradient-to-r from-red-900 via-neutral-700 to-green-900 rounded-full my-auto" />
                  <Slider
                    min={0}
                    max={100}
                    value={localPrevVote}
                    onChange={(e) => setLocalPrevVote(Number(e.target.value))}
                    onMouseUp={commitPreviousVote}
                    onTouchEnd={commitPreviousVote}
                    className="relative z-10"
                  />
                </div>
                <ThumbsUp
                  size={16}
                  className={`transition-colors ${localPrevVote > 75 ? "text-green-500 fill-current" : "text-neutral-600"}`}
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
        description={
          language === "de"
            ? "Bist du sicher, dass du diesen Song aus deiner Warteschlange entfernen willst?"
            : "Are you sure you want to remove this song from your queue?"
        }
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
              timerDuration={room.timerDuration || 120}
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

        {myQueue.length > 0 && (
          <div className="w-full max-w-md mx-auto bg-neutral-900/50 rounded-2xl border border-neutral-800 p-4 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">
              {t("myQueue")}
            </h3>
            <div className="space-y-3">
              {myQueue.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-neutral-800 p-3 rounded-xl"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <img
                      src={`https://img.youtube.com/vi/${item.videoId}/default.jpg`}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-bold truncate text-white">
                        {item.videoTitle || t("unknownTrack")}
                      </span>
                      <span className="text-xs font-mono truncate text-neutral-400">
                        Start: {Math.floor(item.highlightStart / 60)}:
                        {(item.highlightStart % 60).toString().padStart(2, "0")}
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

      {isVip && (
        <VIPControls room={room} players={players} queueItems={queueItems} roomId={roomId} />
      )}
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
          <Loader2 className="animate-spin" size={32} />
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}
