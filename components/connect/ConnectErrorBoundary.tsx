'use client';

/**
 * ConnectErrorBoundary - component-level error boundary for Connect surfaces.
 *
 * Wrap rails, widgets, and lists so a single render failure degrades to a
 * recoverable fallback instead of blanking the screen. Route-level failures
 * are handled separately by Next.js `error.tsx` files.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import DsButton from '@/components/ui/DsButton';

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('connect.error');
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
        {t('title')}
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
        {t('body')}
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

interface ConnectErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback; receives a `reset` callback to clear the error. */
  fallback?: (reset: () => void) => ReactNode;
}

interface ConnectErrorBoundaryState {
  hasError: boolean;
}

export default class ConnectErrorBoundary extends Component<
  ConnectErrorBoundaryProps,
  ConnectErrorBoundaryState
> {
  state: ConnectErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ConnectErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, {
      tags: { module: 'connect', op: 'error-boundary' },
      extra: { componentStack: info.componentStack },
    });
  }

  reset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback(this.reset)
      ) : (
        <ErrorFallback onRetry={this.reset} />
      );
    }
    return this.props.children;
  }
}
