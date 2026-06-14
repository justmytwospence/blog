import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { AdventureReport } from '@/components/adventures/AdventureReport';
import { getAllAdventureSlugs, getAdventureBySlug, getAdventureTrips, type Adventure } from '@/lib/adventures';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import { SITE_URL } from '@/lib/site';

export const dynamicParams = false;

export async function generateStaticParams() {
  // Every report, including non-representative repeat trips, so each trip's URL resolves.
  return getAllAdventureSlugs().map((slug) => ({ slug }));
}

function placeOf(a: Adventure): string {
  return [a.location.city, a.location.state ?? a.location.country].filter(Boolean).join(', ');
}

function statLine(a: Adventure): string {
  return [
    formatDistance(a.totals.distanceMeters),
    formatElevation(a.totals.elevationGainMeters),
    formatDuration(a.totals.movingTimeSeconds),
  ].join(' · ');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const adventure = getAdventureBySlug(slug);
  if (!adventure) notFound();

  const place = placeOf(adventure);
  // Lead the description with the concrete facts a searcher types: sport, place, distance/vert.
  const facts = [adventure.sportType, place, statLine(adventure)].filter(Boolean).join(' · ');
  const description = adventure.description ? `${facts}. ${adventure.description}` : facts;
  const keywords = Array.from(
    new Set(
      [
        adventure.title,
        adventure.location.city,
        adventure.location.state,
        adventure.location.country,
        adventure.sportType,
        adventure.type,
        ...adventure.tags,
      ].filter((k): k is string => Boolean(k)),
    ),
  );

  return {
    title: place ? `${adventure.title} — ${place}` : adventure.title,
    description,
    keywords,
    alternates: { canonical: `/adventures/${slug}` },
    openGraph: {
      title: adventure.title,
      description,
      url: `/adventures/${slug}`,
      type: 'article',
      publishedTime: adventure.date,
    },
  };
}

/** schema.org structured data so the route/peak is eligible for rich results. */
function jsonLd(adventure: Adventure, slug: string) {
  const start = adventure.primaryActivity.track?.coordinates?.[0]; // [lng, lat]
  const place = placeOf(adventure);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: adventure.title,
    description: adventure.description || `${adventure.sportType} · ${statLine(adventure)}`,
    image: `${SITE_URL}/adventures/${slug}/opengraph-image`,
    datePublished: adventure.date,
    dateModified: adventure.date,
    author: { '@type': 'Person', name: 'Spencer Boucher', url: SITE_URL },
    publisher: { '@type': 'Person', name: 'Spencer Boucher', url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/adventures/${slug}`,
    keywords: [adventure.sportType, adventure.type, ...adventure.tags].filter(Boolean).join(', '),
    ...(place || start
      ? {
          contentLocation: {
            '@type': 'Place',
            name: place || adventure.title,
            ...(start
              ? { geo: { '@type': 'GeoCoordinates', latitude: start[1], longitude: start[0] } }
              : {}),
          },
        }
      : {}),
  };
}

export default async function AdventurePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const adventure = getAdventureBySlug(slug);
  if (!adventure) notFound();
  const trips = getAdventureTrips(slug);

  return (
    <PageContainer width="wide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(adventure, slug)) }}
      />
      <AdventureReport adventure={adventure} trips={trips} activeSlug={slug} />
    </PageContainer>
  );
}
