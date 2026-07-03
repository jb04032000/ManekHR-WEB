import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TDD: TeamAdvanceReviewCard (Phase 3a, Task 4).
 * Plan: 2026-06-22-advance-reporting-review.md Task 4.
 * Tests:
 *  1. Renders a direct report's advance request when listAdvanceRequestsForMyReports returns one.
 *  2. Clicking "Verify" + confirming calls verifyAdvanceRequest(wsId, id, { note }).
 * Mocks: @/lib/api/modules/salary.api (named exports), useMyPermissions (can -> true),
 *        useWorkspaceStore, next-intl.
 */

// Hoist mocks so vi.mock factories can reference them.
const { listAdvanceRequestsForMyReports, verifyAdvanceRequest } = vi.hoisted(() => ({
  listAdvanceRequestsForMyReports: vi.fn(),
  verifyAdvanceRequest: vi.fn(),
}));

vi.mock('@/lib/api/modules/salary.api', () => ({
  listAdvanceRequestsForMyReports,
  verifyAdvanceRequest,
  // Provide no-op stubs for any other named imports that the module transitively uses.
  salaryApi: {},
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({
    data: { isOwner: false, teamMemberId: 'manager-tm1', permissions: [] },
    can: (_module: string, _action: string, _scope: string) => true,
  }),
}));

vi.mock('@/lib/store', () => ({
  useWorkspaceStore: (selector: (s: { currentWorkspaceId: string }) => unknown) =>
    selector({ currentWorkspaceId: 'ws1' }),
}));

// Import the component AFTER mocks are declared so hoisting works correctly.
import { TeamAdvanceReviewCard } from '../TeamAdvanceReviewCard';

const MESSAGES = {
  salary: {
    teamAdvanceReview: {
      cardTitle: 'Team advance requests',
      memberLabel: 'Member',
      periodLabel: 'Period',
      amountLabel: 'Requested',
      statusLabel: 'Status',
      verifiedBadge: 'Verified',
      verifyButton: 'Verify',
      verifyModalTitle: 'Verify advance request',
      verifyNoteLabel: 'Note (optional)',
      verifyNoteHint: 'Leave a note for the record',
      verifySubmit: 'Confirm',
      verifyCancel: 'Cancel',
      verifySuccess: 'Advance verified',
      loadError: 'Failed to load team advances',
      empty: 'No pending advance requests from your team',
    },
  },
};

const SAMPLE_REQUEST = {
  _id: 'req-001',
  workspaceId: 'ws1',
  teamMemberId: 'worker-tm1',
  month: 6,
  year: 2026,
  requestedAmount: 500000, // Rs 5000 in paise
  status: 'pending' as const,
  requestedOn: '2026-06-01T00:00:00Z',
};

function setup() {
  return render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <App>
        <TeamAdvanceReviewCard workspaceId="ws1" />
      </App>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  listAdvanceRequestsForMyReports.mockReset();
  verifyAdvanceRequest.mockReset();
  listAdvanceRequestsForMyReports.mockResolvedValue([SAMPLE_REQUEST]);
  verifyAdvanceRequest.mockResolvedValue({
    ...SAMPLE_REQUEST,
    verifiedAt: new Date().toISOString(),
  });
});

afterEach(cleanup);

describe('TeamAdvanceReviewCard', () => {
  it('renders a direct report advance request returned by listAdvanceRequestsForMyReports', async () => {
    setup();

    // The card should call the API on mount and render the request row.
    await waitFor(() => expect(listAdvanceRequestsForMyReports).toHaveBeenCalledWith('ws1'));

    // Amount displayed as rupees (500000 paise = Rs 5000).
    await screen.findByText(/5[,.]?000/);
  });

  it('clicking Verify then confirming calls verifyAdvanceRequest with the workspace id, request id, and note', async () => {
    setup();

    // Wait for the card to load the request and render the Verify button.
    await waitFor(() => expect(listAdvanceRequestsForMyReports).toHaveBeenCalledWith('ws1'));

    const verifyBtn = await screen.findByRole('button', { name: /verify/i });
    fireEvent.click(verifyBtn);

    // A modal should appear; fill in the note textarea.
    const noteInput = await screen.findByPlaceholderText(/leave a note/i);
    fireEvent.change(noteInput, { target: { value: 'Looks good' } });

    // Click the confirm button inside the modal.
    const confirmBtn = await screen.findByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(verifyAdvanceRequest).toHaveBeenCalledTimes(1));

    const [wsArg, idArg, payloadArg] = verifyAdvanceRequest.mock.calls[0];
    expect(wsArg).toBe('ws1');
    expect(idArg).toBe('req-001');
    expect(payloadArg).toEqual({ note: 'Looks good' });
  });
});
