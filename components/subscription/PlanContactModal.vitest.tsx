import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntApp } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import en from '@/app/messages/en.json';
import type { PlanWithBilling } from '@/types';

// Observe the plan-interest submit without hitting the server.
const submitPlanInterestRequest = vi.fn();
vi.mock('@/lib/actions', () => ({
  submitPlanInterestRequest: (p: unknown) => submitPlanInterestRequest(p),
}));

import { PlanContactModal } from '@/components/subscription/PlanContactModal';

afterEach(() => {
  cleanup();
  submitPlanInterestRequest.mockReset();
});

// Minimal plan stub: the modal only reads _id / tier / name.
const PLAN = { _id: 'plan_growth_1', tier: 'growth', name: 'Growth' } as unknown as PlanWithBilling;

function renderModal(plan: PlanWithBilling | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AntApp>
        <PlanContactModal plan={plan} onClose={() => {}} />
      </AntApp>
    </NextIntlClientProvider>,
  );
}

describe('PlanContactModal', () => {
  it('is closed when no plan is selected', () => {
    renderModal(null);
    expect(screen.queryByText('Request the Growth plan')).not.toBeInTheDocument();
  });

  it('opens for the selected plan with the callback fields', async () => {
    renderModal(PLAN);
    expect(await screen.findByText('Request the Growth plan')).toBeInTheDocument();
    expect(screen.getByText("Online payments aren't live yet")).toBeInTheDocument();
    expect(screen.getByText('Mobile number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request a callback' })).toBeInTheDocument();
  });

  it('blocks submit when the mobile is empty (no request sent)', async () => {
    const user = userEvent.setup();
    renderModal(PLAN);
    await screen.findByText('Request the Growth plan');

    await user.click(screen.getByRole('button', { name: 'Request a callback' }));

    expect(
      await screen.findByText('Add a mobile number so we can contact you'),
    ).toBeInTheDocument();
    await waitFor(() => expect(submitPlanInterestRequest).not.toHaveBeenCalled());
  });

  it('submits the plan + callback number', async () => {
    const user = userEvent.setup();
    submitPlanInterestRequest.mockResolvedValue({ _id: 'req1' });
    renderModal(PLAN);
    await screen.findByText('Request the Growth plan');

    await user.type(screen.getByPlaceholderText('Where we can reach you'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Request a callback' }));

    await waitFor(() => expect(submitPlanInterestRequest).toHaveBeenCalledTimes(1));
    // Carries the plan identity + the callback number; team size omitted is fine.
    expect(submitPlanInterestRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan_growth_1',
        planTier: 'growth',
        planName: 'Growth',
        mobile: '9876543210',
      }),
    );
  });
});
