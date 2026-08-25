"use client";

import { useState, useEffect, Suspense } from "react";
import { useGameStore } from "@/lib/game-context";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createId } from "@/lib/utils";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoadingAuth, connectPlayer } = useGameStore();

  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
    }
  }, [searchParams]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 4) return;
    if (!nickname.trim()) {
      setErrorMsg("Please enter a cool nickname.");
      return;
    }
    setIsJoining(true);

    try {
      const playerId = createId();
      const playerToken = crypto.randomUUID();
      const state = await connectPlayer(code, playerId, playerToken, nickname.trim());

      localStorage.setItem("2mdj_current_player_id", playerId);
      localStorage.setItem("2mdj_current_player_token", playerToken);
      localStorage.setItem("2mdj_current_player_name", nickname.trim());
      localStorage.setItem("2mdj_current_room_id", state.room.id);
      localStorage.setItem("2mdj_current_room_code", code);
      router.push(`/play?roomId=${state.room.id}&playerId=${playerId}`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to join. Try again.");
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
                code.length === 4 && "border-green-500/50"
              )}
            />
            {code.length === 4 && (
              <p className="text-green-400 text-xs text-center animate-in fade-in flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Ready to connect securely to the room.
              </p>
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
            disabled={code.length !== 4 || !nickname.trim() || isJoining || isLoadingAuth}
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
          <Loader2 className="animate-spin" size={32} />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
