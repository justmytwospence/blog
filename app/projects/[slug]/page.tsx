import { getAllProjects, getProjectBySlug } from '@/lib/content';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { NotebookRenderer } from '@/components/notebook/NotebookRenderer';
import { NotebookErrorBoundary } from '@/components/notebook/errors/NotebookErrorBoundary';
import { extractMetadata } from '@/lib/notebook/index';

// Generate static params for all projects
export async function generateStaticParams() {
  const projects = getAllProjects();
  return projects.map((project) => ({
    slug: project.slug,
  }));
}

// Generate metadata for each project
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getProjectBySlug(slug);
  
  return {
    title: content.metadata.title,
    description: content.metadata.description,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getProjectBySlug(slug);

  // Check if this is an external project (link type)
  if (content.type === 'link' || content.metadata.externalUrl) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-8 mx-auto max-w-7xl">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
              External Project
            </span>
            <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
              {new Date(content.metadata.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
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
          
          {/* External link card */}
          <div className="bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
            <svg 
              className="w-16 h-16 mx-auto mb-4 text-blue-600 dark:text-blue-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
              />
            </svg>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              This project is hosted externally. Click the button below to visit the application.
            </p>
            <a
              href={content.metadata.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Visit Project
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M14 5l7 7m0 0l-7 7m7-7H3" 
                />
              </svg>
            </a>
          </div>

          {/* Render markdown content if available */}
          {(content.type === 'markdown' || content.type === 'link') && content.content && (
            <article className="prose dark:prose-invert max-w-none mt-12">
              <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                {content.content}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8 mx-auto max-w-7xl">
      <div>
          {/* Project content with integrated metadata */}
          <div>
            {content.type === 'markdown' && (
              <article className="prose dark:prose-invert max-w-none">
                <ReactMarkdown 
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    h1: ({ node, children, ...props }) => (
                      <>
                        <div className="flex items-center gap-2 mb-3 not-prose">
                          <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
                            Article
                          </span>
                          <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
                            {new Date(content.metadata.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <h1 {...props}>{children}</h1>
                        {content.metadata.description && (
                          <p className="lead text-lg text-gray-600 dark:text-[#cccccc] not-prose mb-4">
                            {content.metadata.description}
                          </p>
                        )}
                        {content.metadata.categories && content.metadata.categories.length > 0 && (
                          <div className="flex flex-wrap gap-2 not-prose mb-8">
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
                      </>
                    ),
                  }}
                >
                  {content.content}
                </ReactMarkdown>
              </article>
            )}

            {content.type === 'notebook' && (() => {
              // Filter out the frontmatter cell
              const notebookData = { ...content.notebookData };
              if (
                notebookData.cells &&
                notebookData.cells.length > 0 &&
                (notebookData.cells[0].cell_type === 'raw' || notebookData.cells[0].cell_type === 'markdown')
              ) {
                const firstCellSource = Array.isArray(notebookData.cells[0].source)
                  ? notebookData.cells[0].source.join('')
                  : notebookData.cells[0].source;
                
                if (firstCellSource.trim().startsWith('---')) {
                  notebookData.cells = notebookData.cells.slice(1);
                }
              }
              
              const notebookMetadata = extractMetadata(notebookData, content.metadata.slug);
              
              return (
                <NotebookErrorBoundary notebookTitle={content.metadata.title}>
                  <NotebookRenderer 
                    notebook={notebookData} 
                    metadata={notebookMetadata}
                  />
                </NotebookErrorBoundary>
              );
            })()}

            {content.type === 'webapp' && (
              <div className="bg-white dark:bg-[#1e1e1e] rounded-lg p-6">
                <iframe
                  src={content.url}
                  style={{ height: content.height || '800px' }}
                  className="w-full border border-gray-200 dark:border-[#303031] rounded"
                  sandbox="allow-scripts allow-same-origin"
                  title={content.metadata.title}
                />
              </div>
            )}
          </div>
      </div>
    </main>
  );
}
