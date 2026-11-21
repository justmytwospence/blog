/** What a project is, shown as a small label on cards and detail pages. Top-level cards must set one. */
export const PROJECT_KINDS = [
  { id: 'app', label: 'App' },
  { id: 'library', label: 'Library' },
  { id: 'mcp-server', label: 'MCP server' },
  { id: 'plugin', label: 'Plugin' },
  { id: 'plugin-suite', label: 'Plugin suite' },
  { id: 'tool', label: 'Tool' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'model', label: 'Model' },
] as const;

export type ProjectKind = (typeof PROJECT_KINDS)[number]['id'];

export const PROJECT_KIND_IDS: ReadonlySet<string> = new Set(PROJECT_KINDS.map((kind) => kind.id));

export function projectKindLabel(id: string | undefined): string | undefined {
  return PROJECT_KINDS.find((kind) => kind.id === id)?.label;
}
