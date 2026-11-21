import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDate } from '@/lib/format';

interface PostHeaderProps {
  date: string;
  /** Minutes; omit where a reading time makes no sense (projects). */
  readingTime?: number;
  title: ReactNode;
  description?: string;
  tags?: string[];
  /** Link each tag to its /blog/tags page; plain text otherwise. */
  linkTags?: boolean;
  className?: string;
}

/** Article header shared by notebook and markdown posts. Styles live in globals.css (`.post-*`). */
export function PostHeader({
  date,
  readingTime,
  title,
  description,
  tags = [],
  linkTags = false,
  className,
}: PostHeaderProps) {
  return (
    <header className={`post-header ${className ?? ''}`}>
      <div className="post-meta">
        <time dateTime={date}>{formatDate(date)}</time>
        {readingTime !== undefined && <span> · {readingTime} min read</span>}
      </div>
      <h1 className="post-title">{title}</h1>
      {description && <p className="post-dek">{description}</p>}
      {tags.length > 0 && (
        <nav aria-label="Topics" className="post-topics">
          {tags.map((tag) =>
            linkTags ? (
              <Link key={tag} href={`/blog/tags/${encodeURIComponent(tag)}`} className="post-topic">
                {tag}
              </Link>
            ) : (
              <span key={tag} className="post-topic">
                {tag}
              </span>
            ),
          )}
        </nav>
      )}
    </header>
  );
}
