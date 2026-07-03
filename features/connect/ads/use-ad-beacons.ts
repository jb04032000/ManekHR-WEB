'use client';

/**
 * useAdBeacons - the shared MRC viewability + click beacon logic for a promoted
 * ad unit. Extracted from AdCard (Boost Post epic) so both the promoted-post
 * card and the promoted-listing rail card (M2.2) share ONE implementation.
 *
 * Viewability (MRC standard): >=50% of the card in-viewport for >=1 second
 * continuously fires `recordImpression(impressionToken)` exactly once, then the
 * observer disconnects. Dropping below 50% before the dwell timer fires cancels
 * it. Click fires `recordClick(impressionToken)` on any click inside the card.
 *
 * Both beacons are fire-and-forget; errors are swallowed (the actions already
 * swallow, and an ad beacon must never surface an error into the host surface).
 *
 * Returns a ref to attach to the card root and a click handler to wrap the
 * clickable content.
 */

import { useRef, useEffect, useCallback } from 'react';
import { recordImpression, recordClick } from './ads.actions';
// Product analytics mirror (PostHog/GA4 via the typed catalog). Piggybacks the
// BILLING beacons below: the same viewability/click triggers ALSO emit the
// lossy `connect.ad.*` product events. Keyless-safe (trackEvent no-ops without
// env keys). Links: lib/analytics-events.ts, never billed from these events.
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import type { AdKind } from '@/lib/analytics-events';

/** MRC: 1 000 ms continuous visibility at >= 50%. */
const VIEWABILITY_DWELL_MS = 1_000;

/**
 * Optional analytics descriptor. When provided, the impression/click product
 * events fire alongside (never instead of) the billing beacons. `campaignId` is
 * present for first-party boost units, omitted for adsense (placement only).
 */
export interface AdBeaconAnalytics {
  placement: string;
  kind: AdKind;
  campaignId?: string;
}

export function useAdBeacons(
  impressionToken: string,
  analytics?: AdBeaconAnalytics,
): {
  cardRef: React.RefObject<HTMLDivElement | null>;
  onClick: () => void;
} {
  const cardRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Hold the latest analytics descriptor in a ref so the impression/click
  // emits read a fresh value without re-running the viewability observer effect
  // (which keys off impressionToken only). Analytics is additive; if absent the
  // emits are skipped entirely.
  const analyticsRef = useRef<AdBeaconAnalytics | undefined>(analytics);
  // Sync in an effect (not during render) so we never mutate a ref mid-render.
  useEffect(() => {
    analyticsRef.current = analytics;
  }, [analytics]);

  useEffect(() => {
    if (firedRef.current) return;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      observerRef.current?.disconnect();
      void recordImpression(impressionToken).catch(() => undefined);
      // Additive product-analytics mirror of the same impression trigger.
      if (analyticsRef.current) {
        trackEvent(ConnectEvents.adImpression, analyticsRef.current);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio >= 0.5) {
          if (timerRef.current === null) {
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              fire();
            }, VIEWABILITY_DWELL_MS);
          }
        } else if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      },
      { threshold: 0.5 },
    );

    observerRef.current = observer;
    if (cardRef.current) observer.observe(cardRef.current);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      observer.disconnect();
    };
  }, [impressionToken]);

  const onClick = useCallback(() => {
    void recordClick(impressionToken).catch(() => undefined);
    // Additive product-analytics mirror of the same click trigger.
    if (analyticsRef.current) {
      trackEvent(ConnectEvents.adClick, analyticsRef.current);
    }
  }, [impressionToken]);

  return { cardRef, onClick };
}
