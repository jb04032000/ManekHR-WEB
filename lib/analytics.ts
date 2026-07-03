/**
 * Single analytics helper that fans events out to PostHog (product
 * analytics + session replay + feature flags) and Google Analytics 4
 * (marketing / SEO attribution).
 *
 * Empty `NEXT_PUBLIC_POSTHOG_KEY` or `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
 * makes the corresponding sink a no-op so the build never blocks on
 * missing credentials.
 *
 * Usage (client components only - `'use client'`):
 *   import { track, identify, reset } from '@/lib/analytics';
 *   track('payroll.run.completed', { workspaceId, headcount });
 */

import posthog from 'posthog-js';
import { env } from './env';

let posthogInitialized = false;

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  if (posthogInitialized) return;
  if (!env.posthogKey) return;

  posthog.init(env.posthogKey, {
    api_host: env.posthogHost,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    person_profiles: 'identified_only',
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
    },
  });
  posthogInitialized = true;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (env.posthogKey && posthogInitialized) {
    posthog.capture(event, properties);
  }
  if (env.ga4MeasurementId) {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    w.gtag?.('event', event, properties);
  }
}

export function identify(distinctId: string, traits?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (env.posthogKey && posthogInitialized) {
    posthog.identify(distinctId, traits);
  }
  if (env.ga4MeasurementId) {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    w.gtag?.('set', { user_id: distinctId, ...traits });
  }
}

export function reset(): void {
  if (typeof window === 'undefined') return;
  if (env.posthogKey && posthogInitialized) {
    posthog.reset();
  }
}

export function setFeatureFlag(flag: string, value: boolean | string): void {
  if (typeof window === 'undefined') return;
  if (env.posthogKey && posthogInitialized) {
    posthog.featureFlags.override({ [flag]: value });
  }
}

export function isFeatureEnabled(flag: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!env.posthogKey || !posthogInitialized) return false;
  return Boolean(posthog.isFeatureEnabled(flag));
}
