import type { ReactNode } from 'react';

/** Standard marketing-site content width + responsive gutters. */
export function Container({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
