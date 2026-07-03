'use client';

/**
 * PromotedFeedShell - the shared chrome for a full-width in-feed sponsored card
 * (Phase 1 "boosts in the feed"). Renders the "Promoted" disclosure, wraps the
 * card body in a Link to the destination, and fires the SHARED MRC viewability +
 * click beacons (useAdBeacons) so the boost bills. Each kind's card supplies its
 * own body + CTA label; this keeps the listing / job / rfq feed cards consistent
 * and DRY. Cross-module: useAdBeacons -> /connect/ads/events/*.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Rocket } from 'lucide-react';
import { useAdBeacons } from './use-ad-beacons';
// "Sample" disclosure pill beside the Promoted label. Defense-in-depth: the backend
// already excludes demo content from ads, so this only shows if a seeded unit ever
// leaks into the sponsored feed (sponsoredUnit.isDemo).
import SampleBadge from '@/components/connect/SampleBadge';

export default function PromotedFeedShell({
  impressionToken,
  campaignId,
  href,
  ctaLabel,
  isDemo,
  children,
}: {
  impressionToken: string;
  campaignId: string;
  href: string;
  ctaLabel: string;
  /** Seeded demo advertiser -> show the Sample disclosure (defense-in-depth). */
  isDemo?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('connect.ads');
  const { cardRef, onClick } = useAdBeacons(impressionToken, {
    placement: 'feed',
    kind: 'boost',
    campaignId,
  });

  return (
    <div ref={cardRef}>
      <div
        aria-label={t('promotedLabel')}
        role="note"
        style={{
          marginBottom: 6,
          paddingLeft: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-3)',
          }}
        >
          <Rocket size={11} aria-hidden /> {t('promotedLabel')}
        </span>
        {isDemo && <SampleBadge size="sm" />}
      </div>
      <Link
        href={href}
        onClick={onClick}
        className="no-underline"
        style={{
          display: 'block',
          border: '1px solid var(--cr-border-light)',
          borderRadius: 'var(--cr-radius-md)',
          overflow: 'hidden',
          background: 'var(--cr-surface)',
        }}
      >
        {children}
        {/* CTA pinned at the card BOTTOM as a full-width button (was a small
            right-aligned text link) - clearer + more tappable, and always sits at
            the foot of the card after the content. */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--cr-divider)' }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 'var(--cr-radius-md)',
              background: 'var(--cr-primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {ctaLabel}
          </span>
        </div>
      </Link>
    </div>
  );
}
