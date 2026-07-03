/**
 * BOOST-UI (owner 2026-06-19): promoted-profile coverage for NetworkScreen.
 *
 * A promoted profile (open-to-work / hiring boost) used to render only in the
 * feed; the people page showed none. NetworkScreen now accepts a server-resolved
 * `promotedProfile` (leak-guarded by the page) and renders the shared
 * PromotedProfileAdCard atop the people column on all viewports. This test
 * asserts the card shows when one is resolved, and is absent when none is.
 *
 * The notification provider + router + network actions are stubbed so the screen
 * renders in jsdom without sockets or live data.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { NetworkPromotedProfile } from './NetworkScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/network',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../network.actions', () => ({
  getNetworkCounts: vi.fn().mockResolvedValue({ ok: false }),
}));
vi.mock('@/lib/connect/NotificationProvider', () => ({
  useNotifications: () => ({ markCategorySeen: vi.fn() }),
  useNotificationEvent: () => {},
}));
// The promoted card's useAdBeacons records via these server actions.
vi.mock('@/features/connect/ads/use-ad-beacons', () => ({
  useAdBeacons: () => ({ cardRef: { current: null }, onClick: vi.fn() }),
}));
// The invitations tab (default) loads its own data; stub it to a placeholder so
// the test focuses on the promoted slot, not the tab body.
vi.mock('./InvitationsTab', () => ({ default: () => <div data-testid="invitations-tab" /> }));

import NetworkScreen from './NetworkScreen';

const counts = { pendingRequests: 0, connections: 0, following: 0, followers: 0 };
const emptyData = { tab: 'invitations', requests: [], people: {} } as never;

const promoted: NetworkPromotedProfile = {
  person: { userId: 'u-42', name: 'Asha Patel', headline: 'Zari karigar' },
  impressionToken: 't1',
  campaignId: 'c1',
  kind: 'open_to_work',
};

describe('NetworkScreen - promoted profile slot', () => {
  it('renders the promoted profile card (labelled Promoted) when one is resolved', () => {
    renderWithIntl(<NetworkScreen counts={counts} data={emptyData} promotedProfile={promoted} />);
    expect(screen.getByText('Asha Patel')).toBeInTheDocument();
    // The IAB/FTC disclosure tag + the open-to-work badge mark it as an ad.
    expect(screen.getByText('Promoted')).toBeInTheDocument();
    expect(screen.getByText('Open to work')).toBeInTheDocument();
    // It links to the advertiser's profile.
    const profileLink = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/connect/u/u-42');
    expect(profileLink).toBeDefined();
  });

  it('renders no promoted card when none is resolved', () => {
    renderWithIntl(<NetworkScreen counts={counts} data={emptyData} promotedProfile={null} />);
    expect(screen.queryByText('Promoted')).toBeNull();
  });
});
