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
    <PageContainer width="prose">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">Blogroll</h1>
        <p className="text-lg text-gray-600 dark:text-[#cccccc]">
          Things I&rsquo;ve read recently and thought worth sharing.{' '}
          <a
            href="/blogroll.xml"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Subscribe
          </a>
        </p>
      </div>

      {items.length > 0 ? (
        <BlogrollList items={items} />
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-[#a6a6a6]">
            Blogroll data is not available right now. Check back soon!
          </p>
        </div>
      )}
    </PageContainer>
  );
}
