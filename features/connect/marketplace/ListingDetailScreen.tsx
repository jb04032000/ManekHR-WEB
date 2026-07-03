'use client';

/**
 * ListingDetailScreen - the full marketplace listing surface (M1.6.2).
 *
 * A two-column product page: the gallery + description on the left, a sticky
 * info column (category, title, price, trade terms, CTA) on the right. The
 * surface is mode-aware:
 *
 *  - LIVE (buyer): the right column ends with the active "Contact seller" CTA,
 *    a share row, and a seller mini-card.
 *  - PREVIEW (the owner viewing their own listing, drafts included, via the
 *    owner-scoped preview route): a sticky banner + back-to-edit + Publish, the
 *    CTA shown but inert (the owner cannot inquire to themselves), and a
 *    readiness checklist (progress + per-item Fix links) in place of the seller
 *    card. Publishing stays allowed even when incomplete (the listing then reads
 *    as "incomplete" in the manager); the checklist guides, it does not block.
 *
 * Public read goes through the `@Public` listing endpoint; preview reads the
 * owner's own listing. Below `lg` the columns stack (gallery first).
 */

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Image } from 'antd';
import {
  Award,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  ImageOff,
  MapPin,
  MessageCircle,
  Minus,
  Monitor,
  Package,
  Pencil,
  Play,
  Plus,
  Share2,
  ShieldCheck,
  Tag,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectPage, PersonCard } from '@/components/connect';
import RatingStars from '@/components/connect/RatingStars';
import SellerReviews from '@/components/connect/SellerReviews';
// Per-item "Sample" disclosure pill on a seeded demo listing's detail page
// (listing.isDemo). One source with the marketplace grid card + search down-rank.
import SampleBadge from '@/components/connect/SampleBadge';
import type { ConnectPerson } from '@/components/connect';
import { announceGlobal } from '@/components/connect/globalAnnouncer';
import { useShellTitle } from '@/lib/shell-title';
// Right-sized CDN thumbnails for the strip; hero keeps the full image.
import { imageVariant } from '@/lib/media/imageUrl';
import type { ListingDetail } from './marketplace.types';
import { categoryLabel, type ConnectListingRef } from '../search.types';
import { formatRupees } from './format';
import { publishListing } from './marketplace.actions';
import SendInquiryModal from './SendInquiryModal';
// First-party promoted listing (boost) for this previously rail-LESS page: a
// desktop card in the buy-box aside + an inline mobile block, so phone users get
// the same ad inventory the rail-having pages carry.
import PromotedListingAdCard, { type PromotedListingResolved } from './PromotedListingAdCard';
import MobileAdInline from '../ads/MobileAdInline';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';
import { noDownloadVideoProps } from '@/lib/connect/media-guard';

/** Compact pill button used by the share affordances. */
const shareBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  border: '1px solid var(--cr-border)',
  background: 'var(--cr-surface)',
  borderRadius: 'var(--cr-radius-full)',
  padding: '4px 11px',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--cr-text-2)',
  cursor: 'pointer',
};

/** A bordered card wrapper for the right column blocks. */
const cardStyle: CSSProperties = {
  border: '1px solid var(--cr-border)',
  borderRadius: 'var(--cr-radius-lg)',
  background: 'var(--cr-surface)',
  padding: 'var(--cr-space-lg)',
};

interface ListingDetailScreenProps {
  listing: ListingDetail;
  /** Hydrated seller identity, or `null` when the public profile is unavailable. */
  seller: ConnectPerson | null;
  /** Owner preview mode (see file header). Default false = the live public page. */
  preview?: boolean;
  /** Other products from the same shop ("More from this shop"); empty hides it. */
  siblings?: ConnectListingRef[];
  /** The viewer owns this listing (live page only): the buyer CTA is replaced
   *  with an Edit action, since a self-inquiry is not allowed. */
  isOwner?: boolean;
  /** First-party promoted listing (boost), placement `listing_detail`, or null on
   *  a no-fill. This page has no rail, so it renders in the aside + inline mobile. */
  promoted?: PromotedListingResolved | null;
}

export default function ListingDetailScreen({
  listing,
  seller,
  preview = false,
  siblings = [],
  isOwner = false,
  promoted = null,
}: ListingDetailScreenProps) {
  const t = useTranslations('connect.marketplace.detail');
  const tPrev = useTranslations('connect.marketplace.preview');
  const tCat = useTranslations('connect.search.listing.category');
  const tRail = useTranslations('connect.marketplace.rail');
  const tListing = useTranslations('connect.search.listing');
  const tRev = useTranslations('connect.reviews');
  const router = useRouter();
  const [activeImage, setActiveImage] = useState(0);
  // Hide the poster-first play badge once the product video starts (mirrors PostCard).
  const [videoStarted, setVideoStarted] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  // Order-estimate stepper (buy box). Starts at the MOQ so the estimate is
  // immediately honest about the smallest order the seller takes.
  const [qty, setQty] = useState(() => Math.max(listing.moq ?? 1, 1));

  const editHref = `/connect/marketplace/listing/${listing._id}/edit`;

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      announceGlobal(t('copied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked - no-op */
    }
  };
  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${listing.title}\n${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  // The shell top-bar shows a generic page label ("Product detail"), never the
  // product name - the name already leads the page (h1 + breadcrumb), and a long
  // title overflows the top bar (owner call 2026-06-10). Cleared on unmount so
  // other pages set their own.
  const setShellTitle = useShellTitle((s) => s.setTitle);
  const shellTitle = t('pageTitle');
  useEffect(() => {
    setShellTitle(shellTitle);
    return () => setShellTitle(null);
  }, [shellTitle, setShellTitle]);

  const hasImages = listing.images.length > 0;

  // Course mode (Institutes Phase 1): a `course` listing carries courseDetails and
  // reads as a class, not a product - a course card on the left, a fee (feeType-
  // driven) + no qty estimator in the buy box, and an "Enquire to enrol" CTA. The
  // inquiry payload/action are unchanged; only the web copy/CTA differs.
  const course = listing.category === 'course' ? (listing.courseDetails ?? null) : null;
  const isCourse = !!course;
  // Service mode (Slice B2): a service listing carries serviceDetails and reads as
  // a service offer - a "Service details" block on the left (delivery mode,
  // pricing model, coverage, experience, availability) next to the specs card.
  // The fee reuses priceMin/priceType (pricingModel-driven, like the course fee);
  // a `negotiable` service shows "Negotiable" with no per-unit qualifier. The
  // inquiry payload/action are unchanged.
  const service = listing.serviceDetails ?? null;
  // The buyer CTA label: enrol for a course, contact seller otherwise. Used at
  // every CTA branch below.
  const ctaLabel = isCourse ? t('enquireToEnrol') : t('contactSeller');

  // A negotiable / price-less listing has no numeric amount, so a per-unit
  // qualifier ("per kg") next to "Negotiable" reads as a contradiction.
  const isNegotiable = listing.priceType === 'negotiable' || listing.priceMin == null;
  const priceText =
    listing.priceType === 'negotiable' || listing.priceMin == null
      ? t('negotiable')
      : listing.priceType === 'range' &&
          listing.priceMax != null &&
          listing.priceMax > listing.priceMin
        ? t('priceRange', {
            min: formatRupees(listing.priceMin),
            max: formatRupees(listing.priceMax),
          })
        : formatRupees(listing.priceMin);

  // Course fee text (Institutes Phase 1), driven by feeType: free -> "Free",
  // fixed -> one amount, range -> from/to. Shown in the buy box in place of the
  // product price; "Free" reads as a state (no per-unit qualifier).
  const courseFeeText = course
    ? course.feeType === 'free'
      ? t('course.free')
      : course.feeType === 'range' &&
          listing.priceMin != null &&
          listing.priceMax != null &&
          listing.priceMax > listing.priceMin
        ? t('priceRange', {
            min: formatRupees(listing.priceMin),
            max: formatRupees(listing.priceMax),
          })
        : listing.priceMin != null
          ? formatRupees(listing.priceMin)
          : t('course.free')
    : null;
  const courseFeeIsFree = course?.feeType === 'free';

  // Title-case each word's first letter so raw lowercase entries render as place
  // names; the rest of each word is left as typed.
  const titleCase = (s: string) => s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  const locationParts = [
    listing.location?.district,
    listing.location?.city,
    listing.location?.state,
  ]
    .filter((p): p is string => Boolean(p && p.trim().length > 0))
    .map((p) => titleCase(p.trim()));

  const hasDescription = listing.description.trim().length > 0;
  const hasPrice = listing.priceType === 'negotiable' || listing.priceMin != null;

  // Readiness checklist (preview). Title + category always pass (required to
  // save); the rest flag what a buyer would find missing. Guidance, not a gate.
  const checklist = [
    { key: 'title' as const, done: !!listing.title.trim() },
    { key: 'category' as const, done: !!listing.category },
    { key: 'photo' as const, done: hasImages },
    { key: 'description' as const, done: hasDescription },
    { key: 'price' as const, done: hasPrice },
    { key: 'location' as const, done: locationParts.length > 0 },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const missingCount = checklist.length - doneCount;
  const ready = missingCount === 0;

  const shop = listing.storefront ?? null;
  const shopHref = shop ? `/store/${shop.slug}` : null;
  // Other products from the same shop for the cross-sell rail: the current one
  // excluded, and only products WITH a cover photo (a photoless card reads as
  // broken test data); the backend already returns only active + approved.
  const relatedSiblings = siblings
    .filter((s) => s.listingId !== listing._id && !!s.coverImage)
    .slice(0, 4);

  const handlePublish = async () => {
    setPublishing(true);
    const res = await publishListing(listing._id);
    setPublishing(false);
    if (res.ok) router.push('/connect/marketplace/mine');
  };

  // ── Reusable column pieces ──────────────────────────────────────────────────

  // The gallery lives in a bordered card and the hero frame keeps its own
  // border: a light/white product photo must still read as a photo against the
  // page wash (without the frame it visually melts into the background).
  const gallery = (
    <section style={{ ...cardStyle, padding: 14 }}>
      {hasImages ? (
        // AntD Image gives a click-to-zoom fullscreen preview (zoom / rotate /
        // scroll) for free; PreviewGroup lets the lightbox page through every
        // photo. All photos mount (only the active one is shown in the hero
        // frame); the thumbnails below swap which is shown.
        <Image.PreviewGroup>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4 / 3',
              maxHeight: 520,
              borderRadius: 'var(--cr-radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--cr-border)',
              background: 'var(--cr-surface-2)',
              cursor: 'zoom-in',
            }}
          >
            {listing.images.map((src, index) => (
              <Image
                key={src}
                // Detail hero keeps the FULL image (sharp zoom). The active one
                // paints eagerly (above the fold); the rest lazy-load.
                src={src}
                alt={listing.title}
                width="100%"
                height="100%"
                loading={index === activeImage ? 'eager' : 'lazy'}
                decoding="async"
                style={{ objectFit: 'cover', objectPosition: 'center', display: 'block' }}
                styles={{
                  root: {
                    display: index === activeImage ? 'block' : 'none',
                    width: '100%',
                    height: '100%',
                  },
                }}
              />
            ))}
          </div>
        </Image.PreviewGroup>
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '4 / 3',
            maxHeight: 520,
            borderRadius: 'var(--cr-radius-md)',
            border: '1px solid var(--cr-border)',
            background: 'var(--cr-surface-2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--cr-text-4)',
            textAlign: 'center',
            padding: 'var(--cr-space-md)',
          }}
        >
          <ImageOff size={36} aria-hidden />
          {preview && <span style={{ fontSize: 12.5, fontWeight: 600 }}>{tPrev('noCover')}</span>}
        </div>
      )}
      {listing.images.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {listing.images.map((src, index) => {
            const active = index === activeImage;
            return (
              <button
                key={src}
                type="button"
                aria-label={t('galleryThumb', { index: index + 1 })}
                aria-pressed={active}
                onClick={() => setActiveImage(index)}
                style={{
                  width: 64,
                  height: 64,
                  padding: 0,
                  borderRadius: 'var(--cr-radius-sm)',
                  overflow: 'hidden',
                  border: `2px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border-light)'}`,
                  cursor: 'pointer',
                  background: 'var(--cr-surface-2)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded thumbnail; the established Connect pattern is <img> + object-fit */}
                <img
                  // 64px strip thumbnail -> ~160px variant; full image is the hero.
                  src={imageVariant(src, { w: 160 })}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  // ── Product video (poster-first) ───────────────────────────────────────────
  // At most one clip (backend caps it). Painted poster-first with
  // preload="metadata" + a non-interactive play badge that hides once playback
  // starts - the SAME pattern as the feed PostCard. Native <video controls> is
  // keyboard accessible; the badge is aria-hidden (decorative cue only). Absent
  // entirely when the listing has no video.
  const video = listing.videos?.[0];
  const videoSection = video ? (
    <section style={{ ...cardStyle, marginTop: 'var(--cr-space-md)', padding: 14 }}>
      <h2
        style={{
          margin: '0 0 var(--cr-space-sm)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--cr-text)',
        }}
      >
        {t('videoTitle')}
      </h2>
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--cr-radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--cr-border)',
          background: '#000',
        }}
      >
        <video
          controls
          // Strip the easy download affordances (native download button, PiP,
          // right-click save). Shared with every Connect media player.
          {...noDownloadVideoProps}
          preload="metadata"
          poster={video.posterUrl || undefined}
          src={video.url}
          aria-label={t('playVideo')}
          onPlay={() => {
            setVideoStarted(true);
            // Additive funnel telemetry: video play on the listing surface.
            trackEvent(ConnectEvents.videoPlay, { surface: 'listing' });
          }}
          style={{ width: '100%', maxHeight: 520, background: '#000', display: 'block' }}
        />
        {!videoStarted && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(14,24,68,0.55)',
                color: '#fff',
              }}
            >
              <Play size={26} aria-hidden style={{ marginInlineStart: 3 }} />
            </span>
          </div>
        )}
      </div>
    </section>
  ) : null;

  const detailsSection =
    hasDescription || preview ? (
      <section style={{ ...cardStyle, marginTop: 'var(--cr-space-md)' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('descriptionTitle')}
        </h2>
        {hasDescription ? (
          <p
            style={{
              margin: 'var(--cr-space-sm) 0 0',
              fontSize: 13.5,
              lineHeight: 1.6,
              color: 'var(--cr-text-2)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {listing.description}
          </p>
        ) : (
          <p style={{ margin: 'var(--cr-space-sm) 0 0', fontSize: 13, color: 'var(--cr-text-4)' }}>
            {tPrev('noDescription')}{' '}
            <Link href={editHref} style={{ color: 'var(--cr-primary)', fontWeight: 600 }}>
              {tPrev('fix')} &rarr;
            </Link>
          </p>
        )}
      </section>
    ) : null;

  // ── Title / summary card (left column, under the gallery) ──────────────────
  // Prototype "product-head" anatomy: eyebrow + verified, the h1, a sub-row of
  // real social proof (rating + location - we have no sold-count, so none shows),
  // then the seller's tag chips.
  const titleCard = (
    <section style={{ ...cardStyle, marginTop: 'var(--cr-space-md)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cr-primary)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--cr-gold-500, var(--cr-primary))',
            }}
          />
          {categoryLabel(listing.category, tCat)}
        </span>
        {listing.verified && (
          <span
            title={tListing('verifiedHint')}
            aria-label={`${tListing('verified')}. ${tListing('verifiedHint')}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              padding: '2px 10px',
              borderRadius: 'var(--cr-radius-full)',
              background: 'var(--cr-success-bg, var(--cr-surface-2))',
              color: 'var(--cr-success, var(--cr-primary))',
            }}
          >
            <BadgeCheck size={14} aria-hidden />
            {tListing('verified')}
          </span>
        )}
      </div>

      <h1
        style={{
          margin: '8px 0 0',
          fontSize: 'clamp(20px, 2.4vw, 26px)',
          fontWeight: 700,
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          color: 'var(--cr-text)',
        }}
      >
        {listing.title}
      </h1>

      {listing.isDemo && (
        <div style={{ marginTop: 8 }}>
          <SampleBadge size="md" />
        </div>
      )}

      {(listing.rating || locationParts.length > 0) && (
        <div
          style={{
            marginTop: 9,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '7px 12px',
            fontSize: 12.5,
            color: 'var(--cr-text-4)',
          }}
        >
          {listing.rating && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RatingStars value={listing.rating.ratingAvg} size={13} />
              <b style={{ color: 'var(--cr-text-2)', fontWeight: 700 }}>
                {listing.rating.ratingAvg.toFixed(1)}
              </b>
              <span>{tRev('totalReviews', { count: listing.rating.ratingCount })}</span>
            </span>
          )}
          {locationParts.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} aria-hidden />
              {locationParts.join(', ')}
            </span>
          )}
        </div>
      )}

      {(listing.tags?.length ?? 0) > 0 && (
        <div style={{ marginTop: 13, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {listing.tags!.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 11px',
                borderRadius: 'var(--cr-radius-full)',
                border: '1px solid var(--cr-border)',
                background: 'var(--cr-surface-2)',
                color: 'var(--cr-text-3)',
                textTransform: 'capitalize',
              }}
            >
              {tag.replace(/-/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </section>
  );

  // ── Specifications card (left column) ──────────────────────────────────────
  // The seller's own label/value rows (backend `Listing.specs`); hidden when none.
  const specRows = (listing.specs ?? []).filter((s) => s.label.trim() && s.value.trim());
  const specsCard =
    specRows.length > 0 ? (
      <section style={{ ...cardStyle, marginTop: 'var(--cr-space-md)' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('specsTitle')}
        </h2>
        <dl
          style={{
            margin: 'var(--cr-space-md) 0 0',
            display: 'grid',
            // min(100%, 240px) floor: on a < 240px-wide column the track shrinks to
            // 100% instead of overflowing the card on a narrow phone.
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
            gap: 1,
            background: 'var(--cr-border-light)',
            border: '1px solid var(--cr-border-light)',
            borderRadius: 'var(--cr-radius-md)',
            overflow: 'hidden',
          }}
        >
          {specRows.map((spec) => (
            <div
              key={spec.label}
              style={{
                background: 'var(--cr-surface)',
                padding: '11px 14px',
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
              }}
            >
              <dt
                style={{
                  fontSize: 11.5,
                  color: 'var(--cr-text-4)',
                  fontWeight: 600,
                  flex: 'none',
                  width: 96,
                }}
              >
                {spec.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  color: 'var(--cr-text)',
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    ) : null;

  // ── Course card (left column, Institutes Phase 1) ──────────────────────────
  // The class facts a learner reads before enrolling: duration, next batch, mode,
  // fee, seats, certificate, and the skills taught. Rendered next to the specs
  // card, only for a `course` listing. Reads from `listing.courseDetails`.
  const courseDateLabel = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };
  const courseFacts = course
    ? ([
        { key: 'duration', icon: Clock, label: t('course.duration'), value: course.durationLabel },
        course.batchStart
          ? {
              key: 'batch',
              icon: CalendarDays,
              label: t('course.batchStart'),
              value: courseDateLabel(course.batchStart),
            }
          : null,
        {
          key: 'mode',
          icon: Monitor,
          label: t('course.mode'),
          value: t(`course.modeOpt.${course.mode}`),
        },
        {
          key: 'fee',
          icon: GraduationCap,
          label: t('course.fee'),
          value: courseFeeText ?? t('course.free'),
        },
        typeof course.seats === 'number'
          ? { key: 'seats', icon: Users, label: t('course.seats'), value: String(course.seats) }
          : null,
        {
          key: 'certificate',
          icon: Award,
          label: t('course.certificate'),
          value: course.certificate ? t('course.certificateYes') : t('course.certificateNo'),
        },
      ].filter(Boolean) as { key: string; icon: typeof Clock; label: string; value: string }[])
    : [];
  const courseCard = course ? (
    <section style={{ ...cardStyle, marginTop: 'var(--cr-space-md)' }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--cr-text)' }}>
        {t('course.title')}
      </h2>
      <dl
        style={{
          margin: 'var(--cr-space-md) 0 0',
          display: 'grid',
          // min(100%, 220px) floor: track shrinks to 100% rather than overflowing
          // the card on a narrow phone.
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
          gap: 10,
        }}
      >
        {courseFacts.map((fact) => {
          const FactIcon = fact.icon;
          return (
            <div key={fact.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <FactIcon
                size={16}
                aria-hidden
                style={{ flex: 'none', marginTop: 2, color: 'var(--cr-text-4)' }}
              />
              <div style={{ minWidth: 0 }}>
                <dt style={{ fontSize: 11.5, color: 'var(--cr-text-4)', fontWeight: 600 }}>
                  {fact.label}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--cr-text)',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {fact.value}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
      {course.skillsTaught.length > 0 && (
        <div style={{ marginTop: 'var(--cr-space-md)' }}>
          <p
            style={{
              margin: '0 0 6px',
              fontSize: 11.5,
              color: 'var(--cr-text-4)',
              fontWeight: 600,
            }}
          >
            {t('course.skills')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {course.skillsTaught.map((skill) => (
              <span
                key={skill}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 11px',
                  borderRadius: 'var(--cr-radius-full)',
                  border: '1px solid var(--cr-border)',
                  background: 'var(--cr-surface-2)',
                  color: 'var(--cr-text-3)',
                  textTransform: 'capitalize',
                }}
              >
                {skill.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  ) : null;

  // ── Service card (left column, Slice B2) ───────────────────────────────────
  // The facts a buyer reads before enquiring about a service: delivery mode,
  // pricing model, coverage area, experience, and availability. Rendered next to
  // the specs card, only when `serviceDetails` is present. Reads from
  // `listing.serviceDetails`; the fee itself shows in the buy box (priceMin-
  // driven), so it is not repeated here. Mirrors the course card.
  const serviceFacts = service
    ? ([
        {
          key: 'delivery',
          icon: Monitor,
          label: t('service.deliveryMode'),
          value: t(`service.deliveryModeOpt.${service.deliveryMode}`),
        },
        {
          key: 'pricing',
          icon: Tag,
          label: t('service.pricingModel'),
          value: t(`service.pricingModelOpt.${service.pricingModel}`),
        },
        service.coverageArea?.trim()
          ? {
              key: 'coverage',
              icon: MapPin,
              label: t('service.coverageArea'),
              value: service.coverageArea.trim(),
            }
          : null,
        typeof service.yearsExperience === 'number' && service.yearsExperience > 0
          ? {
              key: 'experience',
              icon: Users,
              label: t('service.experience'),
              value: t('service.experienceValue', { years: service.yearsExperience }),
            }
          : null,
        service.availability?.trim()
          ? {
              key: 'availability',
              icon: Clock,
              label: t('service.availability'),
              value: service.availability.trim(),
            }
          : null,
      ].filter(Boolean) as { key: string; icon: typeof Clock; label: string; value: string }[])
    : [];
  const serviceCard = service ? (
    <section style={{ ...cardStyle, marginTop: 'var(--cr-space-md)' }}>
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--cr-text)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Wrench size={16} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
        {t('service.title')}
      </h2>
      <dl
        style={{
          margin: 'var(--cr-space-md) 0 0',
          display: 'grid',
          // min(100%, 220px) floor: track shrinks to 100% rather than overflowing
          // the card on a narrow phone.
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
          gap: 10,
        }}
      >
        {serviceFacts.map((fact) => {
          const FactIcon = fact.icon;
          return (
            <div key={fact.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <FactIcon
                size={16}
                aria-hidden
                style={{ flex: 'none', marginTop: 2, color: 'var(--cr-text-4)' }}
              />
              <div style={{ minWidth: 0 }}>
                <dt style={{ fontSize: 11.5, color: 'var(--cr-text-4)', fontWeight: 600 }}>
                  {fact.label}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--cr-text)',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {fact.value}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  ) : null;

  // ── Buy box (rail head): price, MOQ, order estimate, CTA, trust lines ──────
  // The order estimator only shows for a fixed-price product (an estimate over a
  // range or "negotiable" would be a made-up number). Never for a course (a class
  // is not ordered by quantity).
  const showEstimator =
    !preview && !isOwner && !isCourse && listing.priceType === 'fixed' && listing.priceMin != null;
  const estimate = listing.priceMin != null ? qty * listing.priceMin : 0;
  const minQty = Math.max(listing.moq ?? 1, 1);

  const buyBox = (
    <div style={cardStyle}>
      {/* Price reads in the foreground colour - the brand accent is reserved for
          the primary CTA so it stays the single loudest element. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--cr-text)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {/* Course shows the feeType-driven fee; a product shows its price. */}
          {isCourse ? courseFeeText : priceText}
        </span>
        {/* The per-unit qualifier ("per kg") is product-only; a course has no unit. */}
        {!isCourse && listing.unit && !isNegotiable && (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-4)' }}>
            {t(`units.${listing.unit}`)}
          </span>
        )}
      </div>
      {isCourse && courseFeeIsFree && (
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--cr-success, #15803d)' }}>
          {t('course.freeHint')}
        </p>
      )}
      {!isCourse && isNegotiable && (
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--cr-success, #15803d)' }}>
          {t('negotiableHint')}
        </p>
      )}

      {/* MOQ is a product order minimum; a course is not ordered by quantity. */}
      {!isCourse && listing.moq != null && (
        <div
          style={{
            marginTop: 11,
            padding: '9px 12px',
            border: '1px solid var(--cr-gold-400, var(--cr-border))',
            background: 'var(--cr-gold-100, var(--cr-surface-2))',
            borderRadius: 'var(--cr-radius-md)',
            fontSize: 12.5,
            color: 'var(--cr-gold-700, var(--cr-text-2))',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Package size={15} aria-hidden style={{ flex: 'none' }} />
          <span style={{ fontWeight: 700 }}>{t('moq', { count: listing.moq })}</span>
        </div>
      )}

      {showEstimator && (
        <>
          <div style={{ marginTop: 14 }}>
            <label
              htmlFor="pd-qty"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--cr-text-4)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              {t('qtyLabel')}
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                width: 'max-content',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                aria-label={t('qtyDecrease')}
                onClick={() => setQty((q) => Math.max(minQty, q - 1))}
                style={{
                  width: 38,
                  border: 'none',
                  background: 'var(--cr-surface-2)',
                  color: 'var(--cr-text-2)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Minus size={15} aria-hidden />
              </button>
              <input
                id="pd-qty"
                type="number"
                inputMode="numeric"
                min={minQty}
                value={qty}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  setQty(Number.isNaN(parsed) ? minQty : Math.max(minQty, parsed));
                }}
                style={{
                  width: 62,
                  border: 'none',
                  borderInline: '1px solid var(--cr-border)',
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--cr-text)',
                  background: 'var(--cr-surface)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <button
                type="button"
                aria-label={t('qtyIncrease')}
                onClick={() => setQty((q) => q + 1)}
                style={{
                  width: 38,
                  border: 'none',
                  background: 'var(--cr-surface-2)',
                  color: 'var(--cr-text-2)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Plus size={15} aria-hidden />
              </button>
            </div>
          </div>
          <div
            style={{
              marginTop: 11,
              paddingTop: 11,
              borderTop: '1px dashed var(--cr-border)',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-text-3)' }}>
              {t('estimatedOrder')}
            </span>
            <span
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--cr-text)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatRupees(estimate)}
            </span>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--cr-text-4)' }}>
            {t('estimateHint')}
          </p>
        </>
      )}

      {preview ? (
        <>
          {/* The owner is the seller, so the buyer CTA is shown inert with a note. */}
          <p
            style={{ margin: 'var(--cr-space-lg) 0 6px', fontSize: 12, color: 'var(--cr-text-4)' }}
          >
            {tPrev('buyersContact')}
          </p>
          <DsButton dsVariant="primary" fullWidth disabled style={{ height: 48 }}>
            {ctaLabel}
          </DsButton>
        </>
      ) : (
        <>
          {isOwner ? (
            // The viewer owns this listing - a self-inquiry is blocked, so the
            // buyer CTA is replaced with an Edit action + a note.
            <>
              <p
                style={{
                  margin: 'var(--cr-space-lg) 0 6px',
                  fontSize: 12,
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('ownListing')}
              </p>
              <DsButton dsVariant="primary" fullWidth href={editHref} style={{ height: 48 }}>
                {t('editListing')}
              </DsButton>
            </>
          ) : (
            <DsButton
              dsVariant="primary"
              fullWidth
              onClick={() => setInquiryOpen(true)}
              style={{ marginTop: 'var(--cr-space-lg)', height: 48 }}
            >
              {ctaLabel}
            </DsButton>
          )}
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'var(--cr-space-sm)' }}
          >
            <button type="button" onClick={shareLink} style={shareBtnStyle} aria-label={t('share')}>
              {copied ? <Check size={14} aria-hidden /> : <Share2 size={14} aria-hidden />}
              {copied ? t('copied') : t('share')}
            </button>
            <button
              type="button"
              onClick={shareWhatsApp}
              style={shareBtnStyle}
              aria-label={t('whatsapp')}
            >
              <MessageCircle size={14} aria-hidden />
              {t('whatsapp')}
            </button>
          </div>
        </>
      )}

      {/* Trust lines: only claims we can stand behind - the verified marker
          (real allowance flag) + the mediator model (we never hold the money). */}
      <div
        style={{
          marginTop: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {listing.verified && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11.5,
              color: 'var(--cr-text-3)',
            }}
          >
            <ShieldCheck
              size={14}
              aria-hidden
              style={{ flex: 'none', color: 'var(--cr-success, var(--cr-primary))' }}
            />
            {t('trustVerified')}
          </span>
        )}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11.5,
            color: 'var(--cr-text-3)',
          }}
        >
          <CheckCircle2
            size={14}
            aria-hidden
            style={{ flex: 'none', color: 'var(--cr-success, var(--cr-primary))' }}
          />
          {t('trustNoPayment')}
        </span>
      </div>
    </div>
  );

  // ── Trade terms card (rail): dispatch / payment / returns ──────────────────
  // Dispatch shows the seller's own prose when set, else the structured lead
  // time (backend `tradeTerms` + `leadTimeDays`); the other rows are prose-only.
  const dispatchText = listing.tradeTerms?.dispatch?.trim() || null;
  const paymentText = listing.tradeTerms?.payment?.trim() || null;
  const returnsText = listing.tradeTerms?.returns?.trim() || null;
  const tradeTermRows: { key: string; icon: typeof Truck; label: string; value: string }[] = [];
  if (dispatchText || listing.leadTimeDays != null) {
    tradeTermRows.push({
      key: 'dispatch',
      icon: Truck,
      label: t('ttDispatch'),
      value: dispatchText ?? t('leadTime', { days: listing.leadTimeDays ?? 0 }),
    });
  }
  if (paymentText) {
    tradeTermRows.push({
      key: 'payment',
      icon: FileText,
      label: t('ttPayment'),
      value: paymentText,
    });
  }
  if (returnsText) {
    tradeTermRows.push({
      key: 'returns',
      icon: ShieldCheck,
      label: t('ttReturns'),
      value: returnsText,
    });
  }
  const tradeTermsCard =
    tradeTermRows.length > 0 ? (
      <div style={{ ...cardStyle, padding: 0 }}>
        <h2
          style={{
            margin: 0,
            padding: 'var(--cr-space-md) var(--cr-space-lg) 0',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
          }}
        >
          {t('tradeTermsTitle')}
        </h2>
        <div style={{ padding: '6px 0 4px' }}>
          {tradeTermRows.map((row) => {
            const RowIcon = row.icon;
            return (
              <div
                key={row.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '9px var(--cr-space-lg)',
                  fontSize: 12.5,
                  color: 'var(--cr-text-2)',
                }}
              >
                <RowIcon
                  size={16}
                  aria-hidden
                  style={{ flex: 'none', marginTop: 1, color: 'var(--cr-text-4)' }}
                />
                <span style={{ lineHeight: 1.45 }}>
                  <b style={{ color: 'var(--cr-text)', fontWeight: 700 }}>{row.label}:</b>{' '}
                  {row.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  // ── "More from this shop" rail card (prototype compact rows) ───────────────
  const siblingPrice = (s: ConnectListingRef): string =>
    s.priceType === 'negotiable' || s.priceMin == null ? t('negotiable') : formatRupees(s.priceMin);
  const moreFromCard =
    shop && (relatedSiblings.length > 0 || preview) ? (
      <div style={{ ...cardStyle, padding: 0 }}>
        <h2
          style={{
            margin: 0,
            padding: 'var(--cr-space-md) var(--cr-space-lg) 8px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
          }}
        >
          {t('moreFrom', { shop: shop.name })}
        </h2>
        {relatedSiblings.length > 0 ? (
          <div>
            {relatedSiblings.map((s) => (
              <Link
                key={s.listingId}
                href={`/connect/marketplace/listing/${s.listingId}`}
                className="no-underline"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px var(--cr-space-lg)',
                  borderTop: '1px solid var(--cr-border-light)',
                }}
              >
                <span
                  style={{
                    width: 48,
                    height: 48,
                    flex: 'none',
                    borderRadius: 'var(--cr-radius-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--cr-border-light)',
                    background: 'var(--cr-surface-2)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded thumbnail; the established Connect pattern is <img> + object-fit */}
                  <img
                    src={s.coverImage!}
                    alt=""
                    aria-hidden
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: 'var(--cr-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.title}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 2,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--cr-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {siblingPrice(s)}
                    {s.unit && s.priceMin != null && (
                      <span style={{ color: 'var(--cr-text-4)', fontWeight: 500 }}>
                        {' '}
                        {t(`units.${s.unit}`)}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              padding: '0 var(--cr-space-lg) var(--cr-space-md)',
              fontSize: 13,
              color: 'var(--cr-text-4)',
            }}
          >
            {tPrev('moreEmpty')}
          </p>
        )}
        {shopHref && relatedSiblings.length > 0 && (
          <Link
            href={shopHref}
            className="no-underline"
            style={{
              display: 'block',
              padding: '10px var(--cr-space-lg)',
              borderTop: '1px solid var(--cr-border-light)',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--cr-primary)',
            }}
          >
            {t('viewAll')} &rarr;
          </Link>
        )}
      </div>
    ) : null;

  const checklistCard = (
    <div style={cardStyle}>
      <h2
        style={{
          margin: '0 0 var(--cr-space-sm)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--cr-text-4)',
        }}
      >
        {tPrev('checklistTitle')}
      </h2>
      {/* Progress: N of 6 ready. */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={checklist.length}
        aria-valuenow={doneCount}
        style={{
          height: 5,
          borderRadius: 999,
          background: 'var(--cr-surface-2)',
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: `${(doneCount / checklist.length) * 100}%`,
            height: '100%',
            background: ready ? 'var(--cr-success)' : 'var(--cr-primary)',
            transition: 'width 0.2s ease',
          }}
        />
      </div>
      <p style={{ margin: '0 0 var(--cr-space-sm)', fontSize: 12, color: 'var(--cr-text-4)' }}>
        {tPrev('progress', { done: doneCount, total: checklist.length })}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 7 }}>
        {checklist.map((item) => (
          <li
            key={item.key}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
          >
            <span
              aria-hidden
              style={{ color: item.done ? 'var(--cr-success)' : 'var(--cr-text-4)' }}
            >
              {item.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            </span>
            <span style={{ flex: 1, color: item.done ? 'var(--cr-text-3)' : 'var(--cr-text)' }}>
              {tPrev(`item.${item.key}`)}
            </span>
            {!item.done && (
              <Link href={editHref} style={{ color: 'var(--cr-primary)', fontWeight: 600 }}>
                {tPrev('fix')}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 'var(--cr-space-sm)',
          paddingTop: 'var(--cr-space-sm)',
          borderTop: '1px solid var(--cr-border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cr-space-sm)',
        }}
      >
        <span
          style={{
            alignSelf: 'flex-start',
            fontSize: 11.5,
            fontWeight: 700,
            padding: '2px 9px',
            borderRadius: 'var(--cr-radius-full)',
            background: ready
              ? 'var(--cr-success-bg, var(--cr-surface-2))'
              : 'var(--cr-warning-bg, #fef3c7)',
            color: ready ? 'var(--cr-success, var(--cr-primary))' : 'var(--cr-warning, #b45309)',
          }}
        >
          {ready ? tPrev('ready') : tPrev('improveCount', { count: missingCount })}
        </span>
        <DsButton dsVariant="primary" fullWidth loading={publishing} onClick={handlePublish}>
          {tPrev('publishListing')}
        </DsButton>
      </div>
    </div>
  );

  const sellerCard = (
    <div style={cardStyle}>
      <h2
        style={{
          margin: '0 0 var(--cr-space-sm)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--cr-text-4)',
        }}
      >
        {t('sellerTitle')}
      </h2>
      {seller ? (
        <PersonCard person={seller} />
      ) : (
        <Link
          href={`/connect/u/${listing.ownerUserId}`}
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-primary)' }}
        >
          {t('sellerFallback')}
        </Link>
      )}
      {/* Honest tenure stat: the seller's join date (backend `sellerMemberSince`)
          - we do not track years-in-business, so we never claim it. */}
      {listing.sellerMemberSince && (
        <p
          style={{
            margin: 'var(--cr-space-sm) 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--cr-text-3)',
          }}
        >
          <Clock size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
          {t('memberSince', { year: new Date(listing.sellerMemberSince).getFullYear() })}
        </p>
      )}
      {shop && shopHref && (
        <Link
          href={shopHref}
          className="no-underline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 'var(--cr-space-sm)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--cr-primary)',
          }}
        >
          {t('viewStorefront')} <ChevronRight size={13} aria-hidden />
        </Link>
      )}
    </div>
  );

  // For the owner viewing their own live listing, the buyer-facing seller card
  // is replaced with their shop's management entry.
  const ownerShopCard = shop ? (
    <div style={cardStyle}>
      <h2
        style={{
          margin: '0 0 6px',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--cr-text-4)',
        }}
      >
        {t('yourShop')}
      </h2>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--cr-text)' }}>
        {shop.name}
      </p>
      <Link
        href={`/connect/stores/${shop.id}`}
        className="no-underline"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 'var(--cr-space-sm)',
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--cr-primary)',
        }}
      >
        {t('manageShop')} <ChevronRight size={13} aria-hidden />
      </Link>
    </div>
  ) : null;

  return (
    <ConnectPage>
      {preview ? (
        <div
          role="status"
          style={{
            position: 'sticky',
            top: 'var(--cr-space-sm)',
            zIndex: 6,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--cr-space-sm)',
            marginBottom: 'var(--cr-space-md)',
            padding: '8px 12px',
            borderRadius: 'var(--cr-radius-md)',
            border: '1px solid var(--cr-primary-border, var(--cr-border))',
            background: 'var(--cr-wash-indigo)',
            color: 'var(--cr-primary)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Eye size={15} aria-hidden />
            {ready ? tPrev('bannerReady') : tPrev('bannerImprove', { count: missingCount })}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Link
              href={editHref}
              className="no-underline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--cr-primary)',
              }}
            >
              <Pencil size={13} aria-hidden /> {tPrev('backToEdit')}
            </Link>
            <DsButton dsVariant="primary" dsSize="sm" loading={publishing} onClick={handlePublish}>
              {tPrev('publish')}
            </DsButton>
          </span>
        </div>
      ) : shop && shopHref ? (
        // Breadcrumb: Shop > current product (the shop page is the product list).
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-1.5 text-[12.5px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          <Link href={shopHref} className="no-underline" style={{ color: 'var(--cr-primary)' }}>
            {shop.name}
          </Link>
          <ChevronRight size={13} aria-hidden />
          <span className="truncate" style={{ maxWidth: 320 }}>
            {listing.title}
          </span>
        </nav>
      ) : (
        <Link
          href="/connect/marketplace"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 'var(--cr-space-sm)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--cr-primary)',
            textDecoration: 'none',
          }}
        >
          <ChevronLeft size={15} aria-hidden />
          {t('back')}
        </Link>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] lg:gap-10">
        {/* Left: gallery, title/summary, specs, description, reviews (prototype
            order - everything a buyer reads). */}
        <div className="min-w-0">
          {gallery}
          {videoSection}
          {titleCard}
          {courseCard}
          {serviceCard}
          {specsCard}
          {detailsSection}
          <section style={{ ...cardStyle, marginTop: 'var(--cr-space-md)' }}>
            <SellerReviews
              subjectUserId={listing.ownerUserId}
              subjectName={seller?.name}
              initialAggregate={listing.rating}
            />
          </section>
          {/* Mobile-only ad: this page has no rail; below lg the aside stacks under
              the gallery, so the desktop boost card (in the aside) is hidden below
              lg and this inline block carries the same boost + Google slot. */}
          <MobileAdInline promoted={promoted} breakpoint="lg" />
        </div>

        {/* Right (sticky): buy box, seller / checklist, trade terms, more from
            this shop - everything a buyer acts on. */}
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-20">
          {buyBox}
          {preview ? checklistCard : isOwner ? ownerShopCard : sellerCard}
          {/* Desktop boost card (this page has no rail). Hidden below lg, where the
              MobileAdInline in the left column carries the same boost instead, so
              the ad never double-shows when the aside stacks under the gallery. */}
          {promoted && (
            <div className="hidden lg:block">
              <PromotedListingAdCard {...promoted} />
            </div>
          )}
          {tradeTermsCard}
          {moreFromCard}
          {/* Buyer-facing tips only - the owner does not need them about their
              own listing. */}
          {!preview && !isOwner && (
            <div style={cardStyle}>
              <p
                className="m-0 text-[12.5px] leading-relaxed"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {tRail('tipsBody')}
              </p>
            </div>
          )}
        </aside>
      </div>

      <SendInquiryModal
        listingId={listing._id}
        sellerName={seller?.name}
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        // Course (Institutes Phase 1): the modal title + intro read as "enrol"
        // rather than "contact seller". The inquiry payload/action are unchanged.
        enrol={isCourse}
      />
    </ConnectPage>
  );
}
