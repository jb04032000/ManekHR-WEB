/**
 * AdCard -- unit tests (RTL + vitest + fake timers).
 *
 * Covers:
 *   1. Promoted card: viewability beacon fires once after >=50% visible for >=1s.
 *   2. Promoted card: beacon does NOT fire if visibility drops before 1s.
 *   3. Promoted card: beacon fires AT MOST once even if the card scrolls in/out
 *      multiple times (double-fire guard).
 *   4. Promoted card: click triggers recordClick(token), then navigation continues.
 *   5. Promoted card: the "Promoted" disclosure label is rendered.
 *   6. House-promo input: renders the house promo (FeedAdCard) with NO impression
 *      beacon call.
 *
 * IO mock strategy:
 *   jsdom does not implement IntersectionObserver. We install a manual spy that
 *   exposes a `trigger(ratio)` helper so tests can drive intersection changes
 *   precisely. Vitest fake timers control the 1-second dwell window.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { HydratedFeedItem } from '@/features/connect/feed.types';
import type { HousePromo } from '@/features/connect/feed/feed-ads';

// ---------------------------------------------------------------------------
// Mock: ads.actions (server actions -- must be mocked before import of AdCard)
// ---------------------------------------------------------------------------
const recordImpressionMock = vi.fn().mockResolvedValue(undefined);
const recordClickMock = vi.fn().mockResolvedValue(undefined);

vi.mock('./ads.actions', () => ({
  recordImpression: (...args: unknown[]) => recordImpressionMock(...args),
  recordClick: (...args: unknown[]) => recordClickMock(...args),
}));

// ---------------------------------------------------------------------------
// Mock: PostCard (heavy component with router/AntD deps -- stub it out)
// ---------------------------------------------------------------------------
vi.mock('@/components/connect/PostCard', () => ({
  // The stub records whether an `onSeen` prop was passed. The promoted card MUST
  // NOT pass onSeen, so a sponsored post is excluded from the viewer's feed-dedup
  // "seen" set and does not suppress later organic delivery of the same post.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ post, onSeen }: { post: any; onSeen?: unknown }) => (
    <div
      data-testid="post-card"
      data-post-id={post._id}
      data-has-onseen={onSeen === undefined ? 'no' : 'yes'}
    >
      PostCard:{post._id}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock: FeedAdCard (house promo renderer)
// ---------------------------------------------------------------------------
vi.mock('@/features/connect/feed/FeedAdCard', () => ({
  default: ({ promo }: { promo: HousePromo }) => (
    <div data-testid="feed-ad-card" data-promo-id={promo.id}>
      FeedAdCard:{promo.id}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let ioCallback: IOCallback | null = null;
let ioObservedElement: Element | null = null;
let ioDisconnected = false;

/**
 * Trigger a synthetic intersection change with the given ratio. Call after
 * the component mounts so ioCallback is populated.
 */
function triggerIntersection(ratio: number) {
  ioCallback?.([
    {
      intersectionRatio: ratio,
      isIntersecting: ratio > 0,
      target: ioObservedElement ?? document.body,
      boundingClientRect: {} as DOMRect,
      intersectionRect: {} as DOMRect,
      rootBounds: null,
      time: performance.now(),
    } as IntersectionObserverEntry,
  ]);
}

function installIOStub() {
  ioCallback = null;
  ioObservedElement = null;
  ioDisconnected = false;

  // Must be a real class so `new IntersectionObserver(...)` works in jsdom.
  class IOStub {
    constructor(cb: IOCallback) {
      ioCallback = cb;
    }
    observe(el: Element) {
      ioObservedElement = el;
    }
    unobserve() {}
    disconnect() {
      ioDisconnected = true;
    }
  }

  vi.stubGlobal('IntersectionObserver', IOStub);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePost(id = 'post-1'): HydratedFeedItem {
  return { _id: id } as unknown as HydratedFeedItem;
}

const TOKEN = 'tok-xyz';
const CAMPAIGN_ID = 'camp-abc';
const VIEWER_ID = 'user-1';

// ---------------------------------------------------------------------------
// Import subject (after mocks are hoisted)
// ---------------------------------------------------------------------------
import AdCard from './AdCard';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AdCard', () => {
  beforeEach(() => {
    // shouldAdvanceTime: true lets RTL's waitFor's internal setTimeout
    // resolve even while fake timers are active. This is the recommended
    // Vitest pattern for mixing fake timers with async Testing Library queries.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installIOStub();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ---- 1. Viewability beacon fires once after >=50% visible for >=1s --------

  it('fires recordImpression once when >=50% visible for >=1s', async () => {
    renderWithIntl(
      <AdCard
        type="promoted"
        post={makePost()}
        impressionToken={TOKEN}
        campaignId={CAMPAIGN_ID}
        viewerId={VIEWER_ID}
        onboarded={true}
      />,
    );

    // Simulate entering viewport at 50%+ intersection.
    triggerIntersection(0.6);

    // Advance timer by just under 1s -- should NOT have fired yet.
    vi.advanceTimersByTime(999);
    expect(recordImpressionMock).not.toHaveBeenCalled();

    // Advance the remaining 1ms to complete the 1s dwell.
    vi.advanceTimersByTime(1);

    await waitFor(() => {
      expect(recordImpressionMock).toHaveBeenCalledTimes(1);
      expect(recordImpressionMock).toHaveBeenCalledWith(TOKEN);
    });
  });

  // ---- 2. Beacon does NOT fire if visibility drops before 1s ----------------

  it('does NOT fire recordImpression when visibility drops before 1s', async () => {
    renderWithIntl(
      <AdCard
        type="promoted"
        post={makePost()}
        impressionToken={TOKEN}
        campaignId={CAMPAIGN_ID}
        viewerId={VIEWER_ID}
        onboarded={true}
      />,
    );

    // Enter viewport.
    triggerIntersection(0.8);
    vi.advanceTimersByTime(500);

    // Drop below threshold before the dwell completes.
    triggerIntersection(0.3);
    vi.advanceTimersByTime(1000);

    // Beacon must never have fired.
    expect(recordImpressionMock).not.toHaveBeenCalled();
  });

  // ---- 3. Double-fire guard: beacon fires AT MOST once ----------------------

  it('fires recordImpression at most once even after multiple scroll-in/out cycles', async () => {
    renderWithIntl(
      <AdCard
        type="promoted"
        post={makePost()}
        impressionToken={TOKEN}
        campaignId={CAMPAIGN_ID}
        viewerId={VIEWER_ID}
        onboarded={true}
      />,
    );

    // First cycle: complete dwell -> fires.
    triggerIntersection(0.7);
    vi.advanceTimersByTime(1000);
    await waitFor(() => expect(recordImpressionMock).toHaveBeenCalledTimes(1));

    // Observer should be disconnected after the first fire.
    expect(ioDisconnected).toBe(true);

    // Second cycle: even if intersection fires again (e.g. a rogue observer),
    // the firedRef guard prevents a second call.
    triggerIntersection(0.9);
    vi.advanceTimersByTime(2000);

    // Still only one call.
    expect(recordImpressionMock).toHaveBeenCalledTimes(1);
  });

  // ---- 4. Click beacon -------------------------------------------------------

  it('calls recordClick(token) when the promoted card is clicked', async () => {
    renderWithIntl(
      <AdCard
        type="promoted"
        post={makePost('p2')}
        impressionToken={TOKEN}
        campaignId={CAMPAIGN_ID}
        viewerId={VIEWER_ID}
        onboarded={true}
      />,
    );

    const card = screen.getByTestId('post-card');
    fireEvent.click(card);

    await waitFor(() => {
      expect(recordClickMock).toHaveBeenCalledTimes(1);
      expect(recordClickMock).toHaveBeenCalledWith(TOKEN);
    });
  });

  // ---- 5. "Promoted" disclosure label renders --------------------------------

  it('renders the Promoted disclosure label for a promoted card', () => {
    renderWithIntl(
      <AdCard
        type="promoted"
        post={makePost()}
        impressionToken={TOKEN}
        campaignId={CAMPAIGN_ID}
        viewerId={VIEWER_ID}
        onboarded={true}
      />,
    );

    // The label text comes from connect.ads.promotedLabel in en.json = "Promoted".
    expect(screen.getByRole('note', { name: /promoted/i })).toBeInTheDocument();
    expect(screen.getByText(/promoted/i)).toBeInTheDocument();
  });

  // ---- 5b. Seen-exclusion: promoted card does NOT wire PostCard's onSeen -----

  it('does NOT pass onSeen to the promoted PostCard (excluded from feed-dedup)', () => {
    renderWithIntl(
      <AdCard
        type="promoted"
        post={makePost('p-seen')}
        impressionToken={TOKEN}
        campaignId={CAMPAIGN_ID}
        viewerId={VIEWER_ID}
        onboarded={true}
      />,
    );
    // No onSeen prop -> the sponsored post never reports itself as "seen", so it
    // cannot suppress later organic delivery of the same post.
    expect(screen.getByTestId('post-card').dataset.hasOnseen).toBe('no');
  });

  // ---- 6. House-promo: renders FeedAdCard, no impression beacon --------------

  it('renders FeedAdCard for a house-promo input and does NOT call recordImpression', () => {
    const promo: HousePromo = { id: 'network', href: '/connect/network' };
    const onDismiss = vi.fn();

    renderWithIntl(<AdCard type="house" promo={promo} onDismiss={onDismiss} />);

    expect(screen.getByTestId('feed-ad-card')).toBeInTheDocument();
    expect(screen.getByTestId('feed-ad-card').dataset.promoId).toBe('network');

    // Advance time past any hypothetical beacon window.
    vi.advanceTimersByTime(5000);

    expect(recordImpressionMock).not.toHaveBeenCalled();
    expect(recordClickMock).not.toHaveBeenCalled();
  });
});
