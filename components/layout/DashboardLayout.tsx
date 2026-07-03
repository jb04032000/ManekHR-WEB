'use client';

import { useEffect, useState, useCallback, useRef, startTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { App as AntApp, Layout, Alert } from 'antd';
import { useAuthStore, useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { listWorkspaces, getMySubscription } from '@/lib/actions';
import type { Subscription, PlanEntitlements } from '@/types';
import { pinApi, meApi } from '@/lib/api/modules';
import { env } from '@/lib/env';
import ModeSidebar, { type AppMode } from '@/components/layout/ModeSidebar';
import ConnectMobileTabBar from '@/components/connect/ConnectMobileTabBar';
import TopHeader from '@/components/layout/TopHeader';
import PageTransitionLoader from '@/components/PageTransitionLoader';
import { ManekHRStitchLoader } from '@/components/ui/ManekHRStitchLoader';
import { DunningBanner } from '@/components/subscription/DunningBanner';
// Trial countdown + post-expiry banners. Pinned at the top of the ERP dashboard
// content; reads the subscription store this layout already hydrates/polls.
import { TrialBanners } from '@/components/subscription/TrialBanners';
import { PasswordSetupPrompt } from '@/components/auth/PasswordSetupPrompt';
import { LockOverlay } from '@/components/auth/LockOverlay';
import { normalizeWorkspaceList } from '@/lib/utils/workspace.utils';
import { useIdle } from '@/hooks/useIdle';
import { useAppLockSync } from '@/hooks/useAppLockSync';
import { useTranslations } from 'next-intl';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { resolveRoutePerm, resolveRouteModule } from '@/lib/constants/nav-permissions';
import { usePermissionsStore } from '@/lib/stores/permissions-store';
import { openPermissionStream } from '@/lib/api/permission-stream';
import { ForbiddenScreen, PermissionsErrorScreen } from '@/components/rbac/PermissionScreens';
// Central PLAN gate companion to ForbiddenScreen (RBAC). Renders when the
// workspace's plan does not include the route's module. See the moduleLocked
// computation + ROUTE_MODULES in lib/constants/nav-permissions.ts.
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { NotificationProvider } from '@/lib/connect/NotificationProvider';

const { Content } = Layout;

// Bootstrap fetch cache (perf pass 2026-07-02). DashboardLayout mounts fresh
// on every route navigation, so `bootstrap()` used to re-run listWorkspaces +
// getMySubscription on EVERY page change even though the zustand stores
// already hold the data. Module-level (survives remounts within the tab):
// skip the network round-trips when the SAME user + workspace + mode
// bootstrapped successfully within the TTL. Keyed on all three so a re-login
// as another user, a workspace switch, or an ERP<->Connect mode flip always
// re-fetches. Cleared on App Lock (lock-transition effect below) so unlock
// re-fetches with the fresh unlocked-jti credentials.
const BOOTSTRAP_CACHE_TTL_MS = 60_000;
let bootstrapCacheKey: string | null = null;
let bootstrapCacheAt = 0;
function clearBootstrapCache() {
  bootstrapCacheKey = null;
  bootstrapCacheAt = 0;
}

export default function DashboardLayout({
  children,
  mode = 'erp',
}: {
  children: React.ReactNode;
  /** Which product shell to render. `/dashboard` → erp, `/connect` → connect. */
  mode?: AppMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  // Wave 4.7 (2026-05-10) - guard against multiple auto-accept attempts on
  // re-renders. Once the inviteId is in flight or processed, ignore further
  // observations of the same id.
  const acceptedInviteIdsRef = useRef<Set<string>>(new Set());
  // Pillar 4 (auth-hardening): NARROW selectors, not a broad `useAuthStore()`
  // destructure. A broad destructure re-renders this layout on EVERY store
  // change — including `unlockExpiresAt`, which the pin-touch heartbeat updates
  // every ~20s — even though this component never reads it. Per-field selectors
  // subscribe only to the slices actually used. Action refs (setAppLocked /
  // setPinSetupRequired) are stable across renders in Zustand, so selecting them
  // adds no re-render churn.
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAppLocked = useAuthStore((s) => s.isAppLocked);
  const pinSetupRequired = useAuthStore((s) => s.pinSetupRequired);
  const setAppLocked = useAuthStore((s) => s.setAppLocked);
  const setPinSetupRequired = useAuthStore((s) => s.setPinSetupRequired);
  // AC-4.1: per-slice selectors (mirrors the auth-store selectors above) so a
  // single-workspace settings mutation does not re-render the whole dashboard shell.
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setCurrentWorkspaceId = useWorkspaceStore((s) => s.setCurrentWorkspaceId);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const { message: messageApi } = AntApp.useApp();
  // `subscriptionHydrated` (zustand persist rehydrated) gates the plan check
  // below so a locked page never flashes before entitlements are known.
  const { entitlements, isHydrated: subscriptionHydrated } = useSubscriptionStore();
  const [collapsed, setCollapsed] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  // True only after listWorkspaces returns successfully. Distinguishes
  // "confirmed zero workspaces" (real onboarding case) from "couldn't load"
  // (BE down / lock / network) so the onboarding gate cannot loop on failure.
  const [workspacesConfirmed, setWorkspacesConfirmed] = useState(false);
  const [pinStateResolved, setPinStateResolved] = useState(false);
  const bootstrapRan = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);

  // App Lock (Quick PIN) is an ERP-only protection - it guards the sensitive
  // payroll / finance / staff surfaces. Two shells hold none of that and are
  // therefore exempt from the whole App Lock lifecycle (idle timer, manual
  // lock, PIN-status pull, forced PIN setup, lock overlay, cross-tab sync) -
  // no lock, no PIN prompt, ever:
  //   - `connect` (network / marketplace / jobs)
  //   - `account` (product-neutral identity area: profile / security / billing
  //     / devices, shared by ERP and Connect-only users). It used to keep App
  //     Lock "because it hosts billing/security", but that PIN-walled the
  //     shared profile page for Connect-only users (who have no PIN) and
  //     force-pushed them to /auth/setup-pin. The real ERP data stays protected
  //     by the ERP shell + the backend PinUnlockGuard; the neutral account
  //     endpoints carry @SkipPinUnlock so the area is fully usable without a PIN.
  // Mirrors the backend PinUnlockGuard, which skips the `/connect` + `/me/connect`
  // namespace and the neutral account/identity endpoints - keep FE + BE in sync.
  const appLockEnabled = mode === 'erp';

  // App Lock - broadcast lock/unlock across tabs, drive idle timer.
  useAppLockSync(appLockEnabled);

  const lockNow = useCallback(async () => {
    try {
      await pinApi.lock();
    } catch {
      // Lock locally even if backend write fails; the next API call will
      // 423 and converge state via the interceptor.
    }
    setAppLocked(true);
  }, [setAppLocked]);

  // Idle timeout - only arms once the user is authenticated, has a PIN, and
  // is not already locked. Avoids firing during cold load or on the
  // setup-pin / login screens.
  // Resolution: per-USER override wins (set on the Security settings page -
  // also the only source for a Connect-only / workspace-less account), then
  // the per-workspace value (admin-set baseline for ERP members), then the
  // deployment-wide env default.
  const idleArmed = appLockEnabled && !!user?.hasPin && !isAppLocked && !pinSetupRequired;
  const idleMs = user?.appLockIdleMs ?? currentWorkspace?.appLockIdleMs ?? env.appLockIdleMs;
  // App Lock heartbeat - ping the backend on real user activity so its
  // request-driven unlock TTL slides on the SAME signal as this local idle
  // timer. Without this a user who is active but not firing API calls (reading,
  // scrolling) has the BE key expire and the next request 423-locks them
  // mid-use. Throttled to min(idleMs/3, 20s) so the BE TTL (>= idleMs) is
  // refreshed with margin even at the 1-minute preset. Best-effort; a 423 still
  // converges via the client interceptor. Mirror: useAppLock (admin shell).
  const touchBackend = useCallback(() => {
    void pinApi.touch().catch(() => {});
  }, []);
  useIdle(idleArmed ? idleMs : 0, lockNow, {
    onActivity: touchBackend,
    activityThrottleMs: Math.min(Math.floor(idleMs / 3), 20_000),
  });

  // Manual-lock shortcut - Ctrl+Shift+L (Cmd+Shift+L on Mac). Industry
  // convention from 1Password / Bitwarden browser extensions; avoids the
  // Ctrl+L browser-native "focus address bar" collision. Only armed when
  // idle-timer is armed (same gate).
  useEffect(() => {
    if (!idleArmed) return;
    const onKeydown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || !e.shiftKey) return;
      if (e.key !== 'L' && e.key !== 'l') return;
      e.preventDefault();
      void lockNow();
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [idleArmed, lockNow]);

  const platformAccess = entitlements?.platformAccess;
  const isRestricted = platformAccess === 'mobile_only';
  const showPreviewBanner =
    isRestricted &&
    typeof window !== 'undefined' &&
    window.location.pathname !== '/platform-restricted';

  const bootstrap = useCallback(async () => {
    // Cache hit: this exact user+workspace+mode bootstrapped successfully
    // within the TTL, and the zustand stores still hold that data. Re-assert
    // the two flags a fresh mount reset and skip both network calls.
    const cacheWsId = useWorkspaceStore.getState().currentWorkspaceId ?? '';
    const cacheKey = `${user?._id ?? ''}:${cacheWsId}:${mode}`;
    if (bootstrapCacheKey === cacheKey && Date.now() - bootstrapCacheAt < BOOTSTRAP_CACHE_TTL_MS) {
      setWorkspacesConfirmed(true);
      setBootstrapped(true);
      return;
    }
    // Only a fully successful workspace fetch marks the cache below.
    let workspacesFetchOk = false;
    try {
      // Pass the token directly as a fallback so the server action can
      // authenticate even if the httpOnly cookie hasn't been set yet.
      const res = await listWorkspaces(accessToken ?? undefined);

      // Handle ActionResult format
      if (res && typeof res === 'object' && 'ok' in res) {
        if (res.ok) {
          const list = normalizeWorkspaceList(res.data);
          setWorkspaces(list);
          // 2026-05-22: only the SUCCESS path confirms the workspace list.
          // The onboarding gate keys off this so a failed / unreachable
          // bootstrap (BE down, 423 lock, network) never gets mistaken for
          // "user owns no workspace" -> redirect -> remount -> loop.
          setWorkspacesConfirmed(true);
          workspacesFetchOk = true;
        } else {
          // Don't clear existing workspace data on API failure - keep hydrated data
        }
      } else {
      }
      // Fetch subscription data and populate store. On error (e.g. 423
      // APP_LOCKED during the brief window before PIN unlock), KEEP the
      // hydrated/persisted store as-is - clearing to null would blank
      // entitlements and make the sidebar show every feature as locked
      // until a manual refresh.
      //
      // Connect mode: skip this ERP fetch entirely. The ERP subscription +
      // entitlements gate the ERP sidebar, NOT the Connect shell, and the
      // endpoint sits behind the Quick-PIN App-Lock guard - so on Connect it
      // only ever 423s and no-ops (the persisted store value is preserved
      // either way). Not firing it keeps Connect from touching App-Locked ERP
      // endpoints (owner decision: no App-Lock bleed on Connect). Keep in sync
      // with the refresh-poll gate (`mode === 'connect'`) further below.
      if (mode !== 'connect')
        try {
          // Wave A Permission-Gated UI (2026-05-15) - pass the active
          // workspaceId so the BE resolves the workspace owner's plan for
          // non-owner invitees. Reading via `getState()` rather than the
          // closured `currentWorkspace` because bootstrap fires before the
          // store has picked the latest value out of hydrate.
          const wsId = useWorkspaceStore.getState().currentWorkspaceId ?? undefined;
          const subRes = await getMySubscription(accessToken ?? undefined, wsId);
          const sub =
            subRes && typeof subRes === 'object' && 'subscription' in subRes
              ? (subRes as { subscription?: Subscription }).subscription
              : subRes;
          const storeState = useSubscriptionStore.getState();
          if (sub) storeState.setSubscription(sub);
          const entitlements =
            subRes && typeof subRes === 'object' && 'entitlements' in subRes
              ? (subRes as { entitlements?: PlanEntitlements }).entitlements
              : null;
          if (entitlements) storeState.setEntitlements(entitlements);
        } catch {
          // Preserve existing subscription/entitlements - DO NOT null.
        }
      // Mark the cache only after the full pass: workspaces fetched OK (the
      // subscription block above preserves prior store data on failure, so a
      // sub error does not warrant re-fetching every route). Failures fall
      // through uncached and retry on the next mount, exactly as before.
      if (workspacesFetchOk) {
        bootstrapCacheKey = cacheKey;
        bootstrapCacheAt = Date.now();
      }
    } catch (error) {
      console.error('[DashboardLayout] Bootstrap failed:', error);
      // Don't clear existing workspace data on exception - keep hydrated data
    } finally {
      setBootstrapped(true);
    }
    // `mode` gates the ERP subscription fetch above (skipped on Connect).
    // `user?._id` keys the bootstrap cache to the signed-in account.
  }, [setWorkspaces, accessToken, mode, user?._id]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!user) {
      bootstrapRan.current = false;
      router.replace('/auth');
      return;
    }

    // Admin accounts belong in the admin panel, not the user dashboard
    if (user.isAdmin) {
      router.replace('/admin');
      return;
    }

    // App Lock - do not bootstrap (or fire any data fetches) until we know
    // the lock state. Without `pinStateResolved`, bootstrap races the
    // `/auth/pin-status` call: if it wins, every server action 423s and
    // surfaces as a 500 stream. Bootstrap re-fires when this gate clears
    // because `isAppLocked` / `pinSetupRequired` / `pinStateResolved`
    // are all deps. Connect mode disables App Lock, so this gate is skipped
    // there (the lock state is irrelevant - bootstrap runs immediately).
    if (appLockEnabled && (!pinStateResolved || isAppLocked || pinSetupRequired)) return;

    if (!bootstrapRan.current) {
      bootstrapRan.current = true;
      startTransition(() => {
        bootstrap();
      });
    }
  }, [
    appLockEnabled,
    isHydrated,
    user,
    pinStateResolved,
    isAppLocked,
    pinSetupRequired,
    router,
    bootstrap,
  ]);

  // App Lock - when the session locks (false → true), reset bootstrap state
  // so the next unlock re-fetches workspaces + subscription with the fresh
  // unlocked-jti credentials. Without this, after the first unlock the gate
  // ref stays `true` and a subsequent lock-then-unlock cycle would skip
  // re-bootstrap and render stale data.
  const prevAppLockedRef = useRef<boolean>(isAppLocked);
  useEffect(() => {
    if (!isHydrated || !user || user.isAdmin) return;
    // Connect disables App Lock; a stray `isAppLocked` flip (e.g. an ERP tab
    // broadcasting, or a non-Connect background call 423ing) must not reset
    // bootstrap and blank the Connect shell.
    if (!appLockEnabled) return;
    const prev = prevAppLockedRef.current;
    prevAppLockedRef.current = isAppLocked;
    if (prev === false && isAppLocked) {
      bootstrapRan.current = false;
      setBootstrapped(false);
      setWorkspacesConfirmed(false);
      // Lock invalidates the bootstrap fetch cache too - unlock must re-fetch
      // with the fresh unlocked-jti credentials, not skip on a warm cache.
      clearBootstrapCache();
    }
  }, [appLockEnabled, isAppLocked, isHydrated, user]);

  // App Lock - pull /auth/pin-status once after hydrate to determine the
  // initial lock state, and re-pull when the tab returns from being hidden
  // for more than 2 minutes (catches cross-tab lock or server-side eviction).
  useEffect(() => {
    if (!isHydrated || !user || user.isAdmin) return;
    // Connect mode: App Lock disabled. Mark PIN state resolved so the shell
    // never blocks waiting on /auth/pin-status, and skip pulling lock state.
    if (!appLockEnabled) {
      setPinStateResolved(true);
      return;
    }

    let cancelled = false;
    const refreshPinStatus = async () => {
      try {
        const res = await pinApi.status();
        if (cancelled) return;
        if (!res.pinSet) {
          setPinSetupRequired(true);
          setAppLocked(false);
        } else if (res.locked) {
          setPinSetupRequired(false);
          setAppLocked(true);
        } else {
          setPinSetupRequired(false);
          setAppLocked(false, res.unlockExpiresAt ?? undefined);
        }
      } catch {
        // 423 path - interceptor already toggled isAppLocked. Other errors
        // (network etc.) leave state as-is and the next API call retries.
      } finally {
        if (!cancelled) setPinStateResolved(true);
      }
    };

    // Fire on every effect run (deps are user/setters - stable enough).
    // Was previously gated by `pinStatusRan` useRef but that left
    // `pinStateResolved` stuck at false under React Strict Mode's
    // double-invoke (first run captures the ref, cleanup cancels it,
    // second run skips because ref is already true → loader hangs).
    void refreshPinStatus();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenSince = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenSince && Date.now() - hiddenSince > 120_000) {
        void refreshPinStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [appLockEnabled, isHydrated, user, setAppLocked, setPinSetupRequired]);

  // App Lock - when the user must set a PIN, route to /auth/setup-pin.
  // Don't loop if we're already on that route. Skipped in Connect mode: a
  // Connect-only user is never forced into PIN setup (App Lock is ERP-only).
  useEffect(() => {
    if (!appLockEnabled) return;
    if (!isHydrated || !user || user.isAdmin) return;
    if (pinSetupRequired && !pathname?.startsWith('/auth/setup-pin')) {
      router.replace('/auth/setup-pin');
    }
  }, [appLockEnabled, isHydrated, user, pinSetupRequired, pathname, router]);

  // Workspace gate - an authed user without a workspace can't reach the ERP
  // (`/dashboard`) until one exists. Closes the OTP-register Back-button
  // leakage where verify-otp issues tokens before workspace setup completes.
  //
  // Wave 2 W4.5 (lifecycle L5, 2026-05-10) - also covers the fired-member
  // case: a user whose only memberships were soft-removed ends up with
  // empty owned + member arrays after bootstrap. Same redirect target;
  // the onboarding screen handles the "previous access revoked" copy.
  //
  // Connect-mode (`/connect`) is identity-scoped and needs no workspace -
  // workspace-less users live there, so the gate only applies in ERP mode.
  useEffect(() => {
    if (mode !== 'erp') return;
    if (!isHydrated || !user || user.isAdmin) return;
    if (!bootstrapped) return; // wait until workspace fetch completes
    // Only act on a CONFIRMED workspace list. A failed bootstrap (BE
    // unreachable, 423 lock) leaves this false, so we never false-positive
    // an empty list into an onboarding redirect loop.
    if (!workspacesConfirmed) return;
    // 2026-05-22 loop fix: the bootstrapped workspace list
    // (`normalizeWorkspaceList` merges owned + member) is the authoritative
    // signal. A user with ANY workspace (owned OR a membership) does not need
    // onboarding. The previous `!hasWorkspaceFlag || !hasAnyWorkspace` OR'd in
    // the server `user.hasWorkspace` hint, which is set from OWNED workspaces
    // only - so an invited member (owns nothing, but is an active member of
    // the inviter's workspace) had `hasWorkspace === false` AND a non-empty
    // list. The OR forced onboarding -> redirect to /auth/setup-workspace ->
    // that page bounces back to /dashboard (the member does have a workspace)
    // -> remount -> bootstrap -> redirect ... an infinite navigation loop that
    // only ever hit non-owner invitees. The fired-member case the flag was
    // meant to cover already lands here too: a user whose memberships were all
    // soft-removed has an EMPTY merged list, so `!hasAnyWorkspace` still fires.
    const hasAnyWorkspace = workspaces.length > 0;
    const needsOnboarding = !hasAnyWorkspace;
    if (needsOnboarding && !pathname?.startsWith('/auth/setup-workspace')) {
      router.replace('/auth/setup-workspace');
    }
  }, [
    mode,
    isHydrated,
    user,
    bootstrapped,
    workspacesConfirmed,
    workspaces.length,
    pathname,
    router,
  ]);

  // Wave 4.7 (2026-05-10) - auto-accept invite when an existing-user signs in
  // via the deep-link path (/invite/[token] → /auth?redirect=/dashboard?inviteId=X).
  // Without this, the user lands on /dashboard with the param dangling and
  // has to manually click Accept in the switcher pending-invites group.
  // Mirrors Sidebar.handleAcceptInvite refresh side-effects (invites +
  // workspaces) so the UI converges immediately.
  useEffect(() => {
    if (!isHydrated || !user || user.isAdmin) return;
    if (!bootstrapped || isAppLocked || pinSetupRequired) return;
    const inviteId = searchParams?.get('inviteId');
    if (!inviteId) return;
    if (acceptedInviteIdsRef.current.has(inviteId)) return;
    acceptedInviteIdsRef.current.add(inviteId);

    void (async () => {
      try {
        const res = await meApi.acceptInvite(inviteId);
        // P2.0 (2026-05-15) - replace silent swallow with toast feedback +
        // active-workspace switch. Refresh workspaces so the freshly-
        // accepted membership shows up in the switcher, then flip the
        // active workspace to the one we just joined so the user lands
        // inside it instead of staying on whatever was active before.
        try {
          const wsRes = await listWorkspaces(accessToken ?? undefined);
          if (wsRes && typeof wsRes === 'object' && 'ok' in wsRes && wsRes.ok) {
            setWorkspaces(normalizeWorkspaceList(wsRes.data));
          }
        } catch {
          // Best-effort; layout's own bootstrap will reconcile on next nav.
        }
        if (res?.workspace?._id) {
          setCurrentWorkspaceId(res.workspace._id);
        }
        // P2.0.2 (2026-05-15) - notify Sidebar (and any other consumer) to
        // refetch /me/invites/pending so the accepted invite stops showing
        // as a pending row with Accept/Decline buttons in the switcher.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('z360:invites-changed'));
        }
        messageApi.success(
          t('invitations.acceptedToast', {
            workspace: res?.workspace?.name ?? '',
          }),
        );
      } catch (e) {
        // Surface the BE error message instead of silently swallowing or
        // dumping the axios generic "Request failed with status code 403".
        // Common failure modes: token bound to a different user, token
        // expired, invite already declined/accepted. Owner sees the
        // reason + the ?inviteId is still cleared so refresh doesn't
        // retry the same dead invite.
        // BE error envelope: { success: false, error: { code, message, details } }
        // (see crewroster-backend src/common/filters/http-exception.filter.ts).
        // Reading `data.error` directly returns the object - rendering it via
        // antd toast triggers "Objects are not valid as a React child".
        const axiosLike = e as {
          response?: {
            data?: {
              message?: string;
              error?: string | { message?: string; code?: number };
            };
          };
          message?: string;
        };
        const data = axiosLike?.response?.data;
        const errField = data?.error;
        const beMessage =
          (typeof errField === 'object' ? errField?.message : errField) ||
          (typeof data?.message === 'string' ? data.message : undefined) ||
          axiosLike?.message;
        messageApi.error(beMessage || t('invitations.acceptFailed'));
      } finally {
        // Strip the query so refresh doesn't retry, and so the URL is clean.
        const next = new URLSearchParams(searchParams?.toString() ?? '');
        next.delete('inviteId');
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/dashboard'), {
          scroll: false,
        });
      }
    })();
  }, [
    isHydrated,
    user,
    bootstrapped,
    isAppLocked,
    pinSetupRequired,
    searchParams,
    pathname,
    router,
    accessToken,
    setWorkspaces,
    setCurrentWorkspaceId,
    messageApi,
    t,
  ]);

  // Always refresh subscription data on each layout mount (independent of bootstrap)
  useEffect(() => {
    if (!isHydrated || !user || user.isAdmin) return;
    // Connect mode: don't poll the ERP subscription at all. It gates the ERP
    // sidebar (not the Connect shell) and sits behind the App-Lock guard, so on
    // Connect this just 423s on a 60s timer with nothing to update. Skipping it
    // (and never arming the interval/listeners) stops the App-Lock bleed on
    // Connect. Mirrors the bootstrap subscription gate above.
    if (mode === 'connect') return;
    // App Lock - same gate as bootstrap. Don't poll subscription until we
    // know the lock state, and skip while locked / PIN setup is pending.
    if (appLockEnabled && (!pinStateResolved || isAppLocked || pinSetupRequired)) return;

    const refreshSubscription = () => {
      // Wave A Permission-Gated UI (2026-05-15) - workspace-scoped read
      // so invitees see the owner's plan, not their (null) own.
      const wsId = useWorkspaceStore.getState().currentWorkspaceId ?? undefined;
      getMySubscription(accessToken ?? undefined, wsId)
        .then((subRes) => {
          if (!subRes) return;
          const storeState = useSubscriptionStore.getState();
          const sub =
            subRes && typeof subRes === 'object' && 'subscription' in subRes
              ? (subRes as { subscription?: Subscription }).subscription
              : null;
          if (env.isDev) {
            console.info('[DashboardLayout] subscription refresh', {
              subscriptionId: sub?._id ?? null,
              tier:
                typeof sub?.planId === 'object' && sub?.planId
                  ? (sub.planId as { tier?: string }).tier
                  : ((subRes as { plan?: { tier?: string } })?.plan?.tier ?? null),
              status: sub?.status ?? null,
            });
          }
          if (sub) storeState.setSubscription(sub);
          const ents =
            subRes && typeof subRes === 'object' && 'entitlements' in subRes
              ? (subRes as { entitlements?: PlanEntitlements }).entitlements
              : null;
          if (ents) storeState.setEntitlements(ents);
        })
        .catch(() => {});
    };

    // Refresh on mount
    refreshSubscription();

    // Refresh when user switches back to this tab - catches admin plan changes and plan expiry
    const onVisibility = () => {
      if (document.visibilityState === 'visible') startTransition(refreshSubscription);
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onFocus = () => startTransition(refreshSubscription);
    const refreshTimer = window.setInterval(() => startTransition(refreshSubscription), 60000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      window.clearInterval(refreshTimer);
    };
    // Wave A - also re-fetch when the active workspace changes so an
    // invitee who switches between an owner's workspace and their own
    // (or between two owners' workspaces with different tiers) sees the
    // right entitlement set immediately, not after the 60s tick.
  }, [
    mode,
    appLockEnabled,
    isHydrated,
    user,
    accessToken,
    pinStateResolved,
    isAppLocked,
    pinSetupRequired,
    currentWorkspace?._id,
  ]);

  // RBAC re-architecture F1 (design §5) - fail-closed permission gate.
  // The dashboard shell is held behind a skeleton until `/me/permissions`
  // resolves; a forbidden deep-link renders a 403 screen in place of the
  // page (see the render block below). No render-through, no post-render
  // redirect. ERP-only - Connect (/platform) is identity-scoped, with no
  // workspace permissions.
  // App Lock - hold the `/me/permissions` fetch until the session is actually
  // unlocked. That endpoint is PIN-guarded; firing it during PIN setup (a no-PIN
  // user crossing Connect -> ERP, before they set a PIN) returns 423, which the
  // axios interceptor PARKS forever - the permissions cache then sticks in
  // 'loading' and this shell's loader never clears (only a hard refresh, which
  // resets the non-persisted cache, recovered). Gate the fetch with the SAME
  // readiness condition `bootstrap` uses below. Connect mode does not read
  // workspace permissions (permissionGate is false there), so leaving it enabled
  // is a no-op. Keep in sync with the bootstrap gate.
  const permissionsFetchReady =
    !appLockEnabled || (pinStateResolved && !isAppLocked && !pinSetupRequired);
  const {
    can: canPermission,
    canPath: canPathPermission,
    data: permissionsData,
    error: permissionsError,
  } = useMyPermissions({ enabled: permissionsFetchReady });
  const invalidatePermissions = usePermissionsStore((s) => s.invalidate);
  const revalidatePermissions = usePermissionsStore((s) => s.revalidate);
  const permissionGate = mode === 'erp' && !!user && !user.isAdmin;

  // Phase 1d - opportunistic permission refresh when the dashboard tab
  // regains focus. Without this, `usePermissionsStore` caches the first
  // /me/permissions response until workspace switch or hard reload, so a
  // permission change made in another tab/browser would leave the FE
  // evaluating against stale `paths` (misclassifies `selfScoped`, etc.).
  //
  // `revalidate` is stale-while-revalidate: it keeps the current `data`
  // visible while a background fetch swaps it in, with a 30s freshness
  // window. No loading-state flash, no thundering-herd on every focus
  // event (alt-tab, devtools, HMR).
  useEffect(() => {
    // `permissionGate` (mode === 'erp' && non-admin) - Connect is identity-
    // scoped and never reads workspace permissions, and `/me/permissions` is
    // App-Lock-guarded, so re-validating it on focus only 423s on Connect.
    // Gate it the same way the permission stream below already does, so Connect
    // never re-pulls ERP permissions.
    if (!currentWorkspaceId || !permissionGate) return;
    const onFocus = () => {
      void revalidatePermissions(currentWorkspaceId);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [currentWorkspaceId, permissionGate, revalidatePermissions]);

  // Real-time permission propagation (2026-05-22). SSE push from the BE the
  // instant an admin edits the caller's role/overrides, invalidating the perm
  // cache so the UI catches up within ~one round-trip: no manual reload, no
  // wait for the 60s notification poll. Pure enhancement layered on top of the
  // focus-revalidate (above) and the TopHeader notification poll, so a dropped
  // stream degrades gracefully rather than losing propagation entirely.
  useEffect(() => {
    if (!currentWorkspaceId || !permissionGate) return;
    const close = openPermissionStream(currentWorkspaceId, () => {
      invalidatePermissions(currentWorkspaceId);
    });
    return close;
  }, [currentWorkspaceId, permissionGate, invalidatePermissions]);

  // Show loader while:
  //   - Zustand is hydrating from localStorage, OR
  //   - workspace bootstrap hasn't finished for the authed user, OR
  //   - PIN state hasn't been resolved yet (so the dashboard never flashes
  //     before LockOverlay or the /auth/setup-pin redirect kicks in), OR
  //   - we're routing to /auth/setup-pin because PIN setup is required, OR
  //   - the session is App-Locked. While locked we deliberately do NOT
  //     mount Sidebar / TopHeader / page children - they would all fire
  //     server actions that 423 against `PinUnlockGuard` and surface as
  //     useless 500 streams in dev. The LockOverlay sits on top and
  //     captures the user's PIN entry instead.
  // App Lock terms (pinStateResolved / pinSetupRequired / isAppLocked) only
  // hold the shell in ERP/account mode. In Connect mode they are inert, so a
  // stray lock flip never blanks the Connect shell behind the loader/overlay.
  const showLoader =
    !isHydrated ||
    (!bootstrapped && !!user) ||
    (appLockEnabled && !!user && !user.isAdmin && !pinStateResolved) ||
    (appLockEnabled && pinSetupRequired) ||
    (appLockEnabled && !!user && !user.isAdmin && isAppLocked) ||
    // F1 - hold the shell until /me/permissions resolves. An errored fetch
    // falls through to the retry screen below (so it is excluded here).
    (permissionGate && permissionsData == null && !permissionsError);
  if (showLoader) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-page">
          <div className="text-center">
            <div className="mx-auto">
              <ManekHRStitchLoader size={140} />
            </div>
            <p className="mt-3 font-body text-[13px] text-subtle">{t('common.loadingZari360')}</p>
          </div>
        </div>
        <LockOverlay open={appLockEnabled && isAppLocked} />
      </>
    );
  }

  // F1 - /me/permissions failed → full-screen retry, never the shell.
  if (permissionGate && permissionsError) {
    return (
      <PermissionsErrorScreen
        onRetry={() => {
          if (currentWorkspaceId) invalidatePermissions(currentWorkspaceId);
        }}
      />
    );
  }

  // F1 - render-time route gate (replaces the post-render redirect). A
  // forbidden deep-link shows a 403 in the content area; the sidebar stays
  // so the user can move to a permitted route. Unmapped routes still pass
  // (F2 flips that to deny-by-default once the maps are complete).
  const routePerm = permissionGate ? resolveRoutePerm(pathname ?? '/dashboard') : null;
  const routeForbidden =
    permissionGate &&
    permissionsData != null &&
    !permissionsData.isOwner &&
    // F2 (fail-closed): no mapping → deny; 'open' → allow; perm → check.
    // Phase 1d - branch on path-form vs flat-form `RequiredPerm`.
    (routePerm === null
      ? true
      : routePerm !== 'open' &&
        ('path' in routePerm && routePerm.path !== undefined
          ? !canPathPermission(routePerm.path, routePerm.scope)
          : !canPermission(routePerm.module, routePerm.action, routePerm.scope)));

  // Central PLAN gate - subscription twin of the RBAC `routeForbidden` gate
  // above. The RBAC gate checks the caller's ROLE and exempts owners; it does
  // NOT check whether the workspace's PLAN includes the module. Module (plan)
  // locking was previously enforced only per-page via <ModuleLockedPage>, so a
  // page that omitted that guard (the Team screens) stayed reachable by direct
  // URL even while the sidebar showed the module locked with a crown. This
  // closes that whole class of gap in one chokepoint. Unmapped routes fall
  // through (resolveRouteModule -> null) and keep their own per-page guard as
  // the backstop. Plan limits apply to owners too, so this does NOT exempt
  // isOwner (unlike the RBAC gate); platform admins are excluded via
  // `permissionGate`. Gated on `subscriptionHydrated` so a locked page never
  // flashes before entitlements load; the `enabled` test mirrors Sidebar's
  // `useModuleEnabled` so the gate and the crown badge never disagree.
  const routeModule = permissionGate ? resolveRouteModule(pathname ?? '/dashboard') : null;
  const moduleLocked =
    routeModule != null &&
    subscriptionHydrated &&
    !(entitlements?.moduleAccess?.some((m) => m.module === routeModule && m.enabled) ?? false);

  // Dense Connect management consoles (e.g. the company-page console
  // `/connect/pages/<id>`) scroll their CONTENT area internally instead of the
  // window. Why: these pages pair a short main column with a tall right rail,
  // and AntD's nested Layout (flex, min-height:0) lets that content overflow the
  // viewport-height layout box rather than growing it - which shortened the
  // sticky product sidebar's containing block so it scrolled off near the
  // bottom. Making the content the scroll container means the window never
  // scrolls, so the sidebar (and the rail) physically cannot move. Scoped by
  // path so the feed and every other route keep the normal window-scroll model.
  const denseConsole = mode === 'connect' && !!pathname && pathname.startsWith('/connect/pages/');

  // Connect (non-console) pages FILL the content area via a flex chain so the
  // common footer's `mt-auto` pins it flush to the viewport bottom on short
  // pages (empty Network/feed states) instead of floating up with a dead gap.
  // Makes <Content> a flex column + the capture-root `flex-1`; the footer column
  // in app/connect/layout.tsx then uses `flex-1` against this. The dense console
  // owns its own internal-scroll model, so it is excluded. ERP is untouched.
  const connectFill = mode === 'connect' && !denseConsole;

  // Build these classNames with join() (NOT template-literal adjacency) so the
  // Tailwind prettier plugin can't strip the separating space and glue classes
  // together: it trims whitespace inside className string literals, which had
  // turned `md:pb-lg` + ` flex` into the invalid `md:pb-lgflex` (silently
  // dropping `display:flex` and breaking the footer fill). The join space is a
  // runtime value, so it survives. connectFill appends the flex-fill classes
  // that let app/connect/layout.tsx pin the footer to the bottom.
  const connectContentClassName = [
    'overflow-x-clip px-4 md:px-lg',
    mode === 'connect' ? 'pt-4 pb-24 md:pb-lg' : 'pt-5 pb-lg',
    connectFill ? 'flex flex-col' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const connectCaptureClassName = [
    'animate-fade-in mx-auto max-w-[1400px]',
    connectFill ? 'flex w-full flex-1 flex-col' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // NotificationProvider owns the single `/notifications` socket + shared
    // unread state for both shells. Mounted here (above TopHeader + sidebar +
    // page content) so the bell, the Connect sidebar badge, the mobile tab
    // badge, and the network invitations list all read one source of truth.
    <NotificationProvider>
      <Layout
        className="min-h-screen bg-page"
        // Exposes sidebar-collapse state to descendants via a CSS attribute
        // selector. `globals.css` defines `--cn-content-max-w`, `--cn-rail-*-w`,
        // and `--cn-feed-max-w` tokens that swap on
        // `[data-sidebar-collapsed='true']`, so Connect rails widen + the feed
        // column grows when the sidebar collapses (instead of just centering
        // with more empty margin). Skipping context here - pure CSS reaches
        // every descendant without prop-drilling or re-renders.
        data-sidebar-collapsed={collapsed ? 'true' : 'false'}
      >
        <PageTransitionLoader />
        {/* Sidebar rendered unconditionally - TopHeader drawer handles mobile.
          ModeSidebar picks the ERP or Connect sidebar for the active mode. */}
        {/* Account mode (`/account/*`) is product-neutral - no product sidebar.
          The page-level `AccountShell` renders its own sub-nav inside the
          content area. */}
        {mode !== 'account' && (
          <ModeSidebar
            mode={mode}
            collapsed={collapsed}
            onCollapse={setCollapsed}
            mobileOpen={false}
            onMobileClose={() => {}}
          />
        )}

        <Layout
          className="min-w-0 bg-page"
          // Console: bound the inner column to the viewport so its Content can
          // own the scroll (TopHeader stays, Content scrolls beneath it).
          style={denseConsole ? { height: '100dvh' } : undefined}
        >
          <TopHeader mode={mode} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
          {/* overflow-x-clip - several dashboard pages use a full-bleed
            wrapper with a hard-coded `margin:-24` that over-pulls on mobile
            (ancestor padding is px-4=16, not 24), causing ~8px of horizontal
            page overflow. `clip` (not `hidden`) removes the stray scrollbar
            without creating a scroll container or breaking sticky children. */}
          <Content
            // Connect pages share one uniform, modest top gap (`pt-4`, ~16px).
            // Previously the shared `pt-5` stacked on top of ConnectLayout's
            // own `pt-2`, doubling the gap above the activity "Back to profile"
            // bar; that extra `pt-2` is now removed in ConnectLayout, so every
            // Connect surface (feed, network, activity, profile) shares this
            // single gap with nothing doubling. ERP keeps `pt-5` unchanged, so
            // this cannot shift any ERP page.
            className={connectContentClassName}
            // Console: this is the scroll container (the window stays put, so the
            // product sidebar can't scroll away). `flex: auto` + `min-height: 0`
            // from AntD already let it fill the bounded inner column.
            style={denseConsole ? { overflowY: 'auto' } : undefined}
          >
            {showPreviewBanner && (
              <Alert
                title="You're viewing a limited preview. Upgrade to get full web access."
                type="warning"
                showIcon
                className="mb-4"
                action={
                  <Link href="/upgrade" className="text-sm font-medium">
                    Upgrade
                  </Link>
                }
              />
            )}
            {/* id is the stable capture target for the Feedback "Capture screen"
                tool (lib/services/feedback-capture.ts). Wraps only the page
                content, so a capture excludes the sidebar + sticky header. */}
            <div id="z360-capture-root" className={connectCaptureClassName}>
              {/* ERP billing dunning banner - ERP/account surface only. It polls
                  the App-Lock-guarded `subscriptions/dunning/status` every 60s,
                  which only 423s on Connect (nothing to show there). Gate it off
                  Connect so the Connect shell never polls it. The action also
                  fails soft on 423 as a backstop (lib/actions/billing.actions). */}
              {mode !== 'connect' && <DunningBanner />}
              {/* Trial countdown + post-expiry banners - ERP/account surface
                  only (Connect has no ERP subscription). Slim, dismissible,
                  mutually exclusive; reads the subscription store hydrated by
                  this layout. */}
              {mode !== 'connect' && <TrialBanners />}
              <PasswordSetupPrompt />
              {routeForbidden ? (
                <ForbiddenScreen />
              ) : moduleLocked && routeModule ? (
                <ModuleLockedPage module={routeModule} />
              ) : (
                children
              )}
            </div>
          </Content>
          {/* Connect mobile bottom tab bar - hidden on desktop (md+). */}
          {mode === 'connect' && <ConnectMobileTabBar />}
        </Layout>
      </Layout>
    </NotificationProvider>
  );
}
