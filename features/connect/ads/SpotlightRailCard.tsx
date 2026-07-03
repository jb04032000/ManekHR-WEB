'use client';

/**
 * SpotlightRailCard - the premium right-rail card for a Spotlight boost (Phase 2).
 * One card that renders ANY boost kind (the Spotlight auction is unified) with the
 * REAL per-kind detail it already carries (price / wage / quantity / intent /
 * snippet), a gold "Spotlight" disclosure pill, a media header, and a tap-through
 * that fires the shared MRC beacons so the premium placement bills. Rendered at
 * the top of the feed right rail (desktop) AND in the mobile-only feed slot
 * (FeedScreen). The hydrated entity rode down from the server as a
 * `FeedSponsoredCard` (feed/feed-ads.ts), so this issues no network requests.
 *
 * Per-kind data is read ONLY from the real types (marketplace ListingDetail,
 * jobs Job, rfq RfqDetail, components/connect ConnectPerson, feed HydratedFeedItem)
 * - a missing field degrades gracefully (the line is dropped, never invented).
 *
 * Cross-module: useAdBeacons -> /connect/ads/events/*; categoryLabel +
 * formatRupees mirror the marketplace price logic; intent pill + headline tagline
 * reuse the same i18n the PromotedProfileAdCard uses. Gotcha: keep the price /
 * wage / openings rendering in sync with the listing/job/rfq cards if those move.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Briefcase,
  ChevronRight,
  FileText,
  Newspaper,
  Package,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAdBeacons } from './use-ad-beacons';
import { categoryLabel } from '../search.types';
import { formatRupees } from '../marketplace/format';
import type { FeedSponsoredCard } from '../feed/feed-ads';

/** Join the present meta parts with a dot separator (drops empty/undefined). */
function metaLine(...parts: (string | null | undefined)[]): string | null {
  const kept = parts.filter((p): p is string => !!p && p.trim().length > 0);
  return kept.length ? kept.join(' · ') : null;
}

export default function SpotlightRailCard({ card }: { card: FeedSponsoredCard }) {
  const t = useTranslations('connect.ads');
  const tCat = useTranslations('connect.search.listing.category');
  const tDetail = useTranslations('connect.marketplace.detail');
  const tUnits = useTranslations('connect.marketplace.card.units');
  const tJobs = useTranslations('connect.jobs');
  const { cardRef, onClick } = useAdBeacons(card.impressionToken, {
    placement: 'spotlight_rail',
    kind: 'boost',
    campaignId: card.campaignId,
  });

  // Resolve the per-kind render model from REAL fields only. `media` is either a
  // cover/avatar image (rendered as a band/round) or a tinted icon plate.
  let title = '';
  let href = '#';
  let image: string | null = null;
  let icon: LucideIcon = Newspaper;
  let round = false; // profile avatar is round; everything else is a square plate
  let primary: { text: string; soft?: boolean } | null = null; // bold fact line
  let meta: string | null = null; // muted sub-line
  let snippet: string | null = null; // post body (2-line clamp, no meta)

  switch (card.kind) {
    case 'listing': {
      const l = card.listing;
      title = l.title;
      href = `/connect/marketplace/listing/${l._id}`;
      image = l.images?.[0] ?? null;
      icon = Package;
      // Mirror the marketplace listing-card price logic: negotiable pill, a range,
      // or a single bound; append the unit suffix when a real unit is set.
      if (l.priceType === 'negotiable' || l.priceMin == null) {
        primary = { text: tDetail('negotiable'), soft: true };
      } else {
        const unitSuffix = l.unit ? ` ${tUnits(l.unit)}` : '';
        const text =
          l.priceType === 'range' && l.priceMax != null && l.priceMax > l.priceMin
            ? tDetail('priceRange', {
                min: formatRupees(l.priceMin),
                max: formatRupees(l.priceMax),
              })
            : formatRupees(l.priceMin);
        primary = { text: `${text}${unitSuffix}` };
      }
      meta = metaLine(categoryLabel(l.category, tCat), l.location?.district);
      break;
    }
    case 'job': {
      const j = card.job;
      title = j.title;
      href = `/connect/jobs/${j._id}`;
      icon = Briefcase;
      // PRIMARY = wage when set (range or single bound) + the wage-type suffix.
      if (j.wageMin != null) {
        const suffix = j.wageType ? ` ${tJobs(`wageType.${j.wageType}`)}` : '';
        const wage =
          j.wageMax != null && j.wageMax > j.wageMin
            ? `${formatRupees(j.wageMin)} - ${formatRupees(j.wageMax)}`
            : formatRupees(j.wageMin);
        primary = { text: `${wage}${suffix}` };
      }
      // META = role (or category) · openings (only when more than one) · district.
      const roleText =
        j.role && j.role.trim()
          ? j.role.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
          : categoryLabel(j.category, tCat);
      const openingsText = j.openings > 1 ? tJobs('openingsCount', { count: j.openings }) : null;
      meta = metaLine(roleText, openingsText, j.location?.district);
      break;
    }
    case 'rfq': {
      const r = card.rfq;
      title = r.title;
      href = `/connect/rfq/${r._id}`;
      icon = FileText;
      // PRIMARY = quantity + unit when present (both real RfqDetail fields).
      if (r.quantity != null) {
        const unitSuffix = r.unit ? ` ${tUnits(r.unit)}` : '';
        primary = { text: `${r.quantity.toLocaleString('en-IN')}${unitSuffix}` };
      }
      meta = metaLine(categoryLabel(r.category, tCat), r.location?.district);
      break;
    }
    case 'profile': {
      const p = card.person;
      title = p.name;
      href = `/connect/u/${p.userId}`;
      image = p.avatarUrl ?? null;
      icon = UserRound;
      round = true;
      // PRIMARY = the intent pill (reuses the PromotedProfileAdCard intent copy).
      const isHiring = card.intent === 'hiring';
      primary = {
        text: isHiring ? t('profileAd.hiringBadge') : t('profileAd.openToWorkBadge'),
        soft: true,
      };
      // META = headline when present (ConnectPerson has no trade/skills field).
      meta = p.headline?.trim() || null;
      break;
    }
    case 'post':
    default: {
      if (card.kind === 'post') {
        href = `/connect/posts/${card.post._id}`;
        snippet = card.post.body?.trim() || null;
      }
      icon = Newspaper;
      break;
    }
  }

  const displayTitle = title || t('spotlightRail.fallback');
  const Icon = icon;

  return (
    <div ref={cardRef}>
      {/* Gold "Spotlight" disclosure pill (premium feel). role=note + aria-label
          for assistive tech; the visible text is aria-hidden so it is announced once. */}
      <div aria-label={t('spotlightRail.label')} role="note" style={{ marginBottom: 8 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.03em',
            borderRadius: 999,
            color: 'var(--cr-gold-700)',
            background: 'var(--cr-accent-light)',
            border: '1px solid var(--cr-gold-300, var(--cr-accent-light))',
          }}
        >
          <Sparkles size={12} aria-hidden /> {t('spotlightRail.label')}
        </span>
      </div>

      <Link
        href={href}
        onClick={onClick}
        className="no-underline"
        style={{
          display: 'block',
          border: '1px solid var(--cr-border-light)',
          borderRadius: 'var(--cr-radius-lg)',
          overflow: 'hidden',
          background: 'var(--cr-surface)',
          boxShadow: 'var(--cr-shadow-xs, 0 1px 2px rgba(16,24,40,0.06))',
        }}
      >
        {/* Media header. listing cover -> 16:10 band; profile -> round avatar;
            job/rfq/post -> a tasteful tinted icon header. */}
        {image && !round ? (
          // eslint-disable-next-line @next/next/no-img-element -- user image of unknown dimensions; established Connect <img> + object-fit pattern
          <img
            src={image}
            alt=""
            aria-hidden
            style={{
              width: '100%',
              aspectRatio: '16 / 10',
              objectFit: 'cover',
              display: 'block',
              background: 'var(--cr-surface-2)',
            }}
          />
        ) : !round ? (
          <div
            aria-hidden
            style={{
              width: '100%',
              aspectRatio: '16 / 10',
              display: 'grid',
              placeItems: 'center',
              background: 'var(--cr-primary-light)',
              color: 'var(--cr-primary)',
            }}
          >
            <Icon size={30} aria-hidden />
          </div>
        ) : null}

        <div style={{ padding: '12px 14px' }}>
          {/* Profile avatar sits inline at the top of the body (round media). */}
          {round && (
            <div style={{ marginBottom: 8 }}>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- user avatar of unknown dimensions; established Connect <img> + object-fit pattern
                <img
                  src={image}
                  alt=""
                  aria-hidden
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block',
                    background: 'var(--cr-surface-2)',
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--cr-accent-light)',
                    color: 'var(--cr-gold-700)',
                    fontSize: 19,
                    fontWeight: 800,
                  }}
                >
                  {(title || '?').trim().charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}

          {/* A post has no title/price; render its body snippet (2-line clamp). */}
          {snippet ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.45,
                color: 'var(--cr-text-2)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {snippet || displayTitle}
            </p>
          ) : (
            <>
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: 'var(--cr-text)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {displayTitle}
              </h3>
              {primary && (
                <div
                  style={{
                    marginTop: 5,
                    display: 'inline-block',
                    fontSize: 13,
                    fontWeight: 700,
                    ...(primary.soft
                      ? {
                          padding: '2px 8px',
                          borderRadius: 999,
                          color: 'var(--cr-primary)',
                          background: 'var(--cr-primary-light)',
                        }
                      : { color: 'var(--cr-primary)' }),
                  }}
                >
                  {primary.text}
                </div>
              )}
              {meta && (
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    color: 'var(--cr-text-4)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {meta}
                </div>
              )}
            </>
          )}

          {/* "View" affordance so the card reads as tappable. */}
          <div
            aria-hidden
            style={{
              marginTop: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--cr-primary)',
            }}
          >
            {t('spotlightRail.view')} <ChevronRight size={14} aria-hidden />
          </div>
        </div>
      </Link>
    </div>
  );
}
