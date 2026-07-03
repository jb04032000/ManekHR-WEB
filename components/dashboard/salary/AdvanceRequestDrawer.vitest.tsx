import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression: the advance-salary request body must NOT carry `teamMemberId`.
 * The backend `CreateAdvanceRequestDto` deliberately omits it (the caller's own
 * member id is resolved from the JWT for IDOR safety) and the global
 * ValidationPipe runs `forbidNonWhitelisted: true` - so any stray `teamMemberId`
 * in the payload is rejected with a 400 before the handler runs. This test locks
 * the drawer to the slim {requestedAmount, month, year} contract.
 * Links: advance-salary-request.dto.ts, AdvanceRequestDrawer.tsx.
 *
 * Task 6 (2026-06-22): added getAdvanceWindow mock + closed-window Submit-disabled test.
 * Links: AdvanceWindowControl.tsx (owner side), advance-request-window.util.ts (BE logic).
 */

const { createAdvanceRequest, getAdvanceWindow } = vi.hoisted(() => ({
  createAdvanceRequest: vi.fn(),
  getAdvanceWindow: vi.fn(),
}));

vi.mock('@/lib/api/modules/salary.api', () => ({ createAdvanceRequest, getAdvanceWindow }));
vi.mock('@/features/salary/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({ symbol: '₹', inline: (n: number) => `₹${n}` }),
}));

import { AdvanceRequestDrawer } from './AdvanceRequestDrawer';

const messages = {
  advanceSalary: {
    requestDrawerTitle: 'Request Advance Salary',
    requestDrawerDescription: 'Advance for {month}/{year}.',
    requestedAmountLabel: 'Amount',
    amountRequired: 'Amount is required',
    amountMustBePositive: 'Must be positive',
    amountPlaceholder: 'Enter amount',
    requestSubmitted: 'Request submitted',
    cancel: 'Cancel',
    submitRequest: 'Submit request',
  },
};

function setup() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <App>
        <AdvanceRequestDrawer
          open
          onClose={() => {}}
          workspaceId="ws1"
          currentMonth={6}
          currentYear={2026}
        />
      </App>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  createAdvanceRequest.mockReset();
  createAdvanceRequest.mockResolvedValue({ _id: 'r1' });
  // Default: window is open so existing tests are unaffected.
  getAdvanceWindow.mockReset();
  getAdvanceWindow.mockResolvedValue({
    isOpenToday: true,
    message: 'Advances open on day 21',
    policy: { mode: 'fixed_day', fixedDay: 21 },
  });
});
afterEach(cleanup);

describe('AdvanceRequestDrawer submit payload', () => {
  it('submits {requestedAmount, month, year} and NEVER a teamMemberId field', async () => {
    setup();
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: /Submit request/i }));

    await waitFor(() => expect(createAdvanceRequest).toHaveBeenCalledTimes(1));
    const [wsId, payload] = createAdvanceRequest.mock.calls[0];
    expect(wsId).toBe('ws1');
    expect(payload).not.toHaveProperty('teamMemberId');
    expect(payload).toMatchObject({ requestedAmount: 50000, month: 6, year: 2026 });
  });
});

describe('AdvanceRequestDrawer window gate', () => {
  it('disables Submit and does not call createAdvanceRequest when window is closed', async () => {
    // Override: window is closed today.
    getAdvanceWindow.mockResolvedValue({
      isOpenToday: false,
      message: 'Advance requests open on day 21 only',
      policy: { mode: 'fixed_day', fixedDay: 21 },
    });
    setup();

    // Wait for the window fetch to resolve and the Alert to appear.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    // Submit button must be disabled.
    const submitBtn = screen.getByRole('button', { name: /Submit request/i });
    expect(submitBtn).toBeDisabled();

    // Even if the user somehow clicks, createAdvanceRequest is never called.
    fireEvent.click(submitBtn);
    expect(createAdvanceRequest).not.toHaveBeenCalled();
  });
});
