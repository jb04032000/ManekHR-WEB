import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { ConnectUsageRow } from '@/features/connect/usage.types';

/**
 * ConnectLimitsCard: the one consolidated "Your limits" view on the owner's
 * profile. It lists every kind from a SINGLE roll-up fetch.
 */
const getConnectUsage = vi.fn();
vi.mock('@/features/connect/usage.actions', () => ({
  getConnectUsage: () => getConnectUsage(),
}));

// Keep trackEvent inert (each row may emit near_limit); we only care about render.
vi.mock('@/lib/analytics-events', async (orig) => {
  const actual = await orig<typeof import('@/lib/analytics-events')>();
  return { ...actual, trackEvent: vi.fn() };
});

import { ConnectLimitsCard } from './ConnectLimitsCard';
import { __resetConnectUsageCache } from '@/features/connect/useConnectUsage';

function r(kind: ConnectUsageRow['kind'], used: number, limit: number): ConnectUsageRow {
  return {
    kind,
    used,
    limit,
    overLimit: limit !== -1 && used > limit,
    policy: 'freeze',
    graceDays: 30,
    overLimitSince: null,
    graceEndsAt: null,
    suppressionActive: false,
    suppressedCount: 0,
  };
}

const ALL: ConnectUsageRow[] = [
  r('listing', 3, 25),
  r('storefront', 1, 1),
  r('company_page', 2, -1),
  r('job', 4, 5),
  r('storage', 120, 500),
];

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  __resetConnectUsageCache();
  getConnectUsage.mockResolvedValue({ ok: true, data: ALL });
});

describe('ConnectLimitsCard', () => {
  it('shows the title and a meter for every kind in the roll-up', async () => {
    renderWithIntl(<ConnectLimitsCard />);
    expect(await screen.findByText('Your limits')).toBeInTheDocument();
    for (const label of ['Products', 'Storefronts', 'Company pages', 'Open jobs', 'Storage']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // 5 kinds -> 5 progressbars.
    expect(screen.getAllByRole('progressbar')).toHaveLength(5);
  });

  it('fetches the roll-up once for the whole card', async () => {
    renderWithIntl(<ConnectLimitsCard />);
    await screen.findByText('Your limits');
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalled());
    expect(getConnectUsage).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when the roll-up is empty', async () => {
    getConnectUsage.mockResolvedValue({ ok: true, data: [] });
    const { container } = renderWithIntl(<ConnectLimitsCard />);
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
  });
});
