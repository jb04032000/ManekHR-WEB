import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, waitFor, fireEvent } from '@/test-utils/render';
import type { ConnectUsageRow } from '@/features/connect/usage.types';

// Mock the usage server action so the banner gets a deterministic row.
const getConnectUsage = vi.fn();
vi.mock('@/features/connect/usage.actions', () => ({
  getConnectUsage: () => getConnectUsage(),
}));

// Spy on trackEvent while keeping the real ConnectEvents catalog.
const trackEvent = vi.fn();
vi.mock('@/lib/analytics-events', async (orig) => {
  const actual = await orig<typeof import('@/lib/analytics-events')>();
  return { ...actual, trackEvent: (...a: unknown[]) => trackEvent(...a) };
});

import { OverLimitBanner } from './OverLimitBanner';
import { __resetConnectUsageCache } from '@/features/connect/useConnectUsage';

function row(over: Partial<ConnectUsageRow> = {}): ConnectUsageRow {
  return {
    kind: 'listing',
    used: 5,
    limit: 2,
    overLimit: true,
    policy: 'freeze',
    graceDays: 30,
    overLimitSince: '2026-06-01T00:00:00.000Z',
    graceEndsAt: '2026-07-01T00:00:00.000Z',
    suppressionActive: false,
    suppressedCount: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  // The banner now reads through the shared module-level usage cache; clear it
  // so each case's mocked roll-up is the one that gets fetched.
  __resetConnectUsageCache();
  getConnectUsage.mockResolvedValue({ ok: true, data: [row()] });
});

describe('OverLimitBanner', () => {
  it('renders the freeze wording when over limit under the freeze policy', async () => {
    renderWithIntl(<OverLimitBanner kind="listing" />);
    expect(await screen.findByText(/existing items stay live/i)).toBeInTheDocument();
  });

  it('renders nothing when within limit', async () => {
    getConnectUsage.mockResolvedValue({ ok: true, data: [row({ overLimit: false })] });
    const { container } = renderWithIntl(<OverLimitBanner kind="listing" />);
    // Give the effect a tick; nothing should appear.
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalled());
    expect(container.querySelector('.ant-alert')).toBeNull();
  });

  it('hide_newest within grace shows the countdown wording (will be hidden)', async () => {
    getConnectUsage.mockResolvedValue({
      ok: true,
      data: [row({ policy: 'hide_newest', suppressionActive: false })],
    });
    renderWithIntl(<OverLimitBanner kind="listing" />);
    expect(await screen.findByText(/will be hidden from public view/i)).toBeInTheDocument();
  });

  it('hide_newest after grace shows the active suppression wording (are hidden)', async () => {
    getConnectUsage.mockResolvedValue({
      ok: true,
      data: [row({ policy: 'hide_newest', suppressionActive: true, suppressedCount: 3 })],
    });
    renderWithIntl(<OverLimitBanner kind="listing" />);
    expect(await screen.findByText(/are hidden from public view/i)).toBeInTheDocument();
  });

  it('fires connect.limit.over_limit_entered once with kind + policy', async () => {
    renderWithIntl(<OverLimitBanner kind="listing" />);
    await screen.findByText(/existing items stay live/i);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('connect.limit.over_limit_entered', {
      kind: 'listing',
      policy: 'freeze',
    });
  });

  it('can be dismissed for the session', async () => {
    const { container } = renderWithIntl(<OverLimitBanner kind="listing" />);
    await screen.findByText(/existing items stay live/i);
    const close = container.querySelector('.ant-alert-close-icon') as HTMLElement | null;
    expect(close).not.toBeNull();
    fireEvent.click(close!);
    await waitFor(() =>
      expect(screen.queryByText(/existing items stay live/i)).not.toBeInTheDocument(),
    );
  });
});
