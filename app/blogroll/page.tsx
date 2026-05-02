import { getBlogrollItems } from '@blog/inoreader';
import { BlogrollList } from '@/components/BlogrollList';
import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Blogroll',
  description: "Articles and links I've found interesting, curated from my RSS reader.",
};

export default async function BlogrollPage() {
  const items = await getBlogrollItems();

  return (
    <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-2 sm:py-8 max-w-3xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">Blogroll</h1>
        <p className="text-lg text-gray-600 dark:text-[#cccccc]">
          Articles and links I've found interesting, curated from my RSS reader.{' '}
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
    </main>
  );
}
