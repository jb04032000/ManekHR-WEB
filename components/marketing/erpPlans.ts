import type { Plan, Tier } from '@/types';
import type { PlanD1Extensions } from '@/types/billing';
import type { ErpPlanView } from './ErpPricingTable';
// Shared helper: orders cards by the admin-controlled Tier displayOrder so this
// grid matches the in-app plans hub + dashboard activation strip.
import { sortPlansByTierOrder } from '@/lib/utils/subscription.utils';

/**
 * Shared selector for the public ERP plan grid. Single source of truth for both
 * marketing pricing surfaces:
 *  - app/(marketing)/pricing/page.tsx (unified pricing page)
 *  - app/(marketing)/erp/pricing/page.tsx (ERP product pricing page)
 *
 * What it does: keeps only the public, self-serve ERP plans (product 'erp', not
 * custom, publicly visible, one of the four canonical tiers), ordered by the
 * admin Tier displayOrder (lowest first) via the shared sortPlansByTierOrder
 * helper, and maps each to the minimal ErpPlanView the card needs (price / staff
 * cap / 1-year-term + GST fields, all with safe defaults for plans that predate a
 * field). Custom (isPubliclyVisible:false + isCustom:true) never renders.
 *
 * Keep in sync with the seed (seed-default-tiers-and-plans.ts). Prices are in
 * RUPEES (not paise) per the seed; Free = 0.
 */
// The four canonical public ERP tiers. Used as the membership ALLOWLIST (only
// these tiers render in the grid) and as the ordering FALLBACK when live tiers
// aren't passed in. Card order itself now comes from the admin Tier displayOrder.
export const ERP_TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  business: 3,
};

export function selectPublicErpPlans(plans: Plan[], tiers: Tier[] = []): ErpPlanView[] {
  const filtered = plans.filter((plan) => {
    const ext = plan as Plan & PlanD1Extensions;
    const isErp = !plan.product || plan.product === 'erp';
    const isPublic = ext.isPubliclyVisible !== false;
    const isCustom = ext.isCustom === true;
    return isErp && isPublic && !isCustom && plan.tier in ERP_TIER_RANK;
  });

  // Order by the admin-controlled Tier displayOrder (single source of truth). Fall
  // back to the static ERP_TIER_RANK only when tiers weren't available (e.g. a
  // tiers-fetch hiccup), so the grid still renders in a sensible order, never raw
  // DB order.
  const ordered = tiers.length
    ? sortPlansByTierOrder(filtered, tiers)
    : [...filtered].sort((a, b) => (ERP_TIER_RANK[a.tier] ?? 99) - (ERP_TIER_RANK[b.tier] ?? 99));

  return ordered.map((plan) => {
    // 1-year-term pricing fields live on PlanD1Extensions (additive/optional).
    // Default discount 0, installments ON, 12 months when the plan omits them.
    const ext = plan as Plan & PlanD1Extensions;
    return {
      tier: plan.tier,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      maxMembers: plan.entitlements?.maxMembersPerWorkspace ?? 0,
      upfrontDiscountPercent: ext.upfrontDiscountPercent ?? 0,
      installmentsEnabled: ext.installmentsEnabled ?? true,
      installmentMonths: ext.installmentMonths ?? 12,
      // GST is ON unless explicitly false (backend Plan.gstEnabled contract).
      gstEnabled: ext.gstEnabled !== false,
      gstRatePercent: ext.gstRatePercent ?? 18,
      isPriceTaxInclusive: ext.isPriceTaxInclusive ?? false,
      // Admin-editable card content (localized tagline + feature bullets). Passed
      // through so ErpPricingTable can render it (with a static i18n fallback when
      // a plan has none). Mirrors backend Plan.marketing.
      marketing: plan.marketing,
    };
  });
}
