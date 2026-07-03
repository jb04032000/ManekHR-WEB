import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { ConnectUsageRow } from '@/features/connect/usage.types';

/**
 * ConnectUsageMeter: the surface-scoped meter that also emits the
 * connect.limit.near_limit demand signal once per surface per session. We mock
 * the usage roll-up and spy on trackEvent (keeping the real catalog).
 */
const getConnectUsage = vi.fn();
vi.mock('@/features/connect/usage.actions', () => ({
  getConnectUsage: () => getConnectUsage(),
}));

const trackEvent = vi.fn();
vi.mock('@/lib/analytics-events', async (orig) => {
  const actual = await orig<typeof import('@/lib/analytics-events')>();
  return { ...actual, trackEvent: (...a: unknown[]) => trackEvent(...a) };
});

import { ConnectUsageMeter } from './ConnectUsageMeter';
import { __resetConnectUsageCache } from '@/features/connect/useConnectUsage';

function row(over: Partial<ConnectUsageRow> = {}): ConnectUsageRow {
  return {
    kind: 'listing',
    used: 9,
    limit: 10,
    overLimit: false,
    policy: 'freeze',
    graceDays: 30,
    overLimitSince: null,
    graceEndsAt: null,
    suppressionActive: false,
    suppressedCount: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  __resetConnectUsageCache();
  getConnectUsage.mockResolvedValue({ ok: true, data: [row()] });
});

describe('ConnectUsageMeter', () => {
  it('placement smoke: renders the meter for its kind', async () => {
    renderWithIntl(<ConnectUsageMeter kind="listing" surface="products" />);
    expect(await screen.findByText('Products')).toBeInTheDocument();
    expect(screen.getByText('9 of 10')).toBeInTheDocument();
  });

  it('fires connect.limit.near_limit once with kind + bucketed ratio', async () => {
    renderWithIntl(<ConnectUsageMeter kind="listing" surface="products" />);
    await screen.findByText('Products');
    await waitFor(() => expect(trackEvent).toHaveBeenCalled());
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('connect.limit.near_limit', {
      kind: 'listing',
      ratio: 0.9, // 9/10 -> 0.9 band
    });
  });

  it('does not re-fire for the same surface+kind within the session', async () => {
    const a = renderWithIntl(<ConnectUsageMeter kind="listing" surface="products" />);
    await screen.findByText('Products');
    await waitFor(() => expect(trackEvent).toHaveBeenCalledTimes(1));
    a.unmount();

    renderWithIntl(<ConnectUsageMeter kind="listing" surface="products" />);
    await screen.findByText('Products');
    // sessionStorage guard suppresses the repeat.
    await waitFor(() => expect(trackEvent).toHaveBeenCalledTimes(1));
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when comfortably below the near threshold', async () => {
    getConnectUsage.mockResolvedValue({ ok: true, data: [row({ used: 2, limit: 10 })] });
    renderWithIntl(<ConnectUsageMeter kind="listing" surface="products" />);
    await screen.findByText('Products');
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalled());
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does NOT fire for unlimited caps', async () => {
    getConnectUsage.mockResolvedValue({ ok: true, data: [row({ used: 50, limit: -1 })] });
    renderWithIntl(<ConnectUsageMeter kind="listing" surface="products" />);
    await screen.findByText('Products');
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalled());
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('renders nothing when the kind is absent from the roll-up', async () => {
    getConnectUsage.mockResolvedValue({ ok: true, data: [] });
    const { container } = renderWithIntl(<ConnectUsageMeter kind="job" surface="jobs" />);
    await waitFor(() => expect(getConnectUsage).toHaveBeenCalled());
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});
