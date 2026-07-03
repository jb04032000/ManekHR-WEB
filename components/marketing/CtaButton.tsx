'use client';

import { Link } from '@/i18n/navigation';
import type { ReactNode } from 'react';
import { ConnectEvents, trackEvent, type MarketingPage } from '@/lib/analytics-events';
import { ArrowRightIcon } from './icons';

type Variant = 'solid-indigo' | 'solid-gold' | 'outline' | 'outline-dark' | 'link';
type Size = 'md' | 'lg';

/** Maps variant names to the `.mkt-btn--*` foundation classes (globals.css).
 *  `link` is the odd one out: it reuses the inline `.mkt-link` text-CTA style
 *  (no `.mkt-btn` chrome) so quiet pointers still get the click tracking. */
const VARIANT_CLASS: Record<Variant, string> = {
  'solid-indigo': 'mkt-btn--primary',
  'solid-gold': 'mkt-btn--gold',
  outline: 'mkt-btn--ghost',
  'outline-dark': 'mkt-btn--ghost-dark',
  link: 'mkt-link',
};

/**
 * Marketing CTA that fires `marketing.cta_clicked` { page, position } on click,
 * then navigates. Same look as `MarketingButton` (shares the `.mkt-btn` classes)
 * but client-side so it can emit the lead-gen event. Use this for every CTA on
 * the marketing pages; use the server `MarketingButton` only where no event is
 * needed.
 *
 * Cross-module links: trackEvent + ConnectEvents in lib/analytics-events.ts
 * (keyless-safe). `position` is a stable slug (e.g. 'hero', 'final', 'nav').
 */
export function CtaButton({
  href,
  children,
  page,
  position,
  variant = 'solid-indigo',
  size = 'md',
  arrow = false,
  block = false,
  className = '',
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  page: MarketingPage;
  position: string;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  block?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const cls = [
    // `link` renders as an inline text CTA (.mkt-link), not a button.
    variant === 'link' ? '' : 'mkt-btn',
    VARIANT_CLASS[variant],
    size === 'lg' ? 'mkt-btn--lg' : '',
    block ? 'mkt-btn--block' : '',
    arrow ? 'mkt-arrow-host' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const onClick = () => trackEvent(ConnectEvents.marketingCtaClicked, { page, position });
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
