import type { Project } from './types';

/** Collections are editorial entry points; other cards keep their existing destination. */
export function projectCardDestination(project: Project): { href: string; external: boolean } {
  const external = project.links?.[0]?.url ?? project.externalUrl;
  if (project.collection || !external) {
    return { href: `/projects/${project.slug}`, external: false };
  }
  return { href: external, external: true };
}
