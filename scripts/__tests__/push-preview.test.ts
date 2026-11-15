import { describe, expect, it, vi } from 'vitest';
import { runPreviewPush, validatePreviewPush } from '../push-preview';
const remote = 'git@github.com:justmytwospence/blog.git';
describe('preview push', () => {
  it('accepts dev and bare slugs only on the exact remote', () => {
    expect(validatePreviewPush('dev', remote).refspec).toBe('HEAD:refs/heads/dev');
    expect(validatePreviewPush('feature-2', 'https://github.com/justmytwospence/blog.git').branch).toBe('feature-2');
    for (const branch of ['main', 'master', 'HEAD', '', 'foo/bar', 'a'.repeat(64), '-a', 'a--b']) expect(() => validatePreviewPush(branch, remote)).toThrow();
    expect(() => validatePreviewPush('dev', `${remote}\n${remote}`)).toThrow();
  });
  it('checks tracked state and uses exact argument arrays', () => {
    const git = vi.fn((args: string[]) => ({ status: 0, stderr: '', stdout: args[0] === 'symbolic-ref' ? 'dev\n' : args[0] === 'remote' ? `${remote}\n` : '' }));
    runPreviewPush([], git);
    expect(git.mock.calls.map(([a]) => a)).toEqual([['symbolic-ref', '--quiet', '--short', 'HEAD'], ['remote', 'get-url', '--push', '--all', 'origin'], ['status', '--porcelain', '--untracked-files=no'], ['-c', 'remote.origin.mirror=false', '-c', 'push.followTags=false', '-c', 'push.recurseSubmodules=no', 'push', '--no-follow-tags', 'origin', 'HEAD:refs/heads/dev']]);
    expect(() => runPreviewPush(['--force'], git)).toThrow();
  });
  it('blocks dirt, multiple URLs, detached HEAD and push failures', () => {
    for (const mode of ['dirty', 'multiple', 'detached', 'push']) {
      const git = vi.fn((args: string[]) => ({ status: (mode === 'detached' && args[0] === 'symbolic-ref') || (mode === 'push' && args.includes('push')) ? 1 : 0, stderr: '', stdout: args[0] === 'symbolic-ref' ? 'dev' : args[0] === 'remote' ? (mode === 'multiple' ? `${remote}\n${remote}` : remote) : args[0] === 'status' && mode === 'dirty' ? ' M file' : '' }));
      expect(() => runPreviewPush([], git)).toThrow();
      if (mode !== 'push') expect(git.mock.calls.some(([a]) => a.includes('push'))).toBe(false);
    }
  });
});
