import { env } from '@/lib/env';

/**
 * SMS-OTP test ("mock") mode - the single front-end chokepoint for the fixed
 * dev code 123456 and the "test mode" banner.
 *
 * What it does: decides whether the UI may surface OTP test-mode at all, and
 * produces the OTP-box seed value for a given backend runtime mock signal.
 *
 * Extra lock (go-live, 2026-06-21): the fake code + banner may appear ONLY in a
 * non-production build. In a real `next build` deploy (`env.isProd`) they are
 * hard-off, so even if NEXT_PUBLIC_AUTH_OTP_MOCK is wrongly left 'true' on the
 * live web, or the backend sends a stray `mockMode: true`, real users can never
 * see the fixed code. Mirrors the backend main.ts boot-guard, which refuses to
 * start with AUTH_OTP_MOCK on in production. `next dev` (local + e2e) is
 * unaffected, so the auth e2e suite that signs in with 123456 keeps working.
 *
 * Cross-module: MockOtpBanner.tsx (banner gate), OtpVerifyMode.tsx +
 * app/auth/verify-mobile/page.tsx (OTP-box prefill). The runtime `mockMode`
 * signal originates in the backend /auth/send-otp response (lib/actions/auth.actions.ts).
 * Watch: keep the prod gate in lockstep with the backend - if the BE ever
 * allows mock in prod via an override, this stays off by design.
 */

/** Fixed development OTP - never sent over SMS; only honored in dev/e2e. */
const MOCK_OTP_CODE = '123456';

/** Whether the UI may surface OTP test-mode at all (non-production builds only). */
export const OTP_MOCK_UI_ALLOWED = !env.isProd;

/**
 * OTP-box seed for a given backend runtime mock signal. Returns the fixed dev
 * code only when mock is on AND this is a non-production build; '' otherwise.
 */
export function otpMockSeed(runtimeMockMode: boolean | undefined): string {
  return runtimeMockMode && OTP_MOCK_UI_ALLOWED ? MOCK_OTP_CODE : '';
}
