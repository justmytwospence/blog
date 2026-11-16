import Link from 'next/link';
import { MarimoArticle } from 'marimo-blog/react';
import type { MarimoDocument } from 'marimo-blog';
import type { ContentMetadata } from '@/lib/types';
import { calculateReadingTime } from '@/lib/content';
import { formatDate } from '@/lib/format';

interface MarimoPostProps {
  document: MarimoDocument;
  metadata: ContentMetadata;
  category?: 'blog' | 'project';
}

/** Site presentation only; marimo-blog owns all notebook output rendering. */
export function MarimoPost({ document, metadata, category = 'blog' }: MarimoPostProps) {
  const categories = metadata.categories ?? [];
  const readingTime = calculateReadingTime(document.plainText);

  return (
    <MarimoArticle
      document={document}
      className="blog-marimo"
      code="folded"
      presentation={{ contents: 'auto' }}
      header={
        <header className="blog-marimo-header">
          <div className="blog-marimo-meta">
            <time dateTime={metadata.date}>{formatDate(metadata.date)}</time>
            {category === 'blog' && <span> · {readingTime} min read</span>}
          </div>
          <h1 className="blog-marimo-title">{metadata.title}</h1>
          {metadata.description && <p className="blog-marimo-dek">{metadata.description}</p>}
          {categories.length > 0 && (
            <nav aria-label="Topics" className="blog-marimo-topics">
              {categories.map((tag) => category === 'blog' ? (
                <Link key={tag} href={`/blog/tags/${encodeURIComponent(tag)}`} className="blog-marimo-topic">
                  {tag}
                </Link>
              ) : <span key={tag} className="blog-marimo-topic">{tag}</span>)}
            </nav>
          )}
        </header>
      }
    />
  );
}
