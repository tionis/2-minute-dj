"use client";

import { X } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  buttonText?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  description,
  buttonText = "OK",
}: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-md w-full space-y-6 relative shadow-2xl text-center">
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-neutral-400">{description}</p>
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
