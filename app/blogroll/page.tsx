import {
  getBlogrollItemsOrThrow,
  getBlogrollFeedsOrThrow,
  type BlogrollFeed,
  type BlogrollItem,
} from '@blog/inoreader';
import { BlogrollList } from '@/components/BlogrollList';
import { PageContainer } from '@/components/PageContainer';
import { readThrough } from '@/lib/last-good';
import type { Metadata } from 'next';

// Renders via ISR (hourly) — keep it static; readThrough serves last-good if the feed is down.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Blogroll',
  description: "Things I've read recently and thought worth sharing — articles, posts, and links from across the web.",
};

export default async function BlogrollPage() {
  // Two depths of the same public stream: the articles to render, and a full-depth crawl behind the
  // sidebar's feed list. Separate cache keys, so a slow crawl can't blank the article list.
  const [items, feeds] = await Promise.all([
    readThrough<BlogrollItem[]>('inoreader:blogroll', getBlogrollItemsOrThrow)
      .catch(() => null)
      .then((result) => result ?? []),
    readThrough<BlogrollFeed[]>('inoreader:feeds', getBlogrollFeedsOrThrow)
      .catch(() => null)
      .then((result) => result ?? []),
  ]);

  return (
    <PageContainer width="wide">
      <BlogrollList items={items} feeds={feeds} />
    </PageContainer>
  );
}
