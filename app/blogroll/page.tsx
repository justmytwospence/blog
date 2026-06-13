import { getBlogrollItems } from '@blog/inoreader';
import { BlogrollList } from '@/components/BlogrollList';
import { PageContainer } from '@/components/PageContainer';
import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Blogroll',
  description: "Things I've read recently and thought worth sharing — articles, posts, and links from across the web.",
};

export default async function BlogrollPage() {
  const items = await getBlogrollItems();

  return (
    <PageContainer width="wide">
      <BlogrollList items={items} />
    </PageContainer>
  );
}
