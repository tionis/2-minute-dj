"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { generateRoomCode } from "@/lib/utils";
import { id } from "@instantdb/react";
import { Copy, Users, Play, Loader2, X, Crown, LogOut } from "lucide-react";
import GameView from "@/components/host/GameView";
import SummaryView from "@/components/host/SummaryView";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { QRCodeSVG } from "qrcode.react";

export default function HostPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [showQuitModal, setShowQuitModal] = useState(false);

  const handleKick = (playerId: string, name: string) => {
      if (confirm(`Kick ${name}?`)) {
          db.transact(db.tx.players[playerId].delete());
      }
  };

  const handleToggleVIP = (player: any) => {
      db.transact(db.tx.players[player.id].update({ is_vip: !player.is_vip }));
  };

  // Create room on mount or restore from local storage
  useEffect(() => {
    setOrigin(window.location.origin);
    
    const savedRoomId = localStorage.getItem("2mdj_host_roomId");
    const savedRoomCode = localStorage.getItem("2mdj_host_roomCode");

    if (savedRoomId && savedRoomCode) {
        setRoomId(savedRoomId);
        setRoomCode(savedRoomCode);
        return;
    }

    if (roomId) return;

    const newRoomId = id();
    const code = generateRoomCode();
    
    setRoomId(newRoomId);
    setRoomCode(code);
    
    // Save to local storage
    localStorage.setItem("2mdj_host_roomId", newRoomId);
    localStorage.setItem("2mdj_host_roomCode", code);

    db.transact(
      db.tx.rooms[newRoomId].update({
        code: code,
        status: "LOBBY",
        created_at: Date.now(),
      })
    );
  }, []);

  // Query room, players, and queue
  const { isLoading, error, data } = db.useQuery(
    roomId
      ? {
          rooms: {
            $:
              {
                where: { id: roomId },
              },
            players: {},
            queue_items: {
                player: {},
            },
          },
        }
      : null
  );

  if (isLoading || !roomId) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-red-400">
        Error: {error.message}
      </div>
    );
  }

  const room = data?.rooms[0];
  const players = room?.players || [];

  const handleQuitConfirm = () => {
      localStorage.removeItem("2mdj_host_roomId");
      localStorage.removeItem("2mdj_host_roomCode");
      window.location.href = "/";
  };

  const startGame = () => {
    if (!roomId) return;
    db.transact(
      db.tx.rooms[roomId].update({ status: "PLAYING", playback_started_at: Date.now() })
    );
  };

  if (room?.status === "PLAYING") {
    return (
      <div className="h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-6 left-6 z-50 cursor-pointer" onClick={() => setShowQuitModal(true)}>
            <div className="flex items-center space-x-2 text-neutral-500 hover:text-white transition-colors opacity-50 hover:opacity-100">
                <div className="p-2 rounded-full bg-neutral-900 border border-neutral-800">
                    <LogOut size={16} /> 
                </div>
            </div>
        </div>
        <div className="w-full max-w-7xl h-full flex flex-col justify-center">
            <GameView room={room as any} />
        </div>
        <ConfirmationModal 
            isOpen={showQuitModal}
            onCancel={() => setShowQuitModal(false)}
            onConfirm={handleQuitConfirm}
            title="End Party?"
            description="This will disconnect all players and close the room. Are you sure?"
            confirmText="End Party"
        />
      </div>
    );
  }

  if (room?.status === "FINISHED") {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-12 overflow-y-auto relative">
        <div className="absolute top-6 left-6 z-50 cursor-pointer" onClick={() => setShowQuitModal(true)}>
            <div className="flex items-center space-x-2 text-neutral-500 hover:text-white transition-colors">
                <div className="p-2 rounded-full bg-neutral-900 border border-neutral-800">
                    <LogOut size={16} /> 
                </div>
                <span className="font-bold text-sm tracking-widest">EXIT</span>
            </div>
        </div>
        <SummaryView room={room as any} />
        <ConfirmationModal 
            isOpen={showQuitModal}
            onCancel={() => setShowQuitModal(false)}
            onConfirm={handleQuitConfirm}
            title="Leave Summary?"
            description="You are about to leave the results screen."
            confirmText="Leave"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-8 relative">
      {/* Home Button */}
      <div className="absolute top-6 left-6 z-10 cursor-pointer" onClick={() => setShowQuitModal(true)}>
        <div className="flex items-center space-x-2 text-neutral-500 hover:text-white transition-colors">
            <div className="p-2 rounded-full bg-neutral-900 border border-neutral-800">
                <LogOut size={16} /> 
            </div>
            <span className="font-bold text-sm tracking-widest">EXIT</span>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={showQuitModal}
        onCancel={() => setShowQuitModal(false)}
        onConfirm={handleQuitConfirm}
        title="Cancel Party?"
        description="Are you sure you want to close this room? Players will be disconnected."
        confirmText="Close Room"
      />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">

        
        {/* Left: Join Info */}
        <div className="lg:col-span-2 space-y-12 flex flex-col items-center lg:items-start">
            <div className="text-center lg:text-left space-y-4">
                <h2 className="text-neutral-400 font-medium tracking-widest uppercase text-sm">Join the party at:</h2>
                <h1 className="text-4xl font-bold">{origin.replace(/^https?:\/\//, "")}</h1>
            </div>

            <div className="relative group cursor-pointer text-center lg:text-left" onClick={() => navigator.clipboard.writeText(roomCode || "")}>
                <h2 className="text-neutral-500 font-bold uppercase text-xs tracking-[0.3em] mb-2">Room Code</h2>
                <h1 className="text-9xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-400 select-none leading-none">
                {roomCode}
                </h1>
            </div>

            {/* Start Button */}
            <button 
                disabled={players.length === 0}
                onClick={startGame}
                className="cursor-pointer px-12 py-6 bg-white text-black rounded-full font-bold text-2xl hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-3 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
            >
                <span>Start Party</span>
                <Play size={24} fill="currentColor" />
            </button>
        </div>

        {/* Right: QR Code & Player Count */}
        <div className="flex flex-col items-center space-y-8 bg-neutral-900/50 p-10 rounded-[3rem] border border-neutral-800">
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_0_50px_rgba(79,70,229,0.2)]">
                <QRCodeSVG 
                    value={`${origin}/join?code=${roomCode}`}
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
                <p className="text-neutral-500 font-medium">DJs in the lobby</p>
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
                                onClick={() => handleToggleVIP(player)}
                                className={`p-1 rounded-full hover:scale-110 transition-transform ${player.is_vip ? "bg-yellow-500 text-black" : "bg-neutral-700 text-neutral-400 hover:bg-yellow-500 hover:text-black"}`}
                                title="Toggle VIP"
                            >
                                <Crown size={12} fill={player.is_vip ? "currentColor" : "none"} />
                            </button>

                            {/* Kick Button */}
                            <button 
                                onClick={() => handleKick(player.id, player.nickname)}
                                className="bg-red-500 text-white p-1 rounded-full hover:scale-110 transition-transform"
                                title="Kick Player"
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
