import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { ObjectiveDetail } from '@/components/adventures/objectives/ObjectiveDetail';
import { getObjectiveDetail, getObjectiveRefs } from '@/lib/adventures';
import { pageConfig } from '@/lib/objective-schema';

export const dynamicParams = false;

export async function generateStaticParams() {
  return getObjectiveRefs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string; slug: string }>;
}): Promise<Metadata> {
  const { page, slug } = await params;
  const detail = getObjectiveDetail(page, slug);
  const cfg = pageConfig(page);
  if (!detail || !cfg) return {};
  return { title: detail.item.title, description: detail.item.description ?? cfg.blurb };
}

export default async function ObjectiveDetailPage({ params }: { params: Promise<{ page: string; slug: string }> }) {
  const { page, slug } = await params;
  const cfg = pageConfig(page);
  const detail = cfg ? getObjectiveDetail(page, slug) : null;
  if (!cfg || !detail) notFound();

  return (
    <PageContainer width="wide">
      <ObjectiveDetail item={detail.item} cfg={cfg} route={detail.route} report={detail.report} />
    </PageContainer>
  );
}
