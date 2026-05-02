import { Feed } from 'feed';
import { getBlogrollItems } from '@/lib/inoreader';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = 'https://spencerboucher.com';

export async function GET() {
  const items = await getBlogrollItems();

  const feed = new Feed({
    title: "Spencer Boucher's Blogroll",
    description: "Articles and links I've found interesting, curated from my RSS reader.",
    id: `${SITE_URL}/blogroll`,
    link: `${SITE_URL}/blogroll`,
    language: 'en',
    favicon: `${SITE_URL}/icon.svg`,
    copyright: `All rights reserved ${new Date().getFullYear()}, Spencer Boucher`,
    updated: new Date(),
    feedLinks: {
      rss2: `${SITE_URL}/blogroll.xml`,
    },
    author: {
      name: 'Spencer Boucher',
      link: SITE_URL,
    },
  });

  for (const item of items) {
    feed.addItem({
      title: item.title,
      id: item.url,
      link: item.url,
      description: item.summary,
      date: item.publishedDate ? new Date(item.publishedDate) : new Date(),
      author: item.author ? [{ name: item.author }] : undefined,
      category: item.categories.map((cat) => ({ name: cat })),
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
