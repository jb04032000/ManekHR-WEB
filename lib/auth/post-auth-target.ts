/**
 * resolvePostAuthTarget - single source of truth for the route a user lands on
 * after authentication / PIN setup. Replaces four copy-pasted
 * "workspaceless -> /connect/feed" blocks (AuthClient.doRedirect, AuthClient's
 * already-authed landing useEffect, and setup-pin's computePostPinTarget + its
 * zero-workspace bounce) so the rule lives in ONE place.
 *
 * The behaviour fix (see memory project_erp_connect_signup_misroute): a
 * WORKSPACELESS user is no longer blindly treated as "Connect-only". If they
 * intend ERP - i.e. they accepted the ERP policy but NOT the Connect policy -
 * they are routed to `/auth/setup-workspace` to finish ERP onboarding, never
 * force-pushed to `/connect/feed`. The per-product policy timestamps already
 * flow from the backend on the sanitised user (erpPolicyAcceptedAt /
 * connectPolicyAcceptedAt), so this needs no new backend field.
 *
 * Cross-module: consumed by app/auth/AuthClient.tsx (doRedirect + the landing
 * useEffect) and app/auth/setup-pin/page.tsx. The workspaceless->setup-workspace
 * decision keeps the ERP onboarding (workspace) step ahead of any "go to
 * Connect" fallback. Watch: `hasWorkspace` is only reliable in the FALSE
 * direction here; an invited member can read hasWorkspace=false yet own a
 * membership, so call sites that already confirm the real workspace LIST
 * (DashboardLayout, setup-pin entry effect) keep doing so - this helper only
 * decides the destination once "no workspace" is the established fact.
 */

export interface PostAuthUser {
  isAdmin?: boolean;
  hasWorkspace?: boolean;
  /** ISO timestamp the user accepted the ERP policy; null/absent = not accepted. */
  erpPolicyAcceptedAt?: string | null;
  /** ISO timestamp the user accepted the Connect policy; null/absent = not accepted. */
  connectPolicyAcceptedAt?: string | null;
}

export interface ResolvePostAuthTargetOptions {
  user: PostAuthUser | null | undefined;
  /** A `?redirect=` query value, if any. */
  requestedRedirect?: string | null;
  /** SMS-OTP forgot-password flow: route to the password card instead. */
  mustResetPassword?: boolean;
}

/**
 * True when the workspaceless user's only expressed intent is ERP: they
 * accepted the ERP policy and have NOT accepted the Connect policy. A user who
 * accepted Connect (or both, or neither) is treated as Connect for the
 * workspaceless fallback.
 */
function intendsErpOnboarding(user: PostAuthUser): boolean {
  return !!user.erpPolicyAcceptedAt && !user.connectPolicyAcceptedAt;
}

export function resolvePostAuthTarget({
  user,
  requestedRedirect,
  mustResetPassword,
}: ResolvePostAuthTargetOptions): string {
  // Admin + forced-reset short-circuits mirror the prior doRedirect order.
  if (user?.isAdmin) return '/admin';
  if (mustResetPassword) return '/account/security#password';

  const workspaceless = user?.hasWorkspace === false;
  // Workspaceless ERP-intent users finish onboarding at setup-workspace; every
  // other workspaceless user lives in Connect. Users with a workspace go to the
  // ERP dashboard.
  const fallback = workspaceless
    ? user && intendsErpOnboarding(user)
      ? '/auth/setup-workspace'
      : '/connect/feed'
    : '/dashboard';

  const requested = requestedRedirect ?? null;
  if (!requested) return fallback;
  // Never honour a redirect into the admin panel for a non-admin caller.
  if (requested.startsWith('/admin')) return fallback;
  // Bare `/connect` is the marketing landing; collapse straight to the feed.
  if (requested === '/connect') return '/connect/feed';
  // A stale `?redirect=/dashboard*` on a workspaceless session must not drag the
  // user into the ERP shell (it fires the ERP policy + PIN gates). Collapse to
  // the workspaceless fallback - setup-workspace for ERP-intent, Connect else.
  if (workspaceless && requested.startsWith('/dashboard')) return fallback;
  return requested;
}
