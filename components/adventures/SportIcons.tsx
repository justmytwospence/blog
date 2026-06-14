import { forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

/**
 * A running figure in lucide's visual language (24×24, 2px stroke, round caps).
 * lucide ships no runner, and `Footprints` reads as walking — this is used for
 * trail/road runs so the sport icon actually looks like running.
 */
const Running = forwardRef<SVGSVGElement, LucideProps>(function Running(
  { size = 24, color = 'currentColor', strokeWidth = 2, className, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="17" cy="4" r="2" />
      <path d="M15.5 6.8 11.6 9.2l2.6 2.8-1.1 4.8" />
      <path d="m14.2 12 3.4 1.1 1.3 4.4" />
      <path d="M11.6 9.2 7.7 8" />
      <path d="m13.1 16.8-2.7 4.1" />
      <path d="M8.9 9.7 6.4 13l3.3 1.6" />
    </svg>
  );
}) as unknown as LucideIcon;

export { Running };
