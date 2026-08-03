/**
 * OPML export of the blogroll — every feed the public stream has seen publish, grouped by tag, so a
 * reader can import the whole list. Deliberately broader than `/blogroll.xml`: that is "what I read
 * recently", this is "the feeds behind it", from a full-depth crawl rather than the first page.
 */
import { buildOpml, getBlogrollFeedsOrThrow, type BlogrollFeed } from '@blog/inoreader';
import { readThrough } from '@/lib/last-good';
import { AUTHOR } from '@/lib/site';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  // Same cache key as the sidebar's list — identical data, so the page and the download share one
  // last-good entry and one crawl per revalidation window.
  const feeds =
    (await readThrough<BlogrollFeed[]>('inoreader:feeds', getBlogrollFeedsOrThrow).catch(
      () => null,
    )) ?? [];

  const opml = buildOpml(feeds, {
    title: "Spencer Boucher's Blogroll",
    ownerName: AUTHOR.name,
    dateCreated: new Date().toUTCString(),
  });

  return new Response(opml, {
    headers: {
      'Content-Type': 'text/x-opml+xml; charset=utf-8',
      'Content-Disposition': 'attachment; filename="blogroll.opml"',
    },
  });
}
