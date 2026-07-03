/**
 * `ListingCard` - the marketplace listing card (M1.4.3).
 *
 * Renders a `ConnectListingRef` as a single buyer-facing row: cover image (or
 * a category placeholder when the seller uploaded none), title, category
 * badge, formatted asking price, seller district, and a "View product" link.
 *
 * The WHOLE card is clickable: the title link carries a stretched `::after`
 * overlay (Tailwind `after:absolute after:inset-0`) that fills the positioned
 * `<article>`, so a click anywhere on the row opens the listing. The explicit
 * "View product" link is kept as a visible affordance and sits above the
 * overlay (`relative z-10`) so it stays independently focusable / clickable.
 *
 * Both the title and the "View product" link land on the listing detail page
 * (`/connect/marketplace/listing/:id`) - the product the buyer is after, not
 * the seller's profile.
 *
 * Component is shared (`components/connect/`) rather than search-scoped so
 * the M1.6 marketplace browse / detail surfaces can reuse it without a
 * second card flavour.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BadgeCheck, ImageOff, Play } from 'lucide-react';
import RatingStars from '@/components/connect/RatingStars';
// Per-item "Sample" disclosure pill on seeded demo listings (listing.isDemo).
import SampleBadge from '@/components/connect/SampleBadge';
import {
  categoryLabel,
  type ConnectListingRef,
  type ListingPriceType,
} from '@/features/connect/search.types';
// Right-sized CDN thumbnail for the 96px cover (no-op until the CDN env is set).
import { imageVariant } from '@/lib/media/imageUrl';
// Records the click-through source for the listing-view funnel (see ViewBeacon).
import { markListingSource } from '@/lib/connect/listing-source';

interface ListingCardProps {
  listing: ConnectListingRef;
  /**
   * Where this card is rendered. Recorded on click via the listing-source
   * breadcrumb so the detail page's ViewBeacon can attribute the view
   * (feed/search/grid) in funnel analytics, without putting a tracking param on
   * the listing URL. Unset = 'direct'.
   */
  source?: 'feed' | 'search' | 'grid';
}

/** Format a rupee amount in Indian numbering (`₹4,49,500`), no decimals. */
function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Render the asking price in the right shape for the seller's `priceType`.
 * Returns a localized label (`Negotiable`) when no number is set.
 */
function priceLabel(
  priceType: ListingPriceType,
  priceMin: number | null,
  priceMax: number | null,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (priceType === 'negotiable' || priceMin === null) {
    return t('listing.negotiable');
  }
  if (priceType === 'range' && priceMax !== null && priceMax > priceMin) {
    return t('listing.priceRange', { min: formatRupees(priceMin), max: formatRupees(priceMax) });
  }
  return formatRupees(priceMin);
}

export default function ListingCard({ listing, source }: ListingCardProps) {
  const t = useTranslations('connect.search');
  const detailHref = `/connect/marketplace/listing/${listing.listingId}`;
  // Record arrival source on click (read back by ViewBeacon on the detail page).
  // Keeps the URL clean; no-op when source is unset.
  const onSourceClick = () => {
    if (source) markListingSource(source);
  };
  // Category namespace, scoped so a slug maps straight to its localized label.
  const tCat = useTranslations('connect.search.listing.category');
  const price = priceLabel(listing.priceType, listing.priceMin, listing.priceMax, t);
  // Known 8 -> localized label; a custom category ("new cat") -> humanized, so a
  // seller-coined category never throws MISSING_MESSAGE.
  const categoryText = categoryLabel(listing.category, tCat);
  // Title-case the district so a raw lowercase entry ("surat") reads as a place.
  const district = listing.district
    ? listing.district.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
    : '';

  return (
    <article
      className="group relative cursor-pointer transition-shadow hover:shadow-[0_2px_14px_rgba(0,0,0,0.08)]"
      style={{
        // height:100% so every card fills its (stretched) grid cell - in a row
        // the shorter card grows to match the tallest, keeping card heights even.
        // In non-grid layouts the parent has no fixed height, so this is a no-op.
        height: '100%',
        display: 'flex',
        gap: 14,
        padding: 14,
        borderRadius: 'var(--cr-radius-md)',
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border-light)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'relative',
          flexShrink: 0,
          width: 96,
          height: 96,
          borderRadius: 'var(--cr-radius-sm)',
          background: 'var(--cr-surface-2)',
          backgroundImage: listing.coverImage
            ? `url(${imageVariant(listing.coverImage, { w: 400 })})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--cr-text-4)',
        }}
      >
        {!listing.coverImage && <ImageOff size={28} aria-hidden />}
        {/* Play badge: the listing has a product video. The cover image is NOT
            swapped for the poster (images stay the cover); this is just a cue.
            Overlay only, so it never shifts layout. */}
        {listing.hasVideo && (
          <span
            title={t('listing.videoBadge')}
            aria-label={t('listing.videoBadge')}
            style={{
              position: 'absolute',
              bottom: 4,
              left: 4,
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(14,24,68,0.62)',
              color: '#fff',
            }}
          >
            <Play size={12} aria-hidden style={{ marginInlineStart: 1 }} />
          </span>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--cr-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          <Link
            href={detailHref}
            onClick={onSourceClick}
            // Stretched link: the ::after overlay fills the positioned <article>,
            // making the entire card a single click target for the listing.
            className="after:absolute after:inset-0 after:content-['']"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {listing.title}
          </Link>
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--cr-radius-full)',
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-2)',
            }}
          >
            {categoryText}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text)' }}>{price}</span>
          {listing.verified && (
            <span
              title={t('listing.verifiedHint')}
              aria-label={`${t('listing.verified')}. ${t('listing.verifiedHint')}`}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11.5,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--cr-radius-full)',
                background: 'var(--cr-success-bg, var(--cr-surface-2))',
                color: 'var(--cr-success, var(--cr-primary))',
              }}
            >
              <BadgeCheck size={13} aria-hidden />
              {t('listing.verified')}
            </span>
          )}
          {/* Sample disclosure for a seeded demo listing. relative z-1 keeps it
              clickable/above the stretched card overlay, like the verified badge. */}
          {listing.isDemo && (
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
              <SampleBadge size="sm" />
            </span>
          )}
          {district && <span style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>{district}</span>}
          {listing.rating && listing.rating.ratingCount > 0 && (
            <RatingStars
              value={listing.rating.ratingAvg}
              count={listing.rating.ratingCount}
              size={13}
              showCount
            />
          )}
        </div>
        <Link
          href={detailHref}
          onClick={onSourceClick}
          style={{
            position: 'relative',
            zIndex: 1,
            alignSelf: 'flex-start',
            marginTop: 2,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--cr-primary)',
            textDecoration: 'none',
          }}
        >
          {t('listing.viewProduct')}
        </Link>
      </div>
    </article>
  );
}
