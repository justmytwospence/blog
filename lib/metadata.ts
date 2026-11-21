import type { Metadata } from 'next';
import { SITE_NAME } from './site';

/**
 * Metadata for an index-style page. A page-level `openGraph` replaces the root layout's wholesale,
 * so this restates siteName and locale; without it every such page shares the home page's og:url.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', locale: 'en_US', siteName: SITE_NAME, url: path, title: `${title} — ${SITE_NAME}`, description },
  };
}
