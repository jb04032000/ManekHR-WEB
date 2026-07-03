/**
 * ConnectRevenueDashboard -- unit tests (RTL + vitest).
 * Pure presentational: renders subscription tiles, boost-spend tile, and the
 * per-plan table from props. No server actions to mock.
 */
import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import ConnectRevenueDashboard from './ConnectRevenueDashboard';
import type { ConnectRevenueSummary } from './revenue.types';

const REVENUE: ConnectRevenueSummary = {
  subscription: {
    grossPaise: 12000000, // ₹1,20,000
    refundedPaise: 1500000, // ₹15,000
    netPaise: 10500000, // ₹1,05,000
    payments: 7,
    byPlan: [
      {
        planId: 'p1',
        planName: 'Connect Premium',
        tier: 'premium',
        grossPaise: 10000000,
        refundedPaise: 1500000,
        netPaise: 8500000,
        payments: 5,
      },
    ],
  },
};

describe('ConnectRevenueDashboard', () => {
  it('renders the net subscription revenue and boost spend tiles', () => {
    renderWithIntl(<ConnectRevenueDashboard revenue={REVENUE} boostCreditsSpent={4200} />);
    expect(screen.getByText('Net subscription revenue')).toBeInTheDocument();
    expect(screen.getByText('₹1,05,000')).toBeInTheDocument();
    expect(screen.getByText('Boost spend')).toBeInTheDocument();
    expect(screen.getByText('4,200')).toBeInTheDocument();
  });

  it('renders the per-plan revenue row', () => {
    renderWithIntl(<ConnectRevenueDashboard revenue={REVENUE} boostCreditsSpent={0} />);
    expect(screen.getByText('Connect Premium')).toBeInTheDocument();
    expect(screen.getByText('₹85,000')).toBeInTheDocument();
  });

  it('handles a null revenue payload with zeroed tiles', () => {
    renderWithIntl(<ConnectRevenueDashboard revenue={null} boostCreditsSpent={0} />);
    expect(screen.getByText('No Connect subscription revenue yet.')).toBeInTheDocument();
  });
});
