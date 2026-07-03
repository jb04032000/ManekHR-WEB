'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ConnectEvents, trackEvent, type MarketingPage } from '@/lib/analytics-events';
import { AUTH } from './content';
import { CloseIcon } from './icons';

const DISMISS_KEY = 'mkt_sticky_cta_dismissed';

/**
 * Phone-only sticky bottom CTA. Slides up after the hero scrolls away, is
 * dismissible (remembered in localStorage), and hides itself near the page
 * bottom so it never covers the footer. Hidden at >= md (the navbar CTA covers
 * desktop). Fires `marketing.cta_clicked` { position: 'sticky_bar' }.
 *
 * Cross-module links: AUTH entry links (intent-pinned by page, mirrors
 * Navbar/FinalCta), trackEvent in lib/analytics-events.ts. Visibility +
 * safe-area styling in `.mkt-sticky-cta`.
 * Watch: dismissal is held in a ref (not state) and the first visibility check
 * is deferred to a frame, so the effect never calls setState synchronously.
 */
export function MobileStickyCta({ page }: { page: MarketingPage }) {
  const t = useTranslations('marketing.stickyCta');
  // Pin signup intent so the Connect page's sticky CTA skips the IntentPicker;
  // home (the only other page rendering this) stays neutral. No ERP case: /erp
  // has no sticky CTA. Mirrors Navbar/FinalCta.
  const signupHref = page === 'connect' ? AUTH.getStartedConnect : AUTH.getStarted;
  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    try {
      dismissedRef.current = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      dismissedRef.current = false;
    }
    const onScroll = () => {
      const doc = document.documentElement;
      const scrolled = window.scrollY > 560;
      const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 140;
      setVisible(!dismissedRef.current && scrolled && !nearBottom);
    };
    // Defer the first check out of the synchronous effect body.
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function dismiss() {
    dismissedRef.current = true;
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // storage blocked — dismissal just won't persist; fine.
    }
  }

  return (
    <div
      className="mkt-sticky-cta fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[var(--cr-neutral-200)] bg-white px-4 pt-2.5 lg:hidden"
      data-mkt-visible={visible}
      aria-hidden={!visible}
    >
      {/* line-clamp-2 (not truncate): every locale's label is longer than the
          ~165px the flex row leaves on a 360-375px phone, so a single-line
          ellipsis cut the copy mid-word. Two clamped lines fit whole. */}
      <p className="line-clamp-2 min-w-0 flex-1 text-[0.88rem] leading-snug font-semibold text-[var(--cr-charcoal)]">
        {t('label')}
      </p>
      <Link
        href={signupHref}
        onClick={() =>
          trackEvent(ConnectEvents.marketingCtaClicked, { page, position: 'sticky_bar' })
        }
        className="mkt-btn mkt-btn--primary !min-h-[44px] shrink-0 px-5"
        tabIndex={visible ? 0 : -1}
      >
        {t('join')}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        tabIndex={visible ? 0 : -1}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-[var(--cr-neutral-500)] transition-colors hover:bg-[var(--cr-neutral-100)]"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
