import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { AdventureReport } from '@/components/adventures/AdventureReport';
import { getAllAdventures, getAdventureBySlug } from '@/lib/adventures';

export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllAdventures().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const adventure = getAdventureBySlug(slug);
  if (!adventure) notFound();

  const place = [adventure.location.state ?? adventure.location.country]
    .filter(Boolean)
    .join('');
  const description =
    adventure.description || [adventure.sportType, place].filter(Boolean).join(' · ');

  return {
    title: adventure.title,
    description,
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

export default async function AdventurePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const adventure = getAdventureBySlug(slug);
  if (!adventure) notFound();

  return (
    <PageContainer width="wide">
      <AdventureReport adventure={adventure} />
    </PageContainer>
  );
}
