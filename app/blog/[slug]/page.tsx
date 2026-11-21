import { getAllBlogPosts, getBlogPostBySlug, calculateReadingTime } from '@/lib/content';
import { ArticleMarkdown } from '@/components/ArticleMarkdown';
import { ConceptLoader } from '@/components/concepts/ConceptLoader';
import { PostHeader } from '@/components/PostHeader';
import { PageContainer } from '@/components/PageContainer';
import { BlueskyComments } from '@/components/BlueskyComments';
import { MarimoPost } from '@/components/marimo/MarimoPost';
import { notFound } from 'next/navigation';

// Keep notebook routes on demand; large compiled articles stay outside the build cache.
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

  if (post.type === 'marimo') {
    return (
      <PageContainer width="wide">
        <MarimoPost document={post.document} metadata={post.metadata} />
        {post.metadata.bluesky && <BlueskyComments postRef={post.metadata.bluesky} />}
      </PageContainer>
    );
  }

  const readingTime = calculateReadingTime(post.content);

  // A post may embed a registered interactive component (frontmatter `component`). Prose is split on
  // a `<!--viz-->` sentinel so it can bracket the component; posts without one render unchanged.
  const [proseBefore, proseAfter] = post.metadata.component
    ? post.content.split(/<!--\s*viz\s*-->/i)
    : [post.content, undefined];

  return (
    <PageContainer width="prose">
      <article className="prose dark:prose-invert max-w-none">
        <ArticleMarkdown
          content={proseBefore}
          components={{
            h1: ({ children }) => (
              <PostHeader
                className="not-prose"
                date={post.metadata.date}
                readingTime={readingTime}
                title={children}
                description={post.metadata.description}
                tags={post.metadata.categories ?? []}
                linkTags
              />
            ),
          }}
        />
      </article>

      {post.metadata.component && (
        <div className="my-8">
          <ConceptLoader componentName={post.metadata.component} />
        </div>
      )}

      {proseAfter && proseAfter.trim() && (
        <article className="prose dark:prose-invert max-w-none">
          <ArticleMarkdown content={proseAfter} />
        </article>
      )}

      {post.metadata.bluesky && <BlueskyComments postRef={post.metadata.bluesky} />}
    </PageContainer>
  );
}
