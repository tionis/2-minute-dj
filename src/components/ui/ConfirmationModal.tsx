"use client";

import { X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-md w-full space-y-6 relative shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-neutral-400">{description}</p>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
