import { getAllBlogPosts } from '@/lib/content';
import Link from 'next/link';

// Generate static params for all tags
export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  const tags = new Set<string>();
  
  posts.forEach(post => {
    post.categories?.forEach(category => tags.add(category));
  });
  
  return Array.from(tags).map(tag => ({
    tag: tag,
  }));
}

export default async function BlogTagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const allPosts = getAllBlogPosts();
  
  // Filter posts by tag
  const postsWithTag = allPosts.filter(post => 
    post.categories?.includes(tag)
  );

  return (
    <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-2 sm:py-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-12">
        <Link 
          href="/blog"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
        >
          ← Back to all posts
        </Link>
        
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">
          Posts tagged "{tag}"
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-[#cccccc]">
          {postsWithTag.length} {postsWithTag.length === 1 ? 'post' : 'posts'} found
        </p>
      </div>

      {/* Blog posts timeline */}
      {postsWithTag.length > 0 ? (
        <div className="space-y-12">
          {postsWithTag.map((post) => (
            <article key={post.slug} className="border-b border-gray-200 dark:border-[#303031] pb-12 last:border-b-0">
              <Link href={`/blog/${post.slug}`} className="group">
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
                
                <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-[#d4d4d4] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {post.title}
                </h2>
                
                {post.description && (
                  <p className="text-gray-600 dark:text-[#cccccc] mb-4 leading-relaxed">
                    {post.description}
                  </p>
                )}
                
                {post.categories && post.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.categories.map((categoryName) => (
                      <span
                        key={categoryName}
                        className="text-xs px-3 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc]"
                      >
                        {categoryName}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-[#a6a6a6]">
            No posts found with this tag.
          </p>
        </div>
      )}
    </main>
  );
}
