'use client';

import { createContext, useContext } from 'react';
import type { CrossRefIndex } from '@blog/notebook-parser/types';

const CrossRefContext = createContext<CrossRefIndex | null>(null);

export const CrossRefProvider = CrossRefContext.Provider;

export function useCrossRefs(): CrossRefIndex | null {
  return useContext(CrossRefContext);
}
