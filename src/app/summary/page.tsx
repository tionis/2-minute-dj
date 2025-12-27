"use client";

import { useGameStore } from "@/lib/game-context";
import { Loader2 } from "lucide-react";
import SummaryView from "@/components/host/SummaryView";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function SummaryContent() {
  const searchParams = useSearchParams();
  const urlRoomId = searchParams.get("roomId");
  const { state, setRoomId, roomId } = useGameStore();

  useEffect(() => {
    if (urlRoomId && urlRoomId !== roomId) {
      setRoomId(urlRoomId);
    }
  }, [urlRoomId, roomId, setRoomId]);

  if (!urlRoomId) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-red-400 p-8">
        No Room ID provided.
      </div>
    );
  }

  // We rely on state sync. If state.room.code is present, we have data.
  // Note: This only works if the Host is online!
  if (!state.room.code) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white flex-col space-y-4">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-neutral-500 text-sm">Connecting to party...</p>
        <p className="text-neutral-700 text-xs max-w-xs text-center">
            Note: The host must be online for the summary to load in P2P mode.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-12 overflow-y-auto">
        <SummaryView />
    </div>
  );
}

export default function PermalinkSummaryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    }>
      <SummaryContent />
    </Suspense>
  );
}