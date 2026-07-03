/**
 * BOOST-UI (owner 2026-06-19): Spotlight-on-mobile coverage for FeedScreen.
 *
 * The Spotlight rail card historically rendered only in the tablet band
 * (`hidden md:block xl:hidden`) and the xl side rail, so phones (<768px) never
 * saw a Spotlight boost. This test asserts the new mobile-only slot: the
 * SpotlightRailCard now also renders inside a `md:hidden` wrapper at the top of
 * the feed column, so a 360px phone shows it. jsdom does not evaluate media
 * queries, so "mobile width" is verified structurally (the card sits in the
 * `md:hidden` slot) exactly as responsive visibility is expressed elsewhere in
 * the codebase.
 *
 * The heavy feed children (FeedList / Composer / rail person actions / the
 * notification provider) are stubbed so the test focuses on the screen's own
 * layout, mirroring the AdCard / boosts-manager mock strategy.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { FeedSponsoredCard } from './feed-ads';
import type { HydratedFeedPage } from '../feed.types';

// Stub the heavy/interactive children so the screen renders in jsdom without
// pulling the live feed query, composer, or socket provider.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/feed',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: vi.fn(), invalidateQueries: vi.fn() }),
}));
vi.mock('./FeedList', () => ({ default: () => <div data-testid="feed-list" /> }));
// The barrel re-exports Composer as `export { default as Composer } from
// './Composer'`, so the mock must provide a `default`.
vi.mock('@/components/connect/Composer', () => ({ default: () => null, Composer: () => null }));
vi.mock('./FeedPeopleToFollow', () => ({ default: () => null }));
vi.mock('./FeedCompanyFollowButton', () => ({ default: () => null }));
vi.mock('../network/PersonCardActions', () => ({ default: () => null }));
vi.mock('@/components/connect/ConnectErpCrossSell', () => ({ default: () => null }));
vi.mock('@/components/connect/FeedProfileCard', () => ({ default: () => null }));
// useAdBeacons (inside SpotlightRailCard) records via these server actions.
vi.mock('@/features/connect/ads/use-ad-beacons', () => ({
  useAdBeacons: () => ({ cardRef: { current: null }, onClick: vi.fn() }),
}));

import FeedScreen from './FeedScreen';

const emptyPage: HydratedFeedPage = { items: [], nextCursor: null } as unknown as HydratedFeedPage;

const viewer = { id: 'me', name: 'Asha', avatar: null, hasWorkspace: false };

const spotlightCard: FeedSponsoredCard = {
  kind: 'listing',
  impressionToken: 't',
  campaignId: 'c',
  listing: { _id: 'l-1', title: 'Pure zari saree', category: 'weaving', images: [] },
} as unknown as FeedSponsoredCard;

function renderFeed(props: Partial<React.ComponentProps<typeof FeedScreen>> = {}) {
  return renderWithIntl(
    <FeedScreen
      tab="foryou"
      data={{ page: emptyPage }}
      viewer={viewer}
      suggestions={[]}
      onboarded
      profile={null}
      spotlightCard={spotlightCard}
      // A non-empty trending list avoids the rail's `trendingEmpty` copy path (a
      // pre-existing missing-key the strict test intl would throw on; unrelated to
      // this Spotlight change). The rail panels are shared with the mobile slot.
      trending={[{ postId: 'p1', snippet: 'A post', reactionCount: 0 } as never]}
      {...props}
    />,
  );
}

describe('FeedScreen - Spotlight on mobile', () => {
  it('renders the Spotlight card in a phone-only (md:hidden) slot at the top of the feed column', () => {
    renderFeed();
    // The card renders in the new phone slot AND in the existing rail copies
    // (jsdom mounts all DOM regardless of CSS visibility), so match all instances.
    const titles = screen.getAllByText('Pure zari saree');
    expect(titles.length).toBeGreaterThan(0);
    // At least one instance must sit inside a `md:hidden` wrapper - the new phone
    // slot - so a 360px viewport (below md) shows the Spotlight card. Without the
    // fix none of the copies lived in a `md:hidden` slot.
    const inMobileSlot = titles.some((el) => el.closest('.md\\:hidden') !== null);
    expect(inMobileSlot).toBe(true);
  });

  it('omits the mobile Spotlight slot when there is no Spotlight boost', () => {
    renderFeed({ spotlightCard: null });
    expect(screen.queryByText('Pure zari saree')).toBeNull();
  });
});
