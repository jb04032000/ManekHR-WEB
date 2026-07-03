import { Link } from '@/i18n/navigation';
import type { ReactNode } from 'react';
import { ArrowRightIcon } from '../icons';

/**
 * Inline text CTA - gold label with an arrow that nudges forward on
 * hover. Colour and hover behaviour come from the `.mkt-link`
 * foundation class; on dark sections (`.mkt-on-dark`) it auto-flips.
 */
export function LinkCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mkt-link w-fit">
      {children}
      <ArrowRightIcon className="h-4 w-4" />
    </Link>
  );
}
