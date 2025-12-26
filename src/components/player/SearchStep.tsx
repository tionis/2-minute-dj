"use client";

import { useState } from "react";
import { ArrowRight, Search, Link as LinkIcon, Info } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";

interface SearchStepProps {
  onNext: (videoId: string, startTime: number, title: string) => void;
}

export default function SearchStep({ onNext }: SearchStepProps) {
  const { t, language } = useI18n();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const parseYoutubeUrl = (input: string) => {
    let videoId = null;
    let startTime = 0;

    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = input.match(regExp);
        if (match && match[2].length === 11) {
            videoId = match[2];
        }

        const safeUrl = input.startsWith("http") ? input : `https://${input}`;
        const urlObj = new URL(safeUrl);
        
        const timeParam = urlObj.searchParams.get("t") || urlObj.searchParams.get("start");
        
        if (timeParam) {
            const hours = timeParam.match(/(\d+)h/);
            const mins = timeParam.match(/(\d+)m/);
            const secs = timeParam.match(/(\d+)s/);
            
            if (hours || mins || secs) {
                startTime = 
                    (hours ? parseInt(hours[1]) * 3600 : 0) +
                    (mins ? parseInt(mins[1]) * 60 : 0) +
                    (secs ? parseInt(secs[1]) : 0);
            } else {
                startTime = parseInt(timeParam);
            }
        }
    } catch (e) {
        console.log("URL parse error", e);
    }

    return { videoId, startTime: isNaN(startTime) ? 0 : startTime };
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const { videoId, startTime } = parseYoutubeUrl(url);

    if (videoId) {
      setLoading(true);
      try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();
        const title = data.title || (language === "de" ? "Unbekannter Titel" : "Unknown Title");
        onNext(videoId, startTime, title);
      } catch (err) {
        console.error("Failed to fetch title", err);
        onNext(videoId, startTime, language === "de" ? "Unbekannter Titel" : "Unknown Title");
      } finally {
        setLoading(false);
      }
    } else {
      setError(language === "de" ? "Ungültige YouTube-URL. Versuche es erneut." : "Invalid YouTube URL. Try again.");
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{t("pickSong")}</h2>
        <p className="text-neutral-400 text-sm">{t("pasteLink")}</p>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
            <LinkIcon size={20} />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            placeholder="https://youtu.be/..."
            className="w-full bg-neutral-800 border-2 border-transparent focus:border-indigo-500 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-600 outline-none transition-all"
          />
        </div>

        {/* Tip */}
        <div className="bg-blue-500/10 p-4 rounded-xl flex items-start space-x-3 text-sm text-blue-200 text-left">
            <Info className="shrink-0 mt-0.5" size={16} />
            <p>
                <strong>Tip:</strong> {language === "de" ? "Willst du an einer bestimmten Stelle starten? Nutze das 'Starten bei' Häkchen beim Teilen auf YouTube oder füge " : "Want to start at a specific part? Use the 'Start at' checkbox when sharing from YouTube, or add "}<code className="bg-black/30 px-1 rounded">?t=1m20s</code> {language === "de" ? "am Ende des Links hinzu." : "to the link."}
            </p>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!url || loading}
          className="w-full bg-white text-black font-bold text-lg p-4 rounded-xl hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
        >
          {loading ? (
             <span>{language === "de" ? "Lädt..." : "Loading..."}</span>
          ) : (
             <>
                <span>{t("previewSong")}</span>
                <ArrowRight size={20} />
             </>
          )}
        </button>
      </form>
    </div>
  );
}
