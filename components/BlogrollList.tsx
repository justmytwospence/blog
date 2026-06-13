'use client';

import { useMemo, useState } from 'react';
import type { BlogrollItem } from '@blog/inoreader';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Sentinel category key for items that carry no tags of their own.
const OTHER = '__other__';

type Feed = { key: string; label: string; href: string };
type Group = { key: string; label: string; feeds: Feed[] };

export function BlogrollList({ items }: { items: BlogrollItem[] }) {
  // A single piece of state drives both the open accordion group and the
  // article filter: null = "All feeds" (everything collapsed, every article
  // shown); otherwise the open category is also the active filter.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { groups, totalFeeds } = useMemo(() => {
    const catToFeeds = new Map<string, Map<string, Feed>>();
    const allFeedKeys = new Set<string>();

    for (const item of items) {
      const domain = getDomain(item.sourceUrl || item.url);
      const label = item.sourceName?.trim() || domain;
      const href = item.sourceUrl || `https://${domain}`;
      const feed: Feed = { key: domain, label, href };
      allFeedKeys.add(domain);

      const cats = item.categories.length > 0 ? item.categories : [OTHER];
      for (const cat of cats) {
        let feedsMap = catToFeeds.get(cat);
        if (!feedsMap) {
          feedsMap = new Map();
          catToFeeds.set(cat, feedsMap);
        }
        const existing = feedsMap.get(domain);
        // Prefer a real source name over a bare domain if we see one later.
        if (!existing || (existing.label === domain && label !== domain)) {
          feedsMap.set(domain, feed);
        }
      }
    }

    const groups: Group[] = Array.from(catToFeeds.entries())
      .map(([key, feedsMap]) => ({
        key,
        label: key === OTHER ? 'Other' : key,
        feeds: Array.from(feedsMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label)
        ),
      }))
      .sort((a, b) => {
        // "Other" always last; otherwise most feeds first, then alphabetical.
        if (a.key === OTHER) return 1;
        if (b.key === OTHER) return -1;
        if (b.feeds.length !== a.feeds.length) return b.feeds.length - a.feeds.length;
        return a.label.localeCompare(b.label);
      });

    return { groups, totalFeeds: allFeedKeys.size };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeCategory === null) return items;
    if (activeCategory === OTHER) return items.filter((item) => item.categories.length === 0);
    return items.filter((item) => item.categories.includes(activeCategory));
  }, [items, activeCategory]);

  return (
    <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-10 lg:items-start">
      {/* Feeds sidebar — sticky on the right at lg+, stacked on top below it */}
      <aside className="mb-10 lg:mb-0 lg:order-2 lg:sticky lg:top-[97px] self-start">
        <div className="flex flex-col rounded-lg border border-gray-200 dark:border-[#303031] bg-white dark:bg-[#252526] shadow-sm lg:max-h-[calc(100vh-7rem)]">
          <div className="flex shrink-0 items-baseline justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]">
              Feeds
            </h2>
            <span className="text-xs text-gray-400 dark:text-[#6e6e6e]">
              {totalFeeds} {totalFeeds === 1 ? 'site' : 'sites'}
            </span>
          </div>

          <div className="toc-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                activeCategory === null
                  ? 'bg-gray-100 dark:bg-[#3a3d41] font-semibold text-blue-700 dark:text-blue-400'
                  : 'text-gray-700 dark:text-[#cccccc] hover:bg-gray-100 dark:hover:bg-[#3a3d41]'
              }`}
            >
              <span>All feeds</span>
              <span className="text-xs text-gray-400 dark:text-[#6e6e6e]">{totalFeeds}</span>
            </button>

            {groups.map((group) => {
              const open = activeCategory === group.key;
              return (
                <div key={group.key} className="mt-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(open ? null : group.key)}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      open
                        ? 'bg-gray-100 dark:bg-[#3a3d41] font-semibold text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-[#cccccc] hover:bg-gray-100 dark:hover:bg-[#3a3d41]'
                    }`}
                  >
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="flex-1 truncate text-left">{group.label}</span>
                    <span className="text-xs text-gray-400 dark:text-[#6e6e6e]">{group.feeds.length}</span>
                  </button>

                  {open && (
                    <ul className="mt-1 mb-2 ml-[1.1rem] space-y-1 border-l border-gray-200 dark:border-[#303031] pl-3">
                      {group.feeds.map((feed) => (
                        <li key={feed.key}>
                          <a
                            href={feed.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={feed.label}
                            className="block truncate text-sm text-gray-600 dark:text-[#cccccc] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {feed.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Article stream */}
      <div className="min-w-0 lg:order-1">
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
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className="text-xs px-3 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#454545] transition-colors"
                    >
                      {cat}
                    </button>
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
      </div>
    </div>
  );
}
