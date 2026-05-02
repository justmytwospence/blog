import { getAllConcepts } from '@/lib/content';
import { ConceptCard } from '@/components/ConceptCard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Concepts',
  description: 'Interactive visualizations exploring ideas in statistics, probability, and data science.',
};

export default function ConceptsPage() {
  const concepts = getAllConcepts();

  return (
    <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-2 sm:py-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">
          Concepts
        </h1>
        <p className="text-lg text-gray-600 dark:text-[#cccccc]">
          Interactive visualizations exploring ideas in statistics, probability, and data science.
        </p>
      </div>

      {concepts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {concepts.map((concept) => (
            <ConceptCard key={concept.slug} concept={concept} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-[#a6a6a6]">
            No concepts available yet. Check back soon!
          </p>
        </div>
      )}
    </main>
  );
}
