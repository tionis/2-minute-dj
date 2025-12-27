"use client";

import { Copy, Check, X } from "lucide-react";
import { useState } from "react";

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  link: string;
  buttonText?: string;
}

export default function ShareLinkModal({
  isOpen,
  onClose,
  title,
  link,
  buttonText = "Done",
}: ShareLinkModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-lg w-full space-y-6 relative shadow-2xl">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={link}
              className="flex-1 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm font-mono truncate focus:outline-none focus:border-indigo-500"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              className={`px-4 rounded-xl font-bold transition-all flex items-center gap-2 ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-indigo-500 hover:bg-indigo-600 text-white"
              }`}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
          <p className="text-xs text-neutral-500 text-center">
            Click the link to select it, or use the copy button
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold bg-white text-black hover:bg-neutral-200 transition-colors"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
