/**
 * Tests for the Connect analytics catalog: type-safety guard rails, money
 * bucketing, and the sampled once-per-session feed impression path.
 *
 * The `@ts-expect-error` lines are the type-safety test: they FAIL the typecheck
 * gate (tsc --noEmit) if the bad shape ever stops being an error, i.e. if the
 * catalog loses its teeth. They are no-ops at runtime.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConnectEvents,
  bucketRupees,
  recordFeedImpression,
  trackEvent,
  __resetFeedImpressionsForTest,
  FEED_IMPRESSION_SAMPLE_RATE,
} from './analytics-events';
import * as analytics from './analytics';

vi.mock('./analytics', () => ({ track: vi.fn() }));
const trackMock = vi.mocked(analytics.track);

beforeEach(() => {
  trackMock.mockClear();
  __resetFeedImpressionsForTest();
});

describe('trackEvent - type safety (compile-time, asserted via @ts-expect-error)', () => {
  it('accepts a correctly-shaped event and forwards to track()', () => {
    trackEvent(ConnectEvents.listingViewed, { listingId: 'l1', source: 'feed' });
    expect(trackMock).toHaveBeenCalledWith('connect.listing.viewed', {
      listingId: 'l1',
      source: 'feed',
    });
  });

  it('rejects bad property shapes at compile time', () => {
    // Wrong type for a field.
    // @ts-expect-error position must be a number
    trackEvent(ConnectEvents.feedPostImpression, { postId: 'p1', position: 'top', tab: 'for-you' });
    // Missing required field.
    // @ts-expect-error source is required
    trackEvent(ConnectEvents.listingViewed, { listingId: 'l1' });
    // Unknown event name.
    // @ts-expect-error not a catalog event
    trackEvent('connect.bogus.event', {});
    // Invalid enum value.
    // @ts-expect-error target must be media|comments|profile|link
    trackEvent(ConnectEvents.feedPostClick, { postId: 'p1', target: 'banana' });
    // PII guard: the search event must NEVER carry the raw query text. An excess
    // `query` property is a typecheck error, so the catalog itself blocks the leak.
    trackEvent(ConnectEvents.searchPerformed, {
      queryLength: 11,
      vertical: 'all',
      resultCount: 3,
      // @ts-expect-error raw query text is forbidden on search events (PII hygiene)
      query: 'silk sarees',
    });
    expect(trackMock).toHaveBeenCalled();
  });
});

describe('boost funnel - events emit in order through the flow', () => {
  it('cta -> flow_started -> submitted preserves order via the wrapper', () => {
    trackEvent(ConnectEvents.boostCtaClicked, { subject: 'listing' });
    trackEvent(ConnectEvents.boostFlowStarted, { subject: 'listing' });
    trackEvent(ConnectEvents.boostSubmitted, { subject: 'listing', budgetBucket: '1k-2.4k' });
    expect(trackMock.mock.calls.map((c) => c[0])).toEqual([
      'connect.boost.cta_clicked',
      'connect.boost.flow_started',
      'connect.boost.submitted',
    ]);
    // Submitted carries a BUCKET, never an exact amount.
    expect(trackMock).toHaveBeenLastCalledWith('connect.boost.submitted', {
      subject: 'listing',
      budgetBucket: '1k-2.4k',
    });
  });
});

describe('plan-interest funnel - which plan people look at / pick', () => {
  it('cta_clicked forwards tier + surface for both pricing surfaces', () => {
    trackEvent(ConnectEvents.planCtaClicked, {
      tier: 'growth',
      surface: 'erp_pricing',
      recommended: true,
    });
    trackEvent(ConnectEvents.planCtaClicked, { tier: 'starter', surface: 'app_plans' });
    expect(trackMock).toHaveBeenNthCalledWith(1, 'plan.cta_clicked', {
      tier: 'growth',
      surface: 'erp_pricing',
      recommended: true,
    });
    expect(trackMock).toHaveBeenNthCalledWith(2, 'plan.cta_clicked', {
      tier: 'starter',
      surface: 'app_plans',
    });
  });

  it('band_selected forwards the team-size band + the tier it recommends', () => {
    trackEvent(ConnectEvents.planBandSelected, { band: 'b100', recommendedTier: 'growth' });
    expect(trackMock).toHaveBeenCalledWith('plan.band_selected', {
      band: 'b100',
      recommendedTier: 'growth',
    });
  });

  it('rejects PII / bad shapes at compile time', () => {
    // Exact price must NEVER ride a plan event (commercial hygiene).
    trackEvent(ConnectEvents.planCtaClicked, {
      tier: 'growth',
      surface: 'erp_pricing',
      // @ts-expect-error price is forbidden on plan events
      price: 4999,
    });
    // surface is constrained to the two known pricing surfaces.
    // @ts-expect-error surface must be erp_pricing | app_plans
    trackEvent(ConnectEvents.planCtaClicked, { tier: 'growth', surface: 'homepage' });
    expect(trackMock).toHaveBeenCalled();
  });
});

describe('keyless-safe - track sink is a no-op without env keys', () => {
  it('trackEvent delegates to track(), which no-ops when keys are absent', () => {
    // `track` (the real sink) early-returns when posthogKey/ga4MeasurementId are
    // empty; here it is mocked, so we assert the delegation contract. The no-op
    // behavior itself lives in lib/analytics.ts and is exercised by its env guard.
    trackEvent(ConnectEvents.videoPlay, { surface: 'profile' });
    expect(trackMock).toHaveBeenCalledWith('connect.video.play', { surface: 'profile' });
  });
});

describe('bucketRupees', () => {
  it('maps amounts into coarse bands, never exact values', () => {
    expect(bucketRupees(50)).toBe('<100');
    expect(bucketRupees(99)).toBe('<100');
    expect(bucketRupees(100)).toBe('100-299');
    expect(bucketRupees(299)).toBe('100-299');
    expect(bucketRupees(300)).toBe('300-599');
    expect(bucketRupees(600)).toBe('600-999');
    expect(bucketRupees(1000)).toBe('1k-2.4k');
    expect(bucketRupees(2500)).toBe('2.5k-4.9k');
    expect(bucketRupees(5000)).toBe('5k+');
    expect(bucketRupees(999999)).toBe('5k+');
  });

  it('treats non-finite input as zero (lowest band)', () => {
    // NaN and Infinity both fail Number.isFinite, so they fold to 0 -> '<100'.
    expect(bucketRupees(NaN)).toBe('<100');
    expect(bucketRupees(Infinity)).toBe('<100');
  });
});

describe('recordFeedImpression - once per post per session + sampling', () => {
  it('fires exactly once per postId within a session', () => {
    const props = { postId: 'p1', position: 3, tab: 'for-you' } as const;
    expect(recordFeedImpression({ ...props })).toBe(true);
    expect(recordFeedImpression({ ...props })).toBe(false);
    expect(recordFeedImpression({ ...props })).toBe(false);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('connect.feed.post_impression', props);
  });

  it('counts distinct posts independently', () => {
    expect(recordFeedImpression({ postId: 'a', position: 0, tab: 'for-you' })).toBe(true);
    expect(recordFeedImpression({ postId: 'b', position: 1, tab: 'for-you' })).toBe(true);
    expect(trackMock).toHaveBeenCalledTimes(2);
  });

  it('default sample rate is 1.0 (emit everything)', () => {
    expect(FEED_IMPRESSION_SAMPLE_RATE).toBe(1.0);
  });
});
