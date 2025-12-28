"use client";

import { useState, useEffect, Suspense } from "react";
import { useGameStore } from "@/lib/game-context";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, updateState, setRoomId, peerId, isConnected } = useGameStore();

  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasTriedJoin, setHasTriedJoin] = useState(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);

  // Auto-fill code from URL if present
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
    }
  }, [searchParams]);

  // Try to connect when code is 4 chars
  useEffect(() => {
      if (code.length === 4) {
          setRoomId(code);
          setHasTriedJoin(true);
          setConnectionTimedOut(false);
      } else {
          setRoomId(""); // Disconnect if invalid code
          setHasTriedJoin(false);
          setConnectionTimedOut(false);
      }
  }, [code, setRoomId]);

  // Timeout mechanism: if room not found after 15 seconds, show error
  useEffect(() => {
    if (!hasTriedJoin || !isConnected || state.room.code === code) {
      return; // No timeout needed
    }

    const timeoutId = setTimeout(() => {
      // If we're still connected but haven't received room data matching our code,
      // the room likely doesn't exist (no host peer in that room)
      if (state.room.code !== code) {
        setConnectionTimedOut(true);
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timeoutId);
  }, [hasTriedJoin, isConnected, state.room.code, code]);

  // Check if room is valid based on synced state
  // We assume if we connected and got state, room.code should match for existing rooms.
  // If we are alone and first to join, room.code is "" (default), but we can still be connected.
  const isValidRoom =
    code.length === 4 &&
    (state.room.code === code ||
      (hasTriedJoin && isConnected && !state.room.code && !connectionTimedOut));

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRoom) {
      setErrorMsg("Room not found. Check the code on the TV.");
      return;
    }
    if (!nickname.trim()) {
      setErrorMsg("Please enter a cool nickname.");
      return;
    }

    setIsJoining(true);
    
    // Create player profile
    // We use the persistent peerId for identification
    const playerId = peerId;

    try {
      updateState(doc => {
          doc.players[playerId] = {
              id: playerId,
              nickname: nickname,
              avatar_seed: nickname,
              joined_at: Date.now(),
              is_online: true,
          };
      });

      // Navigate to play area
      // We don't need params in URL necessarily if we use context, 
      // but keeping them for consistency with original design or deep linking (though P2P deep link is harder)
      // Actually, passing them helps PlayPage know "who am I" if we didn't have global store,
      // but with global store we have `peerId`.
      // We will keep params for now to match PlayPage expectation (which we will refactor next).
      router.push(`/play?roomId=${state.room.id}&playerId=${playerId}`);
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
                code.length === 4 && !isValidRoom && hasTriedJoin && isConnected && !connectionTimedOut && "border-yellow-500/50",
                code.length === 4 && connectionTimedOut && "border-red-500/50",
                isValidRoom && "border-green-500/50"
              )}
            />
            {code.length === 4 && !isValidRoom && isConnected && !connectionTimedOut && (
              <p className="text-yellow-400 text-xs text-center animate-in fade-in flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={12} />
                Searching for room...
              </p>
            )}
            {connectionTimedOut && (
              <p className="text-red-400 text-xs text-center animate-in fade-in">
                Room not found. Make sure the TV is showing the room code.
              </p>
            )}
            {isValidRoom && (
              <p className="text-green-400 text-xs text-center animate-in fade-in">Room found!</p>
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