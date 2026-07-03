'use server';

import axios from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { extractError } from '@/lib/common';
import type {
  User,
  Workspace,
  Subscription,
  Plan,
  PaginatedResponse,
  PaginationParams,
  UpdateUserStatusPayload,
  CreatePlanPayload,
  UpdatePlanPayload,
  AdminAssignPlanPayload,
  AdminCustomAssignPayload,
  AdminUpdateSubscriptionPayload,
  AdminUserDetails,
  Tier,
  CreateTierPayload,
  UpdateTierPayload,
  BrandingAssets,
  AdminUserWithSubscription,
  AdminConnectWallet,
} from '@/types';
import type { SessionInfo } from '@/lib/api/modules/sessions.api';

const E = ApiEndpoints.admin;

export async function getAdminStats() {
  const http = await serverHttp();
  return http.get(E.stats).then(unwrapServer<Record<string, number>>);
}

// Admin Users list. `product` filters the rows by product line (a person can be
// in ERP, Connect, both, or all). Each row carries split ERP + Connect plan
// summaries (see AdminUserWithSubscription). Read by app/admin/users.
export async function getAdminUsers(
  params?: PaginationParams & { product?: 'all' | 'erp' | 'connect' | 'both' },
) {
  const http = await serverHttp();
  return http
    .get(E.users, { params })
    .then(unwrapServer<PaginatedResponse<AdminUserWithSubscription>>);
}

export async function createAdminUser(data: {
  name: string;
  email?: string;
  mobile?: string;
  password: string;
  isActive?: boolean;
  isAdmin?: boolean;
  isEmailVerified?: boolean;
  createWorkspace?: boolean;
  workspaceName?: string;
  workspaceBusinessType?: string;
}) {
  const http = await serverHttp();
  return http.post(E.createUser, data).then(unwrapServer<User>);
}

export async function updateUserStatus(id: string, data: UpdateUserStatusPayload) {
  const http = await serverHttp();
  return http.patch(E.userStatus(id), data).then(unwrapServer<User>);
}

export async function deleteAdminUser(id: string, permanent: boolean = false) {
  const http = await serverHttp();
  return http
    .delete(E.deleteUser(id), { data: { permanent } })
    .then(unwrapServer<{ message: string }>);
}

/**
 * Complete, irreversible DPDP erase of a user's data (ACCOUNT-DELETION plan §8):
 * purges Connect content, anonymizes identity + scrubs basis-less PII, deletes
 * their files at the storage vendor, and retains only statutory records. The
 * proper replacement for the legacy permanent hard-delete (deleteAdminUser
 * permanent), which left salary/attendance/Connect/files orphaned. `confirm:true`
 * is required by the backend so it cannot fire by accident.
 */
export async function eraseAdminUser(id: string, reason?: string) {
  const http = await serverHttp();
  return http
    .post(E.eraseUser(id), { confirm: true, ...(reason ? { reason } : {}) })
    .then(unwrapServer<void>);
}

export async function restoreAdminUser(id: string) {
  const http = await serverHttp();
  return http.post(E.restoreUser(id)).then(unwrapServer<User>);
}

/**
 * Admin-mediated recovery of a DPDP self-serve deletion within the 30-day window
 * (ACCOUNT-DELETION-AND-DPDP-PLAN.md §6). Distinct from restoreAdminUser (the
 * generic soft-delete undo): this also clears the per-scope deletion markers,
 * reactivates the account, and restores owned workspaces best-effort. Surfaces the
 * BE `code` (NO_PENDING_DELETION / DELETION_WINDOW_EXPIRED) so the support UI can
 * explain an unavailable restore. Consumed by app/admin/pending-deletions.
 */
export type RestoreDeletionResult =
  | {
      ok: true;
      restored: string[];
      memberWorkspacesNeedReinvite?: boolean;
      workspaces?: { restored: string[]; failed: { workspaceId: string; code?: string }[] };
    }
  | { ok: false; error: string; code?: string };

export async function restoreUserDeletion(
  id: string,
  reason?: string,
): Promise<RestoreDeletionResult> {
  try {
    const http = await serverHttp();
    const data = await http.post(E.restoreDeletion(id), reason ? { reason } : {}).then(
      unwrapServer<{
        restored?: string[];
        memberWorkspacesNeedReinvite?: boolean;
        workspaces?: { restored: string[]; failed: { workspaceId: string; code?: string }[] };
      }>,
    );
    return {
      ok: true,
      restored: data.restored ?? [],
      memberWorkspacesNeedReinvite: data.memberWorkspacesNeedReinvite,
      workspaces: data.workspaces,
    };
  } catch (e) {
    const code = axios.isAxiosError(e)
      ? (e.response?.data as { code?: string } | undefined)?.code
      : undefined;
    return { ok: false, error: extractError(e), code };
  }
}

export async function getAdminWorkspaces(params?: PaginationParams) {
  const http = await serverHttp();
  return http.get(E.workspaces, { params }).then(unwrapServer<PaginatedResponse<Workspace>>);
}

export async function getAdminSubscriptions(params?: PaginationParams) {
  const http = await serverHttp();
  return http.get(E.subscriptions, { params }).then(unwrapServer<PaginatedResponse<Subscription>>);
}

export async function getAdminPlans() {
  const http = await serverHttp();
  return http.get(E.plans).then(unwrapServer<Plan[]>);
}

export async function createAdminPlan(data: CreatePlanPayload) {
  const http = await serverHttp();
  return http.post(E.createPlan, data).then(unwrapServer<Plan>);
}

export async function updateAdminPlan(id: string, data: UpdatePlanPayload) {
  const http = await serverHttp();
  return http
    .patch(E.updatePlan(id), data)
    .then(unwrapServer<{ plan: Plan; affectedSubscriberCount?: number }>);
}

export async function deleteAdminPlan(id: string) {
  const http = await serverHttp();
  return http.delete(E.deletePlan(id)).then(unwrapServer<{ message: string }>);
}

export async function getAdminUserDetails(id: string) {
  const http = await serverHttp();
  return http.get(E.userDetails(id)).then(unwrapServer<AdminUserDetails>);
}

export async function getAdminUserSubscription(userId: string) {
  const http = await serverHttp();
  return http.get(E.userSubscription(userId)).then(unwrapServer<Subscription | null>);
}

export async function getUserSubscriptionHistory(userId: string) {
  const http = await serverHttp();
  return http.get(E.userSubscriptionHistory(userId)).then(unwrapServer<Subscription[]>);
}

export async function adminAssignPlan(data: AdminAssignPlanPayload) {
  const http = await serverHttp();
  return http.post(E.assignPlan, data).then(unwrapServer<Subscription>);
}

export async function adminCustomAssignPlan(data: AdminCustomAssignPayload) {
  const http = await serverHttp();
  return http.post(E.customAssignPlan, data).then(unwrapServer<Subscription>);
}

// Assign the configured DEFAULT ERP plan to ONE user who has no active plan
// (admin-side counterpart to the signup auto-assign). The plan is resolved
// server-side, so no plan id is sent. Returns {assigned, reason?, planName?};
// assigned:false + reason:'already-has-plan' means the user already had a plan.
// Read by app/admin/users (per-row "Assign default plan" action).
export async function adminAssignDefaultPlan(userId: string, data?: { note?: string }) {
  const http = await serverHttp();
  return http
    .post(E.assignDefaultPlan(userId), data ?? {})
    .then(unwrapServer<{ assigned: boolean; reason?: string; planName?: string }>);
}

// Bulk backfill: assign the default ERP plan to EVERY user without an
// active/trial ERP subscription. Safe to re-run. Returns assigned/skipped/failed/
// total counts — `failed` isolates per-user errors so a single bad row never aborts
// the pass. Read by app/admin/users (header "Assign default to all" action).
export async function adminAssignDefaultPlanToMissing(data?: { note?: string }) {
  const http = await serverHttp();
  return http
    .post(E.assignDefaultMissing, data ?? {})
    .then(unwrapServer<{ assigned: number; skipped: number; failed: number; total: number }>);
}

export async function adminUpdateSubscription(id: string, data: AdminUpdateSubscriptionPayload) {
  const http = await serverHttp();
  return http.patch(E.updateSubscription(id), data).then(unwrapServer<Subscription>);
}

export async function adminCancelSubscription(id: string, data: { note?: string }) {
  const http = await serverHttp();
  return http
    .post(E.cancelSubscription(id), data)
    .then(unwrapServer<{ message: string; currentPeriodEnd?: string }>);
}

export async function adminRevokeSubscription(
  id: string,
  data: { action: 'no-plan' | 'assign-free' | 'assign-plan'; targetPlanId?: string; note?: string },
) {
  const http = await serverHttp();
  return http.delete(E.revokeSubscription(id), { data }).then(unwrapServer<{ message: string }>);
}

// Connect ads wallet (boost credits) for one person. Read by the Manage Plans
// drawer's ConnectWalletCard. Backed by the admin connect ads-wallet endpoint.
export async function getAdminWallet(userId: string) {
  const http = await serverHttp();
  return http.get(E.adminWallet(userId)).then(unwrapServer<AdminConnectWallet>);
}

// Adjust a person's Connect ads wallet by a signed whole-rupee amount with an
// audit reason (positive = add credits, negative = deduct). Returns the updated
// wallet so the card can refresh its balance. Linked to ConnectWalletCard.
export async function adminAdjustWallet(
  userId: string,
  data: { amount: number; reason: string; note?: string },
) {
  const http = await serverHttp();
  return http.post(E.adminWalletAdjust(userId), data).then(unwrapServer<AdminConnectWallet>);
}

// Global app settings shape. trialBanner toggles + optionally overrides the
// "45-day free trial" promo shown on the plans pages (in-app + public pricing).
// Mirrors backend UpdateSettingsDto / AppSettings. Linked to app/admin/settings.
export interface AdminAppSettings {
  freeTierEnabled: boolean;
  trialBanner?: {
    enabled: boolean;
    headlineOverride: string;
  };
}

export async function getAdminSettings() {
  const http = await serverHttp();
  return http.get(E.settings).then(unwrapServer<AdminAppSettings>);
}

// Partial update: send only the fields being changed (the free-tier toggle sends
// just freeTierEnabled; the settings page sends trialBanner on its own save).
export async function updateAdminSettings(data: Partial<AdminAppSettings>) {
  const http = await serverHttp();
  return http.patch(E.settings, data).then(unwrapServer<AdminAppSettings>);
}

// export async function getTiers() {
//   const http = await serverHttp();
//   return http.get(E.tiers).then(unwrapServer<Tier[]>);
// }

export async function createTier(data: CreateTierPayload) {
  const http = await serverHttp();
  return http.post(E.createTier, data).then(unwrapServer<Tier>);
}

export async function updateTier(id: string, data: UpdateTierPayload) {
  const http = await serverHttp();
  return http.patch(E.updateTier(id), data).then(unwrapServer<Tier>);
}

export async function deleteTier(id: string) {
  const http = await serverHttp();
  return http.delete(E.deleteTier(id)).then(unwrapServer<{ message: string }>);
}

export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const http = await serverHttp();
  const response = await http
    .get(E.userSessions(userId))
    .then(unwrapServer<{ data: SessionInfo[] }>);
  return response.data;
}

export async function adminTerminateUserSession(userId: string, sessionId: string): Promise<void> {
  const http = await serverHttp();
  await http.delete(`${E.userSessions(userId)}/${sessionId}`);
}

export async function updateUserSessionLimit(
  userId: string,
  sessionLimitOverride: number | null,
): Promise<{ sessionLimitOverride: number | null }> {
  const http = await serverHttp();
  return http
    .patch(E.userSessionLimit(userId), { sessionLimitOverride })
    .then(unwrapServer<{ sessionLimitOverride: number | null }>);
}

export async function getAdminWorkspaceDetail(id: string) {
  const http = await serverHttp();
  return http.get(E.workspaceDetail(id)).then(unwrapServer<any>);
}

export async function updateAdminWorkspaceEmailConfig(
  id: string,
  config: {
    emailLimitOverride?: number | null;
    smtpConfig?: {
      host?: string;
      port?: number;
      user?: string;
      pass?: string;
      fromEmail?: string;
      fromName?: string;
      secure?: boolean;
      enabled?: boolean;
    };
  },
) {
  const http = await serverHttp();
  return http.patch(E.workspaceEmailConfig(id), config).then(unwrapServer<{ message: string }>);
}

export async function testAdminWorkspaceSmtp(id: string) {
  const http = await serverHttp();
  return http
    .post(E.workspaceTestSmtp(id), {})
    .then(unwrapServer<{ success: boolean; message: string }>);
}

export async function resetAdminWorkspaceEmailUsage(id: string) {
  const http = await serverHttp();
  return http.post(E.workspaceResetEmailUsage(id), {}).then(unwrapServer<{ message: string }>);
}

export async function getAdminBranding(): Promise<BrandingAssets | undefined> {
  const http = await serverHttp();
  return http.get(E.branding).then(unwrapServer<BrandingAssets | undefined>);
}

export async function updateAdminBranding(branding: BrandingAssets): Promise<BrandingAssets> {
  const http = await serverHttp();
  return http.patch(E.branding, branding).then(unwrapServer<BrandingAssets>);
}
