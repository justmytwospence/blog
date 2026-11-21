import type { Metadata } from 'next';
import { getFeaturedContent } from '@/lib/content';
import { getFeaturedAdventures } from '@/lib/adventures';
import Link from 'next/link';
import { ProjectCarousel } from '@/components/ProjectCarousel';
import { BlogCarousel } from '@/components/BlogCarousel';
import { AdventureCard } from '@/components/adventures/AdventureCard';
import { PageContainer } from '@/components/PageContainer';

function SectionHeader({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-[#d4d4d4]">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-blue-600 dark:text-[#a6a6a6] dark:hover:text-blue-400"
      >
        {label}
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Home() {
  const { projects, posts } = getFeaturedContent();
  const adventures = getFeaturedAdventures();

  return (
    <PageContainer width="wide">
      <h1 className="sr-only">Data Spencer — Spencer Boucher&rsquo;s data science portfolio and blog</h1>

      {/*
        Every section below is conditional, so the gap between them belongs to the stack rather than
        to each section: `space-y` inserts a gap only where two sections actually meet, and there is
        nothing to remember when a new one is added. Per-section `mb` is what failed here — a section
        added without one closed up the gap above "Featured Adventures".
      */}
      <div className="space-y-6 sm:space-y-12">
        {/* Featured Projects Section */}
        {projects.length > 0 && (
          <section>
            <SectionHeader title="Featured Projects" href="/projects" label="View all projects" />
            <ProjectCarousel projects={projects} />
          </section>
        )}

        {/* Recent Blog Posts Section */}
        {posts.length > 0 && (
          <section>
            <SectionHeader title="Recent Blog Posts" href="/blog" label="View all posts" />
            <BlogCarousel posts={posts} />
          </section>
        )}

        {/* Featured Adventures Section — last */}
        {adventures.length > 0 && (
          <section>
            <SectionHeader title="Featured Adventures" href="/adventures" label="View all adventures" />
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
