import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { CatalogView } from '@/components/adventures/objectives/CatalogView';
import { getObjectiveCatalog } from '@/lib/adventures';
import { PAGE_IDS, pageConfig } from '@/lib/objective-schema';

export const dynamicParams = false;

export async function generateStaticParams() {
  return PAGE_IDS.map((page) => ({ page }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  const cfg = pageConfig(page);
  if (!cfg) return {};
  return { title: cfg.label, description: cfg.blurb };
}

export default async function ObjectivesCategoryPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const cfg = pageConfig(page);
  if (!cfg) notFound();

  const items = getObjectiveCatalog().filter((i) => i.page === cfg.id);

  return (
    <PageContainer width="wide">
      <Link
        href="/adventures/objectives"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
      >
        ← Objectives
      </Link>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-[#d4d4d4]">{cfg.label}</h1>
        <p className="mt-2 text-gray-600 dark:text-[#cccccc]">{cfg.blurb}</p>
      </div>
      <Suspense fallback={<div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">Loading…</div>}>
        <CatalogView page={cfg.id} items={items} />
      </Suspense>
    </PageContainer>
  );
}
