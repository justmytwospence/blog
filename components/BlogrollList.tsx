'use client';

import { useState } from 'react';
import type { BlogrollItem } from '@blog/inoreader';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function BlogrollList({ items }: { items: BlogrollItem[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const allCategories = Array.from(
    new Set(items.flatMap((item) => item.categories))
  ).sort();

  const filteredItems = activeCategory
    ? items.filter((item) => item.categories.includes(activeCategory))
    : items;

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-10">
        <button
          onClick={() => setActiveCategory(null)}
          className={`text-sm px-4 py-1.5 rounded-full transition-colors ${
            activeCategory === null
              ? 'bg-gray-900 dark:bg-[#d4d4d4] text-white dark:text-[#1e1e1e]'
              : 'bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#454545]'
          }`}
        >
          All
        </button>
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-sm px-4 py-1.5 rounded-full transition-colors ${
              activeCategory === cat
                ? 'bg-gray-900 dark:bg-[#d4d4d4] text-white dark:text-[#1e1e1e]'
                : 'bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#454545]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {filteredItems.map((item) => (
          <article key={item.url} className="border-b border-gray-200 dark:border-[#303031] pb-12 last:border-b-0">
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-[#a6a6a6] mb-3">
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  className="hover:text-gray-700 dark:hover:text-[#cccccc] transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {getDomain(item.sourceUrl)}
                </a>
              ) : item.sourceName ? (
                <span>{item.sourceName}</span>
              ) : null}
              {(item.sourceUrl || item.sourceName) && item.publishedDate && (
                <span>&middot;</span>
              )}
              {item.publishedDate && (
                <time dateTime={new Date(item.publishedDate).toISOString()}>
                  {new Date(item.publishedDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              )}
              {item.readingTime && (
                <>
                  <span>&middot;</span>
                  <span>{item.readingTime} min read</span>
                </>
              )}
            </div>

            <a
              href={item.url}
              className="group block"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-[#d4d4d4] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {item.title}
              </h2>
              {item.summary && (
                <p className={`text-gray-600 dark:text-[#cccccc] leading-relaxed ${activeCategory === null && item.categories.length > 0 ? 'mb-4' : ''}`}>
                  {item.summary}
                </p>
              )}
            </a>

            {activeCategory === null && item.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.categories.map((cat) => (
                  <span
                    key={cat}
                    className="text-xs px-3 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc]"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-[#a6a6a6]">
              No articles in this category.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
