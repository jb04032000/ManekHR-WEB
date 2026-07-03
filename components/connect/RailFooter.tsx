'use client';

/**
 * RailFooter - the ambient footer shown at the bottom of a Connect right rail
 * (LinkedIn pattern). On infinite-scroll pages (feed, marketplace, jobs, search)
 * a page-bottom footer is never reached, so the footer lives here, where the
 * sticky rail (Rail.tsx bottom-sticks a tall rail) keeps it reachable.
 *
 * Rendered automatically by <Rail side="right"> (unless footer={false}); shares
 * the SAME links + copy as the page-bottom footer (ConnectAppFooter) via the
 * connect.appFooter i18n - keep the two in sync. Links are real routes only
 * (About/Contact/Terms); Help/Privacy are deferred until those pages exist.
 *
 * Mutual exclusion: emits `data-connect-rail-footer-bp=<breakpoint>` so the
 * shell's bottom footer hides itself at exactly the breakpoint where this rail
 * (and so this footer) is visible. Below that breakpoint the rail is hidden and
 * the bottom footer takes over, so exactly one footer ever shows. The matching
 * CSS lives in app/globals.css; the breakpoint must equal the Rail's.
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { RailBreakpoint } from './Rail';
import SampleContentNote from './SampleContentNote';

export default function RailFooter({ breakpoint = 'xl' }: { breakpoint?: RailBreakpoint }) {
  const t = useTranslations('connect.appFooter');
  const year = new Date().getFullYear();

  // Real routes only. Keep in sync with ConnectAppFooter; add Help/Privacy here
  // once those pages exist (labels already live in connect.appFooter).
  const links = [
    { href: '/about', label: t('about') },
    { href: '/contact', label: t('contact') },
    { href: '/terms/connect', label: t('terms') },
  ];

  return (
    <footer
      data-connect-rail-footer-bp={breakpoint}
      aria-label={t('aria')}
      style={{
        padding: '0 var(--cr-space-xs)',
        fontSize: 11,
        color: 'var(--cr-text-4)',
        lineHeight: 1.7,
      }}
    >
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0 12px',
        }}
      >
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="no-underline" style={{ color: 'var(--cr-text-4)' }}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--cr-text-4)' }}>
        {t('madeIn')} · {t('copyright', { year })}
      </p>
      <SampleContentNote />
    </footer>
  );
}
