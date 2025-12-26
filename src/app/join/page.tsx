"use client";

import { useState, useEffect, Suspense } from "react";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
// ... rest of the component
  const [nickname, setNickname] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-fill code from URL if present
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
    }
  }, [searchParams]);

  // Only query when code is 4 chars to save resources/avoid noise
  const shouldQuery = code.length === 4;
  const { data, isLoading } = db.useQuery(
    shouldQuery
      ? {
          rooms: {
            $: {
              where: { code: code.toUpperCase() },
            },
          },
        }
      : null
  );

  const isValidRoom = data?.rooms && data.rooms.length > 0;
  const room = data?.rooms[0];

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRoom || !room) {
      setErrorMsg("Room not found. Check the code on the TV.");
      return;
    }
    if (!nickname.trim()) {
      setErrorMsg("Please enter a cool nickname.");
      return;
    }

    setIsJoining(true);
    const playerId = id();

    try {
      await db.transact([
        db.tx.players[playerId].update({
          nickname: nickname,
          avatar_seed: nickname, // Simple seed for now
          joined_at: Date.now(),
          is_online: true,
        }).link({ room: room.id }),
      ]);

      // Navigate to play area
      router.push(`/play?roomId=${room.id}&playerId=${playerId}`);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to join. Try again.");
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        
        <div className="text-center space-y-2">
          <div className="inline-block p-4 rounded-full bg-purple-500/10 mb-2">
            <Music2 size={32} className="text-purple-500" />
          </div>
          <h1 className="text-3xl font-bold">Join the Party</h1>
          <p className="text-neutral-400">Enter the code on the TV to start queuing tracks.</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6 bg-neutral-900 p-8 rounded-3xl border border-neutral-800">
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Room Code</label>
            <input
              type="text"
              maxLength={4}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setErrorMsg("");
              }}
              placeholder="ABCD"
              className={cn(
                "w-full bg-neutral-800 border-2 border-transparent focus:border-indigo-500 rounded-xl p-4 text-center text-3xl font-mono tracking-[0.5em] uppercase outline-none transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-neutral-600",
                shouldQuery && !isValidRoom && !isLoading && "border-red-500/50"
              )}
            />
            {shouldQuery && !isValidRoom && !isLoading && (
              <p className="text-red-400 text-xs text-center">Room not found</p>
            )}
            {shouldQuery && isValidRoom && (
              <p className="text-green-400 text-xs text-center">Room found!</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Your Nickname</label>
            <input
              type="text"
              maxLength={12}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="DJ Cool..."
              className="w-full bg-neutral-800 border-2 border-transparent focus:border-purple-500 rounded-xl p-4 text-center text-xl font-bold outline-none transition-all"
            />
          </div>

          {errorMsg && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValidRoom || !nickname || isJoining}
            className="w-full bg-white text-black font-bold text-lg p-4 rounded-xl hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
          >
            {isJoining ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <span>Enter Party</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
