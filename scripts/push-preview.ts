import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function validatePreviewPush(branch: string, remoteUrl: string): { branch: string; refspec: string } {
  if (branch.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch) || ['main', 'master'].includes(branch)) throw new Error('Invalid preview branch');
  if (!['git@github.com:justmytwospence/blog.git', 'https://github.com/justmytwospence/blog.git'].includes(remoteUrl)) throw new Error('Invalid origin push URL');
  return { branch, refspec: `HEAD:refs/heads/${branch}` };
}

type Git = (args: string[]) => { status: number | null; stdout: string; stderr: string; error?: Error };
class PushError extends Error {
  constructor(readonly status: number | null) { super(`git push failed (status ${status ?? 'unknown'})`); }
}
export function runPreviewPush(args: string[], git: Git): void {
  if (args.length) throw new Error('preview:push accepts no arguments');
  function read(args: string[]): string {
    const result = git(args);
    if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
    return result.stdout.trim();
  }
  const branch = read(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const urls = read(['remote', 'get-url', '--push', '--all', 'origin']).split('\n');
  if (urls.length !== 1) throw new Error('Origin must have exactly one push URL');
  const target = validatePreviewPush(branch, urls[0]);
  if (read(['status', '--porcelain', '--untracked-files=no'])) throw new Error('Tracked working tree must be clean');
  console.log(`Pushing ${branch} to origin ${target.refspec}`);
  const result = git(['-c', 'remote.origin.mirror=false', '-c', 'push.followTags=false', '-c', 'push.recurseSubmodules=no', 'push', '--no-follow-tags', 'origin', target.refspec]);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new PushError(result.status);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runPreviewPush(process.argv.slice(2), (args) => spawnSync('git', args, { encoding: 'utf8' }));
  } catch (error) { console.error(error instanceof Error ? error.message : 'Preview push failed'); process.exitCode = error instanceof PushError ? error.status || 1 : 1; }
}
