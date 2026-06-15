'use client';

import dynamic from 'next/dynamic';

// Loaded browser-only: the OAuth client touches window/indexedDB/crypto and must
// never run during SSR. `ssr: false` is permitted here because this is a Client
// Component.
const BlueskyCallback = dynamic(() => import('@/components/BlueskyCallback'), {
  ssr: false,
});

export default function BlueskyCallbackPage() {
  return <BlueskyCallback />;
}
