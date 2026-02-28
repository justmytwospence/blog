import Link from 'next/link';
import { Concept } from '@/lib/types';

interface ConceptCardProps {
  concept: Concept;
}

export function ConceptCard({ concept }: ConceptCardProps) {
  return (
    <Link
      href={`/concepts/${concept.slug}`}
      className="block p-6 bg-white dark:bg-[#252526] rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-[#303031]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-medium">
          Interactive
        </span>
        <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
          {new Date(concept.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>

      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-[#d4d4d4] hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        {concept.title}
      </h3>

      {concept.description && (
        <p className="text-gray-600 dark:text-[#cccccc] mb-4 line-clamp-3">
          {concept.description}
        </p>
      )}

      {concept.categories && concept.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {concept.categories.map((category) => (
            <span
              key={category}
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#454545] transition-colors"
            >
              {category}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
