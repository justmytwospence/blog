import { getAllProjects, getProjectBySlug } from '@/lib/content';
import { ProjectDetail, projectDetailWidth } from '@/components/ProjectDetail';
import { PageContainer } from '@/components/PageContainer';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Generate static params for all projects
export async function generateStaticParams() {
  const projects = getAllProjects();
  return projects.map((project) => ({
    slug: project.slug,
  }));
}

// Generate metadata for each project
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getProjectBySlug(slug);
  if (!content) notFound();

  return {
    title: content.metadata.title,
    description: content.metadata.description,
    alternates: { canonical: `/projects/${slug}` },
    openGraph: {
      title: content.metadata.title,
      description: content.metadata.description,
      url: `/projects/${slug}`,
      type: 'article',
      publishedTime: content.metadata.date,
      ...(content.metadata.image
        ? { images: [{ url: content.metadata.image, width: 1200, height: 630, alt: content.metadata.imageAlt }] }
        : {}),
    },
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getProjectBySlug(slug);
  if (!content) notFound();

  const parent = content.metadata.parent
    ? getProjectBySlug(content.metadata.parent)?.metadata
    : undefined;

  return (
    <PageContainer width={projectDetailWidth(content)}>
      <ProjectDetail content={content} parent={parent} />
    </PageContainer>
  );
}
