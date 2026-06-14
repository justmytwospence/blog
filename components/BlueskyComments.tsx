'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Heart, Repeat2, MessageCircle, Quote, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getPostThread,
  resolveToAtUri,
  postWebUrl,
  richTextToSegments,
  segmentHref,
  sortReplies,
  countReplies,
  isThreadViewPost,
  isPinPost,
  type ThreadNode,
  type BlueskyPostView,
  type BlueskyImagesEmbed,
  type SortMode,
} from '@/lib/bluesky';

// Loaded browser-only: the composer pulls in @atproto/oauth-client-browser,
// which touches window/indexedDB/crypto and must never run during SSR.
const BlueskyComposer = dynamic(() => import('@/components/BlueskyComposer'), {
  ssr: false,
});

/** How many reply levels to render before deferring to Bluesky for the rest. */
const MAX_DEPTH = 6;

/** Official Bluesky butterfly mark (viewBox 0 0 600 530). */
function BlueskyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 530" className={className} fill="currentColor" aria-hidden="true">
      <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" />
    </svg>
  );
}

/** Compact relative time ("3d", "5h", "now"); full date past ~30 days. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function compact(n: number | undefined): string {
  if (!n) return '';
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
}

function Avatar({ author }: { author: BlueskyPostView['author'] }) {
  const initial = (author.displayName || author.handle || '?').charAt(0).toUpperCase();
  if (author.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatar}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        className="h-9 w-9 shrink-0 rounded-full bg-gray-100 dark:bg-[#3a3d41] object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-[#3a3d41] text-sm font-semibold text-gray-600 dark:text-[#cccccc]">
      {initial}
    </span>
  );
}

/** Render post text with link/mention/hashtag facets resolved to anchors. */
function RichText({ post }: { post: BlueskyPostView }) {
  const segments = useMemo(
    () => richTextToSegments(post.record.text, post.record.facets),
    [post.record.text, post.record.facets],
  );
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-800 dark:text-[#d4d4d4]">
      {segments.map((seg, i) =>
        seg.link ? (
          <a
            key={i}
            href={segmentHref(seg.link)}
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            {seg.text}
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}

function CommentImages({ embed }: { embed: BlueskyImagesEmbed }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {embed.images.slice(0, 4).map((img, i) => (
        <a key={i} href={img.fullsize} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.thumb}
            alt={img.alt}
            loading="lazy"
            className="max-h-44 rounded-lg border border-gray-200 dark:border-[#303031] object-cover"
          />
        </a>
      ))}
    </div>
  );
}

function isImagesEmbed(embed: BlueskyPostView['embed']): embed is BlueskyImagesEmbed {
  return !!embed && (embed as { $type?: string }).$type === 'app.bsky.embed.images#view';
}

function StatPill({ icon, count }: { icon: React.ReactNode; count: number | undefined }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-[#a6a6a6]">
      {icon}
      {compact(count)}
    </span>
  );
}

/** A single comment node and its (recursively rendered) replies. */
function CommentNode({ node, depth, sort }: { node: ThreadNode; depth: number; sort: SortMode }) {
  const [collapsed, setCollapsed] = useState(false);

  if (node.$type === 'app.bsky.feed.defs#notFoundPost') {
    return <p className="py-2 text-sm italic text-gray-400 dark:text-[#6e6e6e]">[deleted comment]</p>;
  }
  if (node.$type === 'app.bsky.feed.defs#blockedPost') {
    return <p className="py-2 text-sm italic text-gray-400 dark:text-[#6e6e6e]">[blocked comment]</p>;
  }

  const { post } = node;
  const url = postWebUrl(post.author, post.uri);
  const childReplies = (node.replies ?? []).filter((r) => !isPinPost(r));
  const sortedChildren = sortReplies(childReplies, sort);
  const childCount = countReplies(childReplies);
  const atMaxDepth = depth >= MAX_DEPTH;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-90">
          <Avatar author={post.author} />
        </a>
        {/* Thread line connecting to nested replies */}
        {childCount > 0 && !collapsed && !atMaxDepth && (
          <div className="mt-1 w-px grow bg-gray-200 dark:bg-[#303031]" />
        )}
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:underline dark:text-[#d4d4d4]"
          >
            {post.author.displayName || `@${post.author.handle}`}
          </a>
          <a
            href={`https://bsky.app/profile/${post.author.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:underline dark:text-[#a6a6a6]"
          >
            @{post.author.handle}
          </a>
          <span className="text-gray-400 dark:text-[#6e6e6e]">·</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={new Date(post.indexedAt).toLocaleString()}
            className="text-gray-500 hover:underline dark:text-[#a6a6a6]"
          >
            {timeAgo(post.indexedAt)}
          </a>
        </div>

        <div className="mt-1">
          <RichText post={post} />
          {isImagesEmbed(post.embed) && <CommentImages embed={post.embed} />}
        </div>

        <div className="mt-2 flex items-center gap-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-blue-600 dark:text-[#a6a6a6] dark:hover:text-blue-400"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Reply
          </a>
          <StatPill icon={<Heart className="h-3.5 w-3.5" />} count={post.likeCount} />
          <StatPill icon={<Repeat2 className="h-3.5 w-3.5" />} count={post.repostCount} />
          {childCount > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex items-center gap-0.5 text-xs text-gray-500 transition-colors hover:text-gray-800 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {collapsed
                ? `Show ${childCount} ${childCount === 1 ? 'reply' : 'replies'}`
                : 'Hide'}
            </button>
          )}
        </div>

        {/* Nested replies */}
        {childCount > 0 && !collapsed && (
          <div className="mt-3">
            {atMaxDepth ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Continue this thread on Bluesky →
              </a>
            ) : (
              <div className="space-y-0">
                {sortedChildren.map((child, i) => (
                  <CommentNode
                    key={isThreadViewPost(child) ? child.post.uri : `x-${i}`}
                    node={child}
                    depth={depth + 1}
                    sort={sort}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gray-200 dark:bg-[#3a3d41]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-gray-200 dark:bg-[#3a3d41]" />
            <div className="h-3 w-full rounded bg-gray-200 dark:bg-[#3a3d41]" />
            <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-[#3a3d41]" />
          </div>
        </div>
      ))}
    </div>
  );
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unavailable' }
  | { status: 'ready'; root: BlueskyPostView; replies: ThreadNode[]; webUrl: string };

export function BlueskyComments({ postRef }: { postRef: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [sort, setSort] = useState<SortMode>('top');

  const load = useCallback(
    async (signal?: AbortSignal, opts?: { keepOnError?: boolean }) => {
      try {
        const atUri = await resolveToAtUri(postRef, signal);
        const { thread } = await getPostThread(atUri, { depth: 10, signal });
        if (signal?.aborted) return;
        if (!isThreadViewPost(thread)) {
          if (!opts?.keepOnError) setState({ status: 'unavailable' });
          return;
        }
        setState({
          status: 'ready',
          root: thread.post,
          replies: (thread.replies ?? []).filter((r) => !isPinPost(r)),
          webUrl: postWebUrl(thread.post.author, thread.post.uri),
        });
      } catch {
        if (signal?.aborted || opts?.keepOnError) return;
        setState({ status: 'error' });
      }
    },
    [postRef],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      await load(ctrl.signal);
    })();
    return () => ctrl.abort();
  }, [load]);

  // Refetch without flashing the skeleton or wiping comments on a transient error.
  const refresh = useCallback(() => {
    void load(undefined, { keepOnError: true });
  }, [load]);

  const total = state.status === 'ready' ? countReplies(state.replies) : 0;
  const sortedTop = useMemo(
    () => (state.status === 'ready' ? sortReplies(state.replies, sort) : []),
    [state, sort],
  );

  return (
    <section className="mt-16 border-t border-gray-200 pt-10 dark:border-[#303031]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-[#d4d4d4]">
          <BlueskyLogo className="h-5 w-5 text-[#1185fe]" />
          Comments
          {state.status === 'ready' && total > 0 && (
            <span className="text-base font-normal text-gray-500 dark:text-[#a6a6a6]">{total}</span>
          )}
        </h2>

        {state.status === 'ready' && total > 1 && (
          <div className="inline-flex rounded-full bg-gray-100 p-0.5 text-xs dark:bg-[#3a3d41]">
            {(['top', 'newest'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSort(mode)}
                className={`rounded-full px-3 py-1 capitalize transition-colors ${
                  sort === mode
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-[#1e1e1e] dark:text-[#d4d4d4]'
                    : 'text-gray-500 hover:text-gray-800 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Engagement summary + primary CTA */}
      {state.status === 'ready' && (
        <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-[#303031] dark:bg-[#252526]">
          <span className="text-sm text-gray-600 dark:text-[#cccccc]">Join the conversation</span>
          <span className="flex items-center gap-4">
            <StatPill icon={<Heart className="h-3.5 w-3.5" />} count={state.root.likeCount} />
            <StatPill icon={<Repeat2 className="h-3.5 w-3.5" />} count={state.root.repostCount} />
            <StatPill icon={<Quote className="h-3.5 w-3.5" />} count={state.root.quoteCount} />
          </span>
          <a
            href={state.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#1185fe] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0a6fd6]"
          >
            <BlueskyLogo className="h-4 w-4" />
            Reply on Bluesky
          </a>
        </div>
      )}

      {/* In-page composer: sign in with Bluesky and reply without leaving */}
      {state.status === 'ready' && (
        <BlueskyComposer
          rootUri={state.root.uri}
          rootCid={state.root.cid}
          onPosted={refresh}
        />
      )}

      {state.status === 'loading' && <Skeleton />}

      {state.status === 'error' && (
        <p className="text-sm text-gray-500 dark:text-[#a6a6a6]">
          Couldn&apos;t load comments right now.
        </p>
      )}

      {state.status === 'unavailable' && (
        <p className="text-sm text-gray-500 dark:text-[#a6a6a6]">
          Comments are unavailable — the linked Bluesky post may have been removed.
        </p>
      )}

      {state.status === 'ready' && total === 0 && (
        <p className="text-sm text-gray-500 dark:text-[#a6a6a6]">
          No comments yet.{' '}
          <a
            href={state.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Be the first to reply on Bluesky.
          </a>
        </p>
      )}

      {state.status === 'ready' && total > 0 && (
        <div className="space-y-0">
          {sortedTop.map((node, i) => (
            <CommentNode
              key={isThreadViewPost(node) ? node.post.uri : `x-${i}`}
              node={node}
              depth={1}
              sort={sort}
            />
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400 dark:text-[#6e6e6e]">
        Comments are public replies to{' '}
        <a
          href={state.status === 'ready' ? state.webUrl : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          this post on Bluesky
        </a>
        , loaded live from the AT Protocol.
      </p>
    </section>
  );
}
