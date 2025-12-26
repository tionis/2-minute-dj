"use client";

import { X } from "lucide-react";
import { useState } from "react";

interface InputModalProps {
  isOpen: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  title: string;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
}

export default function InputModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  placeholder,
  initialValue = "",
  confirmText = "Save",
  cancelText = "Cancel",
}: InputModalProps) {
  const [value, setValue] = useState(initialValue);

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
          {description && <p className="text-neutral-400">{description}</p>}
        </div>

        <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-neutral-800 border-2 border-transparent focus:border-indigo-500 rounded-xl p-4 text-white outline-none transition-all font-bold text-lg"
            autoFocus
        />

        <div className="flex space-x-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => onConfirm(value)}
            disabled={!value.trim()}
            className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
