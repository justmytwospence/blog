import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { languages } from '@/lib/highlight';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { languages }]]}
        components={{
          img: ({ node, ...props }) => (
            <img
              {...props}
              className="rounded-lg shadow-md"
              loading="lazy"
              alt={props.alt || ''}
            />
          ),
          a: ({ node, ...props }) => (
            <a
              {...props}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target={props.href?.startsWith('http') ? '_blank' : undefined}
              rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
