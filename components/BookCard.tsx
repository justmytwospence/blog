'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { UserBook } from '@/lib/types';

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} className="text-yellow-500 dark:text-yellow-400">
        {i <= rating ? '\u2605' : '\u2606'}
      </span>
    );
  }
  return <span className="inline-flex gap-0.5 text-sm">{stars}</span>;
}

function CoverPlaceholder({ className }: { className?: string }) {
  return (
    <div className={`${className ?? ''} bg-gray-200 dark:bg-[#3a3d41] flex items-center justify-center rounded shrink-0`}>
      <svg className="w-8 h-8 text-gray-400 dark:text-[#a6a6a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    </div>
  );
}

function BookDetailDrawer({ userBook, onClose }: { userBook: UserBook; onClose: () => void }) {
  const { book, rating } = userBook;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 bg-white dark:bg-[#252526] rounded-t-2xl sm:rounded-2xl shadow-2xl sm:max-w-lg sm:w-full max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#303031] shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-[#d4d4d4] truncate pr-4">
            {book.title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#3a3d41] transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-[#a6a6a6]" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1">
          <div className="flex gap-5">
            {book.imageUrl ? (
              <img
                src={book.imageUrl}
                alt={`Cover of ${book.title}`}
                className="w-28 h-40 object-cover rounded shrink-0"
              />
            ) : (
              <CoverPlaceholder className="w-28 h-40" />
            )}

            <div className="flex flex-col min-w-0">
              {book.authors.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-[#a6a6a6]">
                  {book.authors.join(', ')}
                </p>
              )}
              {rating !== null && (
                <div className="mt-1">
                  <StarRating rating={rating} />
                </div>
              )}
              {book.pages !== null && (
                <p className="text-xs text-gray-500 dark:text-[#a6a6a6] mt-1">
                  {book.pages} pages
                </p>
              )}
            </div>
          </div>

          {book.description && (
            <p className="text-gray-600 dark:text-[#cccccc] text-sm mt-4 leading-relaxed">
              {book.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-[#303031] shrink-0">
          <a
            href={book.hardcoverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            View on Hardcover
          </a>
        </div>
      </div>
    </>
  );
}

export function BookCard({ userBook }: { userBook: UserBook }) {
  const [isOpen, setIsOpen] = useState(false);
  const { book } = userBook;

  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex flex-col items-center text-center group cursor-pointer"
      >
        <div className="relative w-full aspect-[2/3] mb-2 rounded-lg overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-200 group-hover:scale-[1.03]">
          {book.imageUrl ? (
            <img
              src={book.imageUrl}
              alt={`Cover of ${book.title}`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <CoverPlaceholder className="w-full h-full" />
          )}
        </div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-[#d4d4d4] line-clamp-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {book.title}
        </h3>
        {book.pages !== null && (
          <p className="text-xs text-gray-500 dark:text-[#a6a6a6] mt-0.5">
            {book.pages} pp
          </p>
        )}
      </button>

      {isOpen && <BookDetailDrawer userBook={userBook} onClose={handleClose} />}
    </>
  );
}
