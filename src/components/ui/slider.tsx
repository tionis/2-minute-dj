"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  min: number;
  max: number;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMouseUp?: () => void;
  onTouchEnd?: () => void;
}

export function Slider({ className, ...props }: SliderProps) {
  return (
    <input
      type="range"
      className={cn(
        "w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500",
        className
      )}
      {...props}
    />
  );
}
