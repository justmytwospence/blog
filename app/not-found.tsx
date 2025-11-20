import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        {/* 404 Icon */}
        <div className="mb-8">
          <svg
            className="w-24 h-24 mx-auto text-gray-400 dark:text-[#6b6b6b]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-bold text-gray-900 dark:text-[#d4d4d4] mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-[#cccccc] mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 dark:text-[#a6a6a6] mb-8">
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>

        {/* Navigation Links */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            Go Home
          </Link>
          <Link
            href="/projects"
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-gray-900 dark:text-neutral-100 font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            View Projects
          </Link>
          <Link
            href="/blog"
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-gray-900 dark:text-neutral-100 font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            Read Blog
          </Link>
        </div>

        {/* Additional Help */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-[#303031]">
          <p className="text-sm text-gray-500 dark:text-[#a6a6a6]">
            Looking for something specific? Try navigating from the{' '}
            <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
              home page
            </Link>{' '}
            or check out the{' '}
            <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">
              contact page
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
