import type { CSSProperties } from 'react';
import { AppWindow, Blocks, Boxes, Cable, ChartSpline, Library, Puzzle, Server, Wrench, type LucideIcon } from 'lucide-react';
import type { Project } from '@/lib/types';

/** Accent and icon per project kind, so a generated banner says what the project is at a glance. */
const KIND_STYLE: Record<string, { accent: string; Icon: LucideIcon }> = {
  app: { accent: '#34d399', Icon: AppWindow },
  library: { accent: '#a78bfa', Icon: Library },
  'mcp-server': { accent: '#38bdf8', Icon: Cable },
  plugin: { accent: '#fbbf24', Icon: Puzzle },
  'plugin-suite': { accent: '#fbbf24', Icon: Blocks },
  tool: { accent: '#fb7185', Icon: Wrench },
  infrastructure: { accent: '#2dd4bf', Icon: Server },
  model: { accent: '#818cf8', Icon: ChartSpline },
};
const FALLBACK = { accent: '#94a3b8', Icon: Boxes };

/** Small deterministic hash so each banner gets its own glow position. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Where the project lives, as a repo path or host: `justmytwospence/` + `strava-mcp`. */
function sourceLabel(project: Project): { prefix: string; name: string } {
  const url = project.externalUrl ?? project.links?.[0]?.url;
  if (url) {
    try {
      const { hostname, pathname } = new URL(url);
      const parts = pathname.split('/').filter(Boolean);
      if (hostname === 'github.com' && parts.length >= 2) {
        return { prefix: `${parts[0]}/`, name: parts.at(-1)! };
      }
      return { prefix: '', name: hostname.replace(/^www\./, '') };
    } catch {
      // Fall through to the slug.
    }
  }
  return { prefix: '~/', name: project.slug };
}

/**
 * Stand-in for a project image: a dark title-card band in the same 1200x630 frame as a
 * screenshot, so cards with and without images line up in the grid.
 */
export function ProjectBanner({ project }: { project: Project }) {
  const { accent, Icon } = KIND_STYLE[project.kind ?? ''] ?? FALLBACK;
  const h = hash(project.slug);
  const glowX = 55 + (h % 40);
  const glowY = (h >> 8) % 100;
  const style: CSSProperties = {
    backgroundColor: '#111827',
    backgroundImage: [
      `radial-gradient(circle at ${glowX}% ${glowY}%, ${accent}33, transparent 55%)`,
      'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
      'linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
    ].join(', '),
    backgroundSize: '100% 100%, 32px 32px, 32px 32px',
  };
  const source = sourceLabel(project);

  return (
    <div aria-hidden="true" style={style} className="flex h-full w-full flex-col justify-between p-5">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}26`, color: accent }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="truncate font-mono text-xs text-slate-400">
        {source.prefix && <span className="text-slate-500">{source.prefix}</span>}
        <span style={{ color: accent }}>{source.name}</span>
      </p>
    </div>
  );
}
