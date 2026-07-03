/**
 * Sentry edge-runtime init.
 *
 * Loaded by `instrumentation.ts → register()` when NEXT_RUNTIME === 'edge'.
 * Currently used by `middleware.ts`. Edge runtime ships a slim Sentry SDK
 * (no profiling, limited integrations).
 *
 * Empty SENTRY_DSN → SDK disabled (safe no-op).
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
  beforeSend: (event) => redactPii(event),
});
