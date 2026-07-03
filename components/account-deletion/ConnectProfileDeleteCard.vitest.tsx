import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntdApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * Scope-1 "Delete Connect" card mounted in the Connect-profile owner rail
 * (OwnProfileClient limits slot, plan §7). On success it flips to the scheduled
 * notice and links to /account/security to "also delete my whole profile".
 */

vi.mock('@/lib/actions/cookies', () => ({
  clearAuthCookie: vi.fn(async () => {}),
  syncAuthCookie: vi.fn(async () => {}),
}));

vi.mock('./DangerDeleteModal', () => ({
  DangerDeleteModal: ({
    open,
    scope,
    onScheduled,
  }: {
    open: boolean;
    scope: string;
    onScheduled: (r: { scope: string; purgeAfter: string }) => void;
  }) =>
    open ? (
      <div data-testid="modal" data-scope={scope}>
        <button onClick={() => onScheduled({ scope, purgeAfter: '2026-07-25T00:00:00.000Z' })}>
          do-schedule
        </button>
      </div>
    ) : null,
}));

import { useAuthStore } from '@/lib/store';
import { ConnectProfileDeleteCard } from './ConnectProfileDeleteCard';

function setUser(user: Record<string, unknown> | null) {
  useAuthStore.setState({ user: user as never });
}

const messages = {
  accountDeletion: {
    crossLink: { label: 'Also delete my whole profile' },
    toast: { scheduled: 'Scheduled. Recover by {date}.' },
    scope: {
      connect: {
        cardTitle: 'Delete Connect profile',
        cardDesc: 'Remove your public profile and Connect activity.',
        button: 'Delete Connect profile',
        modalTitle: 'Delete Connect profile',
        lead: 'This removes your Connect profile.',
      },
    },
    scheduled: {
      title: 'Scheduled for deletion',
      body: 'This will be permanently deleted on {date}.',
      recover: 'Contact us before then to recover.',
      contactCta: 'Contact us to recover',
    },
  },
};

function renderCard() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AntdApp>
        <ConnectProfileDeleteCard />
      </AntdApp>
    </NextIntlClientProvider>,
  );
}

describe('ConnectProfileDeleteCard', () => {
  beforeEach(() => setUser({ hasPassword: true }));
  afterEach(cleanup);

  it('opens the Connect-scope confirm modal from the delete button', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /Delete Connect profile/ }));
    expect(screen.getByTestId('modal')).toHaveAttribute('data-scope', 'connect');
  });

  it('flips to the scheduled notice with a cross-link to the whole-account deletion', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /Delete Connect profile/ }));
    fireEvent.click(screen.getByRole('button', { name: 'do-schedule' }));

    await waitFor(() => expect(screen.getByText('Scheduled for deletion')).toBeInTheDocument());
    const cross = screen.getByRole('link', { name: 'Also delete my whole profile' });
    expect(cross).toHaveAttribute('href', '/account/security#delete-account');
    expect(useAuthStore.getState().user?.connectDeletion?.state).toBe('pending');
  });

  it('shows the scheduled notice (no button) when already pending', () => {
    setUser({
      hasPassword: true,
      connectDeletion: {
        state: 'pending',
        requestedAt: '2026-06-25T00:00:00.000Z',
        purgeAfter: '2026-07-25T00:00:00.000Z',
      },
    });
    renderCard();
    expect(screen.queryByRole('button', { name: /Delete Connect profile/ })).toBeNull();
    expect(screen.getByText('Scheduled for deletion')).toBeInTheDocument();
  });
});
