'use client';

/**
 * PromotedProfileAdCard - the in-feed promoted PROFILE card for the open-to-work
 * and hiring boosts. The profile analogue of the feed's promoted-post AdCard: a
 * "Promoted" disclosure + the advertiser's profile (avatar / name / headline) +
 * an intent badge + a "View profile" CTA, firing the SHARED MRC viewability +
 * click beacons (useAdBeacons) so the boost actually bills.
 *
 * The advertiser's profile is hydrated SSR (feed page -> hydratePeople) and passed
 * as a prop; this component issues no network requests. Rendered on BOTH mobile
 * and desktop (unlike house promos, which are mobile-only) so the boost reaches
 * the targeted audience everywhere. `kind` drives the badge + framing: an
 * open-to-work boost reaches employers; a hiring boost reaches workers.
 *
 * Cross-module: ConnectPerson (components/connect/PersonCard), useAdBeacons
 * (records to /connect/ads/events/*). Profile link -> /connect/u/[userId].
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Rocket, UserCheck, UserPlus } from 'lucide-react';
import type { ConnectPerson } from '@/components/connect';
import { useAdBeacons } from './use-ad-beacons';

export interface PromotedProfileAdCardProps {
  person: ConnectPerson;
  impressionToken: string;
  campaignId: string;
  /** open_to_work -> "Open to work" (to employers); hiring -> "Hiring" (to workers). */
  kind: 'open_to_work' | 'hiring';
}

export default function PromotedProfileAdCard({
  person,
  impressionToken,
  campaignId,
  kind,
}: PromotedProfileAdCardProps) {
  const t = useTranslations('connect.ads');
  // Analytics descriptor piggybacks the billing beacons: a first-party boost unit
  // in the feed (kind='boost' + campaignId). Mirrors AdCard's promoted branch.
  const { cardRef, onClick } = useAdBeacons(impressionToken, {
    placement: 'feed',
    kind: 'boost',
    campaignId,
  });

  const promotedLabel = t('promotedLabel');
  const isHiring = kind === 'hiring';
  const BadgeIcon = isHiring ? UserPlus : UserCheck;
  const badge = isHiring ? t('profileAd.hiringBadge') : t('profileAd.openToWorkBadge');
  const tagline = isHiring ? t('profileAd.hiringTagline') : t('profileAd.openToWorkTagline');
  const initial = (person.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div ref={cardRef}>
      {/* Disclosure tag above the card (IAB + FTC). */}
      <div aria-label={promotedLabel} role="note" style={{ marginBottom: 6, paddingLeft: 2 }}>
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
          <Rocket size={11} aria-hidden /> {promotedLabel}
        </span>
      </div>

      <Link
        href={`/connect/u/${person.userId}`}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 12px' }}>
          {person.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user avatar of unknown dimensions; the established Connect pattern is <img> + object-fit
            <img
              src={person.avatarUrl}
              alt=""
              aria-hidden
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                objectFit: 'cover',
                flex: 'none',
                background: 'var(--cr-surface-2)',
              }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                background: 'var(--cr-accent-light)',
                color: 'var(--cr-gold-700)',
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {initial}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--cr-primary)',
              }}
            >
              <BadgeIcon size={13} aria-hidden /> {badge}
            </span>
            <h3
              style={{
                margin: '2px 0 0',
                fontSize: 14.5,
                fontWeight: 700,
                color: 'var(--cr-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {person.name}
            </h3>
            <div
              style={{
                marginTop: 1,
                fontSize: 12.5,
                color: 'var(--cr-text-4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {person.headline?.trim() || tagline}
            </div>
          </div>
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
            {t('profileAd.viewProfile')}
          </span>
        </div>
      </Link>
    </div>
  );
}
