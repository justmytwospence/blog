import { getAllProjects, getTopLevelProjects } from '../content';
import { PROJECT_KIND_IDS } from '../project-kinds';

describe('project kinds', () => {
  it('only uses registered kinds', () => {
    for (const project of getAllProjects()) {
      if (project.kind) expect(PROJECT_KIND_IDS.has(project.kind), `${project.slug}: unknown kind "${project.kind}"`).toBe(true);
    }
  });
});

describe('top-level project kinds', () => {
  it.skip('gives every top-level project a kind', () => {
    for (const project of getTopLevelProjects()) {
      expect(project.kind, project.slug).toBeTruthy();
    }
  });
});
