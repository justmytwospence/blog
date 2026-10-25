'use client';

import { useMemo, useRef, useState } from 'react';
import { ProjectCard } from '@/components/ProjectCard';
import { ContributionCalendar, dayHeadline, type ActivityData } from '@/components/ContributionCalendar';
import type { Project } from '@/lib/types';

type HoveredDay = { key: string; count: number; repos: string[] };

/**
 * Links the activity calendar and the project cards with shared hover state:
 * hovering a calendar day shows only the projects worked on that day (the rest
 * are hidden, so the matches are in view wherever they sit in the list), and
 * hovering a project card highlights that project's activity in the calendar.
 */
export function ProjectsExplorer({ projects, activity }: { projects: Project[]; activity: ActivityData }) {
  const [focusSlugs, setFocusSlugs] = useState<string[] | null>(null);
  const [hoverDay, setHoverDay] = useState<HoveredDay | null>(null);
  // While a day is hovered the grid keeps its full height, so hiding cards never shortens the page
  // (which would scroll the calendar out from under the pointer).
  const gridRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

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
    setLockedHeight(null);
  };

  const handleDayEnter = (repos: string[], key: string, count: number) => {
    if (lockedHeight === null && gridRef.current) setLockedHeight(gridRef.current.offsetHeight);
    setHoverDay({ key, count, repos });
    setFocusSlugs(repos.length > 0 ? repos : null);
  };

  const handleCardEnter = (slug: string) => {
    setHoverDay(null);
    setFocusSlugs(activitySlugs.has(slug) ? [slug] : null);
  };

  // A hovered day filters the cards; a hovered card only dims the calendar.
  const visibleSlugs = hoverDay ? new Set(hoverDay.repos) : null;
  const shown = visibleSlugs ? projects.filter((project) => visibleSlugs.has(project.slug)) : projects;

  return (
    <>
      <ContributionCalendar
        data={activity}
        focusSlugs={focusSlugs}
        hoverDay={hoverDay?.key ?? null}
        onDayEnter={handleDayEnter}
        onLeave={clear}
      />

      <div ref={gridRef} style={lockedHeight !== null ? { minHeight: lockedHeight } : undefined}>
        {hoverDay && shown.length === 0 && (
          <p role="status" className="py-12 text-center text-sm text-gray-500 dark:text-[#a6a6a6]">
            {dayHeadline(hoverDay.count, new Date(`${hoverDay.key}T00:00:00Z`))}
            {hoverDay.count > 0 ? ', all in private or unlisted repositories.' : '.'}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((project) => {
            const dimmed = !hoverDay && focusSlugs !== null && !focusSlugs.includes(project.slug);
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
      </div>
    </>
  );
}
