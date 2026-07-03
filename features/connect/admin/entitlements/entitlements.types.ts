/**
 * Types for the admin per-user Connect entitlements console.
 *
 * Mirrors the backend AdminConnectEntitlementsView (admin-connect-entitlements.
 * service.ts) and the ConnectAllowances / ConnectUsageRow shapes. Kept local to
 * this feature so the admin screen has a typed contract without leaking Connect
 * allowance types into the global types barrel.
 */

/** The resolved Connect allowance block. `-1` = unlimited on numeric fields. */
export interface ConnectAllowances {
  maxListings: number;
  leadsPerMonth: number;
  includedBoostCredits: number;
  verifiedBadge: boolean;
  searchPriority: number;
  maxCompanyPages: number;
  maxStorefronts: number;
  maxJobs: number;
  storageMb: number;
  overLimitPolicy: 'freeze' | 'hide_newest';
  overLimitGraceDays: number;
}

/** A partial override - only the keys the admin actually set. */
export type ConnectEntitlementsOverride = Partial<ConnectAllowances>;

/** One usage row (per kind) from GET /me/connect/usage, reused by the admin view. */
export interface ConnectUsageRow {
  kind: 'listing' | 'storefront' | 'company_page' | 'job' | 'storage';
  used: number;
  limit: number;
  overLimit: boolean;
  policy: 'freeze' | 'hide_newest';
  graceDays: number;
  overLimitSince: string | null;
  graceEndsAt: string | null;
  suppressionActive: boolean;
  suppressedCount: number;
}

/** The full three-section view returned by the admin GET endpoint. */
export interface AdminConnectEntitlementsView {
  user: { id: string; name: string | null; email: string | null; mobile: string | null };
  hasConnectSubscription: boolean;
  subscriptionId: string | null;
  plan: { name: string | null; tier: string | null; status: string } | null;
  planDefaults: ConnectAllowances;
  override: ConnectEntitlementsOverride | null;
  effective: ConnectAllowances;
  usage: ConnectUsageRow[];
}
