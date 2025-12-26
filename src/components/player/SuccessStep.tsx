"use client";

import { CheckCircle2, Music } from "lucide-react";

interface SuccessStepProps {
  onAddAnother: () => void;
}

export default function SuccessStep({ onAddAnother }: SuccessStepProps) {
  return (
    <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500 text-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-6 rounded-full bg-green-500/20 text-green-500">
          <CheckCircle2 size={64} />
        </div>
        <h2 className="text-3xl font-bold">Queued!</h2>
        <p className="text-neutral-400">
          Your track has been added to the playlist. Get ready to party!
        </p>
      </div>

      <button
        onClick={onAddAnother}
        className="w-full bg-neutral-800 text-white font-bold text-lg p-4 rounded-xl border border-neutral-700 hover:bg-neutral-700 hover:border-indigo-500 transition-all flex items-center justify-center space-x-2"
      >
        <Music size={20} />
        <span>Queue Another Song</span>
      </button>
    </div>
  );
}
