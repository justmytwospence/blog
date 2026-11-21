import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { ArticleMarkdown } from '@/components/ArticleMarkdown';
import { MarimoPost } from '@/components/marimo/MarimoPost';
import { projectKindLabel } from '@/lib/project-kinds';
import type { Content, ContentMetadata } from '@/lib/types';

/** Page width for a project's detail view; the modal widens for the same types. */
export function projectDetailWidth(content: Content): 'prose' | 'wide' | 'app' {
  if (content.type === 'marimo') return 'wide';
  if (content.type === 'webapp') return 'app';
  return 'prose';
}

const primaryButton =
  'inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700';
const secondaryButton =
  'inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 dark:border-[#454545] dark:text-[#d4d4d4] dark:hover:bg-[#3a3d41]';

/** A project's story: shared by the full page and the modal over /projects. */
export function ProjectDetail({ content, parent }: { content: Content; parent?: ContentMetadata }): ReactNode {
  const { metadata } = content;

  const parentLink = parent && (
    <nav aria-label="Project collection" className="not-prose mb-6 text-sm">
      <Link href={`/projects/${parent.slug}`} className="text-blue-600 dark:text-blue-400 hover:underline">
        Part of {parent.title}
      </Link>
    </nav>
  );

  const hero = metadata.image && (
    <div className="not-prose relative mb-6 aspect-[1200/630] w-full overflow-hidden rounded-lg border border-gray-200 dark:border-[#303031]">
      <Image
        src={metadata.image}
        alt={metadata.imageAlt ?? ''}
        fill
        priority
        sizes="(min-width: 768px) 720px, 100vw"
        className="object-cover"
      />
    </div>
  );

  const label = (
    <p className="not-prose mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]">
      {projectKindLabel(metadata.kind) ?? (metadata.collection ? 'Project collection' : 'Project')}
    </p>
  );

  const description = metadata.description && (
    <p className="lead font-serif text-lg text-gray-600 dark:text-[#cccccc] not-prose mb-4">{metadata.description}</p>
  );

  const destinations = metadata.links?.length
    ? metadata.links
    : metadata.externalUrl
      ? [{ label: 'Visit project', url: metadata.externalUrl }]
      : [];
  const actions = (destinations.length > 0 || metadata.sourcePrivate) && (
    <nav aria-label="Project resources" className="not-prose my-6 flex flex-wrap items-center gap-3">
      {destinations.map((link, i) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={i === 0 ? primaryButton : secondaryButton}
        >
          {link.label}
        </a>
      ))}
      {metadata.sourcePrivate && (
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#a6a6a6]">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Source private
        </span>
      )}
    </nav>
  );

  const categories = metadata.categories && metadata.categories.length > 0 && (
    <div className="flex flex-wrap gap-2 not-prose mb-8">
      {metadata.categories.map((category) => (
        <span
          key={category}
          className="text-sm px-3 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc]"
        >
          {category}
        </span>
      ))}
    </div>
  );

  if (content.type === 'link') {
    return (
      <>
        {parentLink}
        {hero}
        {label}
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">{metadata.title}</h1>
        {description}
        {actions}
        {categories}
        {content.content?.trim() && (
          <article className="prose dark:prose-invert max-w-none mt-8">
            <ArticleMarkdown content={content.content} />
          </article>
        )}
      </>
    );
  }

  if (content.type === 'markdown') {
    return (
      <>
        {parentLink}
        <article className="prose dark:prose-invert max-w-none">
          <ArticleMarkdown
            content={content.content}
            beforeTitle={<>{hero}{label}</>}
            afterTitle={<>{description}{actions}{categories}</>}
          />
        </article>
      </>
    );
  }

  if (content.type === 'marimo') {
    return (
      <>
        {parentLink}
        <MarimoPost document={content.document} metadata={metadata} category="project" />
        {actions}
      </>
    );
  }

  if (content.type === 'webapp') {
    return (
      <>
        {parentLink}
        <div className="bg-paper dark:bg-[#1e1e1e] rounded-lg p-6">
          <iframe
            src={content.url}
            style={{ height: content.height || '800px' }}
            className="w-full border border-gray-200 dark:border-[#303031] rounded"
            sandbox="allow-scripts allow-same-origin"
            title={metadata.title}
          />
        </div>
      </>
    );
  }

  return null;
}
