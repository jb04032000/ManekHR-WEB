/**
 * Sentry server-side init (Node.js runtime).
 *
 * Loaded by `instrumentation.ts → register()` when NEXT_RUNTIME === 'nodejs'.
 * Captures Server Action / RSC / Route Handler / middleware errors.
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
  // Scrub PAN/Aadhaar/bank/secret-shaped data from server-action / RSC / route
  // handler errors before they leave the process (DPDP + payroll).
  beforeSend: (event) => redactPii(event),
});
