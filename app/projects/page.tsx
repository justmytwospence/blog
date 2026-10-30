import { getTopLevelProjects } from '@/lib/content';
import { ProjectsExplorer } from '@/components/ProjectsExplorer';
import { PageContainer } from '@/components/PageContainer';
import { getActivity, getProjectHistory, projectSparklines } from '@/lib/github-activity';
import type { Metadata } from 'next';

// Revalidate hourly so the live GitHub activity stays fresh between deploys.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Things I have built across software and data: tools, apps, models, and experiments.',
};

export default async function ProjectsPage() {
  const activity = await getActivity();
  const projects = getTopLevelProjects(activity.updated);
  const sparklines = projectSparklines(activity, await getProjectHistory());
  // Per-day commit counts only feed the sparklines; keep them out of the client payload.
  const { commits: _commits, ...calendar } = activity;

  return (
    <PageContainer width="wide">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">
          Projects
        </h1>
        <p className="text-lg text-gray-600 dark:text-[#cccccc]">
          Things I&apos;ve built across software and data: tools, apps, models, and experiments,
          some polished and some still in progress.
        </p>
      </div>

      {/* Activity calendar + project cards (linked on hover) */}
      {projects.length > 0 ? (
        <ProjectsExplorer projects={projects} activity={calendar} sparklines={sparklines} />
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
