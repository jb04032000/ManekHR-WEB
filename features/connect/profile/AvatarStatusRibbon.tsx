'use client';

/**
 * AvatarStatusRibbon - a small status tag pinned to the profile photo (the
 * "HIRING" ribbon in the reference). Picks ONE intent by priority so the photo
 * never carries more than one badge. Reads only the openTo booleans; labels
 * live under connect.profile.intents.ribbon.*. Used by ProfileView header.
 * Gotcha: priority order is hiring > work > customOrders > deals.
 */
import { useTranslations } from 'next-intl';
import type { ConnectOpenTo } from '../profile.types';

// hiring first: a workshop owner advertising roles is the highest-intent signal.
// PAUSED 2026-06-09 - Connect open-to options: customOrders + deals dropped from
// the ribbon (revive by adding them back). hiring + work are mutually exclusive
// (enforced in the editor), so in practice at most one is ever active.
const PRIORITY: (keyof ConnectOpenTo)[] = ['hiring', 'work'];

export default function AvatarStatusRibbon({ openTo }: { openTo: ConnectOpenTo }) {
  const t = useTranslations('connect.profile.intents.ribbon');
  const active = PRIORITY.find((k) => openTo[k]);
  if (!active) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase"
      style={{
        padding: '2px 8px',
        borderRadius: 'var(--cr-radius-full)',
        background: 'var(--cr-primary)',
        color: '#ffffff',
      }}
    >
      {t(active)}
    </span>
  );
}
