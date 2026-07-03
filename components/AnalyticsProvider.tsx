'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { env } from '@/lib/env';
import { initAnalytics } from '@/lib/analytics';

/**
 * Mounts PostHog on first client render and auto-tracks SPA route changes.
 *
 * Renders nothing - purely an effect host. Wrap children in app/layout.tsx.
 * Empty NEXT_PUBLIC_POSTHOG_KEY makes the whole tree a no-op (no init,
 * no event sent, no network request).
 */
export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!env.posthogKey) return;
    if (typeof window === 'undefined') return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
