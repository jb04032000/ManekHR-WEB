import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the analytics sink so we can assert what trackEvent forwards. The module
// under test imports `./analytics`; this mock intercepts that same module.
const track = vi.fn();
vi.mock('./analytics', () => ({ track: (...args: unknown[]) => track(...args) }));

import {
  __resetMarketingSectionViewsForTest,
  ConnectEvents,
  recordMarketingSectionView,
  trackEvent,
} from './analytics-events';

describe('marketing analytics events', () => {
  beforeEach(() => {
    track.mockClear();
    __resetMarketingSectionViewsForTest();
  });

  it('catalogs the three marketing funnel events', () => {
    expect(ConnectEvents.marketingCtaClicked).toBe('marketing.cta_clicked');
    expect(ConnectEvents.marketingSectionViewed).toBe('marketing.page_section_viewed');
    expect(ConnectEvents.marketingFaqOpened).toBe('marketing.faq_opened');
  });

  it('trackEvent forwards cta_clicked with page + position', () => {
    trackEvent(ConnectEvents.marketingCtaClicked, { page: 'home', position: 'hero' });
    expect(track).toHaveBeenCalledWith('marketing.cta_clicked', { page: 'home', position: 'hero' });
  });

  it('recordMarketingSectionView fires once per section per session', () => {
    expect(recordMarketingSectionView({ page: 'connect', section: 'modules' })).toBe(true);
    expect(recordMarketingSectionView({ page: 'connect', section: 'modules' })).toBe(false);
    // A different section still fires.
    expect(recordMarketingSectionView({ page: 'connect', section: 'trust' })).toBe(true);
    expect(track).toHaveBeenCalledTimes(2);
  });
});
