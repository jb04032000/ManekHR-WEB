'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, message } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { listWorkspaces } from '@/lib/actions';
import { meApi, type PendingInvite } from '@/lib/api/modules/me.api';
import { normalizeWorkspaceList } from '@/lib/utils/workspace.utils';
import { RegisterWorkspaceMode } from '@/components/auth/modes/RegisterWorkspaceMode';
import type { Mode } from '@/components/auth/modes/types';
import { useLogout } from '@/hooks/useLogout';

/**
 * Workspace-setup gate for authed users who don't have a workspace yet.
 *
 * Reached by two distinct populations, told apart by the `?flow=signup` marker
 * that only the signup orchestrator (AuthClient) appends:
 *
 *   1. SIGNUP (`?flow=signup`) - a brand-new ERP-intent user whose account was
 *      just minted by /auth/verify-otp. Back here means "cancel signup", so it
 *      tears the session down (BE logout + local clear) and routes to /auth.
 *
 *   2. EXISTING SESSION (no marker) - an already-authenticated, workspace-less
 *      user who arrived via the ERP/Connect mode switch (ModeSwitcher), the
 *      Connect cross-sell card, or the DashboardLayout workspace gate. Back here
 *      must NOT sign them out; it returns them to Connect.
 *
 * Pending-invite gate (2026-06-12): an invited member (WorkspaceMember row with
 * status 'invited') has ZERO workspaces in `findAllForUser` (active-only query),
 * so the DashboardLayout gate lands them here. Before showing the create form,
 * this page checks `/me/invites/pending` and, if any exist, offers Accept /
 * Decline first - "create your own" stays available as a secondary action.
 * Accept reuses the Sidebar switcher flow (meApi.acceptInvite, membership-row
 * userId auth, no token) and routes into /dashboard. Keep the accept/decline
 * semantics in sync with components/layout/Sidebar.tsx (`handleAcceptInvite`).
 *
 * Mounts the same `RegisterWorkspaceMode` used inline by `AuthClient` so the UI
 * is unchanged from the inline-register path. Token comes from Zustand / the
 * httpOnly cookie already written by `/auth/verify-otp`.
 *
 * Why the existing-session Back targets `/connect/feed` and not `router.back()`:
 * `/connect` is connect-mode, where the ERP workspace-gate does not fire, so
 * there is no authed + workspace-less round-trip back to this page. A naive
 * `router.back()` or `/dashboard` would loop via proxy + workspace-gate.
 */
function SetupWorkspaceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations('auth');
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  // Shared sign-out teardown for the signup-cancel branch below (revoke session,
  // clear state, hard-reload to /auth). See hooks/useLogout.ts.
  const performLogout = useLogout();
  const { setWorkspaces, setCurrentWorkspaceId } = useWorkspaceStore();
  const [msgApi, msgCtx] = message.useMessage();

  // Pending-invite state. 'loading' until /me/invites/pending answers; a
  // fetch failure falls back to [] so the create form is never blocked.
  const [invites, setInvites] = useState<PendingInvite[] | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  // User explicitly chose "create my own" despite having pending invites.
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Only the genuine signup-cancel path is marked. Anything unmarked is an
  // existing session, so the default is the safe, non-destructive Back.
  const isSignupCancel = params.get('flow') === 'signup';

  const handleBack = useCallback(async () => {
    if (!isSignupCancel) {
      // Existing authed session: return to Connect without signing out.
      router.replace('/connect/feed');
      return;
    }
    // Signup-cancel: full shared sign-out teardown (revoke session, clear state,
    // hard-reload to /auth) so it can't leave the half-onboarded session firing
    // 401s during a soft transition.
    await performLogout();
  }, [isSignupCancel, performLogout, router]);

  // `RegisterWorkspaceMode`'s inline orchestrator semantics map `setMode` to
  // step transitions. On this standalone page there are no other steps; the
  // ONLY transition the form invokes is 'register' (its Back button). Wire
  // that to the context-aware Back handler above - except when the user got
  // here past a pending-invites panel, where Back returns to that panel.
  const setMode = useCallback(
    (next: Mode) => {
      if (next === 'register') {
        if (showCreateForm && (invites?.length ?? 0) > 0) {
          setShowCreateForm(false);
          return;
        }
        void handleBack();
      }
    },
    [handleBack, showCreateForm, invites],
  );

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.hasWorkspace) {
      router.replace('/dashboard');
    }
  }, [isHydrated, user, router]);

  // Fetch pending invites once for the workspace-less session. Errors resolve
  // to [] (not a retry loop) - the create form is the safe fallback.
  //
  // Fail-safe (2026-06-20): never hold this page blank forever on the invite
  // check. The shared axios interceptor (lib/api/client.ts) PARKS an app-lock
  // 423 indefinitely - it returns a promise that only settles on unlock - so a
  // caller that 423s here would leave `invites === null` permanently and the
  // whole page renders blank (the early `if (invites === null) return null`). If
  // the check has not settled within a few seconds, fall back to the create form
  // ([] = no pending invites). A real response, if it ever arrives, still wins
  // via setInvites above. The root cause is fixed on the backend
  // (`/me/invites/*` is `@SkipPinUnlock`, since App Lock is ERP-only); this is
  // defence-in-depth so no single parked request can blank the screen again.
  useEffect(() => {
    if (!isHydrated || !user || user.hasWorkspace) return;
    let cancelled = false;
    meApi
      .pendingInvites()
      .catch(() => [] as PendingInvite[])
      .then((data) => {
        if (!cancelled) setInvites(data);
      });
    const failSafe = setTimeout(() => {
      if (!cancelled) setInvites((prev) => (prev === null ? [] : prev));
    }, 6000);
    return () => {
      cancelled = true;
      clearTimeout(failSafe);
    };
  }, [isHydrated, user]);

  // Accept mirrors Sidebar's handleAcceptInvite: activate membership, refresh
  // the workspace list into the store, broadcast so any mounted Sidebar
  // refetches, then enter the ERP. The gate in DashboardLayout re-bootstraps
  // on mount and now sees the active membership, so no redirect loop.
  const handleAccept = async (invite: PendingInvite) => {
    setBusyInviteId(invite.id);
    try {
      const res = await meApi.acceptInvite(invite.id);
      const wsRes = await listWorkspaces().catch(() => null);
      if (wsRes && typeof wsRes === 'object' && 'ok' in wsRes && wsRes.ok) {
        setWorkspaces(normalizeWorkspaceList(wsRes.data));
      }
      setCurrentWorkspaceId(res.workspace._id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('z360:invites-changed'));
      }
      router.replace('/dashboard');
    } catch {
      msgApi.error(t('setupWorkspace.acceptFailed'));
      setBusyInviteId(null);
    }
  };

  const handleDecline = async (invite: PendingInvite) => {
    setBusyInviteId(invite.id);
    try {
      await meApi.declineInvite(invite.id);
      const remaining = await meApi.pendingInvites().catch(() => [] as PendingInvite[]);
      setInvites(remaining);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('z360:invites-changed'));
      }
    } catch {
      msgApi.error(t('setupWorkspace.declineFailed'));
    } finally {
      setBusyInviteId(null);
    }
  };

  if (!isHydrated || !user || user.hasWorkspace) return null;
  // Hold rendering until the invite check answers, so an invited user never
  // sees the create form flash before the invites panel swaps in.
  if (invites === null) return null;

  const showInvitesPanel = invites.length > 0 && !showCreateForm;

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      {msgCtx}
      <div className="w-[min(440px,100%)] rounded-xl border border-border-light bg-surface p-7 shadow-md">
        {showInvitesPanel ? (
          <div>
            <h1 className="m-0 mb-1 text-[20px] font-bold text-heading">
              {t('setupWorkspace.invitesTitle')}
            </h1>
            <p className="m-0 mb-5 text-[13px] text-muted">{t('setupWorkspace.invitesSubtitle')}</p>
            <div className="flex flex-col gap-3">
              {invites.map((inv) => {
                const wsName = inv.workspace?.name ?? t('setupWorkspace.workspaceFallback');
                const busy = busyInviteId === inv.id;
                return (
                  <div key={inv.id} className="rounded-lg border border-border-light bg-page p-4">
                    <div className="flex items-center gap-2">
                      <BankOutlined style={{ color: 'var(--cr-info-700)' }} />
                      <span className="truncate text-[14px] font-semibold text-heading">
                        {wsName}
                      </span>
                    </div>
                    <p className="m-0 mt-1 text-[12px] text-muted">
                      {t('setupWorkspace.invitedAsBy', {
                        role: inv.role?.name ?? t('setupWorkspace.roleFallback'),
                        name: inv.invitedBy,
                      })}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="primary"
                        size="small"
                        loading={busy}
                        disabled={busyInviteId !== null && !busy}
                        onClick={() => void handleAccept(inv)}
                      >
                        {t('setupWorkspace.accept')}
                      </Button>
                      <Button
                        size="small"
                        disabled={busyInviteId !== null}
                        onClick={() => void handleDecline(inv)}
                      >
                        {t('setupWorkspace.decline')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Button block onClick={() => setShowCreateForm(true)}>
                {t('setupWorkspace.createOwnInstead')}
              </Button>
              {!isSignupCancel && (
                <Button block type="text" onClick={() => void handleBack()}>
                  {t('registerWorkspace.backToConnect')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <RegisterWorkspaceMode
            setMode={setMode}
            identifier={user.mobile ?? user.email ?? ''}
            setIdentifier={() => {}}
            hideAccountFields
            backLabel={
              // Back returns to the invites panel when one is pending, so the
              // label must not promise Connect in that case.
              showCreateForm && (invites?.length ?? 0) > 0
                ? t('registerWorkspace.back')
                : isSignupCancel
                  ? undefined
                  : t('registerWorkspace.backToConnect')
            }
            registerData={{
              name: '',
              identifier: user.mobile ?? user.email ?? '',
              password: undefined,
            }}
            onAuthSuccess={async () => {
              router.replace('/dashboard');
            }}
            onSessionLimit={() => {}}
          />
        )}
      </div>
    </div>
  );
}

export default function SetupWorkspacePage() {
  // `useSearchParams` requires a Suspense boundary to avoid a CSR-bailout build
  // error, mirroring the auth verify-email / reset-password pages.
  return (
    <Suspense fallback={null}>
      <SetupWorkspaceInner />
    </Suspense>
  );
}
