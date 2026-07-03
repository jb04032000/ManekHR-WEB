import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntApp } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import en from '@/app/messages/en.json';

// Mock the actions barrel so startTrial is observable and never hits the server.
// getTrialState is also exported here but the component receives state as a prop,
// so only startTrial needs a spy.
const startTrial = vi.fn();
vi.mock('@/lib/actions', () => ({
  startTrial: () => startTrial(),
}));

import { TrialStatusBanner } from '@/components/subscription/TrialStatusBanner';
import type { TrialState } from '@/lib/actions';

afterEach(() => {
  cleanup();
  startTrial.mockReset();
});

// Neutral base; each test overrides the relevant flags.
const base: TrialState = {
  trialPlanConfigured: true,
  hasUsedTrial: false,
  isInTrial: false,
  trialEndsAt: null,
  trialDurationDays: 14,
  canStartTrial: false,
};

function renderBanner(
  state: TrialState,
  onStarted?: () => void,
  // Admin "Trial Banner" config props (default to the always-on / no-override
  // behaviour so existing tests stay byte-for-byte equivalent).
  opts?: { bannerEnabled?: boolean; headlineOverride?: string },
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AntApp>
        <TrialStatusBanner
          state={state}
          onStarted={onStarted}
          bannerEnabled={opts?.bannerEnabled}
          headlineOverride={opts?.headlineOverride}
        />
      </AntApp>
    </NextIntlClientProvider>,
  );
}

describe('TrialStatusBanner', () => {
  it('canStartTrial: renders the Start button and opens the confirm modal', async () => {
    const user = userEvent.setup();
    renderBanner({ ...base, canStartTrial: true });

    expect(screen.getByText('Try the full platform free for 14 days')).toBeInTheDocument();
    const startBtn = screen.getByRole('button', { name: 'Start free trial' });
    await user.click(startBtn);

    // Confirm modal surfaces with the prospective-length copy (no fake date).
    expect(await screen.findByText('Start your free trial?')).toBeInTheDocument();
    expect(
      screen.getByText("You'll get 14 days of full access. No card required."),
    ).toBeInTheDocument();
  });

  it('confirm calls startTrial and triggers onStarted on success', async () => {
    const user = userEvent.setup();
    startTrial.mockResolvedValueOnce({ _id: 'sub_1' });
    const onStarted = vi.fn();
    renderBanner({ ...base, canStartTrial: true }, onStarted);

    await user.click(screen.getByRole('button', { name: 'Start free trial' }));
    await screen.findByText('Start your free trial?');
    // Click the modal's confirm OK button.
    await user.click(screen.getByRole('button', { name: 'Start trial' }));

    await waitFor(() => expect(startTrial).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
  });

  it('flips to the countdown immediately after a successful start (no stale Start button)', async () => {
    const user = userEvent.setup();
    startTrial.mockResolvedValueOnce({ _id: 'sub_1' });
    // trialDurationDays drives the optimistic end date (now + days).
    renderBanner({ ...base, canStartTrial: true, trialDurationDays: 45 });

    await user.click(screen.getByRole('button', { name: 'Start free trial' }));
    await screen.findByText('Start your free trial?');
    await user.click(screen.getByRole('button', { name: 'Start trial' }));

    // After success the banner optimistically shows the in-trial countdown, so
    // there is no lingering Start button to re-click (the bug that produced a
    // confusing "Trial already used" on the second click).
    expect(await screen.findByText('Free trial active')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Start free trial' })).not.toBeInTheDocument(),
    );
  });

  it('isInTrial: renders the countdown + end date and NO start button', () => {
    // Trial ends ~5 days out so ceil() yields a stable, positive day count.
    const endsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    renderBanner({ ...base, isInTrial: true, canStartTrial: false, trialEndsAt: endsAt });

    expect(screen.getByText('Free trial active')).toBeInTheDocument();
    // Days-left interpolates; the readable end date is appended.
    expect(screen.getByText(/5 days left\. Ends /)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start free trial' })).not.toBeInTheDocument();
  });

  it('canStartTrial: a non-empty headlineOverride replaces the default title', () => {
    renderBanner({ ...base, canStartTrial: true }, undefined, {
      headlineOverride: 'Diwali special: 30 days on us',
    });

    // The admin custom headline shows verbatim; the localized default does not.
    expect(screen.getByText('Diwali special: 30 days on us')).toBeInTheDocument();
    expect(screen.queryByText('Try the full platform free for 14 days')).not.toBeInTheDocument();
    // The Start button is unchanged.
    expect(screen.getByRole('button', { name: 'Start free trial' })).toBeInTheDocument();
  });

  it('canStartTrial + bannerEnabled=false: renders nothing (admin toggle off)', () => {
    const { container } = renderBanner({ ...base, canStartTrial: true }, undefined, {
      bannerEnabled: false,
    });

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start free trial' })).not.toBeInTheDocument();
    expect(container.querySelector('.ant-alert')).toBeNull();
  });

  it('isInTrial still renders the countdown even when bannerEnabled=false', () => {
    // The in-trial view is the user's own live status, not a promo: it must
    // ignore the admin toggle and the headline override.
    const endsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    renderBanner(
      { ...base, isInTrial: true, canStartTrial: false, trialEndsAt: endsAt },
      undefined,
      {
        bannerEnabled: false,
        headlineOverride: 'Ignored promo headline',
      },
    );

    expect(screen.getByText('Free trial active')).toBeInTheDocument();
    expect(screen.getByText(/5 days left\. Ends /)).toBeInTheDocument();
    expect(screen.queryByText('Ignored promo headline')).not.toBeInTheDocument();
  });

  it('hasUsedTrial && !isInTrial: renders nothing (one-time trial)', () => {
    const { container } = renderBanner({
      ...base,
      hasUsedTrial: true,
      isInTrial: false,
      canStartTrial: false,
    });

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
    // No banner markup at all (only the inert AntApp wrapper remains).
    expect(container.querySelector('.ant-alert')).toBeNull();
  });
});
