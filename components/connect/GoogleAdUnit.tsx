'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import { adReservedHeightClass, type AdPlacement } from '@/lib/connect/ads';
import HouseAdFallback from './HouseAdFallback';

/**
 * GoogleAdUnit - a single Google AdSense display unit, hardened for serving.
 *
 * Lifecycle (client-side):
 *   1. Reserve space immediately via a min-height floor (`adReservedHeightClass`)
 *      so the slot never pops in and shifts content (CLS).
 *   2. Lazy-mount below the fold: defer the paid `adsbygoogle.push({})` until the
 *      unit nears the viewport (same IntersectionObserver pattern as useAdBeacons).
 *   3. Detect fill via the <ins> `data-ad-status` attribute AdSense stamps
 *      ("filled" | "unfilled"). On fill, fire the `connect.ad.impression`
 *      analytics event ONCE (kind=adsense, on fill not mount). On no-fill (or a
 *      timeout backstop), collapse to the house self-promo fallback instead of
 *      leaving a void.
 *
 * `AdSlot` only renders this when AdSense is configured (publisher id + a slot id
 * for the placement), so an unconfigured deploy never mounts it. The "Sponsored"
 * disclosure marks a paid third-party fill (distinct from a first-party
 * "Promoted" boost).
 *
 * Links: lib/connect/ads (placement -> reserved height), lib/analytics-events
 * (adImpression catalog), HouseAdFallback (no-fill), AdSlot (resolution seam),
 * app/connect/layout.tsx (the loader script this pushes into).
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * How long to wait for AdSense to report a fill before collapsing to the house
 * fallback. AdSense usually stamps `data-ad-status` within a second or two; this
 * is a generous backstop for slow networks / no demand. Exported for the test.
 */
export const NO_FILL_TIMEOUT_MS = 4_000;

/** Lazy-mount margin: start the push when the unit is this close to the viewport. */
const LAZY_ROOT_MARGIN = '200px';

type FillState = 'pending' | 'filled' | 'unfilled';

export default function GoogleAdUnit({
  client,
  slot,
  placement,
}: {
  client: string;
  slot: string;
  placement: AdPlacement;
}) {
  const t = useTranslations('connect.ads');
  const rootRef = useRef<HTMLElement>(null);
  const insRef = useRef<HTMLModElement>(null);
  const [fill, setFill] = useState<FillState>('pending');
  // Resolve (fill/no-fill) exactly once per mount; the impression also fires once.
  const resolvedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    let mo: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const resolveFill = (status: 'filled' | 'unfilled') => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      mo?.disconnect();
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (status === 'filled') {
        setFill('filled');
        // Impression fires on FILL (not mount). Catalog kind=adsense, no
        // campaignId (no first-party campaign behind an external fill).
        trackEvent(ConnectEvents.adImpression, { placement, kind: 'adsense' });
      } else {
        setFill('unfilled');
      }
    };

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      // Push once. A double-push throws inside AdSense; the guard + catch keep it
      // non-fatal (loader blocked / not yet loaded / StrictMode remount).
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* AdSense not ready / blocked - falls through to the no-fill backstop. */
      }

      const ins = insRef.current;
      const readStatus = () => ins?.getAttribute('data-ad-status') ?? null;

      // Already resolved synchronously (rare) - honour it immediately.
      const current = readStatus();
      if (current === 'filled') return resolveFill('filled');
      if (current === 'unfilled') return resolveFill('unfilled');

      // Live signal: AdSense flips data-ad-status when it fills or gives up.
      if (ins && typeof MutationObserver !== 'undefined') {
        mo = new MutationObserver(() => {
          const s = readStatus();
          if (s === 'filled') resolveFill('filled');
          else if (s === 'unfilled') resolveFill('unfilled');
        });
        mo.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
      }

      // Backstop: if no fill is reported in time, collapse to the fallback.
      // Reading the attribute at fire-time also catches a fill the observer missed.
      timer = setTimeout(() => {
        timer = null;
        resolveFill(readStatus() === 'filled' ? 'filled' : 'unfilled');
      }, NO_FILL_TIMEOUT_MS);
    };

    // Lazy-mount via IntersectionObserver (the established observer pattern).
    // Start the push when the unit nears the viewport; with no IO (SSR/old
    // engines) start immediately so the unit still works.
    if (typeof IntersectionObserver === 'undefined') {
      start();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: LAZY_ROOT_MARGIN },
    );
    io.observe(node);

    return () => {
      io.disconnect();
      mo?.disconnect();
      if (timer !== null) clearTimeout(timer);
    };
  }, [placement]);

  // No paid fill -> house self-promo (same reserved height = shift-free swap).
  if (fill === 'unfilled') {
    return <HouseAdFallback placement={placement} />;
  }

  return (
    <aside
      ref={rootRef}
      aria-label={t('sponsoredLabel')}
      className={`overflow-hidden rounded-lg ${adReservedHeightClass(placement)}`}
      style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
    >
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <span
        className="block px-3 py-2 text-[11px] font-semibold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-4)' }}
      >
        {t('sponsoredLabel')}
      </span>
    </aside>
  );
}
