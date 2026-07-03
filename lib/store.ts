import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Workspace, Subscription, PlanEntitlements, PurchasedAddOn } from '@/types';
import { syncAuthCookie } from '@/lib/actions/cookies';

// ── Auth Store ─────────────────────────────────────────────
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  /**
   * App Lock (Quick PIN) - transient state, NOT persisted. Cold rehydrate
   * always starts `isAppLocked = false` and a fresh `/auth/pin-status`
   * round-trip determines actual lock state. See DashboardLayout bootstrap.
   */
  isAppLocked: boolean;
  pinSetupRequired: boolean;
  unlockExpiresAt: string | null;
  /**
   * Set the authenticated user + tokens. By default also schedules an httpOnly
   * cookie write so middleware + server actions see the session. Pass
   * `{ skipCookieSync: true }` for the OTP-register flow where we want tokens
   * in memory but NOT in cookies yet - middleware would otherwise bounce the
   * user off /auth before workspace setup completes.
   */
  setAuth: (
    user: User,
    accessToken: string,
    refreshToken?: string | null,
    opts?: { skipCookieSync?: boolean },
  ) => void;
  updateUser: (patch: Partial<User>) => void;
  setAppLocked: (locked: boolean, unlockExpiresAt?: string | null) => void;
  setPinSetupRequired: (required: boolean) => void;
  clearLockState: () => void;
  logout: () => void;
  _setHydrated: () => void;
}

const safeLS =
  typeof window !== 'undefined'
    ? localStorage
    : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };

// Track if we've already synced cookies to avoid repeated calls
let cookieSyncScheduled = false;

const scheduleCookieSync = () => {
  if (cookieSyncScheduled || typeof window === 'undefined') return;
  cookieSyncScheduled = true;

  // Read the freshest tokens at FIRE time, never a stale closured value: a
  // debounced sync scheduled with token A must not overwrite the cookie once
  // a refresh has rotated localStorage to token B (B is current, A is
  // revoked - writing A back makes every server component 401).
  const flush = () => {
    cookieSyncScheduled = false;
    const accessToken = safeLS.getItem('z360_access_token');
    // OQ-1 (auth-hardening): the refresh token is NO LONGER kept in localStorage
    // (XSS hardening). It lives only in the httpOnly cookie written by the auth
    // server actions on login/register/refresh. A bare access-token sync here
    // (e.g. on rehydrate) deliberately omits the refresh token so it cannot
    // overwrite/clear the httpOnly refresh cookie set by the server.
    if (accessToken) {
      syncAuthCookie(accessToken).catch(() => {});
    }
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(flush);
  } else {
    setTimeout(flush, 100);
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: false,
      isAppLocked: false,
      pinSetupRequired: false,
      unlockExpiresAt: null,

      setAuth: (user, accessToken, refreshToken = null, opts) => {
        // Sync raw access token for the Axios request interceptor (client-side).
        // OQ-1 (auth-hardening): the refresh token is intentionally NOT written
        // to localStorage anymore — it lives only in the httpOnly cookie set by
        // the auth server action that produced this login result (XSS-safe). We
        // keep it in memory (transient) for the current tab session only.
        if (typeof window !== 'undefined') {
          localStorage.setItem('z360_access_token', accessToken);
          // Sync the access token to the httpOnly cookie for Server Actions
          // (debounced). The refresh cookie was already set by the server action.
          // Skipped for OTP-register so middleware lets the user finish workspace
          // setup on /auth before the cookie unlocks /dashboard routing.
          if (!opts?.skipCookieSync) {
            scheduleCookieSync();
          }
        }
        // isHydrated = true so the redirect guard fires immediately after login
        set({ user, accessToken, refreshToken, isHydrated: true });
      },

      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : null })),

      setAppLocked: (locked, unlockExpiresAt = null) =>
        set({ isAppLocked: locked, unlockExpiresAt: locked ? null : unlockExpiresAt }),

      setPinSetupRequired: (required) => set({ pinSetupRequired: required }),

      clearLockState: () =>
        set({ isAppLocked: false, pinSetupRequired: false, unlockExpiresAt: null }),

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('z360_access_token');
          // OQ-1: `z360_refresh_token` is no longer stored in localStorage, but
          // remove it defensively to clean up any value persisted by a build
          // from before this hardening (one-time self-cleanup on first logout).
          localStorage.removeItem('z360_refresh_token');
          localStorage.removeItem('z360_workspace_id');
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAppLocked: false,
          pinSetupRequired: false,
          unlockExpiresAt: null,
        });
      },

      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'z360_auth',
      storage: createJSONStorage(() => safeLS),
      // Fired after Zustand restores state from localStorage on mount
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
          // Keep the raw access token in sync for the Axios request interceptor.
          // OQ-1: the refresh token is NOT persisted/restored anymore (XSS
          // hardening) — it lives only in the httpOnly cookie.
          if (state.accessToken) safeLS.setItem('z360_access_token', state.accessToken);
          // Defer cookie sync until after router initialization (debounced)
          if (state.accessToken) {
            scheduleCookieSync();
          }
        }
      },
      // Only persist these fields - not isHydrated (it should always start false
      // on SSR), and NOT refreshToken (OQ-1: httpOnly cookie only, never in
      // localStorage). `user` + `accessToken` are kept so a tab reload restores
      // the session UI immediately; the access token is short-lived (~15 min)
      // and the refresh flow self-heals it from the httpOnly cookie.
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
      }),
    },
  ),
);

// ── Workspace Store ────────────────────────────────────────
interface WorkspaceState {
  currentWorkspaceId: string | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isHydrated: boolean;
  setCurrentWorkspaceId: (id: string) => void;
  setWorkspaces: (ws: Workspace[]) => void;
  /**
   * Optimistic replace of the currently selected workspace doc. Used by
   * settings PATCH flows (e.g. attendance compliance threshold) so the
   * new value is visible across the app without a refetch. Also mirrors
   * the change into the cached `workspaces` array entry of the same id.
   */
  setCurrentWorkspace: (ws: Workspace) => void;
  clearWorkspace: () => void;
  _setHydrated: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      currentWorkspaceId: null,
      workspaces: [],
      currentWorkspace: null,
      isHydrated: false,

      setCurrentWorkspaceId: (id) => {
        const ws = get().workspaces.find((w) => w._id === id) || null;
        set({ currentWorkspaceId: id, currentWorkspace: ws });
      },

      setWorkspaces: (workspaces) => {
        const currentId = get().currentWorkspaceId;

        // Deduplicate workspaces by _id
        const uniqueWorkspaces = workspaces.filter(
          (ws, index, self) => index === self.findIndex((w) => w._id === ws._id),
        );

        // Priority: 1) Current workspace ID, 2) Default workspace, 3) First workspace
        let current: Workspace | null = null;

        if (currentId) {
          current = uniqueWorkspaces.find((w) => w._id === currentId) || null;
        }

        if (!current && uniqueWorkspaces.length > 0) {
          // Check if any workspace is marked as default
          const defaultWorkspace = uniqueWorkspaces.find((w) => w.isDefault === true);
          current = defaultWorkspace || uniqueWorkspaces[0];
        }

        set({
          workspaces: uniqueWorkspaces,
          currentWorkspace: current,
          currentWorkspaceId: current?._id || null,
        });
      },

      setCurrentWorkspace: (ws) => {
        const list = get().workspaces;
        const next = list.length ? list.map((w) => (w._id === ws._id ? ws : w)) : [ws];
        set({
          currentWorkspace: ws,
          currentWorkspaceId: ws._id,
          workspaces: next,
        });
      },

      clearWorkspace: () =>
        set({
          currentWorkspaceId: null,
          workspaces: [],
          currentWorkspace: null,
        }),

      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'z360_workspace',
      storage: createJSONStorage(() => safeLS),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
        }
      },
      partialize: (s) => ({
        currentWorkspaceId: s.currentWorkspaceId,
        workspaces: s.workspaces,
        currentWorkspace: s.currentWorkspace,
      }),
    },
  ),
);

// ── Subscription Store ─────────────────────────────────────
interface SubscriptionState {
  subscription: Subscription | null;
  entitlements: PlanEntitlements | null;
  plan: { _id: string; name: string; tier: string } | null;
  activeAddOns: PurchasedAddOn[];
  // Platform-wide "Coming Soon" module flags (admin-set, public read). A LOCKED
  // module in this list renders the Coming Soon card / nav badge instead of the
  // upgrade prompt. Fetched fail-soft in DashboardLayout bootstrap; consumed by
  // useFeatureAccess + Sidebar. Presentation-only - never affects gating.
  comingSoonModules: string[];
  isLoading: boolean;
  isHydrated: boolean;
  setSubscription: (subscription: Subscription | null) => void;
  setEntitlements: (entitlements: PlanEntitlements | null) => void;
  setActiveAddOns: (addOns: PurchasedAddOn[]) => void;
  setComingSoonModules: (modules: string[]) => void;
  clearSubscription: () => void;
  setLoading: (loading: boolean) => void;
  _setHydrated: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      subscription: null,
      entitlements: null,
      plan: null,
      activeAddOns: [],
      comingSoonModules: [],
      isLoading: true,
      isHydrated: false,

      setSubscription: (subscription) => {
        const entitlements = subscription?.appliedEntitlements || null;
        const plan = (subscription?.planId as any) || null;
        set({ subscription, entitlements, plan, isLoading: false });
      },

      setEntitlements: (entitlements) => set({ entitlements, isLoading: false }),

      setActiveAddOns: (activeAddOns) => set({ activeAddOns }),

      setComingSoonModules: (comingSoonModules) => set({ comingSoonModules }),

      clearSubscription: () =>
        set({
          subscription: null,
          entitlements: null,
          plan: null,
          activeAddOns: [],
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'z360_subscription',
      storage: createJSONStorage(() => safeLS),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
          // Keep isLoading: true - fresh fetch will set it to false
        }
      },
      partialize: (s) => ({
        subscription: s.subscription,
        entitlements: s.entitlements,
        plan: s.plan,
        activeAddOns: s.activeAddOns,
        comingSoonModules: s.comingSoonModules,
      }),
    },
  ),
);
