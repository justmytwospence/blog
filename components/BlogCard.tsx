import Link from 'next/link';
import { BlogPost } from '@/lib/types';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block p-6 bg-white dark:bg-[#252526] rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-[#303031]"
    >
      {/* Date and reading time */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {post.readingTime && (
          <>
            <span className="text-gray-400 dark:text-[#6b6b6b]">•</span>
            <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
              {post.readingTime} min read
            </span>
          </>
        )}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-[#d4d4d4] hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        {post.title}
      </h3>

      {/* Excerpt/Description */}
      {post.description && (
        <p className="text-gray-600 dark:text-[#cccccc] mb-4 line-clamp-3">
          {post.description}
        </p>
      )}

      {/* Categories */}
      {post.categories && post.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.categories.map((category) => (
            <span
              key={category}
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc]"
            >
              {category}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
