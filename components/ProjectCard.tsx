import Link from 'next/link';
import { Project } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
}

// Map project type to display badge
function getTypeBadge(type: string): string {
  const badges = {
    markdown: 'Article',
    notebook: 'Notebook',
    webapp: 'App',
    link: 'Link',
  };
  return badges[type as keyof typeof badges] || type;
}

// Pick an icon for a link chip based on its label.
function LinkChipIcon({ label }: { label: string }) {
  const l = label.toLowerCase();
  if (l.includes('github') || l.includes('repo') || l.includes('code')) {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    );
  }
  if (l.includes('doc')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  // Default: external-link / live-site icon
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

export function ProjectCard({ project }: ProjectCardProps) {
  const links = project.links ?? [];
  // Only surface chips when there's more than one destination to disambiguate.
  const showChips = links.length > 1;

  // Whole-card (stretched) link goes to the primary destination: the first
  // listed link, else the external URL, else the internal detail page.
  const primaryHref = links[0]?.url ?? project.externalUrl ?? `/projects/${project.slug}`;
  const isExternal = Boolean(links[0]?.url ?? project.externalUrl);

  return (
    <div className="group relative flex flex-col p-6 bg-white dark:bg-[#252526] rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-[#303031]">
      {/* Type badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
          {getTypeBadge(project.type)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-[#d4d4d4] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {project.title}
        {isExternal && (
          <svg className="inline-block ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc]"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      {/* Link chips (sit above the stretched link so they're individually clickable) */}
      {showChips && (
        <div className="relative z-10 mt-4 flex flex-wrap gap-2">
          {links.map((lnk) => (
            <a
              key={lnk.url}
              href={lnk.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#454545] transition-colors"
            >
              <LinkChipIcon label={lnk.label} />
              {lnk.label}
            </a>
          ))}
        </div>
      )}

      {/* Stretched primary link — makes the whole card clickable */}
      <Link
        href={primaryHref}
        aria-label={project.title}
        className="absolute inset-0 rounded-lg"
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      />
    </div>
  );
}
