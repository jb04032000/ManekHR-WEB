import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { ErpDeletionImpactSummary } from './ErpDeletionImpactSummary';
import type { ErpDeletionImpact } from '@/lib/actions/account-deletion.actions';

/**
 * The Delete-ERP confirm screen's impact summary - renders what GET .../erp/preview
 * returns: affected workspaces, "your team loses access", sole-owner note, the
 * open-loan / unpaid-advance warning, and the "member workspaces are not
 * auto-rejoinable" caveat. Plan §3B / §7.
 */

const messages = {
  accountDeletion: {
    erpImpact: {
      heading: 'What happens to your workspaces',
      ownedTitle: 'Workspaces you own (deleted)',
      teamLosesAccess: 'Your team loses access to these workspaces.',
      soleOwnerNote: 'You are the only owner, so no one else can keep them running.',
      memberTitle: 'Workspaces you belong to (you are removed)',
      memberNotRejoinable: 'You are not auto-added back. The owner must re-invite you.',
      openLoans: '{count} open employer loan(s) will be affected.',
      unpaidAdvances: '{count} unpaid salary advance(s) will be affected.',
      members: '{count} member(s)',
      loading: 'Checking impact...',
      empty: 'You have no ERP workspaces to delete.',
    },
  },
};

function renderSummary(impact: ErpDeletionImpact | null, loading = false) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ErpDeletionImpactSummary impact={impact} loading={loading} />
    </NextIntlClientProvider>,
  );
}

const baseImpact: ErpDeletionImpact = {
  ownedWorkspaces: [{ workspaceId: 'w1', name: 'Anant Group', memberCount: 4 }],
  memberWorkspaces: [{ workspaceId: 'w2', name: 'Partner Co' }],
  teamLosesAccess: true,
  memberWorkspacesNeedReinvite: true,
  openEmployerLoans: 2,
  unpaidAdvances: 1,
};

describe('ErpDeletionImpactSummary', () => {
  afterEach(cleanup);

  it('shows owned workspaces, team-loses-access, and the sole-owner note', () => {
    renderSummary(baseImpact);
    expect(screen.getByText('Anant Group')).toBeInTheDocument();
    expect(screen.getByText('Your team loses access to these workspaces.')).toBeInTheDocument();
    expect(
      screen.getByText('You are the only owner, so no one else can keep them running.'),
    ).toBeInTheDocument();
  });

  it('warns about member workspaces not being auto-rejoinable', () => {
    renderSummary(baseImpact);
    expect(screen.getByText('Partner Co')).toBeInTheDocument();
    expect(
      screen.getByText('You are not auto-added back. The owner must re-invite you.'),
    ).toBeInTheDocument();
  });

  it('surfaces the open-loan and unpaid-advance warnings', () => {
    renderSummary(baseImpact);
    expect(screen.getByText('2 open employer loan(s) will be affected.')).toBeInTheDocument();
    expect(screen.getByText('1 unpaid salary advance(s) will be affected.')).toBeInTheDocument();
  });

  it('shows a loading state while the preview is in flight', () => {
    renderSummary(null, true);
    expect(screen.getByText('Checking impact...')).toBeInTheDocument();
  });

  it('hides loan/advance warnings when there are none', () => {
    renderSummary({
      ...baseImpact,
      openEmployerLoans: 0,
      unpaidAdvances: 0,
    });
    expect(screen.queryByText(/employer loan/)).toBeNull();
    expect(screen.queryByText(/salary advance/)).toBeNull();
  });
});
