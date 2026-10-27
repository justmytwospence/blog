/**
 * Topic filters on /projects, in chip order. Projects opt in with a `topics` frontmatter list of
 * these ids; topics are not exclusive, and a project may have none (it then shows only under All).
 * Distinct from `categories`, which holds the technology tags shown on each card.
 */
export const PROJECT_TOPICS = [
  { id: 'agent-tooling', label: 'Agent Tooling' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'homelab', label: 'Homelab' },
  { id: 'bayesian', label: 'Bayesian' },
  { id: 'endurance', label: 'Endurance' },
  { id: 'web-apps', label: 'Web Apps' },
  { id: 'fun', label: 'Just for Fun' },
] as const;

export type ProjectTopic = (typeof PROJECT_TOPICS)[number]['id'];

export const PROJECT_TOPIC_IDS: ReadonlySet<string> = new Set(PROJECT_TOPICS.map((topic) => topic.id));
