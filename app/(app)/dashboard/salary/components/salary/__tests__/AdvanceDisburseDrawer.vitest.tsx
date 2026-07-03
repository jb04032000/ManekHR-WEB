import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TDD: AdvanceDisburseDrawer two-step disburse (Plan 2026-06-22 Task 5).
 * Verifies: split with two lines summing to approvedAmount + disbursedByName
 * calls payAdvanceRequest with splitLines and disbursedByName.
 * Links: AdvanceDisburseDrawer.tsx, salary.api.ts payAdvanceRequest.
 */

const { payAdvanceRequest } = vi.hoisted(() => ({
  payAdvanceRequest: vi.fn(),
}));

vi.mock('@/lib/api/modules/salary.api', () => ({ payAdvanceRequest }));
vi.mock('@/features/salary/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({
    symbol: '₹',
    inline: (n: number) => `₹${n}`,
    full: (n: number) => `₹${n}`,
  }),
}));
// AdvanceInstallmentConfigurator calls salaryApi.previewAdvanceSchedule; stub out.
vi.mock('@/lib/api', () => ({
  salaryApi: {
    previewAdvanceSchedule: vi
      .fn()
      .mockResolvedValue({ installments: [], complianceResult: { breaches: [], warnings: [] } }),
  },
}));
// Workspace store used by AdvanceInstallmentConfigurator.
vi.mock('@/lib/store', () => ({
  useWorkspaceStore: (selector: (s: { currentWorkspaceId: string }) => unknown) =>
    selector({ currentWorkspaceId: 'ws1' }),
}));

import { AdvanceDisburseDrawer } from '../AdvanceDisburseDrawer';

const MESSAGES = {
  advanceDisburse: {
    drawerTitle: 'Disburse Advance',
    paymentMethodLabel: 'Payment Method',
    cash: 'Cash',
    bankTransfer: 'Bank Transfer',
    upi: 'UPI',
    cheque: 'Cheque',
    split: 'Split Payment',
    other: 'Other',
    referenceNoLabel: 'Reference No.',
    disbursedByLabel: 'Disbursed By',
    disbursedByPlaceholder: 'Name of person who disbursed',
    addSplitLine: 'Add payment line',
    removeSplitLine: 'Remove',
    splitMethodLabel: 'Method',
    splitAmountLabel: 'Amount',
    splitSumError: 'Split amounts must sum to the approved amount',
    recoveryPlanLabel: 'Recovery Plan',
    recoveryPlanHint: 'How to deduct this advance from future salary',
    submitButton: 'Disburse',
    cancel: 'Cancel',
    successMessage: 'Advance disbursed',
    approvedAmountLabel: 'Approved Amount',
    noteLabel: 'Note',
  },
  salary: {
    advancePlan: {
      title: 'Recovery Plan',
      byMonths: 'By months',
      byAmount: 'By amount',
      countLabel: 'Number of months',
      amountLabel: 'Monthly amount',
      countPlaceholder: '3',
      amountPlaceholder: '1000',
      monthsSuffix: 'months',
      previewError: 'Preview failed',
      helperLine: '{count} installments',
      viewSchedule: 'View {count}',
      colMonth: 'Month',
      colInstallment: 'Amount',
      colProjectedNet: 'Net',
      cappedBadge: 'Capped',
      cappedWarning: 'Some installments are capped',
    },
    payDrawer: {
      compliance: {
        breachDeductionCap: 'Breach: cap',
        breachMinWage: 'Breach: min wage',
        warnOneThird: 'Warn: one third',
        warn12Month: 'Warn: 12 month',
        warnMinWageUnconfigured: 'Min wage not configured',
      },
    },
  },
};

const APPROVED_AMOUNT_PAISE = 500000; // Rs 5000

const REQUEST = {
  _id: 'req1',
  workspaceId: 'ws1',
  teamMemberId: 'tm1',
  month: 6,
  year: 2026,
  requestedAmount: APPROVED_AMOUNT_PAISE,
  approvedAmount: APPROVED_AMOUNT_PAISE,
  status: 'approved' as const,
  requestedOn: '2026-06-01T00:00:00Z',
};

function setup() {
  return render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <App>
        <AdvanceDisburseDrawer
          open
          workspaceId="ws1"
          requests={[REQUEST]}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      </App>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  payAdvanceRequest.mockReset();
  payAdvanceRequest.mockResolvedValue({ ...REQUEST, status: 'paid' });
});
afterEach(cleanup);

describe('AdvanceDisburseDrawer — split payment', () => {
  it('calls payAdvanceRequest with splitLines summing to approvedAmount and disbursedByName', async () => {
    setup();

    // Select "Split Payment" method
    const methodSelect = screen.getByRole('combobox');
    fireEvent.mouseDown(methodSelect);
    const splitOption = await screen.findByText('Split Payment');
    fireEvent.click(splitOption);

    // After choosing split, two default split lines should appear.
    // Fill the first line: bank_transfer Rs 3000 (300000 paise)
    // Fill the second line: cash Rs 2000 (200000 paise)
    // The split rows: each row has a method select + amount spinbutton.
    const spinbuttons = screen.getAllByRole('spinbutton');
    // Fill first amount
    fireEvent.change(spinbuttons[0], { target: { value: '3000' } });
    fireEvent.blur(spinbuttons[0]);
    // Fill second amount
    fireEvent.change(spinbuttons[1], { target: { value: '2000' } });
    fireEvent.blur(spinbuttons[1]);

    // Fill disbursedByName
    const disbursedByInput = screen.getByPlaceholderText('Name of person who disbursed');
    fireEvent.change(disbursedByInput, { target: { value: 'Rajan' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Disburse/i }));

    await waitFor(() => expect(payAdvanceRequest).toHaveBeenCalledTimes(1));

    const [wsId, id, payload] = payAdvanceRequest.mock.calls[0];
    expect(wsId).toBe('ws1');
    expect(id).toBe('req1');
    expect(payload.disbursedByName).toBe('Rajan');
    expect(payload.splitLines).toBeDefined();
    expect(payload.splitLines).toHaveLength(2);

    const total = (payload.splitLines as Array<{ amount: number }>).reduce(
      (sum, l) => sum + l.amount,
      0,
    );
    expect(total).toBe(APPROVED_AMOUNT_PAISE);
  });
});
