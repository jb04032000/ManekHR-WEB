'use server';

/**
 * Connect profile - server actions. Call the backend `connect/profile`
 * endpoints through the httpOnly-cookie-authed `serverHttp` client. Every
 * action returns a discriminated `ActionResult` - never throws to the caller.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type {
  ActionResult,
  ClaimHandleErrorCode,
  ClaimHandleResult,
  ConnectEntryState,
  ConnectOnboardingIntent,
  ConnectProfile,
  ErpLinkStatus,
  ErpVerificationState,
  FeaturedWorkshop,
  HandleAvailability,
  ProfileOpenJobs,
  ProfileViewSummary,
  PublicConnectProfile,
  PublicErpLinkStatus,
  UpdateConnectProfileInput,
} from './profile.types';
// CompanyPageRef = minimal company-page identity (feed.types), the same shape
// company-page.actions returns. Used by the experience editor's company picker.
import type { CompanyPageRef } from './feed.types';

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

/**
 * A `423` from the backend `PinUnlockGuard` - the session is App-Locked (Quick
 * PIN). Distinct from a generic failure: the smart-entry must NOT treat a
 * locked session as "not connectEnabled".
 */
function isLockedError(e: unknown): boolean {
  return isAxiosError(e) && e.response?.status === 423;
}

/**
 * A `401` that survived `serverHttp`'s refresh-retry - the access AND refresh
 * tokens are both expired/revoked, so the session is genuinely signed out.
 * The smart-entry routes such a user to sign in rather than rendering the
 * "coming soon" panel (a revoked token is not a missing `connectEnabled` flag).
 */
function isAuthError(e: unknown): boolean {
  return isAxiosError(e) && e.response?.status === 401;
}

/** The caller's own Connect profile - lazily created by the backend on first read. */
export async function getMyConnectProfile(): Promise<ActionResult<ConnectProfile>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/connect/profile');
    return { ok: true, data: unwrapServer<ConnectProfile>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Apply a partial update to the caller's profile. */
export async function updateMyConnectProfile(
  input: UpdateConnectProfileInput,
): Promise<ActionResult<ConnectProfile>> {
  try {
    const http = await serverHttp();
    const res = await http.patch('/me/connect/profile', input);
    return { ok: true, data: unwrapServer<ConnectProfile>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Derived ERP-linked status for the caller, resolved from their ERP employment. */
export async function getMyErpLink(): Promise<ActionResult<ErpLinkStatus>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/connect/profile/erp-link');
    return { ok: true, data: unwrapServer<ErpLinkStatus>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── ERP-verification consent (consent-first verification, ADR-0004) ──────────
// The PROFILE ERP badge is consent-gated server-side. These four actions drive
// the owner-facing consent UI: the read powers the one-time suggestion banner +
// the persistent settings toggle; grant/revoke flip the badge on/off (revoke is
// immediate); dismiss records "Not now" so the banner stops nagging. All four
// hit `/me/connect/profile/erp-verification*` (auth-only, no body). The state
// is its OWN endpoint - it is NOT part of the profile "me" payload. Cross-module:
// ERPConsentBanner + ERPConsentModal + ProfileView's privacy section render from
// this; the backend ErpVerificationService owns the persisted consent record.

/** The caller's ERP-verification consent + eligibility state (for the banner +
 *  settings toggle). Best-effort at the call site: a failure simply hides the
 *  suggestion banner (the owner can still grant via the settings toggle). */
export async function getMyErpVerification(): Promise<ActionResult<ErpVerificationState>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/connect/profile/erp-verification');
    return { ok: true, data: unwrapServer<ErpVerificationState>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Grant ERP-verification consent (badge becomes eligible). Returns the fresh state. */
export async function grantErpConsent(): Promise<ActionResult<ErpVerificationState>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/me/connect/profile/erp-verification/consent', {});
    return { ok: true, data: unwrapServer<ErpVerificationState>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Revoke ERP-verification consent (badge drops immediately). Returns the fresh state. */
export async function revokeErpConsent(): Promise<ActionResult<ErpVerificationState>> {
  try {
    const http = await serverHttp();
    const res = await http.delete('/me/connect/profile/erp-verification/consent');
    return { ok: true, data: unwrapServer<ErpVerificationState>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Record "Not now" on the one-time suggestion banner. Returns the fresh state. */
export async function dismissErpSuggestion(): Promise<ActionResult<ErpVerificationState>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/me/connect/profile/erp-verification/dismiss', {});
    return { ok: true, data: unwrapServer<ErpVerificationState>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Public read of another user's profile - backend serves `public`-visibility
 * only. The `slug` is dual-input: a handle (preferred - `jayesh-bambhaniya`)
 * OR the legacy 24-hex `ObjectId` (back-compat for old links in the wild).
 * The backend resolves both forms through the same code path.
 */
export async function getPublicConnectProfileBySlug(
  slug: string,
): Promise<ActionResult<PublicConnectProfile>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/profiles/${encodeURIComponent(slug)}`);
    return { ok: true, data: unwrapServer<PublicConnectProfile>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Back-compat alias - older callers passed `userId`. The backend already
 * resolves both ObjectId + handle through the same endpoint, so this is a
 * pass-through. New callers should prefer `getPublicConnectProfileBySlug`.
 */
export const getPublicConnectProfile = getPublicConnectProfileBySlug;

/**
 * Public, privacy-trimmed ERP-linked status for another user's profile -
 * powers the moat badge + trust panel on `/u/[slug]`. Backend returns only
 * `linked` + `since` (no raw activity signals - privacy wall). `slug` is the
 * same dual-input shape as `getPublicConnectProfileBySlug`.
 */
export async function getPublicErpLink(slug: string): Promise<ActionResult<PublicErpLinkStatus>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/profiles/${encodeURIComponent(slug)}/erp-link`);
    return { ok: true, data: unwrapServer<PublicErpLinkStatus>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** `/connect` smart-entry state - Connect access + onboarding status. */
export async function getConnectEntryState(): Promise<ActionResult<ConnectEntryState>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/connect/profile/entry');
    return { ok: true, data: unwrapServer<ConnectEntryState>(res) };
  } catch (e) {
    // Classify the failure so the smart-entry branches correctly: a 423
    // shows the PIN unlock screen, a 401 routes to sign-in - neither must
    // mis-degrade to the "coming soon" panel.
    return {
      ok: false,
      error: toError(e),
      locked: isLockedError(e),
      authFailed: isAuthError(e),
    };
  }
}

/** Mark the onboarding intent flow complete - stamps `onboardedAt`. */
export async function completeOnboarding(
  intent: ConnectOnboardingIntent,
): Promise<ActionResult<ConnectProfile>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/me/connect/profile/onboarding', { intent });
    return { ok: true, data: unwrapServer<ConnectProfile>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Record the caller's Connect policy/terms acceptance.
 *
 * Accepts an optional `fallbackAccessToken`. The signup flow calls this
 * immediately after `syncAuthCookie` - back-to-back server actions can race
 * the Set-Cookie propagation, leaving the second action without a valid auth
 * cookie. Passing the freshly-minted access token bypasses the race; the
 * underlying `serverHttp(fallbackToken)` uses it as the Authorization header
 * when the cookie is missing. Other callers (gate retries, settings flows)
 * leave the argument unset and continue to use the cookie.
 */
export async function acceptConnectPolicy(
  fallbackAccessToken?: string,
): Promise<ActionResult<{ acceptedAt: string }>> {
  // Visible in the SERVER terminal where `next dev` is running. If a user
  // reports the post-signup gate still fires, the absence (or 4xx/5xx) of
  // this log tells us instantly whether the request even reached the BE.
  console.info('[acceptConnectPolicy] starting', {
    fallbackTokenPresent: !!fallbackAccessToken,
    fallbackTokenLen: fallbackAccessToken?.length ?? 0,
  });
  try {
    const http = await serverHttp(fallbackAccessToken);
    const res = await http.post('/me/connect/profile/policy-accept', {});
    const data = unwrapServer<{ acceptedAt: string }>(res);
    console.info('[acceptConnectPolicy] SUCCESS', {
      status: res.status,
      acceptedAt: data?.acceptedAt,
    });
    return { ok: true, data };
  } catch (e) {
    const err = e as { response?: { status?: number; data?: unknown }; message?: string };
    console.error('[acceptConnectPolicy] FAILED', {
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });
    return { ok: false, error: toError(e) };
  }
}

/** Curated featured workshops for the Day-1 home (public - no auth needed). */
export async function getFeaturedWorkshops(): Promise<ActionResult<FeaturedWorkshop[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/featured-workshops');
    return { ok: true, data: unwrapServer<FeaturedWorkshop[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── Handle (username slug) ──────────────────────────────────────────────

/**
 * Debounced availability check used by the `/account/profile` HandleEditor.
 * Returns a discriminated union so the form can render the right inline copy
 * (`format` vs `reserved` vs `taken`). The caller is excluded from the
 * uniqueness check server-side - re-saving an existing handle reads as
 * `{ available: true }`, not "taken by themselves".
 */
export async function checkHandleAvailable(
  value: string,
): Promise<ActionResult<HandleAvailability>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/profile/handle/available', {
      params: { value },
    });
    return { ok: true, data: unwrapServer<HandleAvailability>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Discriminated error from `claimHandle`. `code` is one of the four known
 * backend codes; `nextChangeAt` is populated only for `HANDLE_COOLDOWN` so the
 * UI can format the remaining days until the next allowed change.
 */
export interface ClaimHandleFailure {
  ok: false;
  error: string;
  code?: ClaimHandleErrorCode;
  /** ISO date string - populated when `code === 'HANDLE_COOLDOWN'`. */
  nextChangeAt?: string;
}

/**
 * Read the discriminated `{ code, nextChangeAt }` from an axios error payload
 * without losing the original message. Used only inside `claimHandle` - every
 * other action returns the generic `{ ok: false, error }` shape.
 */
function readClaimHandleErrorPayload(e: unknown): {
  code?: ClaimHandleErrorCode;
  nextChangeAt?: string;
} {
  if (!isAxiosError(e)) return {};
  const data = e.response?.data as
    | {
        error?: { code?: ClaimHandleErrorCode; nextChangeAt?: string };
        code?: ClaimHandleErrorCode;
        nextChangeAt?: string;
      }
    | undefined;
  return {
    code: data?.error?.code ?? data?.code,
    nextChangeAt: data?.error?.nextChangeAt ?? data?.nextChangeAt,
  };
}

/**
 * Claim or change the caller's handle. Returns the discriminated `code` for
 * cooldown / taken / reserved / format-rejected paths so the editor can
 * render the matching inline message. The 30-day cooldown carries a
 * `nextChangeAt` ISO timestamp; the editor formats it relative to "now".
 */
export async function claimHandle(
  value: string,
): Promise<{ ok: true; data: ClaimHandleResult } | ClaimHandleFailure> {
  try {
    const http = await serverHttp();
    const res = await http.patch('/me/profile/handle', { handle: value });
    return { ok: true, data: unwrapServer<ClaimHandleResult>(res) };
  } catch (e) {
    const { code, nextChangeAt } = readClaimHandleErrorPayload(e);
    return {
      ok: false,
      error: toError(e),
      ...(code ? { code } : {}),
      ...(nextChangeAt ? { nextChangeAt } : {}),
    };
  }
}

// ── Profile-view + open-jobs intent cards ────────────────────────────────
// These power the profile "open to" cards: the Hiring card pulls a person's
// open jobs (connect jobs module), and the owner header shows view totals
// (connect views module). Keep the response shapes in lockstep with the BE
// `connect/views` + `connect/jobs/by-user/:id/open` contracts.

/** Record a profile view (deduped per viewer/day server-side). Best-effort:
 *  callers ignore the result. Skip self-views at the call site. */
export async function recordProfileView(subjectUserId: string): Promise<void> {
  try {
    const http = await serverHttp();
    await http.post('/connect/views', { targetType: 'profile', targetId: subjectUserId });
  } catch {
    // non-fatal: a missed view must never break the page render
  }
}

/** The caller own profile-view totals for the header stat. */
export async function getMyProfileViews(): Promise<ActionResult<ProfileViewSummary>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/views/profile/summary');
    return { ok: true, data: unwrapServer<ProfileViewSummary>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Public company-page name type-ahead for the experience editor's company
 * picker (B2). Wraps the BE `@Public` `GET /connect/company-pages/public/search`
 * (min 2 chars, capped server-side). Base path matches `company-page.actions`
 * (`/connect/company-pages` + `/public/...`). Returns at most a handful of
 * `CompanyPageRef`s the owner can link an experience entry to; a free-typed
 * company simply leaves `companyPageId` unset.
 */
export async function searchCompanyPages(q: string): Promise<ActionResult<CompanyPageRef[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/company-pages/public/search', { params: { q } });
    return { ok: true, data: unwrapServer<CompanyPageRef[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** A person open jobs for the profile Hiring card (public). */
export async function getPublicOpenJobs(userId: string): Promise<ActionResult<ProfileOpenJobs>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/jobs/by-user/${encodeURIComponent(userId)}/open`);
    return { ok: true, data: unwrapServer<ProfileOpenJobs>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
