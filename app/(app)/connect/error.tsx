'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';

/**
 * Error boundary for the `/connect/*` segment tree.
 * Catches errors thrown by Connect pages and server components - most often the
 * backend being unreachable - and offers a retry instead of leaking a raw error.
 *
 * Entry branching (redirect, lock, coming-soon, policy gate) now lives in
 * `app/connect/layout.tsx`. A layout-level throw is NOT caught by the segment's
 * own error.tsx (Next.js limitation) - it bubbles to a parent boundary - but
 * errors originating inside `/connect/*` pages do reach this boundary.
 *
 * Next.js handles `redirect()` / `notFound()` itself; those never reach here.
 */
export default function ConnectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('connectMode');

  useEffect(() => {
    console.error('[connect] route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center py-10">
      <div className="mx-auto max-w-[560px] text-center">
        <span
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: 'var(--cr-primary-light)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
          <img src="/manekhr-symbol.svg" alt="" aria-hidden className="h-11 w-11" />
        </span>
        <h1 className="font-display text-[clamp(1.55rem,1rem+1.9vw,2.25rem)] font-semibold text-heading">
          {t('entryErrorTitle')}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{t('entryErrorBody')}</p>
        <Button type="primary" size="large" className="mt-6" onClick={reset}>
          {t('entryErrorRetry')}
        </Button>
      </div>
    </div>
  );
}
