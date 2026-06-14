'use client';

import { useEffect, useRef, useState } from 'react';
import { Agent, RichText } from '@atproto/api';
import { getBlueskyClient, initBluesky } from '@/lib/blueskyClient';

const MAX_GRAPHEMES = 300;

/** The OAuth session type, derived without importing the un-exported symbol. */
type AtSession = NonNullable<
  Awaited<ReturnType<typeof initBluesky>>['result']
>['session'];

/** Count user-perceived characters (graphemes), matching Bluesky's post limit. */
function graphemeLength(s: string): number {
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let n = 0;
    for (const _ of seg.segment(s)) n++;
    return n;
  } catch {
    return Array.from(s).length;
  }
}

function BlueskyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 530" className={className} fill="currentColor" aria-hidden="true">
      <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" />
    </svg>
  );
}

interface Profile {
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface BlueskyComposerProps {
  /** The anchor post that comments reply to: its strong ref (uri + cid). */
  rootUri: string;
  rootCid: string;
  /** Called after a successful post so the thread can refetch. */
  onPosted: () => void;
}

type Phase = 'init' | 'signed-out' | 'ready' | 'posting' | 'posted';

export default function BlueskyComposer({ rootUri, rootCid, onPosted }: BlueskyComposerProps) {
  const [phase, setPhase] = useState<Phase>('init');
  const [handle, setHandle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const agentRef = useRef<Agent | null>(null);
  const sessionRef = useRef<AtSession | null>(null);

  async function activate(session: AtSession) {
    const agent = new Agent(session);
    agentRef.current = agent;
    sessionRef.current = session;
    setPhase('ready');
    try {
      const res = await agent.getProfile({ actor: session.did });
      setProfile({
        handle: res.data.handle,
        displayName: res.data.displayName,
        avatar: res.data.avatar,
      });
    } catch {
      /* profile is cosmetic; ignore failures */
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { result } = await initBluesky();
        if (!alive) return;
        if (result?.session) {
          await activate(result.session);
        } else {
          setPhase('signed-out');
        }
      } catch {
        if (alive) setPhase('signed-out');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleSignIn() {
    setError(null);
    const h = handle.trim().replace(/^@/, '');
    if (!h) {
      setError('Enter your Bluesky handle.');
      return;
    }
    try {
      const client = await getBlueskyClient();
      // Full-page redirect to Bluesky; returns to /bluesky/callback, which sends
      // the visitor back to this path. Never resolves on success.
      await client.signInRedirect(h, {
        state: window.location.pathname + window.location.search,
      });
    } catch {
      setError('Could not start sign-in — check your handle and try again.');
    }
  }

  async function handleSignOut() {
    try {
      await sessionRef.current?.signOut();
    } catch {
      /* ignore */
    }
    agentRef.current = null;
    sessionRef.current = null;
    setProfile(null);
    setPhase('signed-out');
  }

  async function handleSubmit() {
    const agent = agentRef.current;
    const trimmed = text.trim();
    if (!agent || !trimmed) return;
    if (graphemeLength(trimmed) > MAX_GRAPHEMES) {
      setError(`Comments are limited to ${MAX_GRAPHEMES} characters.`);
      return;
    }
    setError(null);
    setPhase('posting');
    try {
      const rt = new RichText({ text: trimmed });
      await rt.detectFacets(agent); // resolve @mentions/links to facets
      const ref = { uri: rootUri, cid: rootCid };
      await agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: { root: ref, parent: ref },
        createdAt: new Date().toISOString(),
      });
      setText('');
      setPhase('posted');
      // The AppView indexes the reply a beat later; refetch then.
      setTimeout(() => {
        onPosted();
        setPhase('ready');
      }, 2500);
    } catch {
      setError('Could not post your comment. Please try again.');
      setPhase('ready');
    }
  }

  const count = graphemeLength(text);
  const over = count > MAX_GRAPHEMES;
  const busy = phase === 'posting';

  const wrap =
    'mb-8 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#303031] dark:bg-[#252526]';

  if (phase === 'init') {
    return (
      <div className={`${wrap} text-sm text-gray-500 dark:text-[#a6a6a6]`}>Connecting…</div>
    );
  }

  if (phase === 'signed-out') {
    return (
      <div className={wrap}>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-[#d4d4d4]">
          <BlueskyLogo className="h-4 w-4 text-[#1185fe]" />
          Comment with your Bluesky account
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
            placeholder="you.bsky.social"
            autoComplete="username"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#1185fe] dark:border-[#3a3d41] dark:bg-[#1e1e1e] dark:text-[#d4d4d4]"
          />
          <button
            type="button"
            onClick={handleSignIn}
            className="rounded-lg bg-[#1185fe] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a6fd6]"
          >
            Sign in
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-[#a6a6a6]">
          You&apos;ll be redirected to Bluesky to authorize, then brought right back. Your comment
          posts as a reply from your account.
        </p>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className={wrap}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#cccccc]">
          {profile?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <BlueskyLogo className="h-4 w-4 text-[#1185fe]" />
          )}
          <span>
            Commenting as{' '}
            <span className="font-semibold text-gray-900 dark:text-[#d4d4d4]">
              @{profile?.handle ?? 'you'}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-xs text-gray-500 transition-colors hover:text-gray-800 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
        >
          Sign out
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment…"
        rows={3}
        disabled={busy}
        className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#1185fe] disabled:opacity-60 dark:border-[#3a3d41] dark:bg-[#1e1e1e] dark:text-[#d4d4d4]"
      />

      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${over ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-[#6e6e6e]'}`}>
          {count}/{MAX_GRAPHEMES}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || !text.trim() || over}
          className="inline-flex items-center gap-2 rounded-full bg-[#1185fe] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0a6fd6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <BlueskyLogo className="h-4 w-4" />
          {busy ? 'Posting…' : 'Post comment'}
        </button>
      </div>

      {phase === 'posted' && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400">
          Comment posted. Refreshing…
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
