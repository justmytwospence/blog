import { MarimoArticle } from 'marimo-blog/react';
import type { MarimoDocument } from 'marimo-blog';
import type { ContentMetadata } from '@/lib/types';
import { calculateReadingTime } from '@/lib/content';
import { PostHeader } from '@/components/PostHeader';

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
        <PostHeader
          date={metadata.date}
          readingTime={category === 'blog' ? readingTime : undefined}
          title={metadata.title}
          description={metadata.description}
          tags={categories}
          linkTags={category === 'blog'}
        />
      }
    />
  );
}
