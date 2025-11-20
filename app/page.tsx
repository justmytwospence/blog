import { getFeaturedContent } from '@/lib/content';
import Link from 'next/link';
import { ProjectCarousel } from '@/components/ProjectCarousel';
import { BlogCarousel } from '@/components/BlogCarousel';

export default function Home() {
  const { projects, posts } = getFeaturedContent();

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      {/* Featured Projects Section */}
      {projects.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-[#d4d4d4]">
              Featured Projects
            </h2>
            <Link
              href="/projects"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              View All Projects
            </Link>
          </div>
          <ProjectCarousel projects={projects} />
        </section>
      )}

      {/* Featured Blog Posts Section */}
      {posts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-[#d4d4d4]">
              Recent Blog Posts
            </h2>
            <Link
              href="/blog"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              View All Posts
            </Link>
          </div>
          <BlogCarousel posts={posts} />
        </section>
      )}
    </main>
  );
}
