import React from 'react';
import { getAllBlogPosts, getBlogPostBySlug, calculateReadingTime } from '@/lib/content';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkCallout from '@r4ai/remark-callout';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { CodeBlock } from '@/components/CodeBlock';
import { MermaidBlock } from '@/components/MermaidBlock';
import { PageContainer } from '@/components/PageContainer';
import { BlueskyComments } from '@/components/BlueskyComments';
import Link from 'next/link';
import 'katex/dist/katex.min.css';

// Extract YouTube video ID from a URL (youtube.com/watch?v=, youtu.be/, youtube.com/embed/)
function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

// Helper to extract text content recursively from React children
function getTextContent(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (!children) return '';
  if (Array.isArray(children)) {
    return children.map(getTextContent).join('');
  }
  if (React.isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode };
    return getTextContent(props.children);
  }
  return '';
}

// Helper to extract code and language from ReactMarkdown pre children
function extractCodeInfo(children: React.ReactNode): { code: string; language: string } | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (child && typeof child === 'object' && 'props' in child) {
    const codeElement = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const className = codeElement.props.className || '';
    // Extract language from class like "language-dockerfile" or "language-python"
    const langMatch = className.match(/language-(\S+)/);
    const language = langMatch ? langMatch[1] : 'plaintext';
    const code = getTextContent(codeElement.props.children);
    return { code, language };
  }
  return null;
}

// Generate static params for all blog posts
export const dynamicParams = false;

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
  
  return {
    title: post.metadata.title,
    description: post.metadata.description,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  const readingTime = calculateReadingTime(post.content);

  return (
    <PageContainer width="prose">
      <article className="prose dark:prose-invert max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkMath, remarkGfm, remarkCallout]}
          rehypePlugins={[rehypeKatex, rehypeRaw]}
          components={{
            h1: ({ node, children, ...props }) => (
              <>
                <div className="flex items-center gap-2 mb-3 not-prose text-sm text-gray-500 dark:text-gray-400">
                  <span>
                    {new Date(post.metadata.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span>{readingTime} min read</span>
                </div>
                <h1 {...props}>{children}</h1>
                {post.metadata.categories && post.metadata.categories.length > 0 && (
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
                )}
              </>
            ),
            pre: ({ node, children, ...props }) => {
              const codeInfo = extractCodeInfo(children);
              if (codeInfo) {
                if (codeInfo.language === 'mermaid') {
                  return <MermaidBlock code={codeInfo.code} />;
                }
                return (
                  <CodeBlock
                    code={codeInfo.code}
                    language={codeInfo.language}
                    showLineNumbers={true}
                    className="my-6"
                  />
                );
              }
              // Fallback for non-code pre blocks
              return <pre {...props}>{children}</pre>;
            },
            a: ({ node, href, children, ...props }) => {
              const videoId = href ? getYouTubeId(href) : null;
              if (videoId) {
                return (
                  <span className="not-prose block my-6">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={getTextContent(children) || 'YouTube video'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full aspect-video rounded-lg"
                    />
                  </span>
                );
              }
              return <a href={href} {...props}>{children}</a>;
            },
          }}
        >
          {post.content}
        </ReactMarkdown>
      </article>
      {post.metadata.bluesky && <BlueskyComments postRef={post.metadata.bluesky} />}
    </PageContainer>
  );
}
