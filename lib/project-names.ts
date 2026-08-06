/**
 * Display names for project slugs, used where only a slug is available
 * (e.g. the contribution-calendar tooltips). Keep in sync with the slugs in
 * REPO_TO_SLUG in lib/github-activity.ts.
 */
const projectNames: Record<string, string> = {
  bayesdag: 'bayesDAG',
  cloudposterior: 'cloudposterior',
  'arviz-mcp': 'ArviZ MCP',
  'strava-mcp': 'Strava MCP',
  'ynab-mcp': 'YNAB MCP',
  'hardcover-mcp': 'Hardcover MCP',
  'inoreader-mcp': 'Inoreader MCP',
  'inoreader-obsidian': 'Inoreader for Obsidian',
  pacing: 'Pacing',
  swimcue: 'SwimCue',
  homelab: 'Homelab',
  vertfarmer: 'VertFarm',
  'ifs-journal': 'IFS Journal',
  groundcover: 'GroundCover',
  '29ers': '29ers',
};

export default projectNames;
