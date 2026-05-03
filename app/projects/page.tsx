import { getAllProjects } from '@/lib/content';
import { ProjectCard } from '@/components/ProjectCard';
import { PageContainer } from '@/components/PageContainer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Data science projects, analyses, and interactive applications.',
};

export default function ProjectsPage() {
  const projects = getAllProjects();

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

      {/* Projects grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
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
