'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
// Initial render count, then a small increment per infinite-scroll batch.
const INITIAL_BATCH = 12;
const SCROLL_BATCH = 5;
// Brief pause so the loading indicator is perceptible (data is already
// client-side, so the reveal itself is instant).
const LOAD_DELAY_MS = 350;

type Feed = { key: string; label: string; href: string };
type Group = { key: string; label: string; feeds: Feed[] };

export function BlogrollList({ items }: { items: BlogrollItem[] }) {
  // A single piece of state drives both the open accordion group and the
  // article filter: null = "All feeds"; otherwise the open category is the
  // active filter.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Infinite scroll: how many of `items` have been revealed so far.
  const [loadedCount, setLoadedCount] = useState(INITIAL_BATCH);
  const [loadingMore, setLoadingMore] = useState(false);

  const loaded = useMemo(() => items.slice(0, loadedCount), [items, loadedCount]);
  const hasMore = loadedCount < items.length;

  // The feeds sidebar reflects what's been loaded so far, so its counts grow
  // as new batches scroll in.
  const { groups, totalFeeds } = useMemo(() => {
    const catToFeeds = new Map<string, Map<string, Feed>>();
    const allFeedKeys = new Set<string>();

    for (const item of loaded) {
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
        if (!existing || (existing.label === domain && label !== domain)) {
          feedsMap.set(domain, feed);
        }
      }
    }

    const groups: Group[] = Array.from(catToFeeds.entries())
      .map(([key, feedsMap]) => ({
        key,
        label: key === OTHER ? 'Other' : key,
        feeds: Array.from(feedsMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => {
        if (a.key === OTHER) return 1;
        if (b.key === OTHER) return -1;
        if (b.feeds.length !== a.feeds.length) return b.feeds.length - a.feeds.length;
        return a.label.localeCompare(b.label);
      });

    return { groups, totalFeeds: allFeedKeys.size };
  }, [loaded]);

  const visibleItems = useMemo(() => {
    if (activeCategory === null) return loaded;
    if (activeCategory === OTHER) return loaded.filter((item) => item.categories.length === 0);
    return loaded.filter((item) => item.categories.includes(activeCategory));
  }, [loaded, activeCategory]);

  // When the sentinel scrolls into view, flag a load. Re-running on loadedCount
  // lets a short page keep filling until the viewport is covered.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLoadingMore(true);
      },
      { rootMargin: '200px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadedCount]);

  // Reveal the next (small) batch after a brief delay so the spinner is visible.
  useEffect(() => {
    if (!loadingMore) return;
    const timer = setTimeout(() => {
      setLoadedCount((count) => Math.min(items.length, count + SCROLL_BATCH));
      setLoadingMore(false);
    }, LOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loadingMore, items.length]);

  const header = (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">Blogroll</h1>
      <p className="text-lg text-gray-600 dark:text-[#cccccc]">
        Things I&rsquo;ve read recently and thought worth sharing.{' '}
        <a href="/blogroll.xml" className="text-blue-600 dark:text-blue-400 hover:underline">
          Subscribe
        </a>
      </p>
    </div>
  );

  if (items.length === 0) {
    return (
      <>
        {header}
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-[#a6a6a6]">
            Blogroll data is not available right now. Check back soon!
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] lg:gap-x-10 lg:items-start">
      {/* Header — left column, top row (so the sidebar can align to it) */}
      <div className="lg:col-start-1 lg:row-start-1">{header}</div>

      {/* Feeds sidebar — right column, floated to the top; sticky on lg+ */}
      <aside className="mb-8 self-start lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:mb-0 lg:sticky lg:top-[97px]">
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

      {/* Article stream — left column, second row */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <div className="space-y-12">
          {visibleItems.map((item) => (
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
                {(item.sourceUrl || item.sourceName) && item.publishedDate && <span>&middot;</span>}
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

              <a href={item.url} className="group block" target="_blank" rel="noopener noreferrer">
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
          {visibleItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-[#a6a6a6]">No articles in this category.</p>
            </div>
          )}
        </div>

        {/* Infinite-scroll sentinel + loading indicator */}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-8" aria-live="polite">
            {loadingMore && (
              <span className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-[#a6a6a6]">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading more&hellip;
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
