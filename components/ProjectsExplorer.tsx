'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ProjectCard } from '@/components/ProjectCard';
import { ContributionCalendar, dayHeadline, type ActivityData } from '@/components/ContributionCalendar';
import { PROJECT_TOPICS, PROJECT_TOPIC_IDS } from '@/lib/project-topics';
import type { Project } from '@/lib/types';

type HoveredDay = { key: string; count: number; repos: string[] };

// The selected topic lives in the URL (`?topic=`), so a filtered view can be linked. The server
// snapshot is "no topic", so the server-rendered markup is the unfiltered list and hydration matches.
const TOPIC_CHANGE = 'projects-topic-change';

function subscribeTopic(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(TOPIC_CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(TOPIC_CHANGE, onChange);
  };
}

function readTopic(): string | null {
  const linked = new URLSearchParams(window.location.search).get('topic');
  return linked && PROJECT_TOPIC_IDS.has(linked) ? linked : null;
}

function writeTopic(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('topic', id);
  else url.searchParams.delete('topic');
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event(TOPIC_CHANGE));
}

/**
 * Links the activity calendar and the project cards with shared hover state:
 * hovering a calendar day shows only the projects worked on that day (the rest
 * are hidden, so the matches are in view wherever they sit in the list), and
 * hovering a project card highlights that project's activity in the calendar.
 * Clicking a day pins its projects until you click anywhere else (the same day
 * again, the page, a card) or press Escape; clicking another day moves the pin.
 *
 * Topic chips narrow both views: the cards to that topic and the calendar to days when one of its
 * projects saw work. Day and card brushing then operate within the topic.
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
  // The project card under the pointer; its topics light up in the chip row.
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const topic = useSyncExternalStore(subscribeTopic, readTopic, () => null);
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

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      for (const id of project.topics ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [projects]);

  const topicSlugs = useMemo(
    () => (topic ? new Set(projects.filter((p) => p.topics?.includes(topic)).map((p) => p.slug)) : null),
    [projects, topic],
  );

  const lockHeight = () => {
    if (lockedHeight === null && gridRef.current) setLockedHeight(gridRef.current.offsetHeight);
  };

  // Leaving the calendar or a card falls back to the pinned day, if any.
  const clear = () => {
    setHoverDay(null);
    setHoverCard(null);
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
      // Topic chips keep the pin too, so you can compare topics on the pinned day.
      if (!(event.target instanceof Element) || !event.target.closest('[data-day], [data-topic-filter]')) unpin();
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
    setHoverCard(null);
    setHoverDay({ key, count, repos });
    setFocusSlugs(repos.length > 0 ? repos : null);
  };

  const handleDayClick = (repos: string[], key: string, count: number) => {
    if (pinnedDay?.key === key) {
      unpin();
      return;
    }
    // Pinning a day with no work in the selected topic clears the topic, so its projects show.
    if (topicSlugs && !repos.some((slug) => topicSlugs.has(slug))) writeTopic(null);
    lockHeight();
    setPinnedDay({ key, count, repos });
    setHoverDay(null);
    setFocusSlugs(repos.length > 0 ? repos : null);
  };

  const handleCardEnter = (slug: string) => {
    setHoverDay(null);
    setHoverCard(slug);
    setFocusSlugs(activitySlugs.has(slug) ? [slug] : null);
  };

  // A hovered (else pinned) day filters the cards; a hovered card only dims the calendar.
  const activeDay = hoverDay ?? pinnedDay;
  const visibleSlugs = activeDay ? new Set(activeDay.repos) : null;
  const shown = projects.filter(
    (project) => (!topicSlugs || topicSlugs.has(project.slug)) && (!visibleSlugs || visibleSlugs.has(project.slug)),
  );
  // Calendar focus: a hovered day or card (restricted to the topic), else the topic as a whole.
  const topicFocus = topicSlugs ? [...topicSlugs].filter((slug) => activitySlugs.has(slug)) : null;
  const localFocus = focusSlugs && topicSlugs ? focusSlugs.filter((slug) => topicSlugs.has(slug)) : focusSlugs;
  const calendarFocus = localFocus && localFocus.length > 0 ? localFocus : topicFocus;
  const topicLabel = PROJECT_TOPICS.find((t) => t.id === topic)?.label;
  // Public projects worked on that day but hidden by the topic filter.
  const hiddenByTopic = activeDay && topicSlugs ? activeDay.repos.filter((slug) => !topicSlugs.has(slug)).length : 0;

  // Topics of the hovered card, so its chips can be brushed.
  const cardTopics = useMemo(
    () => new Set(hoverCard ? (projects.find((p) => p.slug === hoverCard)?.topics ?? []) : []),
    [projects, hoverCard],
  );

  const chip = (selected: boolean, linked = false) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${
      selected
        ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-300'
        : linked
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
        : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-100 dark:border-[#454545] dark:text-[#cccccc] dark:hover:border-[#6b6b6b] dark:hover:bg-[#3a3d41]'
    }`;

  return (
    <>
      {/* Chips and calendar stay pinned under the site nav while the cards scroll. */}
      <div className="sticky top-0 z-40 mb-6 bg-white pb-3 pt-2 transition-colors duration-200 md:top-[65px] dark:bg-[#1e1e1e]">
      <div role="group" aria-label="Filter projects by topic" className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          data-topic-filter
          aria-pressed={topic === null}
          onClick={() => writeTopic(null)}
          className={chip(topic === null)}
        >
          All <span className="opacity-60">{projects.length}</span>
        </button>
        {PROJECT_TOPICS.filter((t) => topicCounts.has(t.id)).map((t) => (
          <button
            key={t.id}
            type="button"
            data-topic-filter
            aria-pressed={topic === t.id}
            onClick={() => writeTopic(topic === t.id ? null : t.id)}
            className={chip(topic === t.id, cardTopics.has(t.id))}
          >
            {t.label} <span className="opacity-60">{topicCounts.get(t.id)}</span>
          </button>
        ))}
      </div>

      <ContributionCalendar
        data={activity}
        focusSlugs={calendarFocus}
        hoverDay={hoverDay?.key ?? null}
        onDayEnter={handleDayEnter}
        onLeave={clear}
        pinnedDay={pinnedDay?.key ?? null}
        onDayClick={handleDayClick}
      />

      {pinnedDay && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-[#a6a6a6]">
          <span>
            Pinned: {dayHeadline(pinnedDay.count, new Date(`${pinnedDay.key}T00:00:00Z`))}
          </span>
          <button
            type="button"
            onClick={unpin}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            {topicLabel ? `Show all ${topicLabel} projects` : 'Show all projects'}
          </button>
        </div>
      )}
      </div>

      <div ref={gridRef} style={lockedHeight !== null ? { minHeight: lockedHeight } : undefined}>
        {activeDay && shown.length === 0 && (
          <p role="status" className="py-12 text-center text-sm text-gray-500 dark:text-[#a6a6a6]">
            {dayHeadline(activeDay.count, new Date(`${activeDay.key}T00:00:00Z`))}
            {activeDay.count === 0
              ? '.'
              : hiddenByTopic > 0
                ? `, none in ${topicLabel}.`
                : ', all in private or unlisted repositories.'}
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
