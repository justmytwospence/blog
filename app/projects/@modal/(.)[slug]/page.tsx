import { notFound } from 'next/navigation';
import { ProjectDetail, projectDetailWidth } from '@/components/ProjectDetail';
import { ProjectModal } from '@/components/ProjectModal';
import { getProjectBySlug } from '@/lib/content';

// Same rendering mode as the full page (app/projects/[slug]/page.tsx).
export const dynamic = 'force-dynamic';

export default async function ProjectModalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = getProjectBySlug(slug);
  if (!content) notFound();
  const parent = content.metadata.parent ? getProjectBySlug(content.metadata.parent)?.metadata : undefined;
  return (
    <ProjectModal key={slug} title={content.metadata.title} wide={projectDetailWidth(content) !== 'prose'}>
      <ProjectDetail content={content} parent={parent} />
    </ProjectModal>
  );
}
