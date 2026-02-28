import { getAllConcepts, getConceptBySlug } from '@/lib/content';
import ReactMarkdown from 'react-markdown';
import { ConceptLoader } from '@/components/concepts/ConceptLoader';

export async function generateStaticParams() {
  const concepts = getAllConcepts();
  return concepts.map((concept) => ({
    slug: concept.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getConceptBySlug(slug);

  return {
    title: content.metadata.title,
    description: content.metadata.description,
  };
}

export default async function ConceptDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getConceptBySlug(slug);

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8 mx-auto max-w-7xl">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-medium">
            Interactive Concept
          </span>
          <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
            {new Date(content.metadata.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">
          {content.metadata.title}
        </h1>

        {content.metadata.description && (
          <p className="text-lg text-gray-600 dark:text-[#cccccc] mb-6">
            {content.metadata.description}
          </p>
        )}

        {content.metadata.categories && content.metadata.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {content.metadata.categories.map((category) => (
              <span
                key={category}
                className="text-sm px-3 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc]"
              >
                {category}
              </span>
            ))}
          </div>
        )}

        {content.content.trim() && (
          <article className="prose dark:prose-invert max-w-none mb-8">
            <ReactMarkdown>{content.content}</ReactMarkdown>
          </article>
        )}

        <ConceptLoader componentName={content.component} />
      </div>
    </main>
  );
}
