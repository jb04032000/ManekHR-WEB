import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntitlementsDisplay } from './entitlements-display';
import type { PlanEntitlements } from '@/types';

const erpEnt: Partial<PlanEntitlements> = {
  maxWorkspaces: 5,
  maxMembersPerWorkspace: 10,
  maxTotalMembers: 50,
};

const connectEnt: Partial<PlanEntitlements> = {
  maxWorkspaces: 0,
  maxMembersPerWorkspace: 0,
  maxTotalMembers: 0,
  connect: {
    maxListings: 25,
    leadsPerMonth: -1,
    includedBoostCredits: 100,
    searchPriority: 3,
    verifiedBadge: true,
  },
};

describe('EntitlementsDisplay - Connect allowances (M3.4)', () => {
  it('shows ERP rows and no Connect rows for an erp product', () => {
    render(<EntitlementsDisplay entitlements={erpEnt} product="erp" />);
    expect(screen.getByText(/workspaces/i)).toBeInTheDocument();
    expect(screen.queryByText(/listings/i)).not.toBeInTheDocument();
  });

  it('shows Connect rows and hides ERP rows for a pure connect product', () => {
    render(<EntitlementsDisplay entitlements={connectEnt} product="connect" />);
    expect(screen.getByText(/25 listings/i)).toBeInTheDocument();
    // leadsPerMonth -1 => Unlimited
    expect(screen.getByText(/unlimited leads/i)).toBeInTheDocument();
    expect(screen.queryByText(/workspaces/i)).not.toBeInTheDocument();
  });

  it('shows BOTH ERP and Connect rows for a bundle product', () => {
    render(
      <EntitlementsDisplay
        entitlements={{ ...erpEnt, connect: connectEnt.connect }}
        product="bundle"
      />,
    );
    expect(screen.getByText(/workspaces/i)).toBeInTheDocument();
    expect(screen.getByText(/25 listings/i)).toBeInTheDocument();
  });

  it('renders the verified-badge line only when verifiedBadge is true', () => {
    render(<EntitlementsDisplay entitlements={connectEnt} product="connect" />);
    expect(screen.getByText(/verified badge/i)).toBeInTheDocument();
  });

  it('falls back to ERP rows for a connect product that has no connect data (tier card)', () => {
    render(<EntitlementsDisplay entitlements={erpEnt} product="connect" />);
    expect(screen.getByText(/workspaces/i)).toBeInTheDocument();
  });

  it('defaults to ERP rows when no product is passed (back-compat)', () => {
    render(<EntitlementsDisplay entitlements={erpEnt} />);
    expect(screen.getByText(/workspaces/i)).toBeInTheDocument();
  });
});
