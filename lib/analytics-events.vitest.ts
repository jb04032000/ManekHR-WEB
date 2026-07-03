/**
 * Tests for the analytics catalog: type-safety guard rails and the plan-interest
 * funnel. (The marketing.* wrapper behavior is covered separately in
 * `marketing-analytics.vitest.ts`.)
 *
 * The `@ts-expect-error` lines are the type-safety test: they FAIL the typecheck
 * gate (tsc --noEmit) if the bad shape ever stops being an error, i.e. if the
 * catalog loses its teeth. They are no-ops at runtime.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectEvents, trackEvent } from './analytics-events';
import * as analytics from './analytics';

vi.mock('./analytics', () => ({ track: vi.fn() }));
const trackMock = vi.mocked(analytics.track);

beforeEach(() => {
  trackMock.mockClear();
});

describe('trackEvent - type safety (compile-time, asserted via @ts-expect-error)', () => {
  it('accepts a correctly-shaped event and forwards to track()', () => {
    trackEvent(ConnectEvents.marketingCtaClicked, { page: 'erp', position: 'hero' });
    expect(trackMock).toHaveBeenCalledWith('marketing.cta_clicked', {
      page: 'erp',
      position: 'hero',
    });
  });

  it('rejects bad property shapes at compile time', () => {
    // Missing required field.
    // @ts-expect-error position is required
    trackEvent(ConnectEvents.marketingCtaClicked, { page: 'erp' });
    // Unknown event name.
    // @ts-expect-error not a catalog event
    trackEvent('marketing.bogus.event', {});
    // Invalid enum value.
    // @ts-expect-error page must be home|connect|pricing|erp
    trackEvent(ConnectEvents.marketingFaqOpened, { page: 'blog', question: 'faq.free' });
    expect(trackMock).toHaveBeenCalled();
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
    trackEvent(ConnectEvents.planBandSelected, { band: 'b5', recommendedTier: 'free' });
    expect(trackMock).toHaveBeenCalledWith('plan.band_selected', {
      band: 'b5',
      recommendedTier: 'free',
    });
  });
});
