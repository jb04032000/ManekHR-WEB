import type { Tier, PlanEntitlements, ModuleAccessEntry } from '@/types';
import { FEATURE_ACCESS_REGISTRY } from '@/lib/constants/feature-access.registry';
import type { FeatureAccessLevel } from '@/types';

export const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  active: 'success',
  cancelled: 'error',
  expired: 'default',
  trial: 'purple',
  superseded: 'default',
  scheduled: 'blue',
};

export function getTierColor(tiers: Tier[], tierKey: string): string {
  const tier = tiers.find((t) => t.key === tierKey);
  return tier?.color || 'default';
}

/**
 * Look up a tier's displayOrder dynamically. Returns 0 if tier not found
 * (treats unknown tier as lowest - Free-equivalent).
 */
export function getTierDisplayOrder(tiers: Tier[], tierKey: string): number {
  return tiers.find((t) => t.key === tierKey)?.displayOrder ?? 0;
}

/**
 * Returns true if `tierKey` has displayOrder >= `thresholdKey`'s displayOrder.
 * Use for hierarchy comparisons that respect admin-defined tier ordering.
 *
 * Example: isTierAtOrAbove(tiers, plan.tier, 'growth') → true if plan.tier
 * is Growth, Business, Enterprise, or Custom (assuming default ordering).
 */
export function isTierAtOrAbove(tiers: Tier[], tierKey: string, thresholdKey: string): boolean {
  return getTierDisplayOrder(tiers, tierKey) >= getTierDisplayOrder(tiers, thresholdKey);
}

/**
 * Returns true if `tierKey` represents any paid tier (displayOrder > 0).
 * Free tier is conventionally displayOrder=0.
 */
export function isPaidTier(tiers: Tier[], tierKey: string): boolean {
  return getTierDisplayOrder(tiers, tierKey) > 0;
}

/**
 * Order plan cards by their tier's admin-controlled displayOrder (ascending:
 * lower displayOrder shown first). Single source of truth for plan-card ordering
 * across every ERP plan listing (the in-app plans hub, the marketing pricing
 * grid via selectPublicErpPlans, and the dashboard NoPlanActivation strip) so
 * they all follow the Tiers admin order instead of raw DB order.
 *
 * Cross-module links: the tier displayOrder is set in the admin Tiers page and
 * mirrored by backend getPublicTiers()/refreshTierCache() (tiers sorted asc).
 * Reuses that order; no new per-plan field.
 *
 * Behaviour:
 *  - Looks the tier up by `plan.tier` key. An unknown tier (no match, or empty
 *    `tiers`) sorts LAST so a stray plan never jumps to the top.
 *  - Stable for plans sharing a tier: keeps their incoming order via an explicit
 *    original-index tiebreaker (deterministic regardless of engine sort stability).
 *  - Pure: returns a NEW array; never mutates the input.
 */
export function sortPlansByTierOrder<T extends { tier: string }>(plans: T[], tiers: Tier[]): T[] {
  const orderByKey = new Map(tiers.map((t) => [t.key, t.displayOrder]));
  // Unknown tier -> Infinity so it sorts after every known tier.
  const rank = (key: string) => orderByKey.get(key) ?? Number.POSITIVE_INFINITY;
  return plans
    .map((plan, index) => ({ plan, index }))
    .sort((a, b) => rank(a.plan.tier) - rank(b.plan.tier) || a.index - b.index)
    .map((entry) => entry.plan);
}

export function formatEntitlementValue(value: number | undefined | null): string {
  if (value === -1 || value === undefined || value === null) {
    return 'Unlimited';
  }
  return String(value);
}

export function countUnlockedFeatures(moduleAccess: ModuleAccessEntry[]): {
  modules: number;
  features: number;
  total: number;
} {
  const enabledModules = moduleAccess.filter((m) => m.enabled).length;
  let unlockedFeatures = 0;
  let totalFeatures = 0;
  for (const mod of moduleAccess) {
    for (const sf of mod.subFeatures) {
      totalFeatures++;
      if (sf.access !== 'locked') unlockedFeatures++;
    }
  }
  return { modules: enabledModules, features: unlockedFeatures, total: totalFeatures };
}

export function buildEmptyPlanEntitlements(
  overrides?: Partial<PlanEntitlements>,
): PlanEntitlements {
  return {
    maxWorkspaces: 1,
    maxMembersPerWorkspace: 5,
    maxTotalMembers: 5,
    modules: [],
    features: {
      export: false,
      apiAccess: false,
      advancedRbac: false,
      customRoles: false,
      shifts: false,
      bills: false,
    },
    moduleAccess: getDefaultModuleAccessEntries(),
    ...overrides,
  };
}

export function getDefaultModuleAccessEntries(
  defaultAccess: 'locked' | 'full' = 'locked',
): ModuleAccessEntry[] {
  return FEATURE_ACCESS_REGISTRY.filter((mod) => mod.module !== 'bills').map((mod) => ({
    module: mod.module,
    enabled: false,
    subFeatures: mod.subFeatures.map((sf) => ({
      key: sf.key,
      access: defaultAccess as FeatureAccessLevel,
    })),
  }));
}

/**
 * Reconcile a stored plan/tier `moduleAccess` array against the live
 * FEATURE_ACCESS_REGISTRY so the admin module-access editor can manage EVERY
 * registry module + every sub-feature key.
 *
 * Why: the editor (components/admin/module-access-editor.tsx) renders one panel
 * per registry module and its handlers only `.map()` over EXISTING entries — so
 * any module or sub-feature key absent from the stored shape was a dead no-op
 * (e.g. Locations couldn't go "full", Machines features didn't respond). Stored
 * access drifts because tier defaults / older plans never carried the newer
 * modules (machines, locations, inventory, gst_compliance, ...). This fills the
 * gaps so the controls bind.
 *
 * INVARIANT (keep in sync with backend SubscriptionGuard): the guard treats an
 * ENABLED module with an EMPTY subFeatures array as FULL access. So a module
 * stored as `{enabled:true, subFeatures:[]}` currently grants FULL at runtime.
 * When we backfill that module's keys we MUST default them to 'full', else
 * merely opening + saving a plan in admin would silently downgrade it to locked.
 * Every other missing key backfills as 'locked' (opt-in).
 *
 * Pure: never mutates the input array or its entries.
 */
export function reconcileModuleAccessWithRegistry(
  stored: ModuleAccessEntry[],
): ModuleAccessEntry[] {
  const storedByModule = new Map((stored ?? []).map((e) => [e.module, e]));

  // One reconciled entry per registry module (bills excluded — consistent with
  // getDefaultModuleAccessEntries / getDefaultModuleAccessFromTier).
  const reconciled: ModuleAccessEntry[] = FEATURE_ACCESS_REGISTRY.filter(
    (mod) => mod.module !== 'bills',
  ).map((mod) => {
    const entry = storedByModule.get(mod.module);

    if (!entry) {
      // No stored entry → visible + opt-in. "No entry = no access" preserved:
      // disabled, all keys locked.
      return {
        module: mod.module,
        enabled: false,
        subFeatures: mod.subFeatures.map((sf) => ({
          key: sf.key,
          access: 'locked' as FeatureAccessLevel,
        })),
      };
    }

    // Enabled-but-empty = FULL at runtime (see invariant above) → backfilled
    // keys must default to 'full' to preserve that, not 'locked'.
    const emptyEnabled = entry.enabled && (!entry.subFeatures || entry.subFeatures.length === 0);
    const existingByKey = new Map((entry.subFeatures ?? []).map((sf) => [sf.key, sf]));

    const subFeatures = mod.subFeatures.map((sf) => {
      const existing = existingByKey.get(sf.key);
      // Reuse the stored sub-feature object as-is (preserves 'limited' etc.);
      // only backfill keys the stored shape was missing.
      if (existing) return existing;
      return {
        key: sf.key,
        access: (emptyEnabled ? 'full' : 'locked') as FeatureAccessLevel,
      };
    });

    // Preserve enabled + any other persisted fields on the entry.
    return { ...entry, subFeatures };
  });

  // Append any stored modules NOT in the registry (and not bills) unchanged so a
  // save never drops persisted data. The editor won't render them, but they
  // must survive a round-trip.
  const registryModules = new Set(FEATURE_ACCESS_REGISTRY.map((m) => m.module));
  for (const entry of stored ?? []) {
    if (!registryModules.has(entry.module) && entry.module !== 'bills') {
      reconciled.push(entry);
    }
  }

  return reconciled;
}

export const TIER_COLORS = [
  { value: 'default', label: 'Default (Gray)' },
  { value: 'blue', label: 'Blue' },
  { value: 'gold', label: 'Gold' },
  { value: 'purple', label: 'Purple' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'geekblue', label: 'Geek Blue' },
  { value: 'lime', label: 'Lime' },
  { value: 'magenta', label: 'Magenta' },
  { value: 'volcano', label: 'Volcano' },
];
