/**
 * Indian mobile validation - single source of truth for the FE.
 *
 * Mirrors the auth signup/login form (`components/auth/modes/CheckMode.tsx`)
 * and the BE DTO (`crewroster-backend/src/modules/auth/utils/mobile-normalizer.ts`
 * + `dto/sms-otp.dto.ts`). Reused by team-member create/edit so the rule a
 * user hit on signup is the same one team-add applies.
 */

/**
 * Optional `+91` / `91` prefix, then 10 digits starting 6/7/8/9
 * (TRAI-allocated mobile prefixes - excludes landlines / non-mobile bands).
 */
export const INDIAN_MOBILE_RE = /^(?:\+?91)?[6-9]\d{9}$/;

/**
 * Strip user-typed whitespace + dashes before testing. Mirrors how
 * CheckMode + auth/verify-mobile flow sanitise input.
 */
export function isValidIndianMobile(value: string | undefined | null): boolean {
  if (!value) return false;
  return INDIAN_MOBILE_RE.test(String(value).replace(/[\s-]/g, ''));
}
