'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { recordConnectView, type ConnectViewTarget } from '../views.actions';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';
import { consumeListingSource } from '@/lib/connect/listing-source';

/**
 * ViewBeacon - records one view of a storefront / listing when a signed-in
 * member opens its page. Renders nothing.
 *
 * Fires once per mount, and only when: (a) the viewer is signed in (recording
 * needs an authenticated identity, and it is the dedupe key), and (b) the viewer
 * is NOT the owner (owners opening their own shop must not inflate their stats).
 * The actual per-viewer-per-day dedupe lives in the backend.
 */
export default function ViewBeacon({
  targetType,
  targetId,
  ownerUserId,
}: {
  targetType: ConnectViewTarget;
  targetId: string;
  ownerUserId?: string;
}) {
  const viewerId = useAuthStore((s) => s.user?._id ?? null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!viewerId) return; // anonymous - nothing to record with
    if (ownerUserId && viewerId === ownerUserId) return; // owner self-view
    fired.current = true;
    void recordConnectView(targetType, targetId);
    // Additive funnel telemetry: emit listingViewed alongside the (untouched)
    // billing/dedup view beacon. Listing targets only - storefront views are
    // not part of the listing funnel. `source` is read from the click breadcrumb
    // (lib/connect/listing-source) so listing URLs stay clean; absent -> 'direct'.
    // Sink is keyless-safe, so no env guard. No PII (id + coarse source only).
    if (targetType === 'listing') {
      trackEvent(ConnectEvents.listingViewed, {
        listingId: targetId,
        source: consumeListingSource(),
      });
    }
  }, [viewerId, ownerUserId, targetType, targetId]);

  return null;
}
