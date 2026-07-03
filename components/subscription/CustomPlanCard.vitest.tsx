import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntApp } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import en from '@/app/messages/en.json';

// Observe the submit action without hitting the server.
const submitCustomPlanRequest = vi.fn();
vi.mock('@/lib/actions', () => ({
  submitCustomPlanRequest: (p: unknown) => submitCustomPlanRequest(p),
}));

import { CustomPlanCard } from '@/components/subscription/CustomPlanCard';

afterEach(() => {
  cleanup();
  submitCustomPlanRequest.mockReset();
});

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AntApp>
        <CustomPlanCard />
      </AntApp>
    </NextIntlClientProvider>,
  );
}

describe('CustomPlanCard', () => {
  it('renders the marketing card with the request CTA', () => {
    renderCard();
    expect(screen.getByText('Need a custom plan?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request a custom plan/i })).toBeInTheDocument();
  });

  it('opens the request form on CTA click', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /request a custom plan/i }));
    // The modal surfaces with the team-size + mobile fields and a submit button.
    expect(await screen.findByText('Total team members')).toBeInTheDocument();
    expect(screen.getByText('Mobile number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send request' })).toBeInTheDocument();
  });

  it('blocks submit when required fields are empty (no request sent)', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /request a custom plan/i }));
    await screen.findByText('Total team members');

    await user.click(screen.getByRole('button', { name: 'Send request' }));

    // Validation surfaces the required messages and the action is never called.
    expect(await screen.findByText('Tell us your team size')).toBeInTheDocument();
    await waitFor(() => expect(submitCustomPlanRequest).not.toHaveBeenCalled());
  });
});
