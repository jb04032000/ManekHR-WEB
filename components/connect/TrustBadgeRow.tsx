'use client';

/**
 * TrustBadgeRow - tiered trust badges (design-decisions doc §3).
 *
 * Order is fixed: ERP-linked (Tier 0, the moat) → GST → Udyam → mobile → email.
 * On cards, cap at `max` (default 3) with a "+N more" pill. On profile / company
 * headers pass `max={Infinity}` to show every earned badge in one row.
 */

import { useTranslations } from 'next-intl';

export type TrustBadgeKind = 'erp' | 'verified' | 'broker' | 'gst' | 'udyam' | 'mobile' | 'email';

/** Tier order - never reorder; ERP-linked is always first (the moat), then the
 *  paid "Verified seller" marker (M2.3), then the self-declared "Broker" badge
 *  (Slice 1), then the statutory/contact badges. */
const TIER_ORDER: readonly TrustBadgeKind[] = [
  'erp',
  'verified',
  'broker',
  'gst',
  'udyam',
  'mobile',
  'email',
];

const BADGE_STYLE: Record<TrustBadgeKind, { bg: string; fg: string; dot: string }> = {
  erp: { bg: 'var(--cn-badge-erp-bg)', fg: 'var(--cn-badge-erp-fg)', dot: 'var(--cr-gold-400)' },
  verified: {
    bg: 'var(--cn-badge-gst-bg)',
    fg: 'var(--cn-badge-gst-fg)',
    dot: 'var(--cr-success-500)',
  },
  // Broker / dalal self-declaration (Slice 1). Uses the brand-gold ERP-badge
  // tokens (the premium-tier look) so the "Broker" badge reads as a trust signal
  // alongside the moat badge. Keep in sync with ProfileView header badges push.
  broker: { bg: 'var(--cn-badge-erp-bg)', fg: 'var(--cn-badge-erp-fg)', dot: 'var(--cr-gold-400)' },
  gst: { bg: 'var(--cn-badge-gst-bg)', fg: 'var(--cn-badge-gst-fg)', dot: 'var(--cr-success-500)' },
  udyam: {
    bg: 'var(--cn-badge-udyam-bg)',
    fg: 'var(--cn-badge-udyam-fg)',
    dot: 'var(--cr-info-500)',
  },
  mobile: {
    bg: 'var(--cn-badge-neutral-bg)',
    fg: 'var(--cn-badge-neutral-fg)',
    dot: 'var(--cr-neutral-400)',
  },
  email: {
    bg: 'var(--cn-badge-neutral-bg)',
    fg: 'var(--cn-badge-neutral-fg)',
    dot: 'var(--cr-neutral-400)',
  },
};

const LABEL_KEY: Record<TrustBadgeKind, string> = {
  erp: 'erpLinked',
  verified: 'verified',
  broker: 'broker',
  gst: 'gstVerified',
  udyam: 'udyamVerified',
  mobile: 'mobileVerified',
  email: 'emailVerified',
};

interface TrustBadgeRowProps {
  /** Earned badge kinds - order does not matter, the row sorts by tier. */
  badges: TrustBadgeKind[];
  /** Max badges before collapsing the rest into "+N more". Default 3 (card use). */
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export default function TrustBadgeRow({
  badges,
  max = 3,
  size = 'md',
  className,
}: TrustBadgeRowProps) {
  const t = useTranslations('connect.badge');
  if (badges.length === 0) return null;

  const ordered = TIER_ORDER.filter((kind) => badges.includes(kind));
  const shown = ordered.slice(0, max);
  const overflow = ordered.length - shown.length;

  const pad = size === 'sm' ? '2px 7px' : '3px 9px';
  const fontSize = size === 'sm' ? 10 : 11;

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}
    >
      {shown.map((kind) => {
        const s = BADGE_STYLE[kind];
        return (
          <span
            key={kind}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: pad,
              borderRadius: 'var(--cr-radius-full)',
              background: s.bg,
              color: s.fg,
              fontSize,
              fontWeight: 600,
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              aria-hidden
              style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot }}
            />
            {t(LABEL_KEY[kind])}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          style={{
            padding: pad,
            borderRadius: 'var(--cr-radius-full)',
            background: 'var(--cn-badge-neutral-bg)',
            color: 'var(--cn-badge-neutral-fg)',
            fontSize,
            fontWeight: 600,
          }}
        >
          {t('more', { count: overflow })}
        </span>
      )}
    </div>
  );
}
