import { Link } from '@/i18n/navigation';
import type { ReactNode } from 'react';
import { ArrowRightIcon } from '../icons';

type Variant = 'solid-indigo' | 'solid-gold' | 'outline' | 'outline-dark';
type Size = 'md' | 'lg';

/**
 * Maps the public variant names to the `.mkt-btn--*` foundation
 * classes defined once in `globals.css`. No per-button colour, font,
 * or size declarations live here - the foundation owns all of it.
 */
const VARIANT_CLASS: Record<Variant, string> = {
  'solid-indigo': 'mkt-btn--primary',
  'solid-gold': 'mkt-btn--gold',
  outline: 'mkt-btn--ghost',
  'outline-dark': 'mkt-btn--ghost-dark',
};

/**
 * Bespoke marketing CTA - pure CSS, no AntD. Renders an internal
 * `next/link` or an external `<a>` automatically.
 */
export function MarketingButton({
  href,
  children,
  variant = 'solid-indigo',
  size = 'md',
  arrow = false,
  block = false,
  className = '',
  ariaLabel,
  onClick,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  block?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Optional fire-and-forget side effect on press (e.g. an analytics event).
   *  The button still navigates via href; this just runs alongside the click. */
  onClick?: () => void;
}) {
  const cls = [
    'mkt-btn',
    VARIANT_CLASS[variant],
    size === 'lg' ? 'mkt-btn--lg' : '',
    block ? 'mkt-btn--block' : '',
    arrow ? 'mkt-arrow-host' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const inner = (
    <>
      {children}
      {arrow ? <ArrowRightIcon className="mkt-arrow h-[1.05em] w-[1.05em]" /> : null}
    </>
  );
  if (href.startsWith('http')) {
    return (
      <a
        href={href}
        className={cls}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={ariaLabel} onClick={onClick}>
      {inner}
    </Link>
  );
}
