"use client";

import { SkipForward, Pause, Play, Users, Clock, Trash2, Crown, Plus, ArrowRight } from "lucide-react";
import { useState } from "react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useI18n } from "@/components/LanguageProvider";
import { computeAdvanceToNextSong, getPlayerOrder } from "@/lib/utils";
import db from "@/lib/db";

interface VIPControlsProps {
  room: any;
  players: any[];
  queueItems: any[];
  roomId: string;
}

export default function VIPControls({ room, players, queueItems, roomId }: VIPControlsProps) {
  const { t, language } = useI18n();
  const [kickPlayerId, setKickPlayerId] = useState<string | null>(null);
  const [kickPlayerName, setKickPlayerName] = useState("");

  const handleSkip = () => {
    if (!room) return;

    const result = computeAdvanceToNextSong(room, players, queueItems, true);

    const txns: any[] = [];
    if (result.queueItemUpdates) {
      for (const [itemId, updates] of Object.entries(result.queueItemUpdates)) {
        txns.push(db.tx.queueItems[itemId].update(updates as any));
      }
    }
    txns.push(db.tx.rooms[roomId].update(result.roomUpdates));

    db.transact(txns);
  };

  const togglePause = () => {
    if (room.status === "PLAYING") {
      const elapsedSeconds = room.playbackStartedAt
        ? Math.floor((Date.now() - room.playbackStartedAt) / 1000)
        : 0;
      const videoOffset = (room.currentStartTime || 0) + elapsedSeconds;

      db.transact(
        db.tx.rooms[roomId].update({
          status: "PAUSED",
          pausedAt: Date.now(),
          currentVideoOffset: videoOffset,
        })
      );
    } else {
      const pauseDuration = room.pausedAt
        ? Date.now() - room.pausedAt
        : 0;
      const newStart = (room.playbackStartedAt || Date.now()) + pauseDuration;

      db.transact(
        db.tx.rooms[roomId].update({
          status: "PLAYING",
          playbackStartedAt: newStart,
          pausedAt: null,
        })
      );
    }
  };

  const updateTimer = (sec: number) => {
    db.transact(db.tx.rooms[roomId].update({ timerDuration: sec }));
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
    if (!room.playbackStartedAt) return;
    db.transact(
      db.tx.rooms[roomId].update({
        playbackStartedAt: room.playbackStartedAt + seconds * 1000,
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
  };

  return (
    <div className="bg-neutral-900 border border-yellow-500/30 rounded-2xl p-4 space-y-6 mt-8">
      <div className="flex items-center space-x-2 text-yellow-500 font-bold uppercase tracking-widest text-xs border-b border-neutral-800 pb-2">
        <Crown size={14} fill="currentColor" />
        <span>{t("toggleVip")}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={togglePause}
          className={`p-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all ${
            room.status === "PAUSED"
              ? "bg-green-500 text-white"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          {room.status === "PAUSED" ? (
            <Play size={20} fill="currentColor" />
          ) : (
            <Pause size={20} fill="currentColor" />
          )}
          <span>
            {room.status === "PAUSED"
              ? language === "de"
                ? "Fortsetzen"
                : "Resume"
              : language === "de"
                ? "Pause"
                : "Pause"}
          </span>
        </button>

        <button
          onClick={handleSkip}
          className="p-4 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 font-bold flex items-center justify-center space-x-2 transition-all"
        >
          <SkipForward size={20} fill="currentColor" />
          <span>{language === "de" ? "Überspringen" : "Skip"}</span>
        </button>
      </div>

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
                (room.timerDuration || 120) === sec
                  ? "border-indigo-500 bg-indigo-500/20 text-white"
                  : "border-neutral-800 bg-neutral-800/50 text-neutral-400"
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>

        <button
          onClick={() => addTime(30)}
          className="w-full py-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center space-x-2 hover:bg-indigo-500/20 transition-all"
        >
          <Plus size={14} />
          <span>{language === "de" ? "30s zur Runde hinzufügen" : "Add 30s to Round"}</span>
        </button>

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
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center space-x-1">
          <Users size={10} />
          <span>{t("managePlayers")}</span>
        </label>
        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
          {players.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-neutral-800/50 p-2 rounded-lg"
            >
              <span className="text-sm font-medium truncate pl-1">{p.nickname}</span>
              <div className="flex items-center space-x-1">
                {p.id !== room.activePlayerId && (
                  <button
                    onClick={() => forcePlayerTurn(p.id)}
                    className="p-1.5 text-neutral-500 hover:text-indigo-500 transition-colors"
                    title={language === "de" ? "Diesen DJ drannehmen" : "Make this DJ current"}
                  >
                    <ArrowRight size={14} />
                  </button>
                )}
                <button
                  onClick={() => kickPlayer(p.id, p.nickname)}
                  className="p-1.5 text-neutral-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
    </div>
  );
}
