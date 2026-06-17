import { getBlogrollItemsOrThrow, type BlogrollItem } from '@blog/inoreader';
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
  const items =
    (await readThrough<BlogrollItem[]>('inoreader:blogroll', getBlogrollItemsOrThrow).catch(
      () => null,
    )) ?? [];

  return (
    <PageContainer width="wide">
      <BlogrollList items={items} />
    </PageContainer>
  );
}
