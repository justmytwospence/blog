'use client';

import { useMemo, useState } from 'react';
import { ProjectCard } from '@/components/ProjectCard';
import { ContributionCalendar, type ActivityData } from '@/components/ContributionCalendar';
import type { Project } from '@/lib/types';

/**
 * Links the activity calendar and the project cards with shared hover state:
 * hovering a calendar day highlights the projects worked on that day, and
 * hovering a project card highlights that project's activity in the calendar.
 */
export function ProjectsExplorer({ projects, activity }: { projects: Project[]; activity: ActivityData }) {
  const [focusSlugs, setFocusSlugs] = useState<string[] | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  // Slugs that actually appear in the calendar — used so hovering a project
  // with no tracked commits (e.g. the notebook) doesn't blank out the calendar.
  const activitySlugs = useMemo(() => {
    const set = new Set<string>();
    for (const day of Object.values(activity.days)) {
      for (const slug of day.r) set.add(slug);
    }
    return set;
  }, [activity]);

  const clear = () => {
    setHoverDay(null);
    setFocusSlugs(null);
  };

  const handleDayEnter = (repos: string[], dayKey: string) => {
    setHoverDay(dayKey);
    setFocusSlugs(repos.length > 0 ? repos : null);
  };

  const handleCardEnter = (slug: string) => {
    setHoverDay(null);
    setFocusSlugs(activitySlugs.has(slug) ? [slug] : null);
  };

  return (
    <>
      <ContributionCalendar
        data={activity}
        focusSlugs={focusSlugs}
        hoverDay={hoverDay}
        onDayEnter={handleDayEnter}
        onLeave={clear}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const dimmed = focusSlugs !== null && !focusSlugs.includes(project.slug);
          return (
            <div
              key={project.slug}
              onMouseEnter={() => handleCardEnter(project.slug)}
              onMouseLeave={clear}
              className={`h-full transition-opacity duration-150 ${dimmed ? 'opacity-40' : 'opacity-100'}`}
            >
              <ProjectCard project={project} />
            </div>
          );
        })}
      </div>
    </>
  );
}
