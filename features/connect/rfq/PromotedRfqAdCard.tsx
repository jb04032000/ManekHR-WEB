'use client';

/**
 * PromotedRfqAdCard - the promoted request-for-quote card pinned atop the RFQ
 * board for an rfq boost. The RFQ analogue of PromotedListingAdCard: a "Promoted"
 * disclosure + the request (title / category / budget) + a "Send a quote" CTA,
 * firing the SHARED MRC viewability + click beacons (useAdBeacons) so the boost
 * bills. The RFQ is hydrated SSR (resolvePromotedRailRfq) and passed as a prop.
 *
 * Cross-module: RfqDetail (rfq.types), useAdBeacons (/connect/ads/events/*).
 * Links to /connect/rfq/[id] (the request detail, where a supplier quotes).
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { useAdBeacons } from '../ads/use-ad-beacons';
import { categoryLabel } from '../search.types';
import type { RfqDetail } from './rfq.types';

export interface PromotedRfqResolvedView {
  rfq: RfqDetail;
  impressionToken: string;
  campaignId: string;
}

export default function PromotedRfqAdCard({
  rfq,
  impressionToken,
  campaignId,
}: PromotedRfqResolvedView) {
  const t = useTranslations('connect.ads');
  const tCat = useTranslations('connect.search.listing.category');
  const { cardRef, onClick } = useAdBeacons(impressionToken, {
    placement: 'rfq_board',
    kind: 'boost',
    campaignId,
  });

  const promotedLabel = t('promotedLabel');
  // Budget line: a range, a single bound, or nothing (negotiable).
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const budgetText =
    rfq.budgetMin != null && rfq.budgetMax != null
      ? `${fmt(rfq.budgetMin)} - ${fmt(rfq.budgetMax)}`
      : rfq.budgetMin != null
        ? `${fmt(rfq.budgetMin)}+`
        : null;

  return (
    <div ref={cardRef}>
      <div aria-label={promotedLabel} role="note" style={{ marginBottom: 6, paddingLeft: 2 }}>
        <span
          aria-hidden="true"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-3)',
          }}
        >
          {promotedLabel}
        </span>
      </div>

      <Link
        href={`/connect/rfq/${rfq._id}`}
        onClick={onClick}
        className="no-underline"
        style={{
          display: 'block',
          border: '1px solid var(--cr-primary-light)',
          borderRadius: 'var(--cr-radius-md)',
          overflow: 'hidden',
          background: 'var(--cr-surface)',
        }}
      >
        <div style={{ padding: '12px 14px' }}>
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
              fontSize: 14.5,
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
            <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: 'var(--cr-text-2)' }}>
              {budgetText}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '8px 14px',
            borderTop: '1px solid var(--cr-divider)',
            background: 'var(--cr-surface-2)',
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cr-primary)' }}>
            {t('rfqAd.sendQuote')}
          </span>
        </div>
      </Link>
    </div>
  );
}
