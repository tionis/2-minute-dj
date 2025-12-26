"use client";

import { db } from "@/lib/db";
import { Loader2 } from "lucide-react";
import SummaryView from "@/components/host/SummaryView";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SummaryContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");

  const { data, isLoading, error } = db.useQuery(
    roomId
      ? {
          rooms: {
            $: { where: { id: roomId } },
            players: {},
            queue_items: {
                player: {},
            },
          },
        }
      : null
  );

  if (!roomId) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-red-400 p-8">
        No Room ID provided.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error || !data?.rooms.length) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-red-400 p-8">
        Summary not found or error loading data.
      </div>
    );
  }

  const room = data.rooms[0];

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-12 overflow-y-auto">
        <SummaryView room={room as any} />
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
