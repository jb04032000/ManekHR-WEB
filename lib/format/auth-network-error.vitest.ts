import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { isNetworkError, NETWORK_UNREACHABLE_MESSAGE } from './http-errors';
import { LOCALIZED_AUTH_ERROR_CODES } from './auth-error-codes';
import en from '@/app/messages/en.json';
import gu from '@/app/messages/gu.json';
import guEn from '@/app/messages/gu-en.json';
import hiEn from '@/app/messages/hi-en.json';

/**
 * Auth network-error contract (sign-in backend-down bugfix).
 *
 * 1. The auth server actions classify a transport failure as NETWORK_UNREACHABLE
 *    (stable code) + the friendly fallback (never a raw axios string). This
 *    re-implements the exact classification `extractError`/`extractErrorCode`
 *    in lib/actions/auth.actions.ts run, against the same shared predicate they
 *    use - the action file is `'use server'` with server-only imports, so we
 *    pin the logic via the shared building blocks rather than importing it.
 * 2. NETWORK_UNREACHABLE is a known localized code with a non-empty translation
 *    in all four locales (en / gu / gu-en / hi-en) so useAuthErrorMessage
 *    renders localized copy. Mirrors what `check:i18n` enforces at build time.
 */

const NETWORK_UNREACHABLE_CODE = 'NETWORK_UNREACHABLE';
const RAW_TIMEOUT = 'timeout of 15000ms exceeded';

// Pure replica of the auth-path resolution (auth.actions.ts):
//   extractErrorCode -> NETWORK_UNREACHABLE when isNetworkError(e)
//   extractError     -> NETWORK_UNREACHABLE_MESSAGE when isNetworkError(e)
function authResolve(e: unknown): { code: string | undefined; message: string } {
  if (isNetworkError(e)) {
    return { code: NETWORK_UNREACHABLE_CODE, message: NETWORK_UNREACHABLE_MESSAGE };
  }
  return { code: undefined, message: 'unchanged' };
}

function axiosNetworkError(message: string, code: string): AxiosError {
  const err = new AxiosError(message);
  err.code = code;
  return err;
}

describe('auth path - network failure -> NETWORK_UNREACHABLE', () => {
  it('axios timeout (ECONNABORTED) yields the code + friendly message', () => {
    const res = authResolve(axiosNetworkError(RAW_TIMEOUT, 'ECONNABORTED'));
    expect(res.code).toBe(NETWORK_UNREACHABLE_CODE);
    expect(res.message).toBe(NETWORK_UNREACHABLE_MESSAGE);
    expect(res.message).not.toContain('timeout of');
  });

  it('axios connection refused (ERR_NETWORK) yields the code + friendly message', () => {
    const res = authResolve(axiosNetworkError('Network Error', 'ERR_NETWORK'));
    expect(res.code).toBe(NETWORK_UNREACHABLE_CODE);
    expect(res.message).toBe(NETWORK_UNREACHABLE_MESSAGE);
  });

  it('serialised plain Error("timeout of 15000ms exceeded") yields the code + friendly message', () => {
    const res = authResolve(new Error(RAW_TIMEOUT));
    expect(res.code).toBe(NETWORK_UNREACHABLE_CODE);
    expect(res.message).toBe(NETWORK_UNREACHABLE_MESSAGE);
    expect(res.message).not.toContain('15000');
  });

  it('non-network errors do NOT get the network code', () => {
    expect(authResolve(new Error('Incorrect password')).code).toBeUndefined();
  });
});

describe('NETWORK_UNREACHABLE localization', () => {
  it('is registered as a localized auth error code', () => {
    expect(LOCALIZED_AUTH_ERROR_CODES).toContain(NETWORK_UNREACHABLE_CODE);
  });

  const locales: ReadonlyArray<[string, Record<string, unknown>]> = [
    ['en', en as Record<string, unknown>],
    ['gu', gu as Record<string, unknown>],
    ['gu-en', guEn as Record<string, unknown>],
    ['hi-en', hiEn as Record<string, unknown>],
  ];

  it.each(locales)('has a non-empty %s translation under auth.errors.codes', (_name, bundle) => {
    const codes = (bundle.auth as { errors?: { codes?: Record<string, string> } })?.errors?.codes;
    const value = codes?.[NETWORK_UNREACHABLE_CODE];
    expect(typeof value).toBe('string');
    expect((value ?? '').trim().length).toBeGreaterThan(0);
    // Must never be the raw axios string in any locale.
    expect(value).not.toContain('15000ms');
  });
});
