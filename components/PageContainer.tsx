import type { ReactNode } from 'react';

type Width = 'prose' | 'wide' | 'app';

const widthClass: Record<Width, string> = {
  prose: 'max-w-3xl',
  wide: 'max-w-6xl',
  app: '',
};

export function PageContainer({
  width = 'wide',
  children,
  className = '',
}: {
  width?: Width;
  children: ReactNode;
  className?: string;
}) {
  const classes = [
    'px-4 sm:px-6 lg:px-8 pt-4 pb-2 sm:py-8 mx-auto',
    widthClass[width],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <main className={classes}>{children}</main>;
}
