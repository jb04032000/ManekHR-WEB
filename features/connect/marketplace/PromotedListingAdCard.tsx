'use client';

/**
 * PromotedListingAdCard - the marketplace-rail promoted listing (M2.2).
 *
 * The listing analogue of the feed's promoted-post AdCard: a compact "Promoted"
 * listing card that links to the listing detail and fires the SHARED MRC
 * viewability + click beacons (`useAdBeacons`). Rendered in the marketplace
 * browse Rail when `decideListingAd('marketplace_rail')` returns a
 * promoted_listing win AND the listing hydrates as a public (active + approved)
 * listing; otherwise the rail simply renders nothing (no-fill).
 *
 * Person-centric, no workspaceId. The "Promoted" disclosure sits above the card
 * (IAB + FTC guidance), role="note" for assistive tech.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ImageOff, MapPin } from 'lucide-react';
import { useAdBeacons } from '../ads/use-ad-beacons';
import { formatRupees } from './format';
import { categoryLabel } from '../search.types';
import type { ListingDetail } from './marketplace.types';

/**
 * A fully-resolved promoted listing, passed from the Server Component to the
 * rail. Carries the hydrated listing + the decision tokens the beacons need.
 */
export interface PromotedListingResolved {
  listing: ListingDetail;
  impressionToken: string;
  campaignId: string;
}

export default function PromotedListingAdCard({
  listing,
  impressionToken,
  campaignId,
}: PromotedListingResolved) {
  const t = useTranslations('connect.ads');
  const tDetail = useTranslations('connect.marketplace.detail');
  const tCat = useTranslations('connect.search.listing.category');
  // Analytics descriptor piggybacks the billing beacons: a first-party boost
  // unit in the marketplace rail, so kind='boost' + campaignId + the
  // marketplace_grid placement. Additive product emit only; the billing beacon
  // still keys off impressionToken. Links: lib/analytics-events.ts.
  const { cardRef, onClick } = useAdBeacons(impressionToken, {
    placement: 'marketplace_grid',
    kind: 'boost',
    campaignId,
  });

  const promotedLabel = t('promotedLabel');
  const cover = listing.images?.[0];
  const priceText =
    listing.priceType === 'negotiable' || listing.priceMin == null
      ? tDetail('negotiable')
      : listing.priceType === 'range' &&
          listing.priceMax != null &&
          listing.priceMax > listing.priceMin
        ? tDetail('priceRange', {
            min: formatRupees(listing.priceMin),
            max: formatRupees(listing.priceMax),
          })
        : formatRupees(listing.priceMin);
  // Title-case the seller's free-text district ("surat" -> "Surat"); shown as a
  // muted meta line so the compact rail card carries category + place, not just price.
  const district = listing.location?.district
    ? listing.location.district.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
    : '';

  return (
    <div ref={cardRef}>
      {/* Disclosure tag above the card (IAB + FTC). */}
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
        href={`/connect/marketplace/listing/${listing._id}`}
        onClick={onClick}
        className="no-underline"
        style={{
          display: 'block',
          border: '1px solid var(--cr-border-light)',
          borderRadius: 'var(--cr-radius-md)',
          overflow: 'hidden',
          background: 'var(--cr-surface)',
          boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded listing image of unknown dimensions; the established Connect pattern is <img> + object-fit
          <img
            src={cover}
            alt=""
            aria-hidden
            style={{
              width: '100%',
              height: 120,
              objectFit: 'cover',
              display: 'block',
              background: 'var(--cr-surface-2)',
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: '100%',
              height: 120,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-4)',
            }}
          >
            <ImageOff size={24} aria-hidden />
          </div>
        )}
        <div style={{ padding: '10px 12px 11px' }}>
          {/* Category eyebrow (gold) ties the card to its category like the grid
              card, so the compact rail unit is more than just title + price. */}
          <span
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--cn-gold, #b8860b)',
            }}
          >
            {categoryLabel(listing.category, tCat)}
          </span>
          <h3
            style={{
              margin: '3px 0 0',
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--cr-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {listing.title}
          </h3>
          <div
            style={{
              marginTop: 3,
              fontSize: 13.5,
              fontWeight: 800,
              color: 'var(--cr-text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {priceText}
          </div>
          {district && (
            <div
              style={{
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11.5,
                color: 'var(--cr-text-4)',
              }}
            >
              <MapPin size={12} aria-hidden /> {district}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
