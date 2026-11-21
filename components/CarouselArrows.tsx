/** Prev/next buttons for a carousel. `className` carries the visibility classes from carouselLayout(). */
export function CarouselArrows({
  onPrev,
  onNext,
  className,
}: {
  onPrev: () => void;
  onNext: () => void;
  className: string;
}) {
  const base =
    'absolute top-1/2 -translate-y-1/2 bg-white dark:bg-[#252526] text-gray-800 dark:text-[#d4d4d4] p-3 rounded-full border border-gray-200 dark:border-[#303031] hover:bg-gray-100 dark:hover:bg-[#3a3d41] transition-colors z-10 cursor-pointer';
  return (
    <>
      <button onClick={onPrev} className={`${className} ${base} left-0 -translate-x-4`} aria-label="Previous slide">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button onClick={onNext} className={`${className} ${base} right-0 translate-x-4`} aria-label="Next slide">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </>
  );
}
