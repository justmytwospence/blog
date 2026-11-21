import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const registry: Record<string, ComponentType> = {
  CenteredVsNoncentered: dynamic(() => import('./CenteredVsNoncentered'), { ssr: false }),
  GiniAtlas: dynamic(() => import('./GiniAtlas'), { ssr: false }),
  ColoradoPeaks: dynamic(() => import('./ColoradoPeaks'), { ssr: false }),
  MillionaireInflation: dynamic(() => import('./MillionaireInflation'), { ssr: false }),
};

export function getConceptComponent(name: string): ComponentType | null {
  return registry[name] || null;
}
