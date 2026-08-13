import { getFeaturedContent } from '@/lib/content';
import { getFeaturedAdventures } from '@/lib/adventures';
import Link from 'next/link';
import { ProjectCarousel } from '@/components/ProjectCarousel';
import { BlogCarousel } from '@/components/BlogCarousel';
import { ConceptCarousel } from '@/components/ConceptCarousel';
import { AdventureCard } from '@/components/adventures/AdventureCard';
import { PageContainer } from '@/components/PageContainer';

export default function Home() {
  const { projects, posts, concepts } = getFeaturedContent();
  const adventures = getFeaturedAdventures();

  return (
    <PageContainer width="wide">
      <h1 className="sr-only">Data Spencer — Spencer Boucher&rsquo;s data science portfolio and blog</h1>

      {/*
        Every section below is conditional, so the gap between them belongs to the stack rather than
        to each section: `space-y` inserts a gap only where two sections actually meet, and there is
        nothing to remember when a new one is added. Per-section `mb` is what failed here — Concepts
        and Adventures were both added without one, closing up the gap above "Featured Adventures".
      */}
      <div className="space-y-6 sm:space-y-12">
        {/* Featured Projects Section */}
        {projects.length > 0 && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-[#d4d4d4]">
                Featured Projects
              </h2>
              <Link
                href="/projects"
                className="w-full sm:w-auto text-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                View All Projects
              </Link>
            </div>
            <ProjectCarousel projects={projects} />
          </section>
        )}

        {/* Recent Blog Posts Section */}
        {posts.length > 0 && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-[#d4d4d4]">
                Recent Blog Posts
              </h2>
              <Link
                href="/blog"
                className="w-full sm:w-auto text-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                View All Posts
              </Link>
            </div>
            <BlogCarousel posts={posts} />
          </section>
        )}

        {/* Interactive Concepts Section */}
        {concepts.length > 0 && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-[#d4d4d4]">
                Interactive Concepts
              </h2>
              <Link
                href="/concepts"
                className="w-full sm:w-auto text-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                View All Concepts
              </Link>
            </div>
            <ConceptCarousel concepts={concepts} />
          </section>
        )}

        {/* Featured Adventures Section — last */}
        {adventures.length > 0 && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-[#d4d4d4]">Featured Adventures</h2>
              <Link
                href="/adventures"
                className="w-full sm:w-auto text-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                View All Adventures
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {adventures.map((a) => (
                <AdventureCard key={a.slug} adventure={a} />
              ))}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
