'use client';

/**
 * FeedAdCard - a native in-feed "Promoted" card (mobile only; FeedList wraps it
 * in `md:hidden`). Matches PostCard chrome but stays clearly distinguishable: a
 * high-contrast "Promoted" label sits ABOVE the content (IAB Native Advertising
 * Playbook + FTC disclosure guidance), with an `InfoTooltip` "why am I seeing
 * this" (standing rule #17) and a "Hide this" dismiss. v1 content is first-party
 * house promos from `feed-ads`; labelled "Promoted" (not "Sponsored", which is
 * reserved for paid third-party inventory).
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Compass, UserRound, UsersRound, X } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import type { HousePromo, HousePromoId } from './feed-ads';

const ICONS: Record<HousePromoId, typeof UsersRound> = {
  network: UsersRound,
  profile: UserRound,
  explore: Compass,
};

interface FeedAdCardProps {
  promo: HousePromo;
  onDismiss: (id: HousePromoId) => void;
}

export default function FeedAdCard({ promo, onDismiss }: FeedAdCardProps) {
  const t = useTranslations('connect.feed.ads');
  const Icon = ICONS[promo.id];
  const heading = t(`${promo.id}.heading` as Parameters<typeof t>[0]);
  const body = t(`${promo.id}.body` as Parameters<typeof t>[0]);
  const cta = t(`${promo.id}.cta` as Parameters<typeof t>[0]);

  return (
    <article
      aria-label={`${t('label')}: ${heading}`}
      style={{
        border: '1px solid var(--cr-border-light)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        padding: 'var(--cr-space-md)',
      }}
    >
      {/* Disclosure row: the label sits ABOVE the content (high contrast), with
          the "why" affordance and a dismiss control. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--cr-text-3)',
            }}
          >
            {t('label')}
          </span>
          <InfoTooltip text={t('why')} body={t('whyBody')} />
        </span>
        <button
          type="button"
          onClick={() => onDismiss(promo.id)}
          aria-label={t('dismiss')}
          className="flex items-center justify-center rounded-full text-faint hover:text-heading"
          style={{
            width: 40,
            height: 40,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          aria-hidden
          style={{
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--cr-wash-indigo)',
            color: 'var(--cr-primary)',
          }}
        >
          <Icon size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--cr-text-1)' }}>
            {heading}
          </h3>
          <p
            style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--cr-text-3)' }}
          >
            {body}
          </p>
        </div>
      </div>

      <Link
        href={promo.href}
        className="no-underline"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          marginTop: 12,
          padding: '0 18px',
          borderRadius: 'var(--cr-radius-md)',
          background: 'var(--cr-primary)',
          color: 'var(--cr-surface)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {cta}
      </Link>
    </article>
  );
}
