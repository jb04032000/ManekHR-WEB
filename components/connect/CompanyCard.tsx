'use client';

/**
 * CompanyCard - a workshop / company page across discovery surfaces (the
 * `/connect/companies` directory; reusable elsewhere). A soft gradient cover band
 * + overlapping logo, the derived ERP-linked badge, location, an `about` snippet,
 * specialization tags, and the real catalog signals (products, seller rating, open
 * jobs) in the stat row with followers as a lighter meta line, plus a Follow action
 * (or a "Your company" marker on the caller's own page). Mirrors the canonical
 * Connect card rhythm; every value is real - the rating cell appears only when the
 * company has reviews, so an unrated company never shows a hollow "0.0", and no
 * response-time / "replies" stat is invented.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Briefcase,
  Check,
  ExternalLink,
  MapPin,
  Package,
  Plus,
  Settings2,
  Users,
} from 'lucide-react';
import { DsAvatar } from '@/components/ui';
import DsButton from '@/components/ui/DsButton';
import RatingStars from '@/components/connect/RatingStars';
import TrustBadgeRow from '@/components/connect/TrustBadgeRow';
// Per-item "Sample" disclosure pill on a seeded demo company page (company.isDemo).
import SampleBadge from '@/components/connect/SampleBadge';
import StartConversationButton from '@/features/connect/inbox/StartConversationButton';
import { categoryLabel } from '@/features/connect/search.types';
// Right-sized CDN variants: banner ~600px, logo ~160px (no-op until CDN env set).
import { imageVariant } from '@/lib/media/imageUrl';
import type { CompanyPageBrowseItem } from '@/features/connect/entities/entities.types';

interface CompanyCardProps {
  company: CompanyPageBrowseItem;
  /** The caller owns this page -> show a "Your company" marker + Manage action. */
  isOwn?: boolean;
  /** The caller already follows this page (seeds the Follow button). */
  following?: boolean;
  /** Toggle follow (owned by the parent so it can manage state + announcements). */
  onToggleFollow?: (company: CompanyPageBrowseItem) => void;
  /** The active specialization filter -> highlights the matching tag on the card. */
  activeSpecialization?: string;
}

/** Decorative cover gradients (the canonical prototype palette). Picked
 *  deterministically per page so a card's cover is stable across renders. */
const COVERS = [
  'linear-gradient(120deg,#2b3e86,#0B6E4F)',
  'linear-gradient(120deg,#dab94a,#b8901f)',
  'linear-gradient(120deg,#3aa0a0,#1f6f6f)',
  'linear-gradient(120deg,#8d6cc4,#5e3aa0)',
  'linear-gradient(120deg,#c4707f,#9a3d52)',
  'linear-gradient(120deg,#7c8497,#4a5266)',
];

function coverFor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) sum += seed.charCodeAt(i);
  return COVERS[sum % COVERS.length];
}

/** Join the populated parts of a location into a single readable line. */
function locationLine(loc: CompanyPageBrowseItem['location']): string {
  return [loc.city, loc.district, loc.state]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
}

export default function CompanyCard({
  company,
  isOwn = false,
  following = false,
  onToggleFollow,
  activeSpecialization,
}: CompanyCardProps) {
  const t = useTranslations('connect.companies');
  const tCat = useTranslations('connect.search.listing.category');
  // In-app link: the authenticated company view inside the Connect shell (the
  // public `/company/<slug>` is the logged-out / SEO surface).
  const href = `/connect/company/${company.slug}`;
  const place = locationLine(company.location);
  const tags = company.specialization.slice(0, 4);
  const extra = company.specialization.length - tags.length;
  // Show the rating cell only for companies with at least one review, so an
  // unrated company shows no rating rather than a hollow "0.0".
  const hasRating = Boolean(company.rating && company.rating.ratingCount > 0);

  return (
    <article
      className="flex h-full flex-col overflow-hidden transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)]"
      style={{
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border-light)',
      }}
    >
      {/* Cover band: the uploaded banner when present, else a deterministic
          decorative gradient. Follow / own-page marker overlays the top-end. */}
      <div
        className="relative h-14 overflow-hidden"
        style={{ background: company.banner ? 'var(--cr-surface-2)' : coverFor(company.id) }}
      >
        {company.banner && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded banner; next/image adds no optimisation here */}
            <img
              // Short cover band -> ~600px variant; lazy as cards sit below the fold.
              src={imageVariant(company.banner, { w: 600 })}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Scrim so the Follow / "Your company" pill stays legible over any
                banner (busy photos, light or dark). */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0) 70%)' }}
            />
          </>
        )}
        {isOwn ? (
          <span
            className="absolute end-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: 'var(--cr-success-bg)', color: 'var(--cr-success)' }}
          >
            <Check size={12} aria-hidden />
            {t('yourCompany')}
          </span>
        ) : (
          onToggleFollow && (
            <button
              type="button"
              aria-pressed={following}
              aria-label={
                following
                  ? t('unfollowAria', { name: company.name })
                  : t('followAria', { name: company.name })
              }
              onClick={() => onToggleFollow(company)}
              className="absolute end-2.5 top-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors"
              style={
                following
                  ? { background: 'var(--cr-primary)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.94)', color: 'var(--cr-primary)' }
              }
            >
              {following ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
              {following ? t('following') : t('follow')}
            </button>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4">
        {/* Overlapping logo tile. */}
        <Link
          href={href}
          aria-label={company.name}
          className="-mt-6 w-fit no-underline"
          style={{
            borderRadius: 'var(--cr-radius-lg)',
            padding: 3,
            background: 'var(--cr-surface)',
          }}
        >
          <DsAvatar
            name={company.name}
            src={imageVariant(company.logo || undefined, { w: 160 })}
            size={52}
          />
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-[15.5px] font-bold">
            <Link href={href} style={{ color: 'var(--cr-text)', textDecoration: 'none' }}>
              {company.name}
            </Link>
          </h3>
          {company.erpLinked && <TrustBadgeRow badges={['erp']} size="sm" />}
          {company.isDemo && <SampleBadge size="sm" />}
        </div>

        {/* Quiet meta line: location + followers (followers demoted here so the
            stat row can foreground the catalog signals). */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {place && (
            <span
              className="inline-flex items-center gap-1 text-[12px]"
              style={{ color: 'var(--cr-text-4)' }}
            >
              <MapPin size={12} aria-hidden />
              {place}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 text-[12px]"
            style={{ color: 'var(--cr-text-4)', fontVariantNumeric: 'tabular-nums' }}
          >
            <Users size={12} aria-hidden />
            <span className="font-semibold" style={{ color: 'var(--cr-text-3)' }}>
              {company.followerCount}
            </span>
            {t('statFollowers')}
          </span>
        </div>

        {company.about && (
          <p
            className="m-0 text-[12.5px]"
            style={{
              lineHeight: 1.5,
              color: 'var(--cr-text-3)',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {company.about}
          </p>
        )}

        {tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              // Highlight the tag matching the active specialization filter so the
              // reason this card matched is obvious (mirrors the reference's accent tag).
              const isActive = !!activeSpecialization && tag === activeSpecialization;
              return (
                <span
                  key={tag}
                  className="text-[11.5px] font-semibold"
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--cr-radius-full)',
                    background: isActive ? 'var(--cr-accent-light)' : 'var(--cr-surface-2)',
                    color: isActive ? 'var(--cr-gold-700)' : 'var(--cr-text-2)',
                  }}
                >
                  {categoryLabel(tag, tCat)}
                </span>
              );
            })}
            {extra > 0 && (
              <span className="self-center text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('moreTags', { count: extra })}
              </span>
            )}
          </div>
        )}

        {/* Real catalog signals: products + seller rating (only when reviewed) +
            open jobs, on one divided row. The rating cell is omitted entirely for
            unrated companies so the card never shows a hollow "0.0". */}
        <dl
          className="mt-2.5 flex items-stretch gap-0 border-t pt-2.5"
          style={{ borderColor: 'var(--cr-divider)' }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <dd
              className="m-0 inline-flex items-center gap-1.5 text-[14px] font-extrabold"
              style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
            >
              <Package size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
              {company.productCount}
            </dd>
            <dt className="text-[10.5px] font-semibold" style={{ color: 'var(--cr-text-4)' }}>
              {t('statProducts')}
            </dt>
          </div>

          {hasRating && company.rating && (
            <div
              className="flex min-w-0 flex-1 flex-col gap-0.5 ps-3"
              style={{ borderInlineStart: '1px solid var(--cr-divider)' }}
            >
              {/* `role="img"` collapses the inner star atom's own label so the
                  single localized `ratingAria` is the one announcement. */}
              <dd
                className="m-0 flex items-center"
                role="img"
                aria-label={t('ratingAria', {
                  avg: company.rating.ratingAvg.toFixed(1),
                  count: company.rating.ratingCount,
                })}
              >
                <RatingStars
                  value={company.rating.ratingAvg}
                  count={company.rating.ratingCount}
                  size={13}
                  showCount
                />
              </dd>
              <dt className="text-[10.5px] font-semibold" style={{ color: 'var(--cr-text-4)' }}>
                {t('statRating')}
              </dt>
            </div>
          )}

          <div
            className="flex min-w-0 flex-1 flex-col gap-0.5 ps-3"
            style={{ borderInlineStart: '1px solid var(--cr-divider)' }}
          >
            <dd
              className="m-0 inline-flex items-center gap-1.5 text-[14px] font-extrabold"
              style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
            >
              <Briefcase size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
              {company.openJobsCount}
            </dd>
            <dt className="text-[10.5px] font-semibold" style={{ color: 'var(--cr-text-4)' }}>
              {t('statOpenJobs')}
            </dt>
          </div>
        </dl>

        {/* Footer: a primary CTA that grows + a ghost secondary, matching the
            hub / manage cards. Non-owned offers Message (self-hides until the
            inbox module is live). */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          {isOwn ? (
            <>
              <DsButton
                dsVariant="primary"
                dsSize="sm"
                href={`/connect/pages/${company.id}`}
                icon={<Settings2 size={14} aria-hidden />}
                className="flex-1"
                style={{ minWidth: 110 }}
              >
                {t('manage')}
              </DsButton>
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                href={`/company/${company.slug}`}
                icon={<ExternalLink size={14} aria-hidden />}
              >
                {t('viewPublic')}
              </DsButton>
            </>
          ) : (
            <>
              <DsButton
                dsVariant="primary"
                dsSize="sm"
                href={href}
                icon={<ExternalLink size={14} aria-hidden />}
                className="flex-1"
                style={{ minWidth: 110 }}
              >
                {t('viewPage')}
              </DsButton>
              <StartConversationButton
                recipientUserId={company.ownerUserId}
                partyName={company.name}
                dsVariant="ghost"
                dsSize="sm"
              />
            </>
          )}
        </div>
      </div>
    </article>
  );
}
