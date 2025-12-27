"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Check } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";

// Declare YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface ClipperStepProps {
  videoId: string;
  onQueue: (startTime: number) => void;
  onBack: () => void;
}

export default function ClipperStep({ videoId, onQueue, onBack }: ClipperStepProps) {
  const { t, language } = useI18n();
  const [duration, setDuration] = useState<number>(0); 
  const [startTime, setStartTime] = useState<number>(0);
  const [isReady, setIsReady] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Constants
  const WINDOW_SIZE = 120; // 2 minutes

  // Load YouTube IFrame API and create player
  useEffect(() => {
    // Load the IFrame Player API code asynchronously if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!containerRef.current || playerRef.current) return;
      
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            const dur = event.target.getDuration();
            if (dur > 0) setDuration(dur);
          },
          onStateChange: (event: any) => {
            // Get duration when video starts playing
            if (event.data === window.YT.PlayerState.PLAYING) {
              const dur = event.target.getDuration();
              if (dur > 0 && duration === 0) setDuration(dur);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = Number(e.target.value);
    setStartTime(newStart);
    // Real-time seeking
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(newStart, true);
    }
  };

  const handleQueue = () => {
    // Stop the player before unmounting to prevent AbortError
    if (playerRef.current?.stopVideo) {
      playerRef.current.stopVideo();
    }
    onQueue(startTime);
  };

  return (
    <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{t("clipBestPart")}</h2>
        <p className="text-neutral-400 text-sm">{t("selectHighlight")}</p>
      </div>

      <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-neutral-900">
            <Loader2 className="animate-spin text-neutral-500" />
          </div>
        )}

        {/* YouTube Player Container */}
        <div ref={containerRef} className="w-full h-full" />
        
        {/* Helper overlay to show it's a preview */}
        <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-white/50 pointer-events-none">
            Preview
        </div>
      </div>

      <div className="space-y-6">
          <div className="flex justify-between text-sm font-mono text-indigo-400 text-left">
            <span>{language === "de" ? "Start" : "Start"}: {formatTime(startTime)}</span>
            <span>+ 2 min</span>
          </div>

          <div className="relative pt-6 pb-2">
             {/* Duration Bar */}
             <div className="absolute top-0 left-0 right-0 h-2 bg-neutral-800 rounded-full overflow-hidden">
                {duration > 0 && (
                    <div 
                        className="absolute h-full bg-indigo-500/30 transition-all duration-75"
                        style={{
                            left: `${(startTime / duration) * 100}%`,
                            width: `${Math.min(100, (WINDOW_SIZE / duration) * 100)}%`
                        }}
                    />
                )}
             </div>
             
             <input
                type="range"
                min={0}
                max={duration || 100} // Fallback until duration loads
                step={1}
                value={startTime}
                onChange={handleSliderChange}
                className="w-full h-2 bg-transparent appearance-none cursor-pointer relative z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
              />
              <p className="text-xs text-neutral-500 text-center mt-2">
                {language === "de" ? "Ziehen, um Startzeit zu wählen" : "Drag to pick start time"}
              </p>
          </div>

          <div className="flex space-x-3">
            <button
                onClick={onBack}
                className="flex-1 py-4 rounded-xl font-bold border border-neutral-700 hover:bg-neutral-800 transition-colors"
            >
                {t("back")}
            </button>
            <button
                onClick={handleQueue}
                className="flex-[2] bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-500 transition-colors flex items-center justify-center space-x-2"
            >
                <span>{t("addToQueue")}</span>
                <Check size={20} />
            </button>
          </div>
        </div>
    </div>
  );
}
