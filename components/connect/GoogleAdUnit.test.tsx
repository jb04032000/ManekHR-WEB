/**
 * GoogleAdUnit - unit tests (RTL + vitest + fake timers).
 *
 * Covers the serving-hardening contract:
 *   1. Reserves space (a min-height floor) at mount, before any fill -> no CLS.
 *   2. Lazy-mount: no adsbygoogle.push until the unit intersects the viewport.
 *   3. On FILL (data-ad-status="filled") the connect.ad.impression event fires
 *      exactly once with kind=adsense - and NOT on mount.
 *   4. On NO-FILL the unit collapses to the house fallback after the timeout,
 *      and fires NO impression.
 *
 * IntersectionObserver is stubbed (jsdom lacks it) with a manual trigger; the
 * <ins> data-ad-status is set by hand to drive the fill/no-fill branches.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithIntl } from '@/test-utils/render';

// ---- Mock: analytics catalog -----------------------------------------------
const trackEventMock = vi.fn();
vi.mock('@/lib/analytics-events', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
  ConnectEvents: { adImpression: 'connect.ad.impression' },
}));

// ---- Mock: house fallback (assert the swap, not its internals) --------------
vi.mock('./HouseAdFallback', () => ({
  default: ({ placement }: { placement: string }) => (
    <div data-testid="house-fallback" data-placement={placement}>
      HouseAdFallback
    </div>
  ),
}));

// ---- IntersectionObserver stub ---------------------------------------------
type IOCallback = (entries: IntersectionObserverEntry[]) => void;
let ioCallback: IOCallback | null = null;
let ioObserved: Element | null = null;

function triggerIntersection(isIntersecting: boolean) {
  ioCallback?.([
    {
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      target: ioObserved ?? document.body,
    } as IntersectionObserverEntry,
  ]);
}

function installIOStub() {
  ioCallback = null;
  ioObserved = null;
  class IOStub {
    constructor(cb: IOCallback) {
      ioCallback = cb;
    }
    observe(el: Element) {
      ioObserved = el;
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', IOStub);
}

import GoogleAdUnit, { NO_FILL_TIMEOUT_MS } from './GoogleAdUnit';

const CLIENT = 'ca-pub-1234567890123456';
const SLOT = 'slot-123';
const PLACEMENT = 'connect.right.top';

function setStatus(container: HTMLElement, status: string) {
  container.querySelector('ins.adsbygoogle')?.setAttribute('data-ad-status', status);
}

describe('GoogleAdUnit', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installIOStub();
    vi.clearAllMocks();
    // Provide the global queue so the push is a harmless array push in jsdom.
    (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ---- 1. Reserves space at mount -------------------------------------------
  it('reserves a min-height floor and renders the <ins> at mount', () => {
    const { container } = renderWithIntl(
      <GoogleAdUnit client={CLIENT} slot={SLOT} placement={PLACEMENT} />,
    );
    const aside = container.querySelector('aside');
    // Rail placement reserves the 250px floor (lib/connect/ads).
    expect(aside?.className).toContain('min-h-[250px]');
    expect(container.querySelector('ins.adsbygoogle')).not.toBeNull();
    expect(container.querySelector('ins.adsbygoogle')?.getAttribute('data-ad-slot')).toBe(SLOT);
  });

  // ---- 2 + 3. Lazy-mount + impression fires on FILL only --------------------
  it('does not fire the impression on mount, and fires once on fill (kind=adsense)', async () => {
    const { container } = renderWithIntl(
      <GoogleAdUnit client={CLIENT} slot={SLOT} placement={PLACEMENT} />,
    );

    // Not in view yet -> no impression even after time passes.
    expect(trackEventMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NO_FILL_TIMEOUT_MS);
    expect(trackEventMock).not.toHaveBeenCalled();

    // Scroll into view -> the unit starts; still no impression until a fill.
    triggerIntersection(true);
    expect(trackEventMock).not.toHaveBeenCalled();

    // AdSense reports a fill -> impression fires exactly once.
    setStatus(container, 'filled');
    vi.advanceTimersByTime(NO_FILL_TIMEOUT_MS);

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock).toHaveBeenCalledWith('connect.ad.impression', {
        placement: PLACEMENT,
        kind: 'adsense',
      });
    });
    // Filled units keep the AdSense <ins> (no fallback).
    expect(container.querySelector('[data-testid="house-fallback"]')).toBeNull();
  });

  // ---- 4. No-fill collapses to the house fallback, fires no impression ------
  it('collapses to the house fallback after the timeout when no ad fills', async () => {
    const { container, getByTestId } = renderWithIntl(
      <GoogleAdUnit client={CLIENT} slot={SLOT} placement={PLACEMENT} />,
    );

    triggerIntersection(true);
    // No data-ad-status set -> after the backstop timeout, collapse.
    vi.advanceTimersByTime(NO_FILL_TIMEOUT_MS);

    await waitFor(() => {
      expect(getByTestId('house-fallback')).toBeInTheDocument();
    });
    expect(getByTestId('house-fallback').dataset.placement).toBe(PLACEMENT);
    // The AdSense <ins> is gone and no impression was counted.
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  // ---- 4b. Explicit unfilled status also collapses --------------------------
  it('collapses to the house fallback on data-ad-status="unfilled"', async () => {
    const { container, getByTestId } = renderWithIntl(
      <GoogleAdUnit client={CLIENT} slot={SLOT} placement={PLACEMENT} />,
    );

    triggerIntersection(true);
    setStatus(container, 'unfilled');
    vi.advanceTimersByTime(NO_FILL_TIMEOUT_MS);

    await waitFor(() => {
      expect(getByTestId('house-fallback')).toBeInTheDocument();
    });
    expect(trackEventMock).not.toHaveBeenCalled();
  });
});
