import { getAllProjects, getProjectBySlug, getTopLevelProjects } from '../content';
import { PROJECT_TOPICS, PROJECT_TOPIC_IDS } from '../project-topics';

describe('project topics', () => {
  it('only uses registered topic ids', () => {
    for (const project of getAllProjects()) {
      for (const id of project.topics ?? []) {
        expect(PROJECT_TOPIC_IDS.has(id), `${project.slug}: unknown topic "${id}"`).toBe(true);
      }
    }
  });

  it('gives every topic at least one top-level project', () => {
    const visible = getTopLevelProjects();
    for (const { id } of PROJECT_TOPICS) {
      expect(visible.some(project => project.topics?.includes(id)), id).toBe(true);
    }
  });

  it('allows overlapping topics and carries them onto detail metadata', () => {
    expect(getProjectBySlug('arviz-mcp')!.metadata.topics).toEqual(expect.arrayContaining(['mcp', 'bayesian']));
  });
});
