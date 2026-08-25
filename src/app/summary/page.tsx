"use client";

import { Loader2 } from "lucide-react";
import SummaryView from "@/components/host/SummaryView";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import LZString from "lz-string";

function SummaryContent() {
  const searchParams = useSearchParams();
  const urlData = searchParams.get("data");
  const summaryId = searchParams.get("id");
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (summaryId) {
      if (!/^[0-9a-f-]{36}$/i.test(summaryId)) { setError("Invalid summary link."); return; }
      const apiOrigin = window.location.port === "3000"
        ? `${window.location.protocol}//${window.location.hostname}:2567`
        : "";
      void fetch(`${apiOrigin}/api/summaries/${encodeURIComponent(summaryId)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(response.status === 404 ? "This summary has expired or does not exist." : "Unable to load summary.");
          return response.json();
        })
        .then((data) => { if (!cancelled) setParsedData(data); })
        .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load summary."); });
    } else if (urlData) {
      try {
        if (urlData.length > 100_000) throw new Error("Summary link is too large");
        const decompressed = LZString.decompressFromEncodedURIComponent(urlData);
        if (!decompressed) throw new Error("Failed to decompress data");
        if (decompressed.length > 500_000) throw new Error("Summary data is too large");
        const data = JSON.parse(decompressed);
        if (!data || typeof data.roomCode !== "string" || !Array.isArray(data.songs) || data.songs.length > 200) {
          throw new Error("Invalid summary data");
        }
        setParsedData({
          roomCode: data.roomCode.slice(0, 16),
          songs: data.songs.map((song: any) => ({
            id: String(song?.id ?? "").slice(0, 64),
            video_id: String(song?.video_id ?? "").slice(0, 32),
            video_title: String(song?.video_title ?? "Unknown Track").slice(0, 200),
            player_nickname: String(song?.player_nickname ?? "Unknown").slice(0, 24),
            votes: Array.isArray(song?.votes) ? song.votes.filter((vote: unknown) => typeof vote === "number" && Number.isFinite(vote)).slice(0, 50) : [],
            status: song?.status === "SKIPPED" ? "SKIPPED" : "PLAYED",
          })),
        });
      } catch (e) {
        console.error("Failed to parse summary data", e);
        setError("Invalid summary link.");
      }
    }
    return () => { cancelled = true; };
  }, [summaryId, urlData]);

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-red-400 p-8">
        {error}
      </div>
    );
  }

  if (parsedData) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-12 overflow-y-auto">
        <SummaryView data={parsedData} />
      </div>
    );
  }

  if (!urlData && !summaryId) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-red-400 p-8">
        No summary data provided.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
      <Loader2 className="animate-spin" size={32} />
    </div>
  );
}

export default function PermalinkSummaryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
          <Loader2 className="animate-spin" size={32} />
        </div>
      }
    >
      <SummaryContent />
    </Suspense>
  );
}
