import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, waitFor } from '@/test-utils/render';
import type { ConnectUsageRow } from './usage.types';

/**
 * The shared usage hook must give ONE fetch per page even when several consumers
 * mount together (an OverLimitBanner + a UsageMeter + the ConnectLimitsCard), and
 * must reuse the warm cache on a remount within the TTL.
 */
const getConnectUsage = vi.fn();
vi.mock('@/features/connect/usage.actions', () => ({
  getConnectUsage: () => getConnectUsage(),
}));

import { useConnectUsage, __resetConnectUsageCache } from './useConnectUsage';

function rows(): ConnectUsageRow[] {
  return [
    {
      kind: 'listing',
      used: 1,
      limit: 10,
      overLimit: false,
      policy: 'freeze',
      graceDays: 30,
      overLimitSince: null,
      graceEndsAt: null,
      suppressionActive: false,
      suppressedCount: 0,
    },
  ];
}

// Two independent consumers of the hook, rendered side by side.
function Consumer() {
  useConnectUsage();
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetConnectUsageCache();
  getConnectUsage.mockResolvedValue({ ok: true, data: rows() });
});

describe('useConnectUsage', () => {
  it('fetches once for many concurrent consumers on the same page', async () => {
    renderWithIntl(
      <>
        <Consumer />
        <Consumer />
        <Consumer />
      </>,
    );
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalled());
    expect(getConnectUsage).toHaveBeenCalledTimes(1);
  });

  it('reuses the warm cache on a fresh mount within the TTL (no second fetch)', async () => {
    const first = renderWithIntl(<Consumer />);
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalledTimes(1));
    first.unmount();

    renderWithIntl(<Consumer />);
    // Give any stray effect a tick; the cache should serve this one.
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalledTimes(1));
    expect(getConnectUsage).toHaveBeenCalledTimes(1);
  });

  it('refetches after the cache is reset', async () => {
    renderWithIntl(<Consumer />);
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalledTimes(1));
    __resetConnectUsageCache();
    renderWithIntl(<Consumer />);
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalledTimes(2));
  });
});
