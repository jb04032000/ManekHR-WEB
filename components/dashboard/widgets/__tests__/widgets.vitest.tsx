/**
 * Render tests for the props-driven dashboard enrichment widgets that have real
 * branching (empty vs data, label mapping, dimension switching). Uses the real
 * en.json catalog so ICU strings + the exact keys the widgets read are exercised.
 * Fetch-driven cards (attendance trend, who's-in, upcoming leave) and recharts
 * cards are covered by the BE test + manual smoke, not here (jsdom + recharts is
 * flaky and the BE owns the data correctness).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import enMessages from '@/app/messages/en.json';
import { WorkforceBreakdownCard } from '@/components/dashboard/widgets/WorkforceBreakdownCard';
import { MoneyMovementCard } from '@/components/dashboard/widgets/MoneyMovementCard';
import type { PayrollOverviewResponse, WorkforceBreakdown } from '@/types';

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

const workforce: WorkforceBreakdown = {
  total: 4,
  byDesignation: [
    { label: 'Weaver', count: 2 },
    { label: 'Helper', count: 1 },
    { label: null, count: 1 },
  ],
  byEmploymentType: [
    { label: 'full_time', count: 3 },
    { label: 'contract', count: 1 },
  ],
  byShift: [
    { label: 'Morning', count: 2 },
    { label: null, count: 1 },
  ],
};

describe('WorkforceBreakdownCard', () => {
  it('renders the designation breakdown with counts and an Unassigned bucket', () => {
    wrap(<WorkforceBreakdownCard workforce={workforce} loading={false} />);
    expect(screen.getByText('Weaver')).toBeInTheDocument();
    expect(screen.getByText('Helper')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument(); // null label
  });

  it('switches dimension to employment type and localises the keys', () => {
    wrap(<WorkforceBreakdownCard workforce={workforce} loading={false} />);
    fireEvent.click(screen.getByText('Type'));
    expect(screen.getByText('Full-time')).toBeInTheDocument(); // full_time → localised
    expect(screen.getByText('Contract')).toBeInTheDocument();
  });

  it('shows the empty state when there are no members', () => {
    wrap(<WorkforceBreakdownCard workforce={undefined} loading={false} />);
    expect(screen.getByText('Add team members to see the breakdown.')).toBeInTheDocument();
  });
});

const overview = (): PayrollOverviewResponse => ({
  summary: {
    totalPayable: 0,
    totalPaid: 0,
    totalPending: 0,
    totalOverpaid: 0,
    employeesCount: 0,
    paidCount: 0,
    pendingCount: 0,
    partialCount: 0,
    advanceCount: 0,
    salaryNotSetCount: 0,
    advancesLoansBonus: {
      totalOutstandingAdvances: 5000,
      totalActiveLoans: 2,
      totalOutstandingLoanPrincipal: 30000,
      totalBonus: 1000,
      totalCommission: 500,
      totalIncentive: 0,
    },
  },
  shiftSnapshot: [],
  trend: [],
});

describe('MoneyMovementCard', () => {
  it('renders rupee figures and the active-loan count', () => {
    wrap(<MoneyMovementCard data={overview()} loading={false} />);
    expect(screen.getByText('₹5,000')).toBeInTheDocument(); // outstanding advances
    expect(screen.getByText('₹30,000')).toBeInTheDocument(); // loan principal
    expect(screen.getByText('₹1,500')).toBeInTheDocument(); // bonus+commission+incentive
    expect(screen.getByText('2 active loans')).toBeInTheDocument();
  });

  it('shows the empty state without overview data', () => {
    wrap(<MoneyMovementCard data={null} loading={false} />);
    expect(screen.getByText('No advances, loans or bonuses yet.')).toBeInTheDocument();
  });
});
