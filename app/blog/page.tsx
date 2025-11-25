import { getAllBlogPosts } from '@/lib/content';
import Link from 'next/link';

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-2 sm:py-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">
          Blog
        </h1>
        <p className="text-lg text-gray-600 dark:text-[#cccccc]">
          Technical articles, insights, and tutorials on data science and machine learning.
        </p>
      </div>

      {/* Blog posts timeline */}
      {posts.length > 0 ? (
        <div className="space-y-12">
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-gray-200 dark:border-[#303031] pb-12 last:border-b-0">
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-[#a6a6a6] mb-3">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>
                {post.readingTime && (
                  <>
                    <span>·</span>
                    <span>{post.readingTime} min read</span>
                  </>
                )}
              </div>
              
              <Link href={`/blog/${post.slug}`} className="group block">
                <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-[#d4d4d4] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {post.title}
                </h2>
                
                {post.description && (
                  <p className="text-gray-600 dark:text-[#cccccc] mb-4 leading-relaxed">
                    {post.description}
                  </p>
                )}
              </Link>
              
              {post.categories && post.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.categories.map((category) => (
                    <Link
                      key={category}
                      href={`/blog/tags/${category}`}
                      className="text-xs px-3 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#454545] transition-colors"
                    >
                      {category}
                    </Link>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-[#a6a6a6]">
            No blog posts available yet. Check back soon!
          </p>
        </div>
      )}
    </main>
  );
}
