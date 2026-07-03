import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectEntitlementsPanel } from './ConnectEntitlementsPanel';
import type { AdminConnectEntitlementsView } from './entitlements.types';

const BASE_ALLOWANCES = {
  maxListings: 25,
  leadsPerMonth: -1,
  includedBoostCredits: 0,
  verifiedBadge: false,
  searchPriority: 0,
  maxCompanyPages: 1,
  maxStorefronts: 1,
  maxJobs: 10,
  storageMb: 500,
  overLimitPolicy: 'freeze' as const,
  overLimitGraceDays: 30,
};

function makeView(over: Partial<typeof BASE_ALLOWANCES> | null): AdminConnectEntitlementsView {
  return {
    user: { id: 'u1', name: 'Asha', email: 'asha@x.io', mobile: null },
    hasConnectSubscription: true,
    subscriptionId: 's1',
    plan: { name: 'Connect Pro', tier: 'connect_pro', status: 'active' },
    planDefaults: { ...BASE_ALLOWANCES },
    override: over,
    effective: { ...BASE_ALLOWANCES, ...(over ?? {}) },
    usage: [
      {
        kind: 'listing',
        used: 12,
        limit: over?.maxListings ?? 25,
        overLimit: false,
        policy: 'freeze',
        graceDays: 30,
        overLimitSince: null,
        graceEndsAt: null,
        suppressionActive: false,
        suppressedCount: 0,
      },
      {
        kind: 'storage',
        used: 600,
        limit: 500,
        overLimit: true,
        policy: 'freeze',
        graceDays: 30,
        overLimitSince: null,
        graceEndsAt: null,
        suppressionActive: false,
        suppressedCount: 0,
      },
    ],
  };
}

describe('ConnectEntitlementsPanel', () => {
  it('renders the three sections (Plan default / Override / Effective) + usage', () => {
    render(
      <ConnectEntitlementsPanel
        view={makeView({ maxListings: 100 })}
        onSave={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText('Plan default')).toBeInTheDocument();
    expect(screen.getByText('Override')).toBeInTheDocument();
    expect(screen.getByText('Effective')).toBeInTheDocument();
    expect(screen.getByText('Usage')).toBeInTheDocument();
    // The overridden field is flagged "custom" in the Effective column.
    expect(screen.getByText('custom')).toBeInTheDocument();
    // Inline usage for the listing row.
    expect(screen.getByText(/used 12/)).toBeInTheDocument();
  });

  it('highlights an over-limit row with an "over limit" tag', () => {
    render(<ConnectEntitlementsPanel view={makeView(null)} onSave={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText('over limit')).toBeInTheDocument();
    expect(screen.getByText(/used 600/)).toBeInTheDocument();
  });

  it('save sends only the fields that are set (partial override)', () => {
    const onSave = vi.fn();
    render(<ConnectEntitlementsPanel view={makeView({})} onSave={onSave} onClear={vi.fn()} />);

    const input = screen.getByLabelText('Listings override');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ maxListings: 7 });
  });

  it('clear-all confirms then fires onClear', async () => {
    const onClear = vi.fn();
    render(
      <ConnectEntitlementsPanel
        view={makeView({ maxListings: 100 })}
        onSave={vi.fn()}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear all overrides' }));
    const ok = await screen.findByText('Clear all'); // Popconfirm OK button
    fireEvent.click(ok);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('a per-field clear removes that field from the next save', () => {
    const onSave = vi.fn();
    render(
      <ConnectEntitlementsPanel
        view={makeView({ maxListings: 100 })}
        onSave={onSave}
        onClear={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear Listings' }));
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
    expect(onSave).toHaveBeenCalledWith({});
  });

  it('disables editing and warns when the person has no Connect subscription', () => {
    const view = makeView(null);
    view.hasConnectSubscription = false;
    render(<ConnectEntitlementsPanel view={view} onSave={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('no active Connect subscription');
    expect(screen.getByRole('button', { name: /^Save/ })).toBeDisabled();
  });

  it('offers a one-click bridge to the assign-plan flow in the no-subscription state', () => {
    const view = makeView(null);
    view.hasConnectSubscription = false;
    render(<ConnectEntitlementsPanel view={view} onSave={vi.fn()} onClear={vi.fn()} />);
    // The bridge is a link to the admin Users console (which owns plan assignment).
    const link = screen.getByRole('link', { name: /Assign a Connect plan/i });
    expect(link).toHaveAttribute('href', '/admin/users');
  });

  it('does NOT show the assign-plan bridge when a subscription exists', () => {
    render(<ConnectEntitlementsPanel view={makeView({})} onSave={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole('link', { name: /Assign a Connect plan/i })).toBeNull();
  });
});
