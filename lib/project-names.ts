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
  'fish-in-the-sea': 'Fish in the Sea',
  'cache-guard': 'cache-guard',
  'auto-effort': 'auto-effort',
  'marimo-for-agents': 'marimo for agents',
  'tool-gate': 'tool-gate',
  'lean-context': 'lean-context',
  'next-prompt': 'next-prompt',
  'anthropic-billing-guard': 'anthropic-billing-guard',
  'pi-plan-mode': 'pi-plan-mode',
  'pi-subagents': 'pi-subagents',
  'pi-status-footer': 'pi-status-footer',
  'pi-copy': 'pi-copy',
  'pi-ask-user-question': 'pi-ask-user-question',
  'pi-rewind': 'pi-rewind',
  'pi-brokered-auth': 'pi-brokered-auth',
  'pi-select-nav': 'pi-select-nav',
  'pi-clear-screen': 'pi-clear-screen',
  'pi-herdr-scrollbar-width': 'pi-herdr-scrollbar-width',
  'pi-appearance-resync': 'pi-appearance-resync',
  'herdr-attention-queue': 'herdr-attention-queue',
  'herdr-repeat-navigation': 'herdr-repeat-navigation',
  'tmux-agents': 'tmux-agents',
  'herdr-machine0': 'herdr-machine0',
  'paseo-machine0': 'paseo-machine0',
};

export default projectNames;
