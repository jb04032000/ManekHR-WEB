/**
 * Sentry client-side instrumentation.
 *
 * Auto-loaded by Next.js for browser runtime. Runs once per page load.
 * Empty NEXT_PUBLIC_SENTRY_DSN → SDK disabled (safe no-op).
 */

import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';
import { redactPii } from '@/lib/observability/scrub-pii';

Sentry.init({
  dsn: env.sentryDsn,
  enabled: Boolean(env.sentryDsn),
  environment: env.sentryEnv,
  release: env.sentryRelease || undefined,
  tracesSampleRate: env.isProd ? 0.1 : 1.0,
  sendDefaultPii: false,
  // Scrub PAN/Aadhaar/bank/secret-shaped data before any event leaves the browser
  // (DPDP + payroll). Replay already masks all text; this covers error payloads.
  beforeSend: (event) => redactPii(event),
  // Session replay - capture for errors only by default to keep volume in
  // budget. Increase replaysSessionSampleRate later when needed.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
