import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkCallout from '@r4ai/remark-callout';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { CodeBlock } from '@/components/CodeBlock';
import { MermaidBlock } from '@/components/MermaidBlock';
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

interface ArticleMarkdownProps {
  content: string;
  /** Rendered immediately above the markdown h1 (e.g. date/badge row). */
  beforeTitle?: React.ReactNode;
  /** Rendered immediately below the markdown h1 (e.g. description, tags). */
  afterTitle?: React.ReactNode;
  /** Page-specific component overrides, merged over the defaults. */
  components?: Components;
}

/**
 * The canonical markdown pipeline for article-style prose: GFM, math,
 * Obsidian-style callouts, raw HTML, CodeBlock/MermaidBlock dispatch,
 * and YouTube link embeds.
 */
export function ArticleMarkdown({
  content,
  beforeTitle,
  afterTitle,
  components,
}: ArticleMarkdownProps) {
  const overrides: Components = {
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
    ...(beforeTitle || afterTitle
      ? {
          h1: ({ node, children, ...props }: React.ComponentProps<'h1'> & { node?: unknown }) => (
            <>
              {beforeTitle}
              <h1 {...props}>{children}</h1>
              {afterTitle}
            </>
          ),
        }
      : {}),
    ...components,
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm, remarkCallout]}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={overrides}
    >
      {content}
    </ReactMarkdown>
  );
}
