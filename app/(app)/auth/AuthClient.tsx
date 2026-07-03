'use client';

/**
 * AuthClient - auth flow orchestrator (check / login / signup / OTP / register).
 *
 * Task 22 addition (2026-06-19, referral program): on first render reads
 * `?ref=` from the URL via `window.location.search` (lazy useState initializer;
 * SSR-safe because the lazy init only runs in the browser). When REFERRAL_ENABLED
 * the code is persisted to `localStorage` (key `cr_ref`) and a 30-day cookie
 * (also `cr_ref`) then forwarded to SignupMode via the `initialRefCode` prop.
 * Backend no-ops when the program is off (admin `enabled=false`).
 * Cross-module: referral-gate.ts / SignupMode.tsx / OtpVerifyMode.tsx / EmailOtpVerifyMode.tsx.
 * Watch: all window/localStorage/document access is in the lazy useState init
 * so there are no SSR hydration mismatches and no cascading render cycles.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useGoogleLogin } from '@react-oauth/google';
import * as Sentry from '@sentry/nextjs';
import { googleAuth, sendOtp, terminateAndLoginUnauth, terminateAndOtpLogin } from '@/lib/actions';
import { syncAuthCookie } from '@/lib/actions/cookies';
import { acceptConnectPolicy } from '@/features/connect/profile.actions';
import { acceptErpPolicy } from '@/features/policy/policy.actions';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { resolvePostAuthTarget } from '@/lib/auth/post-auth-target';
import { track } from '@/lib/analytics';
import SessionLimitModal from '@/components/sessions/session-limit-modal';
import { CheckMode } from '@/components/auth/modes/CheckMode';
import { LoginMode } from '@/components/auth/modes/LoginMode';
import { LoginChoiceMode } from '@/components/auth/modes/LoginChoiceMode';
import { RegisterMode } from '@/components/auth/modes/RegisterMode';
import { RegisterWorkspaceMode } from '@/components/auth/modes/RegisterWorkspaceMode';
import { SignupMode } from '@/components/auth/modes/SignupMode';
import { EmailOtpVerifyMode } from '@/components/auth/modes/EmailOtpVerifyMode';
import { ForgotMode } from '@/components/auth/modes/ForgotMode';
import { ResetSentMode } from '@/components/auth/modes/ResetSentMode';
import { OtpSendMode } from '@/components/auth/modes/OtpSendMode';
import { OtpVerifyMode } from '@/components/auth/modes/OtpVerifyMode';
import type {
  Mode,
  OtpContext,
  SessionLimitData,
  SignupFormData,
  SignupIntent,
} from '@/components/auth/modes/types';
import type { AuthResult } from '@/types';
// Referral program kill switch. The ?ref= capture + cr_ref cookie/localStorage
// write and SignupFormData.referralCode forwarding are all no-ops when false.
import { REFERRAL_ENABLED } from '@/features/connect/referrals/referral-gate';

/**
 * Try a policy-accept once, retry once on failure (network blip recovery).
 * Still-failing → log to Sentry + emit a PostHog event so the eventual
 * PolicyGate-as-safety-net trip has an audit trail. Never throws - signup
 * redirect must always proceed; the layout gate is the safety net.
 *
 * Returns `true` on success, `false` on confirmed failure. Callers ignore
 * the return today; future flows may key on it.
 */
async function acceptPolicyWithRetry(
  product: 'connect' | 'erp',
  accept: () => Promise<{ ok: true } | { ok: false; error?: string }>,
  distinctId: string | null,
): Promise<boolean> {
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await accept();
      if (res.ok) {
        // Confirms the stamp landed before the redirect carries the user
        // past the gate. If a freshly-signed-up user still sees the policy
        // gate, look in the browser console for this log being missing OR
        // followed by the FAILED log below.
        console.info(`[acceptPolicyWithRetry] ${product} policy stamped on attempt ${attempt}`);
        return true;
      }
      lastError = res.error ?? 'ok=false';
      if (attempt === 3) {
        Sentry.captureMessage('signup.acceptPolicy returned ok=false', {
          level: 'warning',
          tags: { module: 'auth', op: 'signup.acceptPolicy', product },
          extra: { error: lastError, attempts: 3 },
        });
      }
    } catch (err) {
      lastError = (err as Error)?.message ?? String(err);
      if (attempt === 3) {
        Sentry.captureException(err, {
          tags: { module: 'auth', op: 'signup.acceptPolicy', product },
        });
      }
    }
    // Linear backoff between retries - gives any pending Set-Cookie /
    // refresh-token rotation a window to commit before the next attempt.
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 150 * attempt));
    }
  }
  console.warn(
    `[acceptPolicyWithRetry] ${product} policy FAILED after 3 attempts - gate is now the safety net.`,
    { lastError },
  );
  // `track` is SSR-safe (no-ops when `window` is undefined) and a no-op
  // when `NEXT_PUBLIC_POSTHOG_KEY` is unset, so no extra guard is needed
  // here. `AuthClient.tsx` is a `'use client'` component, so the helper
  // only ever runs in the browser anyway.
  track('auth.policy_accept_failed_at_signup', { product, distinctId });
  return false;
}

/**
 * Orchestrator. Holds shared state (mode, identifier carryover, session-limit
 * modal state, OTP context) and delegates JSX to per-mode sub-components in
 * `components/auth/modes/`. Adds the SMS-OTP modes alongside the existing
 * password / Google / forgot flows.
 */
export default function AuthClient() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations('auth');
  const { setAuth, user, isHydrated, logout } = useAuthStore();
  const { setWorkspaces } = useWorkspaceStore();

  const initMode: Mode = params.get('mode') === 'register' ? 'register' : 'check';
  const [mode, setMode] = useState<Mode>(initMode);
  const [identifier, setIdentifier] = useState('');

  // Cross-mode auth-success handlers + session-limit modal state.
  const [sessionLimitModalOpen, setSessionLimitModalOpen] = useState(false);
  const [sessionLimitData, setSessionLimitData] = useState<SessionLimitData | null>(null);
  const [pendingPasswordCreds, setPendingPasswordCreds] = useState<{
    identifier: string;
    password: string;
  } | null>(null);
  const [pendingOtpCreds, setPendingOtpCreds] = useState<{
    mobile: string;
    otp?: string;
    /** MSG91 Widget channel — the verified access-token, forwarded to
     *  terminateAndOtpLogin instead of `otp`. See OtpVerifyMode's
     *  onSessionLimitWithOtp callback. */
    accessToken?: string;
  } | null>(null);

  // OTP-flow context (mobile + flowType + cooldown + mock signal).
  const [otpCtx, setOtpCtx] = useState<OtpContext | null>(null);
  // Email-OTP register context - independent from mobile otpCtx because the
  // shapes differ (no mockMode for email; no flowType branching).
  const [emailOtpCtx, setEmailOtpCtx] = useState<{
    resendCooldownSec: number;
    resetKey: number;
  } | null>(null);
  // Captured by RegisterMode (email password path) OR OtpVerifyMode (legacy
  // OTP-only path) for the workspace-setup step.
  const [registerData, setRegisterData] = useState<{
    name: string;
    identifier: string;
    password?: string;
  } | null>(null);
  // Captured by SignupMode (new web combined-signup flow) - name + password
  // are submitted server-side together with the OTP via /auth/verify-otp
  // so the User is created. Lives only in component state - never persisted
  // to localStorage.
  const [signupFormData, setSignupFormData] = useState<SignupFormData | null>(null);

  // Task 22 - referral code captured from ?ref= query or localStorage `cr_ref`.
  // Lazy initializer runs once on mount (client only). SSR-safe: useState lazy
  // init runs only in the browser when the component first mounts; `window`,
  // `localStorage`, and `document` are all available. Returns '' when
  // REFERRAL_ENABLED=false so the feature is a strict no-op when dark.
  const [capturedRefCode] = useState<string>(() => {
    if (!REFERRAL_ENABLED) return '';
    if (typeof window === 'undefined') return ''; // SSR guard
    const STORAGE_KEY = 'cr_ref';
    const CODE_RE = /^[A-Za-z2-9]{6,10}$/;
    // 1. URL query param (highest priority).
    const urlRef = new URLSearchParams(window.location.search).get('ref') ?? '';
    if (urlRef && CODE_RE.test(urlRef)) {
      // Persist to localStorage for subsequent /auth visits without the query.
      try {
        localStorage.setItem(STORAGE_KEY, urlRef);
      } catch {
        /* blocked */
      }
      // 30-day cookie so server actions can read it if needed.
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `${STORAGE_KEY}=${encodeURIComponent(urlRef)}; path=/; expires=${expires}; SameSite=Lax`;
      return urlRef;
    }
    // 2. Fall back to localStorage.
    try {
      const stored = localStorage.getItem(STORAGE_KEY) ?? '';
      if (stored && CODE_RE.test(stored)) return stored;
    } catch {
      /* localStorage blocked */
    }
    return '';
  });

  // Entry marker - landing pages link to `/auth?for=connect` or `/auth?for=erp`
  // to pin the signup intent. Absence triggers the in-form product picker (no
  // silent default). The picker's selection is owned by SignupMode and reaches
  // this layer via `SignupFormData.product` on the proceed callback - there is
  // no parent-side intent state, so the Change pill inside SignupMode stays
  // gated on the URL-driven prop only and remains meaningful across renders.
  const urlIntent: SignupIntent =
    params.get('for') === 'erp' ? 'erp' : params.get('for') === 'connect' ? 'connect' : null;

  useEffect(() => {
    // Auto-redirect ONLY when the user is ALREADY authenticated on landing
    // (e.g. they open /auth with a live session). It must NOT fire mid-signup:
    // `handleAuthSuccess` is the sole authority for where a fresh signup goes,
    // and this effect (triggered the instant `setAuth` runs) otherwise RACED
    // that explicit redirect and yanked a workspace-less ERP signup to
    // /connect/feed before the orchestrator could route it to
    // /auth/setup-workspace. Suppress it for every in-flight signup/verify mode,
    // not just register_workspace. See memory project_erp_connect_signup_misroute.
    const inFlightSignup =
      mode === 'register_workspace' ||
      mode === 'signup' ||
      mode === 'otp_verify' ||
      mode === 'email_otp_verify';
    if (isHydrated && user && !inFlightSignup) {
      // Loop-breaker: a server-gated route (e.g. the /connect layout) bounced us
      // here with `reauth=1` because it rejected the token server-side, yet the
      // client store still holds a `user` (stale session). Redirecting back would
      // ping-pong forever. Clear the stale session so the login form shows and the
      // user can re-authenticate. -> app/(app)/connect/layout.tsx
      if (params.get('reauth')) {
        logout();
        return;
      }
      // Single source of truth for the destination. A workspace-less ERP-intent
      // user (accepted ERP terms, not Connect) goes to /auth/setup-workspace, not
      // /connect/feed; Connect users still land on the feed. See
      // lib/auth/post-auth-target.ts.
      router.replace(resolvePostAuthTarget({ user, requestedRedirect: params.get('redirect') }));
    }
  }, [isHydrated, user, router, params, mode, logout]);

  const doRedirect = (
    loggedInUser?: {
      isAdmin?: boolean;
      hasWorkspace?: boolean;
      erpPolicyAcceptedAt?: string | null;
      connectPolicyAcceptedAt?: string | null;
    },
    mustResetPassword?: boolean,
  ) => {
    // Single source of truth for the post-auth destination (admin, forced
    // password reset, workspace-less ERP-intent -> setup-workspace, Connect ->
    // feed, otherwise dashboard) + safe `?redirect=` handling. See
    // lib/auth/post-auth-target.ts.
    router.replace(
      resolvePostAuthTarget({
        user: loggedInUser,
        requestedRedirect: params.get('redirect'),
        mustResetPassword,
      }),
    );
  };

  const handleAuthSuccess = async (result: AuthResult) => {
    // Register-flow branching: two variants share this path -
    //
    //   1. Web combined-signup (signupFormData present): the /auth/verify-otp
    //      call atomically created User + Workspace server-side. Workspace
    //      already exists, so we skip register_workspace and go straight to
    //      the dashboard (the PIN gate inside DashboardLayout routes to
    //      /auth/setup-pin if no PIN is set yet).
    //
    //   2. Legacy OTP-only register (no signupFormData - e.g. mobile-app):
    //      account exists with placeholder name, no workspace. Drop into
    //      register_workspace where the real name + workspace details get
    //      captured. We deliberately DO NOT call syncAuthCookie here - the
    //      httpOnly cookie is what middleware uses to detect authed-on-/auth
    //      and bounce to /dashboard. RegisterWorkspaceMode flushes the
    //      cookie itself AFTER the workspace POST succeeds.
    if (result.isNewUser && otpCtx?.flowType === 'register') {
      if (signupFormData) {
        // Person-only signup succeeded - the User has no workspace. Capture the
        // chosen product BEFORE clearing the form data so the policy + redirect
        // branch stays correct after the eager clear (which avoids holding the
        // password in memory longer than needed).
        const product = signupFormData.product;
        setSignupFormData(null);
        setAuth(result.user, result.accessToken, result.refreshToken);
        await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
        // Signup consented via the SignupMode checkbox - record the entry
        // product's policy. Best-effort: a failed write must not block the
        // redirect (the product's policy gate re-prompts if this did not land).
        // T5 swaps the silent .catch for retry + Sentry + PostHog observability.
        // Pass the freshly-minted access token to the policy-accept action.
        // The cookie set by `syncAuthCookie` may not yet be visible to a
        // back-to-back server action (Next.js Set-Cookie propagation race);
        // the fallback token bypasses the race via `serverHttp(fallbackToken)`.
        await acceptPolicyWithRetry(
          product,
          () =>
            product === 'erp'
              ? acceptErpPolicy(result.accessToken)
              : acceptConnectPolicy(result.accessToken),
          result.user?._id ?? null,
        );
        if (product === 'erp') {
          // `?flow=signup` marks this as the signup-cancel path so the
          // setup-workspace Back button signs out (vs returning to Connect for
          // an existing authed session).
          router.replace('/auth/setup-workspace?flow=signup');
        } else {
          doRedirect(result.user, result.mustResetPassword);
        }
        return;
      }
      // Variant 2 - legacy OTP-only path. Workspace creation pending.
      setRegisterData({
        name: '',
        identifier: otpCtx.mobile,
        password: undefined,
      });
      setMode('register_workspace');
      setAuth(result.user, result.accessToken, result.refreshToken, {
        skipCookieSync: true,
      });
      return;
    }
    // Email-combined-signup also reaches here (isNewUser=true but otpCtx is
    // null because the email channel uses /auth/email-otp/send-register
    // instead of /auth/send-otp). BE has already created Workspace
    // atomically - capture the chosen product before clearing form data so the
    // policy + redirect branch stays correct, then drop the captured password
    // from memory before we redirect.
    if (result.isNewUser && signupFormData?.email) {
      const product = signupFormData.product;
      setSignupFormData(null);
      setAuth(result.user, result.accessToken, result.refreshToken);
      await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
      // Signup consented via the SignupMode checkbox - record the entry
      // product's policy. Best-effort: a failed write must not block the
      // redirect (the product's policy gate re-prompts if this did not land).
      // T5 swaps the silent .catch for retry + Sentry + PostHog observability.
      // Pass the freshly-minted access token to the policy-accept action.
      // The cookie set by `syncAuthCookie` may not yet be visible to a
      // back-to-back server action (Next.js Set-Cookie propagation race);
      // the fallback token bypasses the race via `serverHttp(fallbackToken)`.
      await acceptPolicyWithRetry(
        product,
        () =>
          product === 'erp'
            ? acceptErpPolicy(result.accessToken)
            : acceptConnectPolicy(result.accessToken),
        result.user?._id ?? null,
      );
      if (product === 'erp') {
        router.replace('/auth/setup-workspace');
      } else {
        doRedirect(result.user, result.mustResetPassword);
      }
      return;
    }

    // Forgot-OTP flow: BE sets `mustResetPassword: true` and embeds the
    // `forgotPasswordReset` JWT claim. Mirror the claim onto the stored
    // user so SettingsPage detects reset-required state and routes through
    // POST /auth/change-password-after-forgot. Cleared after reset succeeds.
    const userWithResetFlag = result.mustResetPassword
      ? { ...result.user, forgotPasswordReset: true }
      : result.user;
    setAuth(userWithResetFlag, result.accessToken, result.refreshToken);
    await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
    doRedirect(result.user, result.mustResetPassword);
  };

  /**
   * Interim mobile signup (SMS OTP off, NEXT_PUBLIC_SMS_OTP_ENABLED=false): the
   * account was just created via /auth/register with name+password and NO OTP, so
   * the phone is unverified. Mirrors the email-combined success branch above -
   * persist the session, stamp the chosen product's policy, then route by
   * product. MobileVerificationGate force-verifies the phone once SMS goes live.
   * Cross-module: SignupMode (onMobileSignupNoOtp prop) / MobileVerificationGate.
   */
  const handleMobileSignupNoOtp = async (result: AuthResult, product: 'connect' | 'erp') => {
    setSignupFormData(null);
    setAuth(result.user, result.accessToken, result.refreshToken);
    await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
    await acceptPolicyWithRetry(
      product,
      () =>
        product === 'erp'
          ? acceptErpPolicy(result.accessToken)
          : acceptConnectPolicy(result.accessToken),
      result.user?._id ?? null,
    );
    if (product === 'erp') {
      // `?flow=signup` marks the signup-cancel path (setup-workspace Back signs
      // out) - same contract as the OTP/email register branches.
      router.replace('/auth/setup-workspace?flow=signup');
    } else {
      doRedirect(result.user, result.mustResetPassword);
    }
  };

  const handleSessionLimit = (data: SessionLimitData) => {
    setSessionLimitData(data);
    setSessionLimitModalOpen(true);
  };

  const handleSessionLimitClose = () => {
    setSessionLimitModalOpen(false);
    setSessionLimitData(null);
    setPendingPasswordCreds(null);
    setPendingOtpCreds(null);
  };

  const handleTerminateAndLogin = async (sessionId: string) => {
    if (pendingPasswordCreds) {
      const res = await terminateAndLoginUnauth({
        identifier: pendingPasswordCreds.identifier,
        password: pendingPasswordCreds.password,
        sessionId,
      });
      handleSessionLimitClose();
      if (!res.ok) return;
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      await syncAuthCookie(res.data.accessToken, res.data.refreshToken, res.data.platformAccess);
      doRedirect(res.data.user, res.data.mustResetPassword);
      return;
    }
    if (pendingOtpCreds) {
      const res = await terminateAndOtpLogin({
        mobile: pendingOtpCreds.mobile,
        ...(pendingOtpCreds.accessToken
          ? { accessToken: pendingOtpCreds.accessToken }
          : { otp: pendingOtpCreds.otp }),
        sessionId,
      });
      handleSessionLimitClose();
      if (!res.ok) return;
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      await syncAuthCookie(res.data.accessToken, res.data.refreshToken, res.data.platformAccess);
      doRedirect(res.data.user, res.data.mustResetPassword);
    }
  };

  const googleLogin = useGoogleLogin({
    // Implicit flow returns an access_token; the backend exchanges it for the
    // profile via Google userinfo, so we must request email + profile here.
    scope: 'openid email profile',
    onSuccess: async (tokenResponse) => {
      const res = await googleAuth(tokenResponse.access_token);
      if (!res.ok) {
        if (res.error === 'SESSION_LIMIT_REACHED' && res.sessionData) {
          handleSessionLimit(res.sessionData as SessionLimitData);
        }
        return;
      }
      await handleAuthSuccess(res.data);
    },
    onError: () => {
      // Toast handled inside CheckMode's error surface - silent here.
    },
  });

  /**
   * Used by ForgotMode after it has already fired `sendOtp` inline. Skips the
   * `otp_send` confirmation step because the mobile is already validated +
   * the OTP has already been dispatched - the user types the code on the
   * very next screen.
   */
  const startOtpFlow = (ctx: OtpContext) => {
    setOtpCtx(ctx);
    setMode('otp_verify');
  };

  /**
   * Existing-mobile OTP-only login: fire send-otp inline so the user skips
   * the intermediate OtpSendMode screen and lands directly on the OTP-entry
   * step. Used only when the account has no password (LoginMode would be a
   * dead-end). Users WITH a password are routed to LoginMode where they pick
   * password or "Use OTP instead" - that path goes through OtpSendMode.
   */
  const startOtpLoginDirect = async (
    mobile: string,
    hasPassword: boolean,
  ): Promise<{ ok: true } | { ok: false; error: string; errorCode?: string }> => {
    const res = await sendOtp(mobile, 'login');
    // Forward errorCode (e.g. NETWORK_UNREACHABLE on a backend-down) so the
    // calling mode can localize via useAuthErrorMessage instead of showing raw.
    if (!res.ok) return { ok: false, error: res.error, errorCode: res.errorCode };
    setOtpCtx({
      mobile,
      flowType: 'login',
      resendCooldownSec: res.data.resendCooldownSec,
      mockMode: res.data.mockMode,
      resetKey: Date.now(),
      hasPassword,
    });
    setMode('otp_verify');
    return { ok: true };
  };

  // Render workspace mode even when user is set - tokens are issued before the
  // workspace exists (OTP-register path: setAuth fires inside handleAuthSuccess
  // BEFORE setMode('register_workspace'); password path: setAuth fires inside
  // RegisterWorkspaceMode.handleSubmit AFTER mount). The redirect useEffect
  // mirrors this gate.
  if (!isHydrated) return null;
  if (user && mode !== 'register_workspace') return null;

  // Reference setWorkspaces to keep the import live for register_workspace.
  void setWorkspaces;

  return (
    <>
      <div className="flex min-h-screen font-body">
        {/* ── Left hero panel (desktop) ───────── */}
        <div
          className="auth-hero relative hidden w-[480px] flex-shrink-0 flex-col justify-between overflow-hidden p-10"
          style={{
            background:
              'linear-gradient(160deg,var(--cr-primary) 0%,var(--cr-indigo-400) 60%,var(--cr-text) 100%)',
          }}
        >
          <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full border border-white/[0.12]" />
          <div className="absolute top-10 right-10 h-45 w-45 rounded-full border border-white/[0.08]" />
          <div className="absolute -bottom-15 -left-15 h-65 w-65 rounded-full border border-white/[0.1]" />
          <div className="absolute -right-10 bottom-30 h-50 w-50 rounded-full bg-white/[0.04]" />
          <Link href="/" className="block no-underline" aria-label={t('hero.brand')}>
            {/* Two-color on-dark brand lockup (cream "zari", gold "360") for the
                dark hero panel. Same asset as the post-auth compact rail
                (AuthCompactRail); keep both in sync. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/manekhr-horizontal-on-dark.svg"
              alt={t('hero.brand')}
              className="h-12 w-auto"
            />
          </Link>
          <div>
            <p className="mb-4 text-[12px] font-semibold tracking-[0.18em] text-[#C9A227] uppercase">
              {t('hero.eyebrow')}
            </p>
            <h2 className="mb-5 font-display text-5xl leading-[1.05] font-extrabold text-surface">
              {t.rich('hero.heading', {
                em: (chunks) => <em className="font-display text-[#C9A227] italic">{chunks}</em>,
              })}
            </h2>
            <p className="mb-6 text-[22px] leading-snug font-normal text-white/85">
              {t('hero.subheadingHinglish')}
            </p>
            <p className="mb-9 text-[15px] leading-relaxed text-white/85">{t('hero.subheading')}</p>
            {/* Dual-product feature list (2026-07-02): the auth screen serves
                BOTH products (most entries arrive Connect-intent via
                redirect=/connect), so the hero sells the platform, not ERP
                alone. Keys renamed attendance/payroll/shifts/roles ->
                network/attendance/gst/oneAccount in all 4 message files. */}
            {[
              t('hero.features.network'),
              t('hero.features.attendance'),
              t('hero.features.gst'),
              t('hero.features.oneAccount'),
            ].map((f, i) => (
              <div key={i} className="mb-3.5 flex items-center gap-3">
                <div className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-[#C9A227]/20 ring-1 ring-[#C9A227]/40">
                  <svg width="12" height="12" fill="none" stroke="#C9A227" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <span className="text-sm text-white/85">{f}</span>
              </div>
            ))}
          </div>
          <p className="text-[13px] tracking-wide text-white/70">{t('hero.trustLine')}</p>
        </div>

        {/* ── Right form panel ───────────────── */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-page">
          {/* Decorative Z-symbol watermark - desktop only, sits behind form */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/manekhr-symbol.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-12 bottom-16 z-0 hidden w-[300px] opacity-[0.06] lg:block"
          />
          <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
            {/* Wider container for the signup mode so the in-form IntentPicker
                can render its two product cards side-by-side. The picker
                itself owns its narrower form sub-container; this just removes
                the 420px ceiling that was crushing the two-card layout. */}
            <div className={`w-full ${mode === 'signup' ? 'max-w-[880px]' : 'max-w-[420px]'}`}>
              <Link
                href="/"
                className="mobile-logo-link mb-8 flex items-center justify-center no-underline"
                aria-label={t('hero.brand')}
              >
                {/* Two-color on-light brand lockup (navy "zari", gold "360"). This
                    mobile-only logo sits on the light form panel (bg-page = cream),
                    so it uses the on-light variant, not the dark hero's version.
                    h-14: it stands alone centred on a full page, so it needs more
                    presence than the h-12 navbar lockup; h-10 read too small. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/manekhr-horizontal-on-light.svg"
                  alt={t('hero.brand')}
                  className="h-18 w-auto"
                />
              </Link>
              <div>
                {mode === 'check' && (
                  <CheckMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    onGoogleLogin={() => googleLogin()}
                    onStartOtpLoginDirect={startOtpLoginDirect}
                  />
                )}
                {mode === 'login' && (
                  <LoginMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    onAuthSuccess={handleAuthSuccess}
                    onSessionLimit={handleSessionLimit}
                    onCredentialsCaptured={setPendingPasswordCreds}
                  />
                )}
                {mode === 'login_choice' && (
                  <LoginChoiceMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    mobile={identifier.replace(/[\s-]/g, '')}
                    onStartOtpLoginDirect={startOtpLoginDirect}
                  />
                )}
                {mode === 'signup' &&
                  (() => {
                    // Channel-keyed: identifier shape decides whether SignupMode
                    // takes the mobile or email path. Both OTP-gate User creation.
                    const isEmail = identifier.includes('@');
                    return (
                      <SignupMode
                        setMode={setMode}
                        identifier={identifier}
                        setIdentifier={setIdentifier}
                        intent={urlIntent}
                        mobile={isEmail ? undefined : identifier.replace(/[\s-]/g, '')}
                        email={isEmail ? identifier.trim() : undefined}
                        // Task 22 - pass captured referral code so SignupMode can
                        // prefill the optional referral field. Empty string when
                        // REFERRAL_ENABLED=false (feature is dark).
                        initialRefCode={capturedRefCode}
                        onProceedToOtp={(data, sendResult) => {
                          setSignupFormData(data);
                          setOtpCtx({
                            mobile: data.mobile ?? '',
                            flowType: 'register',
                            resendCooldownSec: sendResult.resendCooldownSec,
                            mockMode: sendResult.mockMode,
                            resetKey: Date.now(),
                          });
                          setMode('otp_verify');
                        }}
                        onMobileSignupNoOtp={handleMobileSignupNoOtp}
                        onProceedToEmailOtp={(data, sendResult) => {
                          setSignupFormData(data);
                          setEmailOtpCtx({
                            resendCooldownSec: sendResult.resendCooldownSec,
                            resetKey: Date.now(),
                          });
                          setMode('email_otp_verify');
                        }}
                      />
                    );
                  })()}
                {mode === 'email_otp_verify' && signupFormData?.email && emailOtpCtx && (
                  <EmailOtpVerifyMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    signupFormData={signupFormData as SignupFormData & { email: string }}
                    resendCooldownSec={emailOtpCtx.resendCooldownSec}
                    resetKey={emailOtpCtx.resetKey}
                    setResendCtx={setEmailOtpCtx}
                    onAuthSuccess={handleAuthSuccess}
                    onSessionLimit={handleSessionLimit}
                  />
                )}
                {mode === 'register' && (
                  <RegisterMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    onProceedToWorkspace={(data) => {
                      setRegisterData({
                        name: data.name,
                        identifier,
                        password: data.password,
                      });
                      setMode('register_workspace');
                    }}
                  />
                )}
                {mode === 'register_workspace' && (
                  <RegisterWorkspaceMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    registerData={registerData}
                    onAuthSuccess={handleAuthSuccess}
                    onSessionLimit={handleSessionLimit}
                  />
                )}
                {mode === 'forgot' && (
                  <ForgotMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    onSwitchToOtp={(ctx) => startOtpFlow(ctx)}
                  />
                )}
                {mode === 'reset_sent' && (
                  <ResetSentMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                  />
                )}
                {mode === 'otp_send' && otpCtx && (
                  <OtpSendMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    initialMobile={otpCtx.mobile}
                    flowType={otpCtx.flowType}
                    onSendSuccess={(ctx) => {
                      setOtpCtx(ctx);
                      setMode('otp_verify');
                    }}
                    onUsePassword={
                      otpCtx.flowType === 'register'
                        ? () => {
                            setIdentifier(otpCtx.mobile);
                            setMode('register');
                          }
                        : undefined
                    }
                  />
                )}
                {mode === 'otp_verify' && otpCtx && (
                  <OtpVerifyMode
                    setMode={setMode}
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    ctx={otpCtx}
                    setCtx={setOtpCtx}
                    onAuthSuccess={handleAuthSuccess}
                    onSessionLimitWithOtp={(data, credential) => {
                      setPendingOtpCreds({ mobile: otpCtx.mobile, ...credential });
                      handleSessionLimit(data);
                    }}
                    signupFormData={signupFormData}
                  />
                )}
              </div>
            </div>
          </div>
          {/* Bottom strip - trust + copyright. Visible at lg+ to fill the
              empty space below the form, mirrors the reference auth chrome. */}
          <div className="absolute right-8 bottom-6 left-8 hidden items-center justify-between text-[12px] text-subtle lg:flex">
            <span className="inline-flex items-center gap-1.5">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {t('hero.trust')}
            </span>
            <span>{t('hero.copyright')}</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .auth-hero { display: flex !important; }
          .mobile-logo-link { display: none !important; }
        }
      `}</style>

      <SessionLimitModal
        open={sessionLimitModalOpen}
        onClose={handleSessionLimitClose}
        onTerminateAndLogin={handleTerminateAndLogin}
        initialSessions={sessionLimitData?.activeSessions}
      />
    </>
  );
}
