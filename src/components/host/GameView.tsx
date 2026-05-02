"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Music, User, SkipForward, Clock, Play, Settings, X, Crown, Pause, Plus, ArrowRight } from "lucide-react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useI18n } from "@/components/LanguageProvider";
import HypeMeter from "./HypeMeter";
import { computeAdvanceToNextSong, getPlayerOrder } from "@/lib/utils";
import db from "@/lib/db";

export default function GameView({ roomId }: { roomId: string }) {
  const { t, language } = useI18n();

  const { data } = db.useQuery({
    rooms: {
      $: { where: { id: roomId } },
      players: {},
      queueItems: {},
    },
  } as any) as any;

  const room = (data?.rooms?.[0] ?? null) as any;
  const players: any[] = room?.players ?? [];
  const queueItems: any[] = room?.queueItems ?? [];

  const [timeLeft, setTimeLeft] = useState(room?.timerDuration || 120);
  const [isEnding, setIsEnding] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [kickPlayerId, setKickPlayerId] = useState<string | null>(null);
  const [kickPlayerName, setKickPlayerName] = useState("");
  const [iframeKey, setIframeKey] = useState(0);
  const [ytApiReady, setYtApiReady] = useState(false);

  const stateRef = useRef<any>({ room, queueItems, players });
  const isEndingRef = useRef(false);
  const ytPlayerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const onYTReady = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        ytPlayerRef.current = new (window as any).YT.Player(iframeRef.current, {
          events: {
            onReady: () => setIsPlayerReady(true),
          },
        });
      } catch {
        setIsPlayerReady(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      (window as any).onYouTubeIframeAPIReady = () => setYtApiReady(true);
    } else {
      setYtApiReady(true);
    }
  }, []);

  useEffect(() => {
    stateRef.current = { room, queueItems, players };
    isEndingRef.current = isEnding;
  }, [room, queueItems, players, isEnding]);

  useEffect(() => {
    setIsPlayerReady(false);
    const timer = setTimeout(() => setIsPlayerReady(true), 5000);
    return () => clearTimeout(timer);
  }, [room?.currentVideoId]);

  useEffect(() => {
    if (ytApiReady && iframeRef.current && !(window as any).YT?.Player) {
      return;
    }
    if (ytApiReady && iframeRef.current && (window as any).YT?.Player) {
      try {
        ytPlayerRef.current = new (window as any).YT.Player(iframeRef.current, {
          events: {
            onReady: () => setIsPlayerReady(true),
          },
        });
      } catch {
        setIsPlayerReady(true);
      }
    }
  }, [ytApiReady, iframeKey]);

  useEffect(() => {
    setIsEnding(false);
  }, [room?.activeQueueItemId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentRoom = stateRef.current.room;
      if (!currentRoom) return;
      if (
        currentRoom.status === "PAUSED" ||
        currentRoom.status !== "PLAYING" ||
        !currentRoom.playbackStartedAt
      )
        return;
      if (!currentRoom.currentVideoId) return;

      const duration = currentRoom.timerDuration || 120;
      const elapsed = Math.floor(
        (Date.now() - currentRoom.playbackStartedAt) / 1000
      );
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      const autoSkipEnabled = currentRoom.autoSkip !== false;
      if (remaining <= 0 && !isEndingRef.current && autoSkipEnabled) {
        setIsEnding(true);
        doAdvance();
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!room) return;
    const pendingCount = queueItems.filter(
      (q: any) => q.status === "PENDING"
    ).length;
    if (
      room.status === "PLAYING" &&
      !room.currentVideoId &&
      pendingCount > 0
    ) {
      doAdvance();
    }
  }, [room?.status, room?.currentVideoId, queueItems]);

  const doAdvance = () => {
    const current = stateRef.current;
    if (!current.room) return;

    const result = computeAdvanceToNextSong(
      current.room,
      current.players,
      current.queueItems,
      true
    );

    const txns: any[] = [];

    if (result.queueItemUpdates) {
      for (const [itemId, updates] of Object.entries(
        result.queueItemUpdates
      )) {
        txns.push(db.tx.queueItems[itemId].update(updates as any));
      }
    }

    txns.push(db.tx.rooms[roomId].update(result.roomUpdates));

    db.transact(txns);
    setIsEnding(false);
  };

  const togglePause = () => {
    if (!room) return;

    if (room.status === "PLAYING") {
      const player = ytPlayerRef.current;
      let videoOffset: number | undefined;
      if (player && typeof player.getCurrentTime === "function") {
        try {
          videoOffset = Math.floor(player.getCurrentTime());
        } catch {}
      }
      if (!videoOffset && videoOffset !== 0) {
        const elapsedSeconds = room.playbackStartedAt
          ? Math.floor((Date.now() - room.playbackStartedAt) / 1000)
          : 0;
        videoOffset = (room.currentStartTime || 0) + elapsedSeconds;
      }

      if (player && typeof player.pauseVideo === "function") {
        try { player.pauseVideo(); } catch {}
      }

      db.transact(
        db.tx.rooms[roomId].update({
          status: "PAUSED",
          pausedAt: Date.now(),
          currentVideoOffset: videoOffset,
        })
      );
    } else if (room.status === "PAUSED") {
      const pauseDuration = room.pausedAt
        ? Date.now() - room.pausedAt
        : 0;
      const newStart = (room.playbackStartedAt || Date.now()) + pauseDuration;
      const seekTo = room.currentVideoOffset ?? room.currentStartTime ?? 0;

      db.transact(
        db.tx.rooms[roomId].update({
          status: "PLAYING",
          playbackStartedAt: newStart,
          pausedAt: null,
        })
      );

      const player = ytPlayerRef.current;
      if (player && typeof player.seekTo === "function" && typeof player.playVideo === "function") {
        try {
          player.seekTo(seekTo, true);
          player.playVideo();
        } catch {}
      } else {
        setIframeKey((prev) => prev + 1);
      }
    }
  };

  const endSession = () => {
    if (!room) return;

    const currentActiveItem = queueItems.find(
      (q: any) => q.id === room.activeQueueItemId
    );

    const preEndState: Record<string, unknown> = {};
    if (room.currentVideoId != null) preEndState.currentVideoId = room.currentVideoId;
    if (room.currentStartTime != null) preEndState.currentStartTime = room.currentStartTime;
    if (room.currentVideoOffset != null) preEndState.currentVideoOffset = room.currentVideoOffset;
    if (room.playbackStartedAt != null) preEndState.playbackStartedAt = room.playbackStartedAt;
    if (room.activePlayerId != null) preEndState.activePlayerId = room.activePlayerId;
    if (room.activeQueueItemId != null) preEndState.activeQueueItemId = room.activeQueueItemId;
    if (room.currentTurnIndex != null) preEndState.currentTurnIndex = room.currentTurnIndex;
    if (room.playerOrder) preEndState.playerOrder = room.playerOrder;

    const txns: any[] = [
      db.tx.rooms[roomId].update({
        status: "FINISHED",
        currentVideoId: null,
        activePlayerId: null,
        playbackStartedAt: null,
        pausedAt: null,
        preEndState,
      }),
    ];

    if (currentActiveItem) {
      txns.push(
        db.tx.queueItems[currentActiveItem.id].update({ status: "PLAYED" })
      );
    }

    db.transact(txns);
  };

  const updateTimer = (seconds: number) => {
    db.transact(db.tx.rooms[roomId].update({ timerDuration: seconds }));
  };

  const addTime = (seconds: number) => {
    if (!room?.playbackStartedAt) return;
    db.transact(
      db.tx.rooms[roomId].update({
        playbackStartedAt: room.playbackStartedAt + seconds * 1000,
      })
    );
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

  const handleToggleVIP = (playerId: string, isVip: boolean) => {
    db.transact(
      db.tx.players[playerId].update({ isVip: isVip ? null : true })
    );
  };

  const toggleAutoSkip = () => {
    if (!room) return;
    db.transact(
      db.tx.rooms[roomId].update({
        autoSkip: room.autoSkip === false ? null : false,
      })
    );
  };

  const forcePlayerTurn = (playerId: string) => {
    if (!room) return;
    const playerOrder = getPlayerOrder(players, room.playerOrder);
    const idx = playerOrder.indexOf(playerId);
    if (idx === -1) return;

    const pendingForPlayer = queueItems.filter(
      (q: any) => q.status === "PENDING" && q.playerId === playerId
    );

    const txns: any[] = [];

    if (room.activeQueueItemId) {
      const currentItem = queueItems.find(
        (q: any) => q.id === room.activeQueueItemId
      );
      if (currentItem) {
        txns.push(db.tx.queueItems[currentItem.id].update({ status: "PLAYED" }));
      }
    }

    if (pendingForPlayer.length > 0) {
      const nextItem = pendingForPlayer.sort(
        (a: any, b: any) => a.createdAt - b.createdAt
      )[0];
      txns.push(
        db.tx.rooms[roomId].update({
          currentTurnIndex: idx,
          activePlayerId: playerId,
          activeQueueItemId: nextItem.id,
          currentVideoId: nextItem.videoId,
          currentStartTime: nextItem.highlightStart,
          currentVideoOffset: nextItem.highlightStart,
          playbackStartedAt: Date.now(),
          previousQueueItemId: room.activeQueueItemId ?? null,
        })
      );
    } else {
      txns.push(
        db.tx.rooms[roomId].update({
          currentTurnIndex: idx,
          activePlayerId: playerId,
          activeQueueItemId: null,
          currentVideoId: null,
          currentStartTime: null,
          currentVideoOffset: null,
          playbackStartedAt: null,
          previousQueueItemId: room.activeQueueItemId ?? null,
        })
      );
    }

    db.transact(txns);
    setShowPlayers(false);
  };

  const activeQueueItem = queueItems.find(
    (q: any) => q.id === room?.activeQueueItemId
  ) as any;
  const activePlayer = players.find(
    (p: any) => p.id === room?.activePlayerId
  ) as any;

  const getCurrentTurnPlayer = () => {
    if (!room?.playerOrder || room.playerOrder.length === 0) return null;
    const validOrder = room.playerOrder.filter((pid: string) =>
      players.some((p: any) => p.id === pid)
    );
    if (validOrder.length === 0) return null;
    const turnIndex = room.currentTurnIndex ?? 0;
    const playerId = validOrder[turnIndex % validOrder.length];
    return players.find((p: any) => p.id === playerId);
  };
  const currentTurnPlayer = getCurrentTurnPlayer();

  const renderModals = () => (
    <>
      {showSettings && (
        <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-lg w-full space-y-8 relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white"
            >
              <X size={24} />
            </button>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold flex items-center space-x-2">
                <Settings className="text-indigo-500" />
                <span>{t("settings")}</span>
              </h2>
              <p className="text-neutral-400">
                {language === "de" ? "Passe die Party-Regeln an." : "Customize the party rules."}
              </p>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                {t("timerDuration")}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[60, 90, 120, 180].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => updateTimer(sec)}
                    className={`py-3 rounded-xl font-bold border-2 transition-all ${
                      (room?.timerDuration || 120) === sec
                        ? "border-indigo-500 bg-indigo-500/20 text-white"
                        : "border-neutral-800 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                {t("addTime")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => addTime(30)}
                  className="py-3 rounded-xl font-bold border-2 border-neutral-800 bg-neutral-800/50 text-white hover:border-indigo-500 hover:bg-indigo-500/20 transition-all"
                >
                  +30s
                </button>
                <button
                  onClick={() => addTime(60)}
                  className="py-3 rounded-xl font-bold border-2 border-neutral-800 bg-neutral-800/50 text-white hover:border-indigo-500 hover:bg-indigo-500/20 transition-all"
                >
                  +60s
                </button>
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
                  onClick={toggleAutoSkip}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    room?.autoSkip !== false ? "bg-indigo-500" : "bg-neutral-700"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      room?.autoSkip !== false ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPlayers && (
        <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-2xl w-full space-y-8 relative max-h-[80vh] flex flex-col">
            <button
              onClick={() => setShowPlayers(false)}
              className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white"
            >
              <X size={24} />
            </button>
            <div className="space-y-2 shrink-0">
              <h2 className="text-2xl font-bold flex items-center space-x-2">
                <User className="text-indigo-500" />
                <span>{t("managePlayers")}</span>
              </h2>
              <p className="text-neutral-400">
                {language === "de"
                  ? "Spieler entfernen oder VIP-Status vergeben."
                  : "Kick players or grant VIP status."}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-2">
              {players.map((player: any) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between bg-neutral-800/50 p-4 rounded-2xl border border-neutral-700/50"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        player.isVip
                          ? "bg-yellow-500 text-black"
                          : "bg-neutral-700 text-white"
                      }`}
                    >
                      {player.nickname[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold">{player.nickname}</h3>
                      <p className="text-xs text-neutral-500">
                        {player.isVip
                          ? "VIP DJ"
                          : language === "de"
                            ? "Gast"
                            : "Guest"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {player.id !== room?.activePlayerId && (
                      <button
                        onClick={() => forcePlayerTurn(player.id)}
                        className="p-2 rounded-xl border border-neutral-700 text-neutral-500 hover:text-indigo-500 hover:border-indigo-500 transition-colors"
                        title={language === "de" ? "Diesen DJ drannehmen" : "Make this DJ current"}
                      >
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handleToggleVIP(player.id, player.isVip)
                      }
                      className={`p-2 rounded-xl border transition-colors ${
                        player.isVip
                          ? "bg-yellow-500/10 border-yellow-500 text-yellow-500"
                          : "border-neutral-700 text-neutral-500 hover:text-yellow-500 hover:border-yellow-500"
                      }`}
                      title={t("toggleVip")}
                    >
                      <Crown size={16} fill={player.isVip ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => handleKick(player.id, player.nickname)}
                      className="p-2 rounded-xl border border-neutral-700 text-neutral-500 hover:text-red-500 hover:border-red-500 transition-colors"
                      title={t("kick")}
                    >
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
        description={
          language === "de"
            ? "Bist du sicher, dass du diesen Spieler hinauswerfen willst?"
            : "Are you sure you want to kick this player?"
        }
        confirmText={t("kick")}
        cancelText={t("cancel")}
      />
    </>
  );

  if (!room) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
      </div>
    );
  }

  if (!room.currentVideoId) {
    const turnPlayer = currentTurnPlayer;
    const turnPlayerQueue = turnPlayer
      ? queueItems.filter(
          (q: any) => q.status === "PENDING" && q.playerId === turnPlayer.id
        )
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
                    ? language === "de"
                      ? "Song wird gleich abgespielt..."
                      : "Song playing soon..."
                    : language === "de"
                      ? "Warte auf einen Song von diesem DJ..."
                      : "Waiting for a song from this DJ..."}
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

          {turnPlayer &&
            turnPlayerQueue.length === 0 &&
            queueItems.some((q: any) => q.status === "PENDING") && (
              <button
                onClick={doAdvance}
                className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold text-sm text-neutral-300 flex items-center space-x-2 transition-colors"
              >
                <SkipForward size={16} />
                <span>{language === "de" ? "Zug überspringen" : "Skip Turn"}</span>
              </button>
            )}
        </div>
        <div className="flex items-center justify-between px-4 py-4 shrink-0 h-20 border-t border-neutral-900/50">
          <div
            className="flex items-center space-x-8 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowPlayers(true)}
          >
            <div className="flex -space-x-3">
              {players.map((p: any, i: number) => (
                <div
                  key={p.id}
                  className={`w-10 h-10 rounded-full border-2 bg-neutral-800 flex items-center justify-center font-bold text-xs ${
                    p.id === turnPlayer?.id
                      ? "border-indigo-500 text-indigo-500 ring-2 ring-indigo-500/50"
                      : p.isVip
                        ? "border-yellow-500 text-yellow-500"
                        : "border-neutral-950 text-white"
                  }`}
                  style={{ zIndex: players.length - i }}
                >
                  {p.nickname[0].toUpperCase()}
                </div>
              ))}
            </div>
            <div className="text-neutral-500 text-sm font-medium">
              {players.length} {t("djsOnline")}
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setShowPlayers(true)}
              className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
              title={t("managePlayers")}
            >
              <User size={20} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
              title={t("settings")}
            >
              <Settings size={20} />
            </button>
            <button
              onClick={endSession}
              className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
            >
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
          <h1 className="text-3xl font-black max-w-xl truncate leading-none">
            {activePlayer
              ? language === "de"
                ? `${activePlayer.nickname}s Wahl`
                : `${activePlayer.nickname}'s Pick`
              : t("nextUp")}
          </h1>
        </div>
        <div className="flex flex-col items-end">
          <div
            className={`flex items-center space-x-3 px-5 py-1.5 rounded-2xl border-2 font-mono text-3xl font-black transition-colors ${
              room.status === "PAUSED"
                ? "border-yellow-500 text-yellow-500"
                : timeLeft <= 0 && room.autoSkip === false
                  ? "border-green-500 text-green-500"
                  : timeLeft < 20
                    ? "border-red-500 text-red-500 animate-pulse"
                    : "border-neutral-800 text-white"
            }`}
          >
            {room.status === "PAUSED" ? <Pause size={20} /> : <Clock size={20} />}
            <span>
              {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </span>
            {room.status === "PAUSED" && (
              <span className="text-xs uppercase tracking-wider ml-2">
                {language === "de" ? "Pausiert" : "Paused"}
              </span>
            )}
            {timeLeft <= 0 && room.autoSkip === false && room.status !== "PAUSED" && (
              <span className="text-xs uppercase tracking-wider ml-2">
                {language === "de" ? "Bereit" : "Ready"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 w-full relative bg-black rounded-3xl overflow-hidden border border-neutral-800 shadow-[0_0_100px_rgba(79,70,229,0.1)] cursor-pointer group"
        onClick={togglePause}
      >
        {!isPlayerReady && (
          <div className="absolute inset-0 z-30 bg-neutral-900 flex items-center justify-center">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
          </div>
        )}

        {room.status === "PAUSED" && (
          <div className="absolute inset-0 z-40 bg-black/70 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="bg-neutral-900/80 p-8 rounded-full border border-neutral-700 mb-4">
              <Play size={64} className="text-white" fill="currentColor" />
            </div>
            <p className="text-neutral-400 text-lg font-medium">
              {language === "de" ? "Klicken zum Fortsetzen" : "Click to resume"}
            </p>
          </div>
        )}

        {room.status === "PLAYING" && (
          <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center space-x-2 text-neutral-400 text-xs">
              <Pause size={12} />
              <span>{language === "de" ? "Klicken zum Pausieren" : "Click to pause"}</span>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={`${room.currentVideoId}-${iframeKey}`}
          className={`absolute inset-0 w-full h-full border-none transition-opacity ${room.status === "PAUSED" ? "opacity-50" : ""}`}
          src={`https://www.youtube.com/embed/${room.currentVideoId}?enablejsapi=1&autoplay=${room.status === "PLAYING" ? 1 : 0}&start=${room.currentVideoOffset || room.currentStartTime || 0}&controls=0&modestbranding=1&rel=0`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          onLoad={() => {
            if (!ytApiReady) {
              setIsPlayerReady(true);
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {activeQueueItem && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-6">
            <HypeMeter votes={activeQueueItem.votes || {}} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-4 shrink-0 h-20">
        <div
          className="flex items-center space-x-8 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowPlayers(true)}
        >
          <div className="flex -space-x-3">
            {players.map((p: any, i: number) => (
              <div
                key={p.id}
                className={`w-10 h-10 rounded-full border-2 bg-neutral-800 flex items-center justify-center font-bold text-xs ${p.isVip ? "border-yellow-500 text-yellow-500" : "border-neutral-950 text-white"}`}
                style={{ zIndex: players.length - i }}
              >
                {p.nickname[0].toUpperCase()}
              </div>
            ))}
          </div>
          <div className="text-neutral-500 text-sm font-medium">
            {players.length} {t("djsOnline")}
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <button
            onClick={() => setShowPlayers(true)}
            className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            title={t("managePlayers")}
          >
            <User size={20} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            title={t("settings")}
          >
            <Settings size={20} />
          </button>
          <button
            onClick={togglePause}
            className={`p-3 rounded-full transition-colors ${
              room.status === "PAUSED"
                ? "bg-green-500 text-white"
                : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
            }`}
            title={
              room.status === "PAUSED"
                ? language === "de"
                  ? "Fortsetzen"
                  : "Resume"
                : language === "de"
                  ? "Pause"
                  : "Pause"
            }
          >
            {room.status === "PAUSED" ? (
              <Play size={20} fill="currentColor" />
            ) : (
              <Pause size={20} />
            )}
          </button>
          <button
            onClick={doAdvance}
            className="group flex items-center space-x-2 text-neutral-500 hover:text-white transition-colors"
          >
            <span className="font-bold uppercase tracking-widest text-xs">
              {language === "de" ? "Überspringen" : "Skip Song"}
            </span>
            <SkipForward className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={endSession}
            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
          >
            {t("endSession")}
          </button>
        </div>
      </div>
      {renderModals()}
    </div>
  );
}
