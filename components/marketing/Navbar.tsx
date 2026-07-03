'use client';

import Image from 'next/image';
import { Link, usePathname } from '@/i18n/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MarketingPage } from '@/lib/analytics-events';
import { AUTH, NAV_PRODUCT_LINKS, NAV_SITE_LINKS } from './content';
import { CtaButton } from './CtaButton';
import { CloseIcon, MenuIcon } from './icons';
import { LanguageMenu } from './LanguageMenu';

/** Map the current path to the analytics page slug for the nav CTA. */
function pageOf(pathname: string): MarketingPage {
  if (pathname === '/connect') return 'connect';
  if (pathname === '/pricing') return 'pricing';
  if (pathname.startsWith('/erp')) return 'erp';
  return 'home';
}

/**
 * Sticky marketing navbar. Desktop: dotted product links (Connect = indigo,
 * ERP = gold) with hover/focus tooltips, a divider, site links, then the
 * compact language switcher + the primary CTA. Mobile: hamburger opens a
 * slide-down drawer (scroll-lock, Escape-to-close, Tab focus trap) that also
 * carries the language switcher.
 *
 * The bar stays opaque cream (legible over dark bands) and gains a stronger
 * shadow once scrolled past the hero (`data-mkt-scrolled`, rAF-throttled).
 *
 * Cross-module links: CtaButton fires marketing.cta_clicked; LanguageMenu shares
 * the locale source in lib/locales.ts. Styling: `.mkt-navbar` in globals.css.
 */
export function Navbar() {
  const t = useTranslations('marketing.nav');
  const a11y = useTranslations('marketing.a11y');
  const pathname = usePathname();
  const page = pageOf(pathname);
  // Connect product removed (2026-07-04): single product, so the signup CTA
  // only distinguishes the ERP detail page from the neutral default.
  const signupHref = page === 'erp' ? AUTH.getStartedErp : AUTH.getStarted;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Elevation on scroll — rAF-throttled, single class toggle, no layout work.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isActive = (href: string) => pathname === href;

  return (
    <header
      data-mkt-scrolled={scrolled}
      className="mkt-navbar sticky top-0 z-40 border-b border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] shadow-[0_1px_3px_rgba(26,26,26,0.05)]"
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-[76px] w-full max-w-[1200px] items-center gap-9 px-5 sm:px-6 lg:px-8"
      >
        <Link href="/" aria-label="ManekHR — home" className="shrink-0">
          {/* Two-color on-light brand lockup (navy "zari", gold "360"). Shared
              across the whole public site; the marketing Footer uses the same
              asset, so keep both in sync. */}
          <Image
            src="/manekhr-horizontal-on-light.svg"
            alt="ManekHR"
            width={172}
            height={86}
            priority
            className="h-12 w-auto"
          />
        </Link>

        {/* desktop links — shown from lg up; below lg the nav (incl. the
            language switcher) lives in the hamburger drawer so the bar never
            overflows on tablet widths. */}
        <div className="hidden items-center gap-7 lg:flex">
          <div className="flex items-center gap-6">
            {NAV_PRODUCT_LINKS.map((link) => (
              <span key={link.id} className="group relative">
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  data-active={isActive(link.href)}
                  className="mkt-nav-link gap-2 font-semibold"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full transition-transform duration-150 group-hover:scale-125"
                    style={{
                      background:
                        link.dot === 'indigo' ? 'var(--cr-indigo-600)' : 'var(--cr-gold-500)',
                    }}
                    aria-hidden="true"
                  />
                  {t(link.id)}
                </Link>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 translate-y-[-4px] rounded-lg bg-[var(--cr-indigo-800)] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
                >
                  {t(`${link.id}Tip`)}
                </span>
              </span>
            ))}
          </div>
          <span className="h-[22px] w-px bg-[var(--cr-neutral-300)]" aria-hidden="true" />
          <div className="flex items-center gap-6">
            {NAV_SITE_LINKS.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                data-active={isActive(link.href)}
                className="mkt-nav-link"
              >
                {t(link.id)}
              </Link>
            ))}
          </div>
        </div>

        {/* desktop actions: language + primary CTA */}
        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <LanguageMenu align="end" />
          <CtaButton href={signupHref} page={page} position="nav" variant="solid-indigo" arrow>
            {t('getStarted')}
          </CtaButton>
        </div>

        {/* mobile actions: the language switcher is surfaced ON the bar (outside
            the drawer) for one-tap locale change, then the hamburger. Both are
            lg:hidden; on desktop the language switcher lives in the desktop actions
            group above. */}
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <LanguageMenu align="end" />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mkt-mobile-nav"
            aria-label={open ? a11y('closeMenu') : a11y('openMenu')}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border-[1.5px] border-[var(--cr-neutral-300)] text-[var(--cr-indigo-700)] transition-colors hover:border-[var(--cr-indigo-600)] hover:bg-[var(--cr-indigo-50)]"
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* mobile drawer */}
      {open ? (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label={a11y('closeMenu')}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[76px] z-30 cursor-default bg-[rgba(26,26,26,0.35)]"
          />
          <div
            ref={panelRef}
            id="mkt-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={a11y('menu')}
            className="absolute inset-x-0 top-[76px] z-40 border-b border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-5 pt-1 pb-7 shadow-xl sm:px-6"
          >
            <div className="flex flex-col">
              {[...NAV_PRODUCT_LINKS, ...NAV_SITE_LINKS].map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={`flex items-center gap-2.5 border-b border-[var(--cr-neutral-200)] py-3.5 text-[1.05rem] ${
                    isActive(link.href)
                      ? 'font-semibold text-[var(--cr-indigo-700)]'
                      : 'font-medium text-[var(--cr-neutral-700)]'
                  }`}
                >
                  {'dot' in link ? (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background:
                          link.dot === 'indigo' ? 'var(--cr-indigo-600)' : 'var(--cr-gold-500)',
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                  {t(link.id)}
                </Link>
              ))}
            </div>
            {/* Language switcher moved OUT of the drawer onto the bar (above) for
                quick access; not duplicated here. */}
            <div className="mt-5">
              <CtaButton
                href={signupHref}
                page={page}
                position="nav_mobile"
                variant="solid-indigo"
                size="lg"
                block
                arrow
              >
                {t('getStarted')}
              </CtaButton>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
