'use client';

/**
 * NetworkTabStates - the shared loading + error states for the Network tabs.
 *
 * `NetworkTabSkeleton` backs in-tab refetches (a sub-box switch, a filter
 * change) where the route-level `loading.tsx` no longer applies.
 * `NetworkTabError` is the recoverable in-tab failure state for those same
 * client-side refetches.
 */

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';

/** A list of pulsing person-row placeholders for an in-tab refetch. */
export function NetworkTabSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul
      aria-hidden
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--cr-space-sm)',
            padding: '14px 4px',
            borderBottom: '1px solid var(--cr-border-light)',
          }}
        >
          <span
            className="skeleton"
            style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }}
          />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="skeleton" style={{ width: '40%', height: 12 }} />
            <span className="skeleton" style={{ width: '62%', height: 10 }} />
          </span>
          <span className="skeleton" style={{ width: 84, height: 30, borderRadius: 8 }} />
        </li>
      ))}
    </ul>
  );
}

/** A recoverable failure state for an in-tab fetch. */
export function NetworkTabError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('connect.network');
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--cr-space-sm)',
        padding: 'var(--cr-space-xl) var(--cr-space-md)',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--cr-error-bg)',
          color: 'var(--cr-error)',
        }}
      >
        <TriangleAlert size={22} />
      </span>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text)' }}>
        {t('loadErrorTitle')}
      </h2>
      <p
        style={{
          margin: 0,
          maxWidth: 360,
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--cr-text-4)',
        }}
      >
        {t('loadError')}
      </p>
      <DsButton
        dsVariant="ghost"
        dsSize="sm"
        onClick={onRetry}
        style={{ marginTop: 'var(--cr-space-xs)' }}
      >
        {t('retry')}
      </DsButton>
    </div>
  );
}
