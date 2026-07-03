import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import {
  isNetworkError,
  extractErrorMessage,
  NETWORK_UNREACHABLE_MESSAGE,
  friendlyFromAxiosMessage,
} from './http-errors';

/**
 * Network-failure safety net (auth-hardening bugfix).
 *
 * The sign-in screen was leaking the raw axios "timeout of 15000ms exceeded"
 * string when the backend was down. These tests pin the contract that the
 * shared extractors NEVER return a raw network/timeout message and ALWAYS map
 * it to the friendly NETWORK_UNREACHABLE_MESSAGE. Covers the three shapes the
 * FE can actually receive:
 *   1. axios timeout (ECONNABORTED / "timeout of 15000ms exceeded", no response)
 *   2. axios connection refused (ERR_NETWORK / ECONNREFUSED, no response)
 *   3. a plain serialised Error('timeout of 15000ms exceeded') (RSC boundary
 *      stripped the axios response)
 *
 * Cross-module: same predicate drives the auth path (lib/actions/auth.actions
 * -> extractError/extractErrorCode) and parseApiError (lib/utils).
 */

const RAW_TIMEOUT = 'timeout of 15000ms exceeded';

/** Build an axios error with no `response` (pure transport failure). */
function axiosNetworkError(message: string, code: string): AxiosError {
  const err = new AxiosError(message);
  err.code = code;
  // No `response` set = the request never reached a responding server.
  return err;
}

describe('isNetworkError', () => {
  it('detects an axios timeout with no response (ECONNABORTED)', () => {
    expect(isNetworkError(axiosNetworkError(RAW_TIMEOUT, 'ECONNABORTED'))).toBe(true);
  });

  it('detects an axios connection-refused with no response (ERR_NETWORK)', () => {
    expect(isNetworkError(axiosNetworkError('Network Error', 'ERR_NETWORK'))).toBe(true);
  });

  it('detects a plain serialised Error("timeout of 15000ms exceeded")', () => {
    expect(isNetworkError(new Error(RAW_TIMEOUT))).toBe(true);
  });

  it('detects node connection codes carried on a plain Error', () => {
    expect(isNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:3000'))).toBe(true);
    expect(isNetworkError(new Error('getaddrinfo ENOTFOUND api.example.com'))).toBe(true);
  });

  it('detects a serialised plain object { message } from the RSC boundary', () => {
    expect(isNetworkError({ message: RAW_TIMEOUT })).toBe(true);
  });

  it('does NOT treat an HTTP-status error as a network error', () => {
    const httpErr = new AxiosError('Request failed with status code 403');
    // Attach a response so it is classified as a real HTTP failure, not transport.
    httpErr.response = { status: 403, data: {}, statusText: '', headers: {}, config: {} as never };
    expect(isNetworkError(httpErr)).toBe(false);
  });

  it('does NOT treat an ordinary message Error as a network error', () => {
    expect(isNetworkError(new Error('Incorrect password'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe('extractErrorMessage - network safety net', () => {
  it('returns the friendly message for an axios timeout (no raw string)', () => {
    const msg = extractErrorMessage(axiosNetworkError(RAW_TIMEOUT, 'ECONNABORTED'), 'fallback');
    expect(msg).toBe(NETWORK_UNREACHABLE_MESSAGE);
    expect(msg).not.toContain('timeout of');
    expect(msg).not.toContain('15000');
  });

  it('returns the friendly message for an axios connection refused (no raw string)', () => {
    const msg = extractErrorMessage(axiosNetworkError('Network Error', 'ERR_NETWORK'), 'fallback');
    expect(msg).toBe(NETWORK_UNREACHABLE_MESSAGE);
    expect(msg).not.toMatch(/network error/i);
  });

  it('returns the friendly message for a serialised timeout Error (no raw string)', () => {
    const msg = extractErrorMessage(new Error(RAW_TIMEOUT), 'fallback');
    expect(msg).toBe(NETWORK_UNREACHABLE_MESSAGE);
    expect(msg).not.toContain('timeout of');
  });

  it('still surfaces a structured backend body for a real HTTP error', () => {
    const httpErr = {
      response: { status: 403, data: { message: 'You do not have permission.' } },
    };
    expect(extractErrorMessage(httpErr, 'fallback')).toBe('You do not have permission.');
  });

  it('maps a friendly status sentence when no body message is present', () => {
    const httpErr = { response: { status: 500, data: {} } };
    expect(extractErrorMessage(httpErr, 'fallback')).toContain('Something went wrong on our end');
  });

  it('returns an ordinary Error message unchanged (non-network)', () => {
    expect(extractErrorMessage(new Error('Incorrect password'), 'fallback')).toBe(
      'Incorrect password',
    );
  });
});

describe('friendlyFromAxiosMessage - unchanged status mapping', () => {
  it('maps a raw status-code message to a friendly sentence', () => {
    expect(friendlyFromAxiosMessage('Request failed with status code 404')).toContain(
      'could not be found',
    );
  });

  it('returns null for a non-status message (caller keeps its own)', () => {
    expect(friendlyFromAxiosMessage(RAW_TIMEOUT)).toBeNull();
  });
});
