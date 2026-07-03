/**
 * PII redaction for Sentry events (launch security — Workstream F). Mirror of the
 * backend `crewroster-backend/src/common/observability/scrub-pii.ts` — keep the two
 * in sync. The product handles PAN / Aadhaar / bank data; an error report must
 * never carry that to a third party (DPDP + duty of care). Wired into the Sentry
 * `beforeSend` hook in the browser / server / edge configs.
 *
 * Over-redacts on purpose: (1) values under a sensitive KEY name are dropped;
 * (2) PAN/Aadhaar-shaped tokens in any STRING are masked. Recurses with a depth
 * cap + cycle guard so a self-referential event can never throw or loop.
 */

const REDACTED = '[redacted]';
const REDACTED_ID = '[redacted-id]';
const MAX_DEPTH = 8;

const SENSITIVE_KEY_PARTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'otp',
  'pan',
  'aadhaar',
  'aadhar',
  'bankaccount',
  'accountnumber',
  'accountno',
  'ifsc',
  'cvv',
  'apikey',
  'api_key',
  'privatekey',
];

const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi;
const AADHAAR_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => k.includes(part));
}

function scrubString(value: string): string {
  return value.replace(PAN_RE, REDACTED_ID).replace(AADHAAR_RE, REDACTED_ID);
}

function redact(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return value;
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(val, depth + 1, seen);
  }
  return out;
}

/** Return a redacted deep clone of `value` (objects/arrays/strings scanned). */
export function redactPii<T>(value: T): T {
  return redact(value, 0, new WeakSet()) as T;
}
