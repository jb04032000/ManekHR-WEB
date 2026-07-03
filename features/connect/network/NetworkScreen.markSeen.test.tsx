/**
 * NetworkScreen - "My Network" nav-badge clearing.
 *
 * The badge (useNetworkBadge) counts unseen connection_requested /
 * connection_accepted notifications. Opening the page marks them seen so it
 * clears. These tests pin the cases where it must ALSO re-clear so it never
 * stays stuck lit while the user is on the page:
 *   - on the realtime socket reconnecting (recovers a failed first attempt),
 *   - after a self-action (accept / ignore / withdraw),
 *   - when a connection notification arrives after the page is already open.
 * Provider / router / actions are stubbed so the screen renders in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, act } from '@/test-utils/render';
import { NETWORK_CHANGED_EVENT } from './useNetworkBadge';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/network',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../network.actions', () => ({
  getNetworkCounts: vi.fn().mockResolvedValue({ ok: false }),
}));

// `mock`-prefixed so the hoisted vi.mock factory may reference them.
const mockMarkCategorySeen = vi.fn();
let mockConnectionState = 'connected';
let mockNotificationHandler: ((e: { category: string }) => void) | null = null;
vi.mock('@/lib/connect/NotificationProvider', () => ({
  useNotifications: () => ({
    markCategorySeen: mockMarkCategorySeen,
    connectionState: mockConnectionState,
  }),
  useNotificationEvent: (handler: (e: { category: string }) => void) => {
    mockNotificationHandler = handler;
  },
}));
vi.mock('@/features/connect/ads/use-ad-beacons', () => ({
  useAdBeacons: () => ({ cardRef: { current: null }, onClick: vi.fn() }),
}));
vi.mock('./InvitationsTab', () => ({ default: () => <div data-testid="invitations-tab" /> }));

import NetworkScreen from './NetworkScreen';

const counts = { pendingRequests: 0, connections: 0, following: 0, followers: 0 };
const data = { tab: 'invitations', requests: [], people: {} } as never;
const CATEGORIES = ['connect.connection_requested', 'connect.connection_accepted'];

beforeEach(() => {
  mockMarkCategorySeen.mockClear();
  mockConnectionState = 'connected';
  mockNotificationHandler = null;
});

describe('NetworkScreen - My Network nav-badge clearing', () => {
  it('marks both connection categories seen when the page is opened', () => {
    renderWithIntl(<NetworkScreen counts={counts} data={data} />);
    for (const c of CATEGORIES) expect(mockMarkCategorySeen).toHaveBeenCalledWith(c);
  });

  it('re-runs the clear when the realtime socket reconnects (recovers a failed first attempt)', () => {
    const { rerender } = renderWithIntl(<NetworkScreen counts={counts} data={data} />);
    mockMarkCategorySeen.mockClear();

    mockConnectionState = 'disconnected';
    rerender(<NetworkScreen counts={counts} data={data} />);
    mockConnectionState = 'connected';
    rerender(<NetworkScreen counts={counts} data={data} />);

    for (const c of CATEGORIES) expect(mockMarkCategorySeen).toHaveBeenCalledWith(c);
  });

  it('re-clears after a self-action (accept / ignore / withdraw) on the page', () => {
    renderWithIntl(<NetworkScreen counts={counts} data={data} />);
    mockMarkCategorySeen.mockClear(); // ignore the open-time mark

    act(() => {
      window.dispatchEvent(new CustomEvent(NETWORK_CHANGED_EVENT));
    });

    for (const c of CATEGORIES) expect(mockMarkCategorySeen).toHaveBeenCalledWith(c);
  });

  it('re-clears when a connection notification arrives after the page is open', () => {
    renderWithIntl(<NetworkScreen counts={counts} data={data} />);
    mockMarkCategorySeen.mockClear();

    act(() => {
      mockNotificationHandler?.({ category: 'connect.connection_requested' });
    });

    for (const c of CATEGORIES) expect(mockMarkCategorySeen).toHaveBeenCalledWith(c);
  });
});
