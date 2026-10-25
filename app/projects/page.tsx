import { getTopLevelProjects } from '@/lib/content';
import { ProjectsExplorer } from '@/components/ProjectsExplorer';
import { PageContainer } from '@/components/PageContainer';
import { getActivity } from '@/lib/github-activity';
import type { Metadata } from 'next';

// Revalidate hourly so the live GitHub activity stays fresh between deploys.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Bayesian modeling tools, web apps, MCP servers, coding-agent plugins, and the self-hosted homelab that runs them.',
};

export default async function ProjectsPage() {
  const activity = await getActivity();
  const projects = getTopLevelProjects(activity.updated);

  return (
    <PageContainer width="wide">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">
          Projects
        </h1>
        <p className="text-lg text-gray-600 dark:text-[#cccccc]">
          Bayesian modeling tools and data analyses, interactive web apps, MCP servers that connect
          my data to LLMs, plugins for the coding agents I work with every day, and the self-hosted
          homelab that runs most of it.
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
