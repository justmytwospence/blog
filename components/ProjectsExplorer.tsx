'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ProjectCard } from '@/components/ProjectCard';
import { ContributionCalendar, dayHeadline, type ActivityData } from '@/components/ContributionCalendar';
import type { Project } from '@/lib/types';

type HoveredDay = { key: string; count: number; repos: string[] };

/**
 * Links the activity calendar and the project cards with shared hover state:
 * hovering a calendar day shows only the projects worked on that day (the rest
 * are hidden, so the matches are in view wherever they sit in the list), and
 * hovering a project card highlights that project's activity in the calendar.
 * Clicking a day pins its projects until you click anywhere else (the same day
 * again, the page, a card) or press Escape; clicking another day moves the pin.
 */
interface ProjectsExplorerProps {
  projects: Project[];
  activity: ActivityData;
  /** Project slug -> weekly commits over the calendar window; projects without commits are absent. */
  sparklines?: Record<string, number[]>;
}

export function ProjectsExplorer({ projects, activity, sparklines = {} }: ProjectsExplorerProps) {
  const [focusSlugs, setFocusSlugs] = useState<string[] | null>(null);
  const [hoverDay, setHoverDay] = useState<HoveredDay | null>(null);
  const [pinnedDay, setPinnedDay] = useState<HoveredDay | null>(null);
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

  const lockHeight = () => {
    if (lockedHeight === null && gridRef.current) setLockedHeight(gridRef.current.offsetHeight);
  };

  // Leaving the calendar or a card falls back to the pinned day, if any.
  const clear = () => {
    setHoverDay(null);
    setFocusSlugs(pinnedDay && pinnedDay.repos.length > 0 ? pinnedDay.repos : null);
    if (!pinnedDay) setLockedHeight(null);
  };

  const unpin = () => {
    setPinnedDay(null);
    setHoverDay(null);
    setFocusSlugs(null);
    setLockedHeight(null);
  };

  useEffect(() => {
    if (!pinnedDay) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') unpin();
    };
    // Any click outside a calendar day unpins; day clicks are handled by handleDayClick.
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-day]')) unpin();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [pinnedDay]);

  const handleDayEnter = (repos: string[], key: string, count: number) => {
    lockHeight();
    setHoverDay({ key, count, repos });
    setFocusSlugs(repos.length > 0 ? repos : null);
  };

  const handleDayClick = (repos: string[], key: string, count: number) => {
    if (pinnedDay?.key === key) {
      unpin();
      return;
    }
    lockHeight();
    setPinnedDay({ key, count, repos });
    setHoverDay(null);
    setFocusSlugs(repos.length > 0 ? repos : null);
  };

  const handleCardEnter = (slug: string) => {
    setHoverDay(null);
    setFocusSlugs(activitySlugs.has(slug) ? [slug] : null);
  };

  // A hovered (else pinned) day filters the cards; a hovered card only dims the calendar.
  const activeDay = hoverDay ?? pinnedDay;
  const visibleSlugs = activeDay ? new Set(activeDay.repos) : null;
  const shown = visibleSlugs ? projects.filter((project) => visibleSlugs.has(project.slug)) : projects;

  return (
    <>
      <ContributionCalendar
        data={activity}
        focusSlugs={focusSlugs}
        hoverDay={hoverDay?.key ?? null}
        onDayEnter={handleDayEnter}
        onLeave={clear}
        pinnedDay={pinnedDay?.key ?? null}
        onDayClick={handleDayClick}
      />

      {pinnedDay && (
        <div className="-mt-6 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-[#a6a6a6]">
          <span>
            Pinned: {dayHeadline(pinnedDay.count, new Date(`${pinnedDay.key}T00:00:00Z`))}
          </span>
          <button
            type="button"
            onClick={unpin}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Show all projects
          </button>
        </div>
      )}

      <div ref={gridRef} style={lockedHeight !== null ? { minHeight: lockedHeight } : undefined}>
        {activeDay && shown.length === 0 && (
          <p role="status" className="py-12 text-center text-sm text-gray-500 dark:text-[#a6a6a6]">
            {dayHeadline(activeDay.count, new Date(`${activeDay.key}T00:00:00Z`))}
            {activeDay.count > 0 ? ', all in private or unlisted repositories.' : '.'}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((project) => {
            const dimmed = !activeDay && focusSlugs !== null && !focusSlugs.includes(project.slug);
            return (
              <div
                key={project.slug}
                onMouseEnter={() => handleCardEnter(project.slug)}
                onMouseLeave={clear}
                className={`h-full transition-opacity duration-150 ${dimmed ? 'opacity-40' : 'opacity-100'}`}
              >
                <ProjectCard
                  project={project}
                  activity={sparklines[project.slug]}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
