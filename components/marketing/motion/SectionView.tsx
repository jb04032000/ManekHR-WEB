'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { recordMarketingSectionView, type MarketingPage } from '@/lib/analytics-events';

/**
 * Renders a semantic section element and fires `marketing.page_section_viewed`
 * the first time it enters the viewport (once per section per session, deduped
 * in lib/analytics-events). Purely an analytics + landmark wrapper — no visual
 * effect (use `Reveal` for motion).
 *
 * Cross-module links: recordMarketingSectionView in lib/analytics-events.ts
 * (keyless-safe). Keep `section` slugs stable; they are the funnel dimension.
 */
export function SectionView({
  page,
  section,
  as: Tag = 'section',
  className = '',
  id,
  ariaLabelledby,
  children,
}: {
  page: MarketingPage;
  section: string;
  as?: ElementType;
  className?: string;
  id?: string;
  ariaLabelledby?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fire = () => recordMarketingSectionView({ page, section });

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const rect = el.getBoundingClientRect();
    if (rect.top < vh && rect.bottom > 0) {
      fire(); // already on screen at mount
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fire();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [page, section]);

  return (
    <Tag ref={ref} id={id} aria-labelledby={ariaLabelledby} className={className}>
      {children}
    </Tag>
  );
}
