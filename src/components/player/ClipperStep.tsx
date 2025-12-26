"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Slider } from "@/components/ui/slider";
import { Loader2, Check, Play } from "lucide-react";

// Dynamic import to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface ClipperStepProps {
  videoId: string;
  onQueue: (startTime: number) => void;
  onBack: () => void;
}

export default function ClipperStep({ videoId, onQueue, onBack }: ClipperStepProps) {
  const [duration, setDuration] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [previewTime, setPreviewTime] = useState<number>(0); // Time sent to iframe
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Constants
  const WINDOW_SIZE = 120; // 2 minutes

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDuration = (d: number) => {
    console.log("Got duration:", d);
    setDuration(d);
    setIsReady(true);
  };

  const handleError = (e: any) => {
    console.error("ReactPlayer Error:", e);
    // If ReactPlayer fails, we might still be able to play via iframe,
    // but we won't know duration. Default to 10 mins?
    if (!duration) {
        setDuration(600); 
        setIsReady(true);
    }
  };

  // Fallback: If duration load hangs, just show the UI with a default duration
  useEffect(() => {
    const timer = setTimeout(() => {
        if (!isReady && !duration) {
            console.warn("Duration timeout. Using fallback.");
            setDuration(300); // 5 mins fallback
            setIsReady(true);
        }
    }, 2000); // Quick fallback
    return () => clearTimeout(timer);
  }, [isReady, duration]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = Number(e.target.value);
    setStartTime(newStart);
  };

  // Only update iframe when user stops dragging to avoid reload spam
  const handleSliderCommit = () => {
    setPreviewTime(startTime);
  };

  const maxStart = Math.max(0, duration - WINDOW_SIZE);
  const Player = ReactPlayer as any;

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

        {/* Hidden Player for Metadata Only */}
        <div className="hidden">
            <Player
                url={`https://www.youtube.com/watch?v=${videoId}`}
                onDuration={handleDuration}
                onError={handleError}
                playing={false}
                muted={true}
                config={{ youtube: { playerVars: { origin: typeof window !== 'undefined' ? window.location.origin : undefined } } as any }}
            />
        </div>
        
        {/* Visual Player (Native Iframe) */}
        {isReady && (
            <iframe
                key={previewTime} // Reload on commit
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}?start=${previewTime}&autoplay=1&controls=0&modestbranding=1&rel=0`}
                title="Preview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                className="border-none"
            />
        )}
      </div>

      {isReady && (
        <div className="space-y-6">
          <div className="flex justify-between text-sm font-mono text-indigo-400">
            <span>Start: {formatTime(startTime)}</span>
            <span>End: {formatTime(Math.min(duration, startTime + WINDOW_SIZE))}</span>
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
      )}
    </div>
  );
}