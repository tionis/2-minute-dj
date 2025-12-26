"use client";

import { useEffect, useState } from "react";
import { Flame, ThumbsUp, ThumbsDown } from "lucide-react";

interface HypeMeterProps {
  votes: Record<string, number>;
  className?: string;
}

export default function HypeMeter({ votes, className = "" }: HypeMeterProps) {
  const [score, setScore] = useState(50);
  const [trend, setTrend] = useState<"up" | "down" | "neutral">("neutral");

  useEffect(() => {
    if (!votes) {
      setScore(50);
      return;
    }

    const values = Object.values(votes);
    if (values.length === 0) {
      setScore(50);
      return;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / values.length);
    
    setScore(prev => {
        if (avg > prev) setTrend("up");
        else if (avg < prev) setTrend("down");
        else setTrend("neutral");
        return avg;
    });

  }, [votes]);

  const getColor = (s: number) => {
      if (s >= 75) return "text-green-500";
      if (s <= 25) return "text-red-500";
      return "text-white";
  };

  const getBarColor = (s: number) => {
      if (s >= 75) return "bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]";
      if (s <= 25) return "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]";
      return "bg-indigo-500";
  };

  const getEmoji = (s: number) => {
      if (s >= 90) return "🔥";
      if (s >= 75) return "💃";
      if (s >= 60) return "🙂";
      if (s >= 40) return "😐";
      if (s >= 25) return "🥱";
      return "💩";
  };

  return (
    <div className={`relative ${className}`}>
        <div className="flex items-center space-x-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-2xl transition-all duration-500">
            {/* Score */}
            <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 bg-neutral-900 transition-colors duration-500 ${score >= 75 ? "border-green-500/50" : score <= 25 ? "border-red-500/50" : "border-neutral-800"}`}>
                <span className={`text-2xl font-black font-mono transition-colors duration-300 ${getColor(score)}`}>{score}</span>
                <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">HYPE</span>
            </div>

            {/* Bar */}
            <div className="flex-1 space-y-2 min-w-[200px]">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    <div className={`flex items-center space-x-1 transition-opacity ${score <= 25 ? "opacity-100 text-red-500" : "opacity-30"}`}>
                        <ThumbsDown size={12} />
                        <span>Lame</span>
                    </div>
                    <div className="text-2xl animate-bounce">{getEmoji(score)}</div>
                    <div className={`flex items-center space-x-1 transition-opacity ${score >= 75 ? "opacity-100 text-green-500" : "opacity-30"}`}>
                        <span>Fire</span>
                        <ThumbsUp size={12} />
                    </div>
                </div>
                <div className="h-4 bg-neutral-800 rounded-full overflow-hidden relative">
                    {/* Center Marker */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 z-10" />
                    
                    {/* Progress */}
                    <div 
                        className={`h-full transition-all duration-500 ease-out relative ${getBarColor(score)}`}
                        style={{ width: `${score}%` }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full animate-[shimmer_2s_infinite]" />
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
