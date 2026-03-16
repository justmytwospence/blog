import { getBlogrollItems } from '@/lib/inoreader';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blogroll',
  description: "Articles and links I've found interesting, curated from my RSS reader.",
};

export default async function BlogrollPage() {
  const items = await getBlogrollItems();

  return (
    <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-2 sm:py-8 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">Blogroll</h1>
        <p className="text-gray-600 dark:text-[#a6a6a6]">
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
        <ul className="space-y-8">
          {items.map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.title}
              </a>
              <div className="mt-1 text-sm text-gray-500 dark:text-[#a6a6a6]">
                {item.sourceName && <span>{item.sourceName}</span>}
                {item.sourceName && item.author && <span> &middot; </span>}
                {item.author && <span>{item.author}</span>}
                {(item.sourceName || item.author) && item.publishedDate && (
                  <span> &middot; </span>
                )}
                {item.publishedDate && (
                  <time dateTime={new Date(item.publishedDate).toISOString()}>
                    {new Date(item.publishedDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                )}
              </div>
              {item.summary && (
                <p className="mt-2 text-gray-700 dark:text-[#cccccc] text-sm leading-relaxed">
                  {item.summary}
                </p>
              )}
            </li>
          ))}
        </ul>
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
