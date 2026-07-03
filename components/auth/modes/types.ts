/**
 * Shared mode-state contract for the AuthClient sub-components. Each mode
 * receives the mode setter + shared identifier carryover; modes that issue
 * tokens additionally receive the doRedirect/setAuth callbacks.
 */

import type { AuthResult } from '@/types';
import type { SessionInfo } from '@/lib/api/modules/sessions.api';

/**
 * Product intent at signup time - derived from the `?for=` URL query OR set
 * inside `<IntentPicker>` when the user enters /auth without an intent. `null`
 * means "no intent yet" and SignupMode renders the picker sub-step. The two
 * non-null values mirror the dual-policy products.
 */
export type SignupIntent = 'connect' | 'erp' | null;

export type Mode =
  | 'check'
  | 'login'
  | 'login_choice'
  | 'register'
  | 'register_workspace'
  | 'signup'
  | 'email_otp_verify'
  | 'forgot'
  | 'reset_sent'
  | 'otp_send'
  | 'otp_verify';

export type OtpFlowType = 'login' | 'register' | 'forgot';

export interface OtpContext {
  mobile: string; // canonical 91XXXXXXXXXX
  flowType: OtpFlowType;
  resendCooldownSec: number;
  mockMode: boolean;
  /** Bumped on every successful (re)send so `<ResendCountdown>` resets. */
  resetKey: number;
  /**
   * True if the existing user has a password set. Used by OtpVerifyMode to
   * decide whether the "Use password instead" link is shown - hiding it for
   * OTP-only accounts avoids routing users to a screen they can't complete.
   */
  hasPassword?: boolean;
}

/**
 * Full payload captured by SignupMode for the new web combined-signup flow.
 * Stored in AuthClient state and submitted alongside the OTP via
 * /auth/verify-otp (mobile path) or /auth/register (email path) so the User
 * is created server-side. Lives only in component state - never persisted to
 * localStorage to avoid leaking the password in plaintext if the tab is
 * closed mid-flow.
 */
export interface SignupFormData {
  /** Set when channel is mobile. */
  mobile?: string;
  /** Set when channel is email. */
  email?: string;
  name: string;
  password: string;
  /**
   * Product the user chose at signup time - either from the `?for=` URL
   * query (URL-driven) or the in-form `<IntentPicker>` selection. Routed by
   * `AuthClient.handleAuthSuccess` for the post-signup redirect + policy
   * acceptance. Always non-null at submit time (the form submit is gated
   * behind a non-null `effectiveIntent`).
   */
  product: 'connect' | 'erp';
  /**
   * Referral code captured from `?ref=` query or the in-form input
   * (Task 22 - referral program). Only present when REFERRAL_ENABLED=true.
   * Passed through to /auth/verify-otp and /auth/register so the BE can
   * attribute the referral. Backend no-ops when the program is off.
   */
  referralCode?: string;
}

export interface SessionLimitData {
  activeSessions?: SessionInfo[];
}

export interface BaseModeProps {
  setMode: (m: Mode) => void;
  identifier: string;
  setIdentifier: (s: string) => void;
}

export interface AuthSuccessHandler {
  onAuthSuccess: (result: AuthResult) => Promise<void> | void;
  onSessionLimit: (data: SessionLimitData) => void;
}
