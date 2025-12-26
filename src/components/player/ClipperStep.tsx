"use client";

import { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Loader2, Music2, Check, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClipperStepProps {
  videoId: string;
  onQueue: (startTime: number) => void;
  onBack: () => void;
}

export default function ClipperStep({ videoId, onQueue, onBack }: ClipperStepProps) {
  const [duration, setDuration] = useState<number>(600); // Default to 10 mins
  const [startTime, setStartTime] = useState<number>(0);
  const [previewTime, setPreviewTime] = useState<number>(0); 
  const [isReady, setIsReady] = useState(false); // Used for iframe load
  
  // Constants
  const WINDOW_SIZE = 120; // 2 minutes

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = Number(e.target.value);
    setStartTime(newStart);
  };

  const handleSliderCommit = () => {
    setPreviewTime(startTime);
    setIsReady(false); // Show loader while iframe updates/reloads
  };

  // Max start time is duration - 120s? 
  // With hardcoded duration, we should just let them slide up to the limit.
  // If they pick a time past the real end, the video won't play.
  const maxStart = duration; 

  return (
    <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Clip the Best Part</h2>
        <p className="text-neutral-400 text-sm">Select the 2-minute highlight.</p>
      </div>

      <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-neutral-900">
            <Loader2 className="animate-spin text-neutral-500" />
          </div>
        )}

        {/* Visual Player (Native Iframe) */}
        <iframe
            key={previewTime} // Reload on commit
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}?start=${previewTime}&autoplay=1&controls=0&modestbranding=1&rel=0`}
            title="Preview"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            className="border-none"
            onLoad={() => setIsReady(true)}
        />
      </div>

      <div className="space-y-6">
          <div className="flex justify-between text-sm font-mono text-indigo-400">
            <span>Start: {formatTime(startTime)}</span>
            <span>+ 2 min</span>
          </div>

          <div className="relative pt-6 pb-2">
             <div className="absolute top-0 left-0 right-0 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div 
                    className="absolute h-full bg-indigo-500/30"
                    style={{
                        left: `${(startTime / duration) * 100}%`,
                        width: `${(WINDOW_SIZE / duration) * 100}%`
                    }}
                />
             </div>
             
             <Slider
                min={0}
                max={maxStart}
                value={startTime}
                onChange={handleSliderChange}
                onMouseUp={handleSliderCommit}
                onTouchEnd={handleSliderCommit}
                className="relative z-10"
              />
              <p className="text-xs text-neutral-500 text-center mt-2">
                Release slider to update preview
              </p>
          </div>

          <div className="flex space-x-3">
            <button
                onClick={onBack}
                className="flex-1 py-4 rounded-xl font-bold border border-neutral-700 hover:bg-neutral-800 transition-colors"
            >
                Back
            </button>
            <button
                onClick={() => onQueue(startTime)}
                className="flex-[2] bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-500 transition-colors flex items-center justify-center space-x-2"
            >
                <span>Add to Queue</span>
                <Check size={20} />
            </button>
          </div>
        </div>
    </div>
  );
}