"use client";

import { Loader2 } from "lucide-react";
import SummaryView from "@/components/host/SummaryView";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import LZString from "lz-string";

function SummaryContent() {
  const searchParams = useSearchParams();
  const urlData = searchParams.get("data");
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (urlData) {
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(urlData);
        if (!decompressed) throw new Error("Failed to decompress data");
        const data = JSON.parse(decompressed);
        setParsedData(data);
      } catch (e) {
        console.error("Failed to parse summary data", e);
        setError("Invalid summary link.");
      }
    }
  }, [urlData]);

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

  if (!urlData) {
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
