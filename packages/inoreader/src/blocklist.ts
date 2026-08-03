/**
 * Sources hidden from the blogroll — applied to BOTH the item stream and the subscription list, so a
 * blocked feed disappears from the articles, the sidebar, and the OPML download alike.
 *
 * Each entry is matched case-insensitively against the source/feed title and against the host of its
 * URL (exact host, subdomain, or a single dot-label), so `reddit` catches a feed named "Reddit", one
 * named "r/running" served from `www.reddit.com`, and `old.reddit.com` — but not a post about Reddit
 * syndicated by Hacker News, whose source host is `news.ycombinator.com`.
 *
 * Override the whole list with INOREADER_SOURCE_BLOCKLIST (comma-separated); an empty string
 * disables the filter.
 */
const DEFAULT_SOURCE_BLOCKLIST = ['reddit'];

export function sourceBlocklist(): string[] {
  const raw = process.env.INOREADER_SOURCE_BLOCKLIST;
  const entries = raw === undefined ? DEFAULT_SOURCE_BLOCKLIST : raw.split(',');
  return entries.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function hostOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * True when a source is blocked. `urls` is variadic because a subscription carries both a feed URL
 * and a site URL, and either one may be the reddit.com giveaway.
 */
export function isSourceBlocked(
  blocklist: string[],
  name: string | null | undefined,
  ...urls: (string | null | undefined)[]
): boolean {
  if (blocklist.length === 0) return false;

  const title = name?.toLowerCase() ?? '';
  const hosts = urls.map(hostOf).filter(Boolean);

  return blocklist.some(
    (blocked) =>
      (title !== '' && title.includes(blocked)) ||
      hosts.some(
        (host) =>
          host === blocked || host.endsWith(`.${blocked}`) || host.split('.').includes(blocked),
      ),
  );
}
