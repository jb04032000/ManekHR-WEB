'use client';

/**
 * PrivacyBadge - small "Private to you" pill with an eye icon.
 *
 * Drops on cards / sections whose contents are visible ONLY to the signed-in
 * viewer (own-profile strength, future profile analytics, account-only
 * suggestions). Mirrors the LinkedIn pattern - explicit privacy marker reduces
 * the user's anxiety about what their public viewers can see.
 *
 * Caller MAY pass a custom `label` for a different shade of privacy (e.g.
 * `Only your connections`). Default reads the canonical `connect.profile`
 * namespace.
 */

import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PrivacyBadgeProps {
  /** Override the default "Private to you" label. */
  label?: string;
}

export default function PrivacyBadge({ label }: PrivacyBadgeProps) {
  const t = useTranslations('connect.profile');
  const text = label ?? t('privateToYou');
  return (
    <span
      aria-label={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        color: 'var(--cr-text-4)',
        background: 'var(--cr-surface-2)',
        border: '1px solid var(--cr-border-light)',
        borderRadius: 'var(--cr-radius-full)',
      }}
    >
      <Eye size={11} aria-hidden />
      <span>{text}</span>
    </span>
  );
}
