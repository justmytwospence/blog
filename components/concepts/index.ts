import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const registry: Record<string, ComponentType> = {
  CenteredVsNoncentered: dynamic(() => import('./CenteredVsNoncentered'), { ssr: false }),
};

export function getConceptComponent(name: string): ComponentType | null {
  return registry[name] || null;
}
