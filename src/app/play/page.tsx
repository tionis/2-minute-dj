"use client";

export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { useSearchParams } from "next/navigation";
import { Loader2, Music4, Radio } from "lucide-react";
import { Suspense, useState } from "react";
import { id } from "@instantdb/react";
import VIPControls from "@/components/player/VIPControls";
import SearchStep from "@/components/player/SearchStep";
import ClipperStep from "@/components/player/ClipperStep";
import SuccessStep from "@/components/player/SuccessStep";
import { Trash2, Home } from "lucide-react";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

function PlayContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");
  const playerId = searchParams.get("playerId");

  // Game State
  const [step, setStep] = useState<"SEARCH" | "CLIP" | "SUCCESS">("SEARCH");
  const [videoData, setVideoData] = useState<{ id: string, startTime: number, title: string } | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);

  const { data, isLoading, error } = db.useQuery(
    roomId && playerId
      ? {
          rooms: {
            $: { where: { id: roomId } },
            players: {}, // All players for VIP
            queue_items: { // All pending songs for VIP skip logic
                 $: { where: { status: "PENDING" } }
            }
          },
          players: {
            $: { where: { id: playerId } },
            queue_items: { // My songs for My Queue
                $: { where: { status: "PENDING" } }
            }
          },
        }
      : null
  );

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

  const room = data?.rooms[0];
  const player = data?.players[0];
  const myQueue = player?.queue_items || [];
  const isVip = player?.is_vip || false;

  if (!room || !player) {
    return <div className="text-white p-8">Room or Player not found.</div>;
  }

  // Handle Queueing
  const handleQueue = (startTime: number) => {
    if (!videoData) return;

    const queueId = id();
    db.transact(
        db.tx.queue_items[queueId].update({
            video_id: videoData.id,
            video_title: videoData.title, // Save title
            highlight_start: startTime,
            status: "PENDING",
            created_at: Date.now(),
        })
        .link({ room: roomId, player: playerId })
    );
    setStep("SUCCESS");
  };

  const handleDelete = (itemId: string) => {
      if (confirm("Remove this song?")) {
          db.transact(db.tx.queue_items[itemId].delete());
      }
  };

  const handleQuitConfirm = () => {
      window.location.href = "/";
  };

  // Lobby View
  if (room.status === "LOBBY") {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col p-6">
        <header className="flex justify-between items-center mb-8 opacity-50">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setShowQuitModal(true)}>
             <Home size={16} />
             <div className="font-mono text-xs">EXIT</div>
          </div>
          <div className="font-mono text-xs">{player.nickname}</div>
        </header>

        <ConfirmationModal 
            isOpen={showQuitModal}
            onCancel={() => setShowQuitModal(false)}
            onConfirm={handleQuitConfirm}
            title="Leave Party?"
            description="Are you sure you want to leave?"
            confirmText="Leave"
        />

        <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative bg-neutral-900 border border-neutral-800 p-8 rounded-full">
              <Radio size={48} className="text-indigo-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <h2 className="text-2xl font-bold">You're in!</h2>
            <p className="text-neutral-500">
              Waiting for the host to start the game. Get your favorite songs ready in your mind!
            </p>
          </div>

          <div className="pt-8 flex items-center space-x-2 text-xs text-neutral-600 uppercase tracking-widest">
            <Music4 size={12} />
            <span>Lobby Phase</span>
          </div>
        </div>
      </div>
    );
  }

  // Game View (PLAYING)
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col p-6">
      <header className="flex justify-between items-center mb-8 opacity-50">
         <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setShowQuitModal(true)}>
             <Home size={16} />
         </div>
        <div className="font-mono text-xs font-bold text-indigo-400">2-MINUTE DJ</div>
        <div className="font-mono text-xs">{player.nickname}</div>
      </header>

      <ConfirmationModal 
        isOpen={showQuitModal}
        onCancel={() => setShowQuitModal(false)}
        onConfirm={handleQuitConfirm}
        title="Leave Party?"
        description="Are you sure you want to leave the game?"
        confirmText="Leave"
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
                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">My Upcoming Tracks</h3>
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
                                        {item.video_title || "Unknown Track"}
                                    </span>
                                    <span className="text-xs font-mono truncate text-neutral-400">
                                        Start: {Math.floor(item.highlight_start / 60)}:{(item.highlight_start % 60).toString().padStart(2, "0")}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDelete(item.id)}
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
