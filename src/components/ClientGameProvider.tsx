"use client";

import dynamic from 'next/dynamic';
import React from 'react';

const GameProviderInternal = dynamic(() => import('@/lib/store').then(mod => mod.GameProvider), {
  ssr: false,
});

export function ClientGameProvider({ children }: { children: React.ReactNode }) {
  return <GameProviderInternal>{children}</GameProviderInternal>;
}
