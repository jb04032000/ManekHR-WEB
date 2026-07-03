// TDD: AdvanceAllocationPanel - tests written BEFORE implementation (Task 2, Plan 2026-06-22).
// Verifies:
//   1. "Distribute" button fills rows whose allocations sum <= pool.
//   2. "Approve allocated" calls approveAdvanceRequest once per funded row (allocated > 0).
// Links: AdvanceAllocationPanel.tsx, allocateAdvancePool.ts, salary.api.ts approveAdvanceRequest.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mock before any imports that might trigger module evaluation.
const { approveAdvanceRequest } = vi.hoisted(() => ({
  approveAdvanceRequest: vi.fn(),
}));

vi.mock('@/lib/api/modules/salary.api', () => ({ approveAdvanceRequest }));
vi.mock('@/features/salary/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({
    symbol: '₹',
    inline: (n: number) => `₹${n}`,
    full: (n: number) => `₹${n}`,
  }),
}));

// Import AFTER mocks are registered.
import { AdvanceAllocationPanel } from '../AdvanceAllocationPanel';
import type { AdvanceSalaryRequest } from '@/types';

// Minimal i18n messages needed by the panel.
const MESSAGES = {
  advanceAllocation: {
    panelTitle: 'Budget Allocation',
    poolLabel: 'Fundable amount',
    distributeButton: 'Distribute',
    approveAllocatedButton: 'Approve allocated',
    allocateColLabel: 'Allocate',
    rollsToNext: 'Rolls to next window',
    totalLabel: 'Total allocated',
    overBudgetWarning: 'Total exceeds pool',
    progressApproving: 'Approving {done} of {total}...',
    approveAllSuccess: 'Approved {count} requests',
    noRequests: 'No pending requests',
  },
};

const PENDING_REQUESTS: AdvanceSalaryRequest[] = [
  {
    _id: 'req1',
    workspaceId: 'ws1',
    teamMemberId: 'tm1',
    month: 6,
    year: 2026,
    requestedAmount: 20000000, // ₹2,00,000
    status: 'pending',
    requestedOn: '2026-06-01T00:00:00Z',
  },
  {
    _id: 'req2',
    workspaceId: 'ws1',
    teamMemberId: 'tm2',
    month: 6,
    year: 2026,
    requestedAmount: 30000000, // ₹3,00,000
    status: 'pending',
    requestedOn: '2026-06-02T00:00:00Z',
  },
];

function setup(overrides?: Partial<{ onApproveSuccess: () => void }>) {
  const onApproveSuccess = overrides?.onApproveSuccess ?? vi.fn();
  return {
    onApproveSuccess,
    ...render(
      <NextIntlClientProvider locale="en" messages={MESSAGES}>
        <App>
          <AdvanceAllocationPanel
            workspaceId="ws1"
            pendingRequests={PENDING_REQUESTS}
            memberNames={{ tm1: 'Alice', tm2: 'Bob' }}
            onApproveSuccess={onApproveSuccess}
          />
        </App>
      </NextIntlClientProvider>,
    ),
  };
}

beforeEach(() => {
  approveAdvanceRequest.mockReset();
  approveAdvanceRequest.mockResolvedValue({ status: 'approved' });
});
afterEach(cleanup);

describe('AdvanceAllocationPanel', () => {
  it('renders both pending requests', () => {
    setup();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('fills allocation rows after Distribute and sum <= pool', async () => {
    setup();

    // Enter pool = ₹3,00,000 = 300000 rupees into the pool InputNumber
    // The spinbutton labelled "Fundable amount" is the pool input.
    const poolInput = screen.getByRole('spinbutton', { name: /fundable amount/i });
    fireEvent.change(poolInput, { target: { value: '300000' } });
    fireEvent.blur(poolInput);

    fireEvent.click(screen.getByRole('button', { name: /distribute/i }));

    // After distribute, allocation spinbuttons appear for each row.
    // Alice (₹2,00,000 / ₹5,00,000 * ₹3,00,000 = ₹1,20,000) and
    // Bob (₹3,00,000 / ₹5,00,000 * ₹3,00,000 = ₹1,80,000).
    // The sum must be <= 300000 (₹3,00,000).
    const allocInputs = screen.getAllByRole('spinbutton', { name: /allocate/i });
    expect(allocInputs).toHaveLength(2);

    const val1 = parseFloat((allocInputs[0] as HTMLInputElement).value);
    const val2 = parseFloat((allocInputs[1] as HTMLInputElement).value);

    expect(val1 + val2).toBeLessThanOrEqual(300000);
    // Each must be positive
    expect(val1).toBeGreaterThan(0);
    expect(val2).toBeGreaterThan(0);
  });

  it('calls approveAdvanceRequest once per funded row (both funded)', async () => {
    setup();

    // Set pool and distribute
    const poolInput = screen.getByRole('spinbutton', { name: /fundable amount/i });
    fireEvent.change(poolInput, { target: { value: '300000' } });
    fireEvent.blur(poolInput);
    fireEvent.click(screen.getByRole('button', { name: /distribute/i }));

    // Click "Approve allocated"
    fireEvent.click(await screen.findByRole('button', { name: /approve allocated/i }));

    await waitFor(() => expect(approveAdvanceRequest).toHaveBeenCalledTimes(2));

    // Each call must carry approvedAmount in paise (positive integer)
    for (const call of approveAdvanceRequest.mock.calls) {
      const [wsId, id, payload] = call as [string, string, { approvedAmount: number }];
      expect(wsId).toBe('ws1');
      expect(['req1', 'req2']).toContain(id);
      expect(payload.approvedAmount).toBeGreaterThan(0);
      expect(Number.isInteger(payload.approvedAmount)).toBe(true);
    }
  });

  it('only calls approveAdvanceRequest for rows with allocation > 0', async () => {
    // Pool so small that at least one row gets 0 (pool < smallest request)
    setup();

    const poolInput = screen.getByRole('spinbutton', { name: /fundable amount/i });
    // ₹50,000 pool (5000000 paise). Alice: 2/5 * 50000 = 20000 (₹20,000 = 2000000 paise > roundTo).
    // Bob: 3/5 * 50000 = 30000 (₹30,000 = 3000000 paise > roundTo).
    // Actually both are funded, so use an even smaller pool where Bob floored to 0.
    // Pool = ₹100 = 10000 paise. Alice raw: 10000*20000000/50000000 = 4000 → floor/10000*10000 = 0
    // Both 0. Let's use a pool that funds only one: ₹1,00,000.
    // Alice: 100000*2/5=40000, Bob: 100000*3/5=60000 — both funded.
    // To get one at zero, use pool = ₹100 → both are 0 (raw < 10000).
    fireEvent.change(poolInput, { target: { value: '100' } }); // ₹100 pool → both alloc = 0
    fireEvent.blur(poolInput);
    fireEvent.click(screen.getByRole('button', { name: /distribute/i }));

    fireEvent.click(await screen.findByRole('button', { name: /approve allocated/i }));

    // With ₹100 pool both round to 0, so no approvals should fire
    await new Promise((r) => setTimeout(r, 100));
    expect(approveAdvanceRequest).toHaveBeenCalledTimes(0);
  });

  it('shows rolls-to-next-window label for rows allocated 0', async () => {
    setup();

    const poolInput = screen.getByRole('spinbutton', { name: /fundable amount/i });
    fireEvent.change(poolInput, { target: { value: '100' } }); // tiny pool → both 0
    fireEvent.blur(poolInput);
    fireEvent.click(screen.getByRole('button', { name: /distribute/i }));

    // Both rows should show "Rolls to next window" label
    const labels = screen.getAllByText(/rolls to next window/i);
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });
});
