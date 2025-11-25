import Link from 'next/link';
import { Project } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  // Map project type to display badge
  const getTypeBadge = (type: string) => {
    const badges = {
      markdown: 'Article',
      notebook: 'Notebook',
      webapp: 'App',
      link: 'Link',
    };
    return badges[type as keyof typeof badges] || type;
  };

  // Determine the link href - use external URL if present, otherwise internal
  const href = project.externalUrl || `/projects/${project.slug}`;
  const isExternal = !!project.externalUrl;

  return (
    <Link
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="block p-6 bg-white dark:bg-[#252526] rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-[#303031]"
    >
      {/* Type badge and date */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
          {getTypeBadge(project.type)}
        </span>
        <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
          {new Date(project.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-[#d4d4d4] hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        {project.title}
        {isExternal && (
          <svg className="inline-block ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        )}
      </h3>

      {/* Description */}
      {project.description && (
        <p className="text-gray-600 dark:text-[#cccccc] mb-4 line-clamp-3">
          {project.description}
        </p>
      )}

      {/* Technology categories */}
      {project.categories && project.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.categories.map((category) => (
            <span
              key={category}
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#454545] transition-colors"
            >
              {category}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
