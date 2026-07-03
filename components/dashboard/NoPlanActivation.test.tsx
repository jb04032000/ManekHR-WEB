/**
 * NoPlanActivation -- regression test for the ERP-plan filter on the
 * "Unlock your workspace" activation screen.
 *
 * Bug: the screen filtered the fetched plans by `isActive` ONLY, so it listed
 * EVERY active plan -- Connect plans ("Connect Free"/"Connect Premium") and the
 * hidden/Custom plan included. Connect Premium's ₹499 then won Math.min for the
 * "Starting from" callout even though this is the ERP dashboard.
 *
 * These tests feed a MIXED plan list and assert the screen shows ERP self-serve
 * plans only and that the entry price is the cheapest ERP PAID plan (₹999), not
 * the ₹499 Connect plan. The filter must mirror the plans hub
 * (app/account/subscription/plans/page.tsx) and the marketing pricing page
 * (app/(marketing)/erp/pricing/page.tsx selectPublicErpPlans) -- keep all three
 * in sync. Mirrors the AdminPlansPage test: mock @/lib/actions + @/lib/store
 * before importing the subject.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { PlanWithBilling, Tier } from '@/types';

const getPlansMock = vi.fn();
const getTiersMock = vi.fn();

vi.mock('@/lib/actions', () => ({
  getPlans: (...a: unknown[]) => getPlansMock(...a),
  getTiers: (...a: unknown[]) => getTiersMock(...a),
}));

// The component reads the signed-in user's first name for the greeting.
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { name: 'Asha Patel' } }),
}));

import NoPlanActivation from './NoPlanActivation';

// Minimal ERP entitlements stub -- not asserted, only shape-satisfying.
const ENTITLEMENTS = {
  maxWorkspaces: 1,
  maxMembersPerWorkspace: 5,
  maxTotalMembers: 5,
  modules: ['attendance'],
  features: {
    export: false,
    apiAccess: false,
    advancedRbac: false,
    customRoles: false,
    shifts: false,
    bills: false,
  },
  moduleAccess: [{ module: 'attendance', enabled: true, subFeatures: [] }],
};

function makePlan(over: Partial<PlanWithBilling> & { _id: string; name: string }): PlanWithBilling {
  return {
    tier: 'free',
    product: 'erp',
    isActive: true,
    monthlyPrice: 0,
    yearlyPrice: 0,
    entitlements: ENTITLEMENTS,
    ...over,
  } as PlanWithBilling;
}

// MIXED list: 2 self-serve ERP plans + 2 Connect plans + 1 hidden/custom ERP.
const ERP_FREE = makePlan({ _id: 'erp-free', name: 'ERP Free', tier: 'free', monthlyPrice: 0 });
const ERP_STARTER = makePlan({
  _id: 'erp-starter',
  name: 'Starter',
  tier: 'starter',
  monthlyPrice: 999,
});
const CONNECT_FREE = makePlan({
  _id: 'connect-free',
  name: 'Connect Free',
  product: 'connect',
  tier: 'free',
  monthlyPrice: 0,
});
const CONNECT_PREMIUM = makePlan({
  _id: 'connect-premium',
  name: 'Connect Premium',
  product: 'connect',
  tier: 'premium',
  monthlyPrice: 499,
});
// Hidden + custom ERP plan: must never surface on the public activation screen.
const HIDDEN_CUSTOM = makePlan({
  _id: 'erp-custom',
  name: 'Acme Custom',
  tier: 'custom',
  monthlyPrice: 250,
  isPubliclyVisible: false,
  isCustom: true,
});

const TIERS: Tier[] = [
  {
    _id: 'tier-free',
    name: 'Free',
    key: 'free',
    displayOrder: 0,
    color: 'default',
    isActive: true,
    defaultEntitlements: { maxWorkspaces: 1, maxMembersPerWorkspace: 5, maxTotalMembers: 5 },
  },
  {
    _id: 'tier-starter',
    name: 'Starter',
    key: 'starter',
    displayOrder: 1,
    color: 'default',
    isActive: true,
    defaultEntitlements: { maxWorkspaces: 1, maxMembersPerWorkspace: 25, maxTotalMembers: 25 },
  },
];

describe('NoPlanActivation ERP-only plan filter', () => {
  beforeEach(() => {
    getPlansMock.mockReset();
    getTiersMock.mockReset();
    getPlansMock.mockResolvedValue([
      ERP_FREE,
      ERP_STARTER,
      CONNECT_FREE,
      CONNECT_PREMIUM,
      HIDDEN_CUSTOM,
    ]);
    getTiersMock.mockResolvedValue(TIERS);
  });

  it('lists ERP self-serve plans only (no Connect, no hidden/custom)', async () => {
    renderWithIntl(<NoPlanActivation />);

    // The "Available plans" grid renders once plans resolve; the ERP Starter
    // card proves the grid is populated.
    await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());

    // ERP plans present.
    expect(screen.getByText('ERP Free')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();

    // Connect + hidden/custom plans must NOT appear anywhere on the screen.
    expect(screen.queryByText('Connect Premium')).not.toBeInTheDocument();
    expect(screen.queryByText('Connect Free')).not.toBeInTheDocument();
    expect(screen.queryByText('Acme Custom')).not.toBeInTheDocument();
  });

  it('shows the cheapest ERP PAID price (₹999), not the ₹499 Connect price', async () => {
    renderWithIntl(<NoPlanActivation />);

    // Wait for the loading skeleton to resolve into the price callout.
    await waitFor(() => expect(screen.getByText('Starting from')).toBeInTheDocument());

    // Entry price = cheapest ERP paid plan. ₹999 shows in both the "Starting
    // from" callout and the Starter card in the grid, so allow >= 1 match.
    expect(screen.getAllByText('₹999').length).toBeGreaterThan(0);
    // The Connect Premium ₹499 price must never drive the callout (or appear).
    expect(screen.queryByText('₹499')).not.toBeInTheDocument();
  });
});
