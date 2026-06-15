import { getAllBlogPosts, getBlogPostBySlug, calculateReadingTime } from '@/lib/content';
import { ArticleMarkdown } from '@/components/ArticleMarkdown';
import { PageContainer } from '@/components/PageContainer';
import { BlueskyComments } from '@/components/BlueskyComments';
import { NotebookRenderer } from '@/components/notebook/NotebookRenderer';
import { NotebookErrorBoundary } from '@/components/notebook/errors/NotebookErrorBoundary';
import { extractMetadata } from '@blog/notebook-parser';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/format';

// Rendered on demand (mirrors /projects/[slug]) so the large K-Core notebook
// isn't prerendered at build time, which blows up the Vercel build/cache.
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// Generate metadata for each blog post
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  return {
    title: post.metadata.title,
    description: post.metadata.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.metadata.title,
      description: post.metadata.description,
      url: `/blog/${slug}`,
      type: 'article',
      publishedTime: post.metadata.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  // Notebook blog post — render the executed notebook (the frontmatter cell is stripped).
  if (post.type === 'notebook') {
    const notebookData = { ...post.notebookData };
    if (
      notebookData.cells &&
      notebookData.cells.length > 0 &&
      (notebookData.cells[0].cell_type === 'raw' || notebookData.cells[0].cell_type === 'markdown')
    ) {
      const firstCellSource = Array.isArray(notebookData.cells[0].source)
        ? notebookData.cells[0].source.join('')
        : notebookData.cells[0].source;
      if (firstCellSource.trim().startsWith('---')) {
        notebookData.cells = notebookData.cells.slice(1);
      }
    }
    const notebookMetadata = extractMetadata(notebookData, post.metadata.slug);
    return (
      <PageContainer width="wide">
        <NotebookErrorBoundary notebookTitle={post.metadata.title}>
          <NotebookRenderer notebook={notebookData} metadata={notebookMetadata} />
        </NotebookErrorBoundary>
      </PageContainer>
    );
  }

  const readingTime = calculateReadingTime(post.content);

  return (
    <PageContainer width="prose">
      <article className="prose dark:prose-invert max-w-none">
        <ArticleMarkdown
          content={post.content}
          beforeTitle={
            <div className="flex items-center gap-2 mb-3 not-prose text-sm text-gray-500 dark:text-gray-400">
              <span>{formatDate(post.metadata.date)}</span>
              <span className="text-gray-400 dark:text-gray-500">•</span>
              <span>{readingTime} min read</span>
            </div>
          }
          afterTitle={
            post.metadata.categories && post.metadata.categories.length > 0 ? (
              <div className="flex flex-wrap gap-2 not-prose mb-8">
                {post.metadata.categories.map((category) => (
                  <Link
                    key={category}
                    href={`/blog/tags/${category}`}
                    className="text-sm px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            ) : undefined
          }
        />
      </article>
      {post.metadata.bluesky && <BlueskyComments postRef={post.metadata.bluesky} />}
    </PageContainer>
  );
}
