import type { Project } from './types';

/** Collections and projects with a written story open their detail view; the rest link out. */
export function projectCardDestination(project: Project): { href: string; external: boolean } {
  const external = project.links?.[0]?.url ?? project.externalUrl;
  if (project.collection || project.hasBody || !external) {
    return { href: `/projects/${project.slug}`, external: false };
  }
  return { href: external, external: true };
}

/** Featured order: explicit `featuredOrder` first, the rest after in their existing order. */
export function byFeaturedOrder(a: Project, b: Project): number {
  return (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER);
}
