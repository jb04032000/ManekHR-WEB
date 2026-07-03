import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntdApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * The /account/security danger-zone orchestrator - three scopes (Connect mirror,
 * ERP, whole account) over the shared DangerDeleteModal. Tests pin: pending markers
 * render the scheduled notice (not the button); the ERP confirm fetches the impact
 * preview; whole-account success logs out + redirects; Connect success flips the card
 * to scheduled and offers the "also delete my whole profile" cross-link (plan §7).
 */

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

const cookies = vi.hoisted(() => ({
  clearAuthCookie: vi.fn(async () => {}),
  syncAuthCookie: vi.fn(async () => {}),
}));
vi.mock('@/lib/actions/cookies', () => cookies);

const baseImpact = {
  ownedWorkspaces: [{ workspaceId: 'w1', name: 'Anant Group', memberCount: 4 }],
  memberWorkspaces: [],
  teamLosesAccess: true,
  memberWorkspacesNeedReinvite: false,
  openEmployerLoans: 0,
  unpaidAdvances: 0,
};
const delActions = vi.hoisted(() => ({
  getErpDeletionPreview: vi.fn(),
  scheduleConnectDeletion: vi.fn(),
  scheduleErpDeletion: vi.fn(),
  scheduleAccountDeletion: vi.fn(),
  sendDeletionStepupOtp: vi.fn(),
  verifyDeletionStepupOtp: vi.fn(),
}));
vi.mock('@/lib/actions/account-deletion.actions', () => delActions);

// Stub the heavy modal: render scope + a button that drives onScheduled directly.
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
import { AccountSecurityDeletionSection } from './AccountSecurityDeletionSection';

function setUser(user: Record<string, unknown> | null) {
  useAuthStore.setState({ user: user as never });
}

const messages = {
  accountDeletion: {
    section: { title: 'Danger zone', desc: 'Permanent, high-impact actions.' },
    crossLink: { label: 'Also delete my whole profile' },
    toast: { scheduled: 'Scheduled. Recover by {date} by contacting us.' },
    scope: {
      connect: {
        cardTitle: 'Delete Connect profile',
        cardDesc: 'Remove your public profile and Connect activity.',
        button: 'Delete Connect profile',
        modalTitle: 'Delete Connect profile',
        lead: 'This removes your Connect profile.',
      },
      erp: {
        cardTitle: 'Delete business data',
        cardDesc: 'Remove your workspaces.',
        button: 'Delete ERP data',
        modalTitle: 'Delete business data',
        lead: 'This deletes your workspaces.',
      },
      account: {
        cardTitle: 'Delete whole account',
        cardDesc: 'Remove everything and sign out.',
        button: 'Delete my whole account',
        modalTitle: 'Delete whole account',
        lead: 'This removes everything.',
      },
    },
    scheduled: {
      title: 'Scheduled for deletion',
      body: 'This will be permanently deleted on {date}.',
      recover: 'Contact us before then to recover. There is no self-undo.',
      contactCta: 'Contact us to recover',
    },
    erpImpact: {
      heading: 'What happens',
      ownedTitle: 'Owned',
      teamLosesAccess: 'Team loses access.',
      soleOwnerNote: 'You are the only owner.',
      memberTitle: 'Member',
      memberNotRejoinable: 'Re-invite needed.',
      openLoans: '{count} loans',
      unpaidAdvances: '{count} advances',
      members: '{count} members',
      loading: 'Checking impact...',
      empty: 'No workspaces.',
    },
  },
};

function renderSection() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AntdApp>
        <AccountSecurityDeletionSection />
      </AntdApp>
    </NextIntlClientProvider>,
  );
}

const fullUser = {
  hasPassword: true,
  connectPolicyAcceptedAt: '2026-01-01',
  erpPolicyAcceptedAt: '2026-01-01',
  hasWorkspace: true,
};

describe('AccountSecurityDeletionSection', () => {
  beforeEach(() => {
    setUser({ ...fullUser });
    replaceMock.mockReset();
    Object.values(delActions).forEach((fn) => fn.mockReset());
    cookies.clearAuthCookie.mockClear();
    delActions.getErpDeletionPreview.mockResolvedValue({ ok: true, data: baseImpact });
  });
  afterEach(cleanup);

  it('renders the scheduled notice (not the button) for an already-pending Connect scope', () => {
    setUser({
      ...fullUser,
      connectDeletion: {
        state: 'pending',
        requestedAt: '2026-06-25T00:00:00.000Z',
        purgeAfter: '2026-07-25T00:00:00.000Z',
      },
    });
    renderSection();
    expect(screen.queryByRole('button', { name: 'Delete Connect profile' })).toBeNull();
    expect(screen.getByText('Scheduled for deletion')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Also delete my whole profile' }),
    ).toBeInTheDocument();
  });

  it('fetches the ERP impact preview when the ERP confirm opens', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Delete ERP data/ }));
    await waitFor(() => expect(delActions.getErpDeletionPreview).toHaveBeenCalled());
    expect(screen.getByTestId('modal')).toHaveAttribute('data-scope', 'erp');
  });

  it('logs out and redirects after the whole-account deletion is scheduled', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Delete my whole account/ }));
    fireEvent.click(screen.getByRole('button', { name: 'do-schedule' }));

    await waitFor(() => expect(cookies.clearAuthCookie).toHaveBeenCalled());
    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('flips the Connect card to scheduled and offers the cross-link after success', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Delete Connect profile/ }));
    fireEvent.click(screen.getByRole('button', { name: 'do-schedule' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Also delete my whole profile' }),
      ).toBeInTheDocument(),
    );
    expect(useAuthStore.getState().user?.connectDeletion?.state).toBe('pending');
  });
});
