import { getAllProjects } from '@/lib/content';
import { ProjectsExplorer } from '@/components/ProjectsExplorer';
import { PageContainer } from '@/components/PageContainer';
import { getActivity } from '@/lib/github-activity';
import type { Metadata } from 'next';

// Revalidate hourly so the live GitHub activity stays fresh between deploys.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Data science projects, analyses, and interactive applications.',
};

export default async function ProjectsPage() {
  const projects = getAllProjects();
  const activity = await getActivity();

  return (
    <PageContainer width="wide">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">
          Projects
        </h1>
        <p className="text-lg text-gray-600 dark:text-[#cccccc]">
          Explore my data science projects, analyses, and interactive applications.
        </p>
      </div>

      {/* Activity calendar + project cards (linked on hover) */}
      {projects.length > 0 ? (
        <ProjectsExplorer projects={projects} activity={activity} />
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-[#a6a6a6]">
            No projects available yet. Check back soon!
          </p>
        </div>
      )}
    </PageContainer>
  );
}
