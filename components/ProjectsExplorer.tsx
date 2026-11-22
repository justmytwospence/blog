'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ProjectCard } from '@/components/ProjectCard';
import { ChipCount, ChipRow, chipClass } from '@/components/FilterChips';
import { ContributionCalendar, dayHeadline, type ActivityData } from '@/components/ContributionCalendar';
import { byFeaturedOrder } from '@/lib/project-navigation';
import { PROJECT_TOPICS, PROJECT_TOPIC_IDS } from '@/lib/project-topics';
import type { Project } from '@/lib/types';
import type { ProjectSparkline } from '@/lib/github-activity';

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
  /** Project slug -> recent activity; projects without commits are absent. */
  sparklines?: Record<string, ProjectSparkline>;
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
  const featuredShown = shown.filter((p) => p.featured).sort(byFeaturedOrder);
  const restShown = shown.filter((p) => !p.featured);
  const sectionLabel = 'mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]';
  const renderCard = (project: Project, variant: 'default' | 'featured') => {
    const dimmed = !activeDay && focusSlugs !== null && !focusSlugs.includes(project.slug);
    return (
      <div
        key={project.slug}
        onMouseEnter={() => handleCardEnter(project.slug)}
        onMouseLeave={clear}
        className={`h-full transition-opacity duration-150 ${dimmed ? 'opacity-40' : 'opacity-100'}`}
      >
        <ProjectCard project={project} activity={sparklines[project.slug]} variant={variant} />
      </div>
    );
  };
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

  return (
    <>
      {/* Chips and calendar stay pinned under the site nav while the cards scroll. */}
      <div className="mb-6 bg-paper pt-2 transition-colors duration-200 md:sticky md:top-[65px] md:z-40 md:pb-3 dark:bg-[#1e1e1e]">
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-gray-200 bg-white px-4 py-2 dark:border-[#303031] dark:bg-[#252526] md:static md:z-auto md:mb-4 md:border-0 md:bg-transparent md:p-0 md:dark:bg-transparent">
      <ChipRow label="Filter projects by topic">
        <button
          type="button"
          data-topic-filter
          aria-pressed={topic === null}
          onClick={() => writeTopic(null)}
          className={chipClass(topic === null)}
        >
          All<ChipCount>{projects.length}</ChipCount>
        </button>
        {PROJECT_TOPICS.filter((t) => topicCounts.has(t.id)).map((t) => (
          <button
            key={t.id}
            type="button"
            data-topic-filter
            aria-pressed={topic === t.id}
            onClick={() => writeTopic(topic === t.id ? null : t.id)}
            className={chipClass(topic === t.id, cardTopics.has(t.id))}
          >
            {t.label}<ChipCount>{topicCounts.get(t.id)}</ChipCount>
          </button>
        ))}
      </ChipRow>
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

      <div ref={gridRef} className="pb-14 md:pb-0" style={lockedHeight !== null ? { minHeight: lockedHeight } : undefined}>
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
        {featuredShown.length > 0 && (
          <section aria-label="Featured projects" className="mb-8 md:mb-10">
            <h2 className={sectionLabel}>Featured</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {featuredShown.map((project) => renderCard(project, 'featured'))}
            </div>
          </section>
        )}
        {restShown.length > 0 && (
          <section aria-label="More projects">
            {featuredShown.length > 0 && <h2 className={sectionLabel}>More projects</h2>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {restShown.map((project) => renderCard(project, 'default'))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
