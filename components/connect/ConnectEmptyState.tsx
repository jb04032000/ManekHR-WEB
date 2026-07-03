'use client';

/**
 * ConnectEmptyState - the locked empty-state recipe (design-decisions doc §5.1):
 * icon · headline · subhead · primary CTA · optional secondary action.
 *
 * Designed for the day-1 karigar - copy must never assume the user already
 * knows what Connect is. Callers pass i18n'd strings.
 */

import type { ReactNode } from 'react';
import DsButton from '@/components/ui/DsButton';

interface EmptyAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface ConnectEmptyStateProps {
  /** A single decorative icon - lucide icon or monochrome SVG. */
  icon: ReactNode;
  title: string;
  description: string;
  primaryAction?: EmptyAction;
  secondaryAction?: EmptyAction;
  /** `page` = full-height standalone; `inline` = compact, embedded in a list/tab. */
  variant?: 'page' | 'inline';
}

function ActionButton({ action, primary }: { action: EmptyAction; primary: boolean }) {
  const variant = primary ? 'primary' : 'ghost';
  return (
    <DsButton dsVariant={variant} href={action.href} onClick={action.onClick}>
      {action.label}
    </DsButton>
  );
}

export default function ConnectEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = 'page',
}: ConnectEmptyStateProps) {
  const isPage = variant === 'page';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'var(--cr-space-sm)',
        padding: isPage
          ? 'var(--cr-space-2xl) var(--cr-space-lg)'
          : 'var(--cr-space-xl) var(--cr-space-md)',
        minHeight: isPage ? '60vh' : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'grid',
          placeItems: 'center',
          width: isPage ? 72 : 56,
          height: isPage ? 72 : 56,
          borderRadius: '50%',
          background: 'var(--cr-primary-light)',
          color: 'var(--cr-primary)',
          marginBottom: 'var(--cr-space-xs)',
        }}
      >
        {icon}
      </span>
      <h2
        style={{ margin: 0, fontSize: isPage ? 20 : 16, fontWeight: 600, color: 'var(--cr-text)' }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          maxWidth: 420,
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--cr-text-4)',
        }}
      >
        {description}
      </p>
      {(primaryAction || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--cr-space-sm)',
            justifyContent: 'center',
            marginTop: 'var(--cr-space-sm)',
          }}
        >
          {primaryAction && <ActionButton action={primaryAction} primary />}
          {secondaryAction && <ActionButton action={secondaryAction} primary={false} />}
        </div>
      )}
    </div>
  );
}
