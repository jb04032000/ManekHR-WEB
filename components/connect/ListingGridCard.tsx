'use client';

/**
 * `ListingGridCard` - the marketplace browse GRID card (redesign, Phase A).
 *
 * A vertical product card per the reference mockup: a cover image (or a
 * category-tinted icon header when the seller uploaded none), a category
 * eyebrow, a 2-line title, the asking price (or Negotiable), an MOQ + district
 * meta row, and a "Get quotation" + WhatsApp footer that both open the listing
 * detail (where the inquiry / WhatsApp flow lives). The whole card is a stretched
 * link to the detail page.
 *
 * Real data only: a verified badge shows when the listing is verified; the
 * rating row shows when the seller has a rating aggregate (R2/R3); the price
 * carries its unit. Response time, seller name, save, and condition pills are
 * net-new features (epic phases B-G) and stay absent until their data lands.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cog,
  Droplets,
  GraduationCap,
  Layers,
  MapPin,
  MessageSquareQuote,
  Monitor,
  Package,
  Play,
  Printer,
  Scissors,
  Shirt,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import {
  categoryLabel,
  type ConnectListingRef,
  type ListingPriceType,
} from '@/features/connect/search.types';
// Per-item "Sample" disclosure pill on seeded demo listings (listing.isDemo). One
// source of truth with the marketplace/search demo down-rank (backend demo-rank.ts).
import SampleBadge from '@/components/connect/SampleBadge';
// Right-sized CDN thumbnails for the grid cell (no-op until the CDN env is set).
import { imageVariant } from '@/lib/media/imageUrl';
// Records the click-through source for the listing-view funnel (see ViewBeacon).
import { markListingSource } from '@/lib/connect/listing-source';

interface Props {
  listing: ConnectListingRef;
  /**
   * Arrival source, recorded on click via the listing-source breadcrumb (funnel
   * analytics, ViewBeacon listingViewed). The marketplace grid passes 'grid'.
   * Unset = 'direct'. Mirrors the ListingCard `source` prop; keeps the URL clean.
   */
  source?: 'feed' | 'search' | 'grid';
  /**
   * Marks this card as a paid PROMOTED unit (a boost) - renders a small
   * "Promoted" disclosure chip on the cover (IAB/FTC) while the card stays
   * visually identical to an organic one. Set by PromotedGridListingCard for the
   * in-grid marketplace ad slot.
   */
  promoted?: boolean;
}

/** Category -> icon + tint for the no-photo header (mirrors the textile taxonomy). */
const CATEGORY_VISUAL: Record<string, { icon: LucideIcon; tint: string; fg: string }> = {
  weaving: { icon: Layers, tint: 'var(--cr-indigo-50)', fg: 'var(--cr-indigo-400, #8fa6e0)' },
  dyeing: { icon: Droplets, tint: 'var(--cr-indigo-50)', fg: 'var(--cr-indigo-400, #8fa6e0)' },
  printing: { icon: Printer, tint: 'var(--cr-surface-2)', fg: 'var(--cr-text-4)' },
  'embroidery-zari': { icon: Sparkles, tint: 'var(--cr-indigo-50)', fg: 'var(--cn-gold, #c79a3a)' },
  'job-work': { icon: Scissors, tint: 'var(--cr-surface-2)', fg: 'var(--cr-text-4)' },
  'raw-material': { icon: Boxes, tint: 'var(--cr-surface-2)', fg: 'var(--cr-text-4)' },
  machinery: { icon: Cog, tint: 'var(--cr-surface-2)', fg: 'var(--cr-text-4)' },
  'finished-goods': { icon: Shirt, tint: 'var(--cr-surface-2)', fg: 'var(--cr-text-4)' },
  // Institutes Phase 1: a training course renders with the cap glyph + brand tint.
  course: { icon: GraduationCap, tint: 'var(--cr-indigo-50)', fg: 'var(--cr-indigo-400, #8fa6e0)' },
};

/** Indian-numbering rupee, no decimals. */
function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function priceLabel(
  priceType: ListingPriceType,
  priceMin: number | null,
  priceMax: number | null,
  t: (k: string) => string,
): { text: string; negotiable: boolean } {
  if (priceType === 'negotiable' || priceMin === null) {
    return { text: t('listing.negotiable'), negotiable: true };
  }
  if (priceType === 'range' && priceMax !== null && priceMax > priceMin) {
    return { text: `${formatRupees(priceMin)} - ${formatRupees(priceMax)}`, negotiable: false };
  }
  return { text: formatRupees(priceMin), negotiable: false };
}

export default function ListingGridCard({ listing, source, promoted }: Props) {
  const t = useTranslations('connect.search');
  const tCat = useTranslations('connect.search.listing.category');
  const tMk = useTranslations('connect.marketplace');
  // Ad disclosure label (shared with the rail PromotedListingAdCard); only used
  // when `promoted` is set, so no new key and no cost for organic cards.
  const tAds = useTranslations('connect.ads');
  const href = `/connect/marketplace/listing/${listing.listingId}`;
  // Record arrival source on click; ViewBeacon reads it on the detail page.
  const onSourceClick = () => {
    if (source) markListingSource(source);
  };
  const price = priceLabel(listing.priceType, listing.priceMin, listing.priceMax, t);
  // Course card (Institutes Phase 1): a `course` listing carries courseDetails and
  // shows a fee label + duration/mode meta instead of product price + MOQ, and an
  // "Enquire to enrol" footer CTA. courseDetails mirrors the BE slim card.
  const course = listing.category === 'course' ? (listing.courseDetails ?? null) : null;
  const isCourse = !!course;
  // Course fee, driven by feeType (free / fixed amount / range), so the card reads
  // "Free" / "₹X" / "₹X - ₹Y" without the product Negotiable pill semantics.
  // `courseFeeIsFree` (not a label-string compare) decides the pill-vs-number UI.
  const courseFeeIsFree = !!course && (course.feeType === 'free' || listing.priceMin == null);
  const courseFee = course
    ? courseFeeIsFree
      ? tMk('card.course.free')
      : course.feeType === 'range' && listing.priceMax != null && listing.priceMin != null
        ? `${formatRupees(listing.priceMin)} - ${formatRupees(listing.priceMax)}`
        : listing.priceMin != null
          ? formatRupees(listing.priceMin)
          : tMk('card.course.free')
    : null;
  const visual = CATEGORY_VISUAL[listing.category] ?? {
    icon: Package,
    tint: 'var(--cr-surface-2)',
    fg: 'var(--cr-text-4)',
  };
  const Icon = visual.icon;
  // Title-case a raw lowercase district ("surat" -> "Surat").
  const district = listing.district
    ? listing.district.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
    : '';

  // The full image set (cover first); a single-element fallback from coverImage.
  const images =
    listing.images && listing.images.length
      ? listing.images
      : listing.coverImage
        ? [listing.coverImage]
        : [];
  const [active, setActive] = useState(0);
  const idx = Math.min(active, Math.max(0, images.length - 1));
  const hasCarousel = images.length > 1;
  // Arrow / dot handlers must not trigger the card's stretched link to detail.
  const step = (delta: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive((i) => (i + delta + images.length) % images.length);
  };

  return (
    <article
      className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden shadow-[0_2px_4px_rgba(46,45,42,0.05),0_5px_16px_rgba(46,45,42,0.07)] transition-[box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(16,24,40,0.13)]"
      style={{
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        // Card edge: a visible 1px --cr-border hairline (was --cr-border-light,
        // #f2eee6, nearly invisible on the cream page) plus a real resting shadow.
        // The resting shadow is the `shadow-[...]` CLASS above, NOT an inline
        // box-shadow: an inline shadow outranks the `hover:shadow-` class, so the
        // old inline value killed the hover lift entirely. Together these lift the
        // white card (#fff) off the cream page (#faf8f3), which it otherwise
        // merged into. Keep in sync with the warm --cr-shadow-md token intent.
        border: '1px solid var(--cr-border)',
      }}
    >
      {/* Header: the WHOLE image (object-contain, never cropped to the box) on a
          tinted plate, or a category icon when there is no photo. Multi-image
          listings reveal prev/next arrows + dots on hover to flip in place; the
          image itself stays part of the card link (click -> detail's full gallery). */}
      <div
        className="group/img relative w-full overflow-hidden"
        style={{
          aspectRatio: '4 / 3',
          // Photo well: --cr-surface-3 (a faint warm grey), NOT --cr-surface-2 -
          // surface-2 is byte-identical to the page cream (#faf8f3), so the image
          // area dissolved into the background. surface-3 reads as a distinct
          // plate behind the contain-fit photo, framed by the card border.
          background: images.length
            ? 'var(--cr-surface-3)'
            : `linear-gradient(135deg, ${visual.tint} 0%, var(--cr-surface) 100%)`,
        }}
      >
        {images.length ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded listing creative; contain-fit so the whole image shows
          <img
            // ~400px thumbnail variant for the grid cell (full image lives on the
            // listing detail gallery). Lazy + async-decode for off-screen cards.
            src={imageVariant(images[idx], { w: 400 })}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          // No photo: a category-tinted plate with the category glyph lifted into a
          // soft white chip (depth) instead of a bare flat icon - reads as designed,
          // not "image missing".
          <span aria-hidden className="grid h-full w-full place-items-center">
            <span
              className="grid place-items-center transition-transform duration-200 group-hover:scale-105"
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: 'var(--cr-surface)',
                boxShadow: '0 2px 10px rgba(16,24,40,0.08)',
                color: visual.fg,
              }}
            >
              <Icon size={26} strokeWidth={1.7} />
            </span>
          </span>
        )}

        {/* Play badge: the listing has a product video. The cover stays the
            image (poster is NOT swapped in); this is just a corner cue. Absolute
            overlay, so no layout shift. */}
        {listing.hasVideo && (
          <span
            title={tMk('card.videoBadge')}
            aria-label={tMk('card.videoBadge')}
            className="absolute top-2 left-2 z-20 grid h-7 w-7 place-items-center rounded-full"
            style={{ background: 'rgba(14,24,68,0.62)', color: '#fff' }}
          >
            <Play size={14} aria-hidden style={{ marginInlineStart: 1 }} />
          </span>
        )}

        {/* Promoted disclosure (boost): a small "Promoted" chip on the cover so a
            paid grid unit is labelled (IAB/FTC) while staying visually identical to
            an organic card. Top-right, so it never collides with the top-left video
            badge. Set only via PromotedGridListingCard. */}
        {promoted && (
          <span
            role="note"
            aria-label={tAds('promotedLabel')}
            className="absolute top-2 right-2 z-30 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{
              background: 'rgba(255,255,255,0.92)',
              color: 'var(--cr-text-2)',
              border: '1px solid var(--cr-border)',
              letterSpacing: '0.04em',
            }}
          >
            {tAds('promotedLabel')}
          </span>
        )}

        {/* Sample disclosure on the cover for a seeded demo listing. Bottom-left so
            it never collides with the top-left video badge or the top-right
            Promoted chip. */}
        {listing.isDemo && (
          <span className="absolute bottom-2 left-2 z-30">
            <SampleBadge size="sm" />
          </span>
        )}

        {hasCarousel && (
          <>
            <button
              type="button"
              aria-label={tMk('card.prevImage')}
              onClick={step(-1)}
              className="absolute top-1/2 left-1.5 z-20 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full opacity-0 transition-opacity group-hover/img:opacity-100"
              style={{
                background: 'rgba(255,255,255,0.92)',
                color: 'var(--cr-text-2)',
                border: '1px solid var(--cr-border)',
              }}
            >
              <ChevronLeft size={15} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={tMk('card.nextImage')}
              onClick={step(1)}
              className="absolute top-1/2 right-1.5 z-20 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full opacity-0 transition-opacity group-hover/img:opacity-100"
              style={{
                background: 'rgba(255,255,255,0.92)',
                color: 'var(--cr-text-2)',
                border: '1px solid var(--cr-border)',
              }}
            >
              <ChevronRight size={15} aria-hidden />
            </button>
            <div
              className="absolute inset-x-0 bottom-1.5 z-20 flex justify-center gap-1"
              aria-hidden
            >
              {images.map((src, i) => (
                <span
                  key={src + i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === idx ? 14 : 6,
                    background: i === idx ? 'var(--cr-primary)' : 'rgba(255,255,255,0.85)',
                    boxShadow: '0 0 2px rgba(16,24,40,0.35)',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-3 pt-2.5 pb-3">
        {/* Category eyebrow: the category glyph + label in gold, tying the card
            to its category strip pill + the no-photo plate glyph. */}
        <span
          className="inline-flex w-fit items-center gap-1 text-[10px] font-bold tracking-wider uppercase"
          style={{ color: 'var(--cn-gold, #b8860b)' }}
        >
          <Icon size={11} strokeWidth={2.25} aria-hidden />
          {categoryLabel(listing.category, tCat)}
        </span>

        <h3
          className="m-0 text-[13.5px] leading-snug font-bold"
          style={{
            color: 'var(--cr-text)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          <Link
            href={href}
            onClick={onSourceClick}
            className="no-underline after:absolute after:inset-0 after:content-['']"
            style={{ color: 'inherit' }}
          >
            {listing.title}
          </Link>
        </h3>

        {listing.verified && (
          <span
            className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold"
            style={{ color: 'var(--cr-success, var(--cr-primary))' }}
          >
            <BadgeCheck size={13} aria-hidden /> {t('listing.verified')}
          </span>
        )}

        {/* Course fee: feeType-driven label (Free / fixed / range). "Free" reads as
            a soft brand pill (a state, like Negotiable); a real fee reads as a
            bold number. Shown in place of the product price for a course. */}
        {isCourse ? (
          courseFeeIsFree ? (
            <span
              className="inline-flex w-fit items-center rounded-full text-[12px] font-bold"
              style={{
                padding: '3px 11px',
                background: 'var(--cr-pill-brand-bg, var(--cr-indigo-50))',
                color: 'var(--cr-primary)',
                border: '1px solid var(--cr-indigo-100, #dbe4f7)',
              }}
            >
              {courseFee}
            </span>
          ) : (
            <div
              className="text-[15px] font-extrabold"
              style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
            >
              {courseFee}
            </div>
          )
        ) : /* Price: a hard number reads as the value, so it stays bold + tabular.
            "Negotiable" is a STATE, not a price, so it renders as a soft pill -
            clearer than the old same-weight indigo text that looked like a price. */
        price.negotiable ? (
          <span
            className="inline-flex w-fit items-center rounded-full text-[12px] font-bold"
            style={{
              padding: '3px 11px',
              background: 'var(--cr-pill-brand-bg, var(--cr-indigo-50))',
              color: 'var(--cr-primary)',
              border: '1px solid var(--cr-indigo-100, #dbe4f7)',
            }}
          >
            {price.text}
          </span>
        ) : (
          <div
            className="text-[15px] font-extrabold"
            style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
          >
            {price.text}
            {listing.unit && (
              <small
                className="font-semibold"
                style={{ marginLeft: 4, fontSize: 11, color: 'var(--cr-text-4)' }}
              >
                {tMk(`card.units.${listing.unit}`)}
              </small>
            )}
          </div>
        )}

        {/* Logistics meta: muted icons + readable values (MOQ / location / rating).
            Values sit at text-2 with the icons dropped back to text-4 so the row
            scans cleanly under the price without competing with it. */}
        <div
          className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]"
          style={{ color: 'var(--cr-text-2)' }}
        >
          {/* Course meta: duration + delivery mode (Institutes Phase 1), replacing
              the product MOQ. Reads from courseDetails on the slim card. */}
          {course && course.durationLabel && (
            <span className="inline-flex items-center gap-1 font-semibold">
              <Clock size={12} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
              {tMk('card.course.duration', { duration: course.durationLabel })}
            </span>
          )}
          {course && (
            <span className="inline-flex items-center gap-1 font-semibold">
              <Monitor size={12} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
              {tMk(`card.course.mode.${course.mode}`)}
            </span>
          )}
          {!isCourse && typeof listing.moq === 'number' && (
            <span className="inline-flex items-center gap-1 font-semibold">
              <Package size={12} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
              {tMk('card.moq', { count: listing.moq })}
            </span>
          )}
          {district && (
            <span className="inline-flex items-center gap-1 font-semibold">
              <MapPin size={12} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
              {district}
            </span>
          )}
          {listing.rating && listing.rating.ratingCount > 0 && (
            <span
              className="inline-flex items-center gap-1 font-bold"
              aria-label={tMk('card.ratingAria', {
                avg: listing.rating.ratingAvg.toFixed(1),
                count: listing.rating.ratingCount,
              })}
            >
              <Star
                size={12}
                aria-hidden
                style={{ color: 'var(--cn-gold, #d4a72c)', fill: 'currentColor' }}
              />
              {listing.rating.ratingAvg.toFixed(1)}
            </span>
          )}
        </div>

        {/* Footer: both actions open the detail page (inquiry / WhatsApp live
            there). Above the stretched overlay so they stay independently clickable. */}
        <div
          className="relative z-10 mt-auto flex gap-1.5 pt-2.5"
          style={{ borderTop: '1px solid var(--cr-border-light)' }}
        >
          <Link
            href={href}
            onClick={onSourceClick}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold no-underline transition-[filter,box-shadow] duration-150 hover:brightness-[1.04]"
            style={{
              // Brand-gold gradient + a soft gold shadow gives the primary action
              // real depth (was a flat single-tone slab). Token: --cr-grad-gold.
              background: 'var(--cr-grad-gold, var(--cn-gold, #c79a3a))',
              color: '#fff',
              boxShadow: '0 1px 3px rgba(140,112,25,0.28)',
            }}
          >
            <MessageSquareQuote size={14} aria-hidden />{' '}
            {isCourse ? tMk('card.enrolCta') : tMk('card.getQuote')}
          </Link>
        </div>
      </div>
    </article>
  );
}
