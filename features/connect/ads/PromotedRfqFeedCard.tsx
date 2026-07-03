'use client';

/**
 * PromotedRfqFeedCard - a boosted quote request as a full-width feed card
 * (Phase 1). The feed-native counterpart of the rfq-board card.
 *
 * REDESIGN (2026-06-20): enriched from a bare category+title+budget stub to the
 * same signal richness as the rfq board card - category eyebrow, title, then a
 * meta row of quantity + unit, budget range, and location - so an in-feed quote
 * request reads as a real request, not a teaser. Uses the shared PromotedFeedShell
 * for the "Promoted" disclosure + the billing beacons + the tap-through (RfqDetail
 * has no image, so a full ListingGridCard-style reuse does not apply; the shell
 * keeps it consistent with the other feed boosts).
 *
 * Cross-module: RfqDetail (rfq.types); categoryLabel (search.types); marketplace
 * unit labels (connect.marketplace.card.units, shared with the listing cards);
 * PromotedFeedShell -> useAdBeacons -> /connect/ads/events/*. Gotcha: keep the
 * quantity/unit + budget rendering in sync with SpotlightRailCard's rfq branch.
 */

import { FileText, MapPin, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import PromotedFeedShell from './PromotedFeedShell';
import { categoryLabel } from '../search.types';
import type { RfqDetail } from '../rfq/rfq.types';

export interface PromotedRfqFeedCardProps {
  rfq: RfqDetail;
  impressionToken: string;
  campaignId: string;
}

export default function PromotedRfqFeedCard({
  rfq,
  impressionToken,
  campaignId,
}: PromotedRfqFeedCardProps) {
  const t = useTranslations('connect.ads');
  const tCat = useTranslations('connect.search.listing.category');
  // Unit labels are shared with the marketplace listing cards (per piece / per
  // meter / ...); reusing them keeps the quantity line consistent across boosts.
  const tUnits = useTranslations('connect.marketplace.card.units');
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const budgetText =
    rfq.budgetMin != null && rfq.budgetMax != null
      ? `${fmt(rfq.budgetMin)} - ${fmt(rfq.budgetMax)}`
      : rfq.budgetMin != null
        ? `${fmt(rfq.budgetMin)}+`
        : null;
  // Quantity + unit ("5,000 per meter") - both real RfqDetail fields; the unit
  // suffix is dropped when absent so a quantity-only request still reads cleanly.
  const quantityText =
    rfq.quantity != null
      ? `${rfq.quantity.toLocaleString('en-IN')}${rfq.unit ? ` ${tUnits(rfq.unit)}` : ''}`
      : null;
  const place = rfq.location?.district || rfq.location?.city || rfq.location?.state || null;

  return (
    <PromotedFeedShell
      impressionToken={impressionToken}
      campaignId={campaignId}
      href={`/connect/rfq/${rfq._id}`}
      ctaLabel={t('rfqAd.sendQuote')}
      isDemo={rfq.isDemo}
    >
      <div style={{ padding: '14px 14px 12px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--cr-primary)',
          }}
        >
          <FileText size={13} aria-hidden /> {categoryLabel(rfq.category, tCat)}
        </span>
        <h3
          style={{
            margin: '4px 0 0',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--cr-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {rfq.title}
        </h3>
        {budgetText && (
          <div style={{ marginTop: 3, fontSize: 14, fontWeight: 700, color: 'var(--cr-text-2)' }}>
            {budgetText}
          </div>
        )}
        {/* Meta row: quantity + unit and location, muted under the budget. Each
            span is dropped when its field is absent (real data only, never
            invented). Mirrors the board card's logistics line. */}
        {(quantityText || place) && (
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              fontSize: 12.5,
              color: 'var(--cr-text-4)',
            }}
          >
            {quantityText && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Package size={12} aria-hidden /> {quantityText}
              </span>
            )}
            {place && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} aria-hidden /> {place}
              </span>
            )}
          </div>
        )}
      </div>
    </PromotedFeedShell>
  );
}
