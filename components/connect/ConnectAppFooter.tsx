'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LocaleToggle } from '@/components/marketing/LocaleToggle';
import SampleContentNote from './SampleContentNote';

/**
 * ConnectAppFooter - the single common footer for the signed-in Connect surface.
 *
 * Rendered once per page by the Connect shell (app/connect/layout.tsx). Folds in the
 * old right-rail footer (RailFooter, now removed) so the feed no longer shows footer
 * links twice. Kept OFF the full-screen consoles (inbox + store/company manage screens)
 * via the shell's HideOnPaths - a footer there is noise and drags their sticky rail.
 *
 * Links: only routes that EXIST today (About, Contact, Connect Terms). Help + Privacy
 * are deferred until those pages are built - their labels stay in the catalogue
 * (connect.appFooter.help / .privacy) so the links drop back in with no copy work. Keep
 * this list in sync with the marketing footer's legal/company columns
 * (components/marketing/content.ts) when those pages land.
 *
 * Language: the header globe switcher is desktop-only, so a compact LocaleToggle shows
 * HERE on mobile only (md:hidden) - exactly one language control per breakpoint.
 *
 * Width: inner content is capped to the page content column (--cn-content-max-w) so the
 * footer's left edge lines up with page content at both sidebar states.
 *
 * Sample-content disclaimer: reuses the self-contained SampleContentNote (its own
 * NEXT_PUBLIC_CONNECT_DEMO_NOTICE kill-switch + inline 4-locale copy).
 */
export default function ConnectAppFooter() {
  const t = useTranslations('connect.appFooter');
  const year = new Date().getFullYear();

  // Real routes only. Add { href: '/help', label: t('help') } back here once that
  // page exists. Privacy + Community Guidelines are required to be reachable from
  // every page for Google AdSense approval (UGC policy), so they link here.
  const links = [
    { href: '/about', label: t('about') },
    { href: '/contact', label: t('contact') },
    { href: '/terms/connect', label: t('terms') },
    { href: '/privacy/connect', label: t('privacy') },
    { href: '/guidelines/connect', label: t('guidelines') },
  ];

  return (
    <footer
      aria-label={t('rights', { year })}
      className="border-t"
      style={{ borderColor: 'var(--cr-border)' }}
    >
      <div
        className="mx-auto flex w-full flex-col gap-3 px-4 py-4 sm:px-6"
        style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="no-underline hover:underline"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <span className="text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('madeIn')} · {t('copyright', { year })}
            </span>
          </div>
          <div className="md:hidden">
            <LocaleToggle />
          </div>
        </div>
        <SampleContentNote />
      </div>
    </footer>
  );
}
