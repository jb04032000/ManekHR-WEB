/**
 * MobileAdInline -- unit tests (RTL + vitest).
 *
 * The mobile-only inline ad block mirrors the desktop EntityAdRail inventory:
 * the first-party promoted listing (PromotedListingAdCard) + a Google AdSlot.
 * It must hide at the breakpoint where the desktop rail takes over so the same
 * ad never double-shows.
 *
 * Covers:
 *   1. With a `promoted` listing: renders the boost card + the AdSlot.
 *   2. Carries `xl:hidden` by default (most rails are hidden below xl).
 *   3. Carries `lg:hidden` for breakpoint="lg" (the ConnectLayout rails).
 *   4. Google-only (promoted=null): renders the AdSlot but NO boost card.
 *
 * Mocks mirror AdCard.test.tsx / new-boost-cards.smoke.test.tsx: the AdSlot
 * (a server component that resolves to null without AdSense env) is stubbed to a
 * testid, and ads.actions + IntersectionObserver are stubbed for the real
 * PromotedListingAdCard's view/click beacons.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { PromotedListingResolved } from '../marketplace/PromotedListingAdCard';

// AdSlot is a server component that returns null with no AdSense env; stub it so
// the test can assert the Google unit is wired into the block.
vi.mock('@/components/connect/AdSlot', () => ({
  default: ({ placement }: { placement: string }) => (
    <div data-testid="ad-slot" data-placement={placement}>
      AdSlot:{placement}
    </div>
  ),
  // The block now hides itself when there's no boost AND the slot won't render.
  // Default the fill-check to true so the existing "slot is wired" cases render;
  // the empty-state test overrides it to false.
  adSlotWillRender: vi.fn(() => true),
}));

// PromotedListingAdCard's useAdBeacons calls these server actions; stub them out.
vi.mock('./ads.actions', () => ({
  recordImpression: vi.fn().mockResolvedValue(undefined),
  recordClick: vi.fn().mockResolvedValue(undefined),
}));

// jsdom lacks IntersectionObserver (useAdBeacons constructs one in an effect).
class IOStub {
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IOStub;
});
afterEach(() => {
  vi.clearAllMocks();
});

import MobileAdInline from './MobileAdInline';

const promoted = {
  listing: {
    _id: 'l-1',
    title: 'Pure zari saree',
    images: [],
    priceType: 'fixed',
    priceMin: 4500,
    // PromotedListingAdCard labels the listing category; without it the card's
    // categoryLabel(undefined) throws (was the cause of stale red here).
    category: 'sarees',
  },
  impressionToken: 'tok-1',
  campaignId: 'camp-1',
} as unknown as PromotedListingResolved;

describe('MobileAdInline', () => {
  it('renders the promoted boost card AND a Google AdSlot when a boost is set', () => {
    renderWithIntl(<MobileAdInline promoted={promoted} />);
    // The first-party boost card shows the listing title.
    expect(screen.getByText('Pure zari saree')).toBeInTheDocument();
    // The Google unit is wired to the shared connect.right.top placement.
    const slot = screen.getByTestId('ad-slot');
    expect(slot).toBeInTheDocument();
    expect(slot.dataset.placement).toBe('connect.right.top');
  });

  it('hides below xl by default (xl:hidden), where the desktop rail takes over', () => {
    const { container } = renderWithIntl(<MobileAdInline promoted={promoted} />);
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section!.className).toContain('xl:hidden');
    expect(section!.className).not.toContain('lg:hidden');
  });

  it('hides below lg (lg:hidden) for breakpoint="lg" (ConnectLayout rails)', () => {
    const { container } = renderWithIntl(<MobileAdInline promoted={promoted} breakpoint="lg" />);
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section!.className).toContain('lg:hidden');
  });

  it('Google-only (promoted=null): renders the AdSlot but no boost card', () => {
    renderWithIntl(<MobileAdInline promoted={null} />);
    expect(screen.getByTestId('ad-slot')).toBeInTheDocument();
    // No first-party boost card -> the listing title is absent.
    expect(screen.queryByText('Pure zari saree')).not.toBeInTheDocument();
  });

  it('renders nothing (no orphaned "Sponsored" label) when no boost AND the slot will not fill', async () => {
    const { adSlotWillRender } = await import('@/components/connect/AdSlot');
    vi.mocked(adSlotWillRender).mockReturnValueOnce(false);
    const { container } = renderWithIntl(<MobileAdInline promoted={null} />);
    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByTestId('ad-slot')).not.toBeInTheDocument();
  });
});
