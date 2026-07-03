/**
 * Next.js instrumentation hook.
 *
 * Runs once per process at boot. Loads the runtime-specific Sentry
 * initializer so error capture starts before request handling begins.
 *
 * Empty SENTRY_DSN → SDK initialises in disabled state and all calls
 * are no-ops. No conditional gating required at call sites.
 */

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Capture React Server Component / Route Handler errors.
export const onRequestError = Sentry.captureRequestError;
