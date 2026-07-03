'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * Auth error-code localization (auth-hardening Pillar 3, AC-3.6).
 *
 * The backend returns structured auth failures as a stable `code` (e.g.
 * `OTP_LOCKED`, `SESSION_LIMIT_REACHED`, `PIN_INCORRECT`). Every code listed
 * here has a translation under `auth.errors.codes.<CODE>` in ALL FOUR locales
 * (en / gu / gu-en / hi-en) so the UI shows a localized, plain-language message
 * instead of the raw BE string. `check:i18n` enforces the parity.
 *
 * Cross-module: BE codes are thrown from `crewroster-backend` auth/sms-otp/pin
 * services + the team-invite + sessions paths. Keep this set in sync with the
 * BE error codes the user can actually see; an unknown code falls back to the
 * generic `auth.errors.codes.fallback`.
 *
 * Usage:
 *   const tAuthCode = useAuthErrorMessage();
 *   const msg = tAuthCode(codeFromBackend, rawBackendMessage);
 */

/** The BE auth error codes that have a localized message. */
export const LOCALIZED_AUTH_ERROR_CODES = [
  'OTP_RATE_LIMITED',
  'OTP_LOCKED',
  'OTP_INCORRECT',
  'OTP_EXPIRED',
  'INVITE_EXPIRED',
  'INVITE_IDENTIFIER_MISMATCH',
  'SESSION_LIMIT_REACHED',
  'PIN_INCORRECT',
  'PIN_LOCKOUT_FORGOT_REQUIRED',
  'FORGOT_RESET_CLAIM_REQUIRED',
  // Re-signup during the 30-day deletion grace (Option B, ACCOUNT-DELETION §9):
  // the BE register path returns this when the typed email/mobile belongs to a
  // whole-account deletion still recoverable. Localized so the signup screen
  // shows "scheduled for deletion - contact us to recover" in all four locales
  // instead of the raw BE string. Mirrors the suspended-LOGIN notice.
  'ACCOUNT_SCHEDULED_FOR_DELETION',
  // Synthesised by the FE (not the BE) when a server action hits a transport
  // failure (backend down / DNS / connection refused / timeout). Emitted by
  // `extractErrorCode` in lib/actions/auth.actions.ts so the auth screens show
  // the localized "couldn't reach the server" copy instead of a raw axios
  // string. Keep in sync with NETWORK_UNREACHABLE_CODE there + the
  // NETWORK_UNREACHABLE key under auth.errors.codes in all four locales.
  'NETWORK_UNREACHABLE',
] as const;

export type LocalizedAuthErrorCode = (typeof LOCALIZED_AUTH_ERROR_CODES)[number];

function isLocalizedCode(code: string | undefined | null): code is LocalizedAuthErrorCode {
  return !!code && (LOCALIZED_AUTH_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Returns a resolver `(code, rawFallback?) => string`:
 *   - a known code -> its localized `auth.errors.codes.<CODE>` message,
 *   - an unknown code -> the raw BE message if provided, else the generic
 *     localized `auth.errors.codes.fallback`.
 *
 * Client-only (uses next-intl). Memoized so the resolver is referentially
 * stable for `useCallback`/`useMemo` consumers.
 */
export function useAuthErrorMessage() {
  const t = useTranslations('auth.errors.codes');
  return useCallback(
    (code: string | undefined | null, rawFallback?: string | null): string => {
      if (isLocalizedCode(code)) return t(code);
      if (rawFallback && rawFallback.trim()) return rawFallback;
      return t('fallback');
    },
    [t],
  );
}
