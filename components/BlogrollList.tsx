'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlogrollFeed, BlogrollItem } from '@blog/inoreader';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Feed content is untrusted: only allow http(s) hrefs, never javascript:/data:.
function safeUrl(url: string | null | undefined): string {
  if (!url) return '#';
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : '#';
  } catch {
    return '#';
  }
}

// Sentinel group key for feeds whose items carried no tags.
const OTHER = '__other__';
// Initial render count, then a small increment per infinite-scroll batch.
const INITIAL_BATCH = 12;
const SCROLL_BATCH = 5;
// Brief pause so the loading indicator is perceptible (data is already
// client-side, so the reveal itself is instant).
const LOAD_DELAY_MS = 350;

type SidebarFeed = { key: string; label: string; href: string; count: number };
type Group = { key: string; label: string; feeds: SidebarFeed[]; activeCount: number };
type Filter = { kind: 'folder' | 'tag'; key: string };

export function BlogrollList({
  items,
  feeds,
}: {
  items: BlogrollItem[];
  /**
   * Every feed from the full-depth crawl — a superset of the sources in `items`, which is only the
   * most recent page of the same stream.
   */
  feeds: BlogrollFeed[];
}) {
  // One piece of state drives the open accordion group AND the article filter. Two kinds: a sidebar
  // group selects a whole FEED set, an article chip selects a single TAG. null = "All feeds".
  const [filter, setFilter] = useState<Filter | null>(null);
  // Infinite scroll: how many of `items` have been revealed so far.
  const [loadedCount, setLoadedCount] = useState(INITIAL_BATCH);
  const [loadingMore, setLoadingMore] = useState(false);

  // Changing the filter rewinds the scroll window: a folder's articles can sit anywhere in the
  // stream, so pagination applies to the FILTERED list, not to the raw one.
  const applyFilter = (next: Filter | null) => {
    setFilter(next);
    setLoadedCount(INITIAL_BATCH);
  };

  // How many of the RENDERED articles each feed contributed. The crawl's own `itemCount` covers ten
  // weeks of history, so it would promise articles this page can't show — count what's here instead.
  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = getDomain(item.sourceUrl || item.url);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  // The sidebar is the whole crawled feed list grouped by tag — feeds with nothing in the rendered
  // articles are listed too (that's the point of it), just without a count.
  const { groups, totalFeeds } = useMemo(() => {
    const byFolder = new Map<string, SidebarFeed[]>();

    for (const feed of feeds) {
      const key = feed.id;
      const sidebarFeed: SidebarFeed = {
        key,
        label: feed.title,
        href: feed.url,
        count: itemCounts.get(key) ?? 0,
      };
      const folders = feed.folders.length > 0 ? feed.folders : [OTHER];
      for (const folder of folders) {
        const bucket = byFolder.get(folder);
        if (bucket) bucket.push(sidebarFeed);
        else byFolder.set(folder, [sidebarFeed]);
      }
    }

    const groups: Group[] = Array.from(byFolder.entries())
      .map(([key, folderFeeds]) => ({
        key,
        label: key === OTHER ? 'Other' : key,
        feeds: folderFeeds.sort((a, b) => a.label.localeCompare(b.label)),
        activeCount: folderFeeds.filter((f) => f.count > 0).length,
      }))
      .sort((a, b) => {
        if (a.key === OTHER) return 1;
        if (b.key === OTHER) return -1;
        return a.label.localeCompare(b.label);
      });

    return { groups, totalFeeds: feeds.length };
  }, [feeds, itemCounts]);

  const filteredItems = useMemo(() => {
    if (filter === null) return items;
    if (filter.kind === 'tag') return items.filter((item) => item.categories.includes(filter.key));

    // Folder: show what its feeds published.
    const group = groups.find((g) => g.key === filter.key);
    const keys = new Set(group?.feeds.map((f) => f.key) ?? []);
    return items.filter((item) => keys.has(getDomain(item.sourceUrl || item.url)));
  }, [items, filter, groups]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, loadedCount),
    [filteredItems, loadedCount],
  );
  const hasMore = loadedCount < filteredItems.length;

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
      setLoadedCount((count) => Math.min(filteredItems.length, count + SCROLL_BATCH));
      setLoadingMore(false);
    }, LOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loadingMore, filteredItems.length]);

  const header = (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-[#d4d4d4]">Blogroll</h1>
        <a
          href="/blogroll.xml"
          title="Subscribe"
          aria-label="Subscribe to the blogroll feed"
          className="flex items-center justify-center p-2 rounded-lg bg-gray-200 dark:bg-[#252526] hover:bg-gray-300 dark:hover:bg-[#3a3d41] transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-700 dark:text-yellow-500" aria-hidden="true">
            <path d="M3.75 3a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75H4a9 9 0 0 1 9 9v.25c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75V14c0-6.075-4.925-11-11-11h-.25Z" />
            <path d="M3 7.75A.75.75 0 0 1 3.75 7H4a6 6 0 0 1 6 6v.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V13a4 4 0 0 0-4-4h-.25A.75.75 0 0 1 3 8.25v-.5Z" />
            <path d="M6 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
          </svg>
        </a>
        <a
          href="/blogroll.opml"
          download="blogroll.opml"
          title="Download OPML"
          aria-label="Download the full feed list as OPML"
          className="flex items-center justify-center p-2 rounded-lg bg-gray-200 dark:bg-[#252526] hover:bg-gray-300 dark:hover:bg-[#3a3d41] transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-700 dark:text-yellow-500" aria-hidden="true">
            <path fillRule="evenodd" d="M10 2.75a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V3.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v.5A3.25 3.25 0 0 0 5.25 16.5h9.5A3.25 3.25 0 0 0 18 13.25v-.5a.75.75 0 0 0-1.5 0v.5a1.75 1.75 0 0 1-1.75 1.75h-9.5a1.75 1.75 0 0 1-1.75-1.75v-.5Z" />
          </svg>
        </a>
      </div>
      <p className="text-lg text-gray-600 dark:text-[#cccccc]">
        Things I&rsquo;ve read recently and thought worth sharing.
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
            <h2
              className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]"
              title="Every feed that has published in the last few months, grouped by tag"
            >
              Feeds
            </h2>
            <span className="text-xs text-gray-400 dark:text-[#6e6e6e]">
              {totalFeeds} {totalFeeds === 1 ? 'site' : 'sites'}
            </span>
          </div>

          <div className="toc-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <button
              type="button"
              onClick={() => applyFilter(null)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                filter === null
                  ? 'bg-gray-100 dark:bg-[#3a3d41] font-semibold text-blue-700 dark:text-blue-400'
                  : 'text-gray-700 dark:text-[#cccccc] hover:bg-gray-100 dark:hover:bg-[#3a3d41]'
              }`}
            >
              <span>All feeds</span>
              <span className="text-xs text-gray-400 dark:text-[#6e6e6e]">{totalFeeds}</span>
            </button>

            {groups.map((group) => {
              const open = filter?.kind === 'folder' && filter.key === group.key;
              const panelId = `feeds-${group.key.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
              return (
                <div key={group.key} className="mt-0.5">
                  <button
                    type="button"
                    onClick={() => applyFilter(open ? null : { kind: 'folder', key: group.key })}
                    aria-expanded={open}
                    aria-controls={panelId}
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
                    <span
                      className="text-xs text-gray-400 dark:text-[#6e6e6e]"
                      title={`${group.activeCount} of ${group.feeds.length} with articles below`}
                    >
                      {group.activeCount} of {group.feeds.length}
                    </span>
                  </button>

                  {open && (
                    <ul id={panelId} className="mt-1 mb-2 ml-[1.1rem] space-y-1 border-l border-gray-200 dark:border-[#303031] pl-3">
                      {group.feeds.map((feed) => (
                        <li key={feed.key} className="flex items-baseline justify-between gap-2">
                          <a
                            href={safeUrl(feed.href)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={feed.label}
                            className={`block truncate text-sm transition-colors hover:text-blue-600 dark:hover:text-blue-400 ${
                              feed.count > 0
                                ? 'text-gray-600 dark:text-[#cccccc]'
                                : 'text-gray-400 dark:text-[#6e6e6e]'
                            }`}
                          >
                            {feed.label}
                          </a>
                          <span
                            className="shrink-0 text-xs text-gray-400 dark:text-[#6e6e6e]"
                            title={
                              feed.count > 0
                                ? `${feed.count} article${feed.count === 1 ? '' : 's'} below`
                                : 'No articles in the current window'
                            }
                          >
                            {feed.count > 0 ? feed.count : '·'}
                          </span>
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
                    href={safeUrl(item.sourceUrl)}
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

              <a href={safeUrl(item.url)} className="group block" target="_blank" rel="noopener noreferrer">
                <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-[#d4d4d4] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h2>
                {item.summary && (
                  <p className={`text-gray-600 dark:text-[#cccccc] leading-relaxed ${filter === null && item.categories.length > 0 ? 'mb-4' : ''}`}>
                    {item.summary}
                  </p>
                )}
              </a>

              {filter === null && item.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => applyFilter({ kind: 'tag', key: cat })}
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
              <p className="text-gray-500 dark:text-[#a6a6a6]">
                {filter?.kind === 'folder'
                  ? 'Nothing from these feeds in the recent stream.'
                  : 'No articles in this category.'}
              </p>
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
