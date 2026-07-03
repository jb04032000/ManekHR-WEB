import { describe, it, expect } from 'vitest';
import { selectPublicErpPlans } from './erpPlans';
import type { Plan } from '@/types';

/**
 * selectPublicErpPlans threads the admin-editable card content
 * (marketing.tagline + featureHighlights) from the backend Plan onto the minimal
 * ErpPlanView the public pricing cards read. Without this, ErpPricingTable could
 * never see the per-plan copy and would always fall back to the static defaults.
 */
function makePlan(over: Partial<Plan> = {}): Plan {
  return {
    _id: 'p1',
    name: 'Growth',
    tier: 'growth',
    product: 'erp',
    isActive: true,
    monthlyPrice: 999,
    yearlyPrice: 9999,
    entitlements: { maxMembersPerWorkspace: 100 } as Plan['entitlements'],
    ...over,
  } as Plan;
}

describe('selectPublicErpPlans marketing passthrough', () => {
  it('carries marketing.tagline + featureHighlights onto the view', () => {
    const plan = makePlan({
      marketing: {
        tagline: { en: 'For teams running payroll' },
        featureHighlights: [{ en: 'Full payroll' }, { en: 'Payslips' }],
      },
    });

    const [view] = selectPublicErpPlans([plan]);

    expect(view.marketing?.tagline?.en).toBe('For teams running payroll');
    expect(view.marketing?.featureHighlights).toHaveLength(2);
    expect(view.marketing?.featureHighlights?.[0].en).toBe('Full payroll');
  });

  it('leaves marketing undefined when the plan has none (card uses the static fallback)', () => {
    const [view] = selectPublicErpPlans([makePlan()]);
    expect(view.marketing).toBeUndefined();
  });
});
