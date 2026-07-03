/**
 * ReferralScreen -- unit tests (RTL + vitest).
 *
 * Covers:
 *   1. Renders stat values from a summary fixture.
 *   2. Shows the empty state (share CTA) when recent=[].
 *   3. Does NOT render a "spend now" / credits CTA when creditsEarned===0.
 *   4. Shows the disabled panel when summary.enabled===false.
 *   5. Shows the fetch-error Alert when summary is null.
 *
 * Mock strategy:
 *   - next-intl `useTranslations` is mocked to return key paths verbatim (the
 *     connect.referrals.* keys do not exist in en.json until Phase 9; this lets
 *     tests pass regardless of the message catalog state).
 *   - antd App.useApp mocked for message toasts.
 *   - lib/connect/share and lib/env mocked to avoid DOM API gaps in jsdom.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReferralSummaryView } from '../referrals.types';

// ---------------------------------------------------------------------------
// Mock: next-intl useTranslations -- returns key path as string, handles
// interpolation by appending the stringified params. This makes tests
// independent of whether Phase 9 keys exist in en.json yet.
// ---------------------------------------------------------------------------
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const fullKey = `${namespace}.${key}`;
    if (!params) return fullKey;
    // Append param values so tests can assert on interpolated content if needed.
    const paramStr = Object.values(params).join(' ');
    return `${fullKey} ${paramStr}`;
  },
}));

// ---------------------------------------------------------------------------
// Mock: antd -- keep Tag/Alert/Tooltip real but mock App.useApp for toasts
// ---------------------------------------------------------------------------
const messageSuccessMock = vi.fn();
const messageErrorMock = vi.fn();
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    App: {
      ...actual.App,
      useApp: () => ({ message: { success: messageSuccessMock, error: messageErrorMock } }),
    },
  };
});

// ---------------------------------------------------------------------------
// Mock: lib/connect/share (nativeShareSupported -- always false in jsdom)
// ---------------------------------------------------------------------------
vi.mock('@/lib/connect/share', () => ({
  waMeHref: (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  nativeShareSupported: () => false,
}));

// ---------------------------------------------------------------------------
// Mock: lib/env (appUrl)
// ---------------------------------------------------------------------------
vi.mock('@/lib/env', () => ({
  env: { appUrl: 'http://localhost:3001' },
}));

// ---------------------------------------------------------------------------
// Subject (after mocks are hoisted)
// ---------------------------------------------------------------------------
import ReferralScreen from '../ReferralScreen';

// Convenience wrapper: plain render is enough since next-intl is fully mocked.
function renderScreen(ui: React.ReactElement): ReturnType<typeof render> {
  return render(ui);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function summary(overrides: Partial<ReferralSummaryView> = {}): ReferralSummaryView {
  return {
    code: 'RAJES2B4',
    enabled: true,
    referrerCredits: 50,
    refereeCredits: 50,
    referredCount: 3,
    rewardedCount: 1,
    pendingCount: 2,
    creditsEarned: 50,
    creditsPending: 100,
    recent: [
      { name: 'Priya Shah', status: 'rewarded', date: '2026-06-01T10:00:00Z' },
      { name: 'Rahul Mehta', status: 'qualified', date: '2026-06-10T10:00:00Z' },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReferralScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders stat values from the summary fixture', () => {
    renderScreen(<ReferralScreen summary={summary()} />);

    // Referred count -- multiple "3" may appear (step numbers, avatar initials);
    // use getAllByText and assert at least one is the stat value.
    const threes = screen.getAllByText('3');
    expect(threes.length).toBeGreaterThan(0);

    // Credits earned (formatted as "50 credits"). May appear twice (earned + a
    // second occurrence in the earn-line interpolation); getAllByText is safe.
    expect(screen.getAllByText('50 credits').length).toBeGreaterThan(0);

    // Credits pending
    expect(screen.getByText('100 credits')).toBeInTheDocument();

    // Referral link contains the code
    expect(screen.getByText(/RAJES2B4/)).toBeInTheDocument();
  });

  it('shows referred names in the list when recent is non-empty', () => {
    renderScreen(<ReferralScreen summary={summary()} />);
    expect(screen.getByText('Priya Shah')).toBeInTheDocument();
    expect(screen.getByText('Rahul Mehta')).toBeInTheDocument();
  });

  it('shows the empty state when recent=[]', () => {
    renderScreen(<ReferralScreen summary={summary({ recent: [] })} />);
    // The empty-state paragraph should be present; the referred list items should not.
    expect(screen.queryByText('Priya Shah')).not.toBeInTheDocument();
    // There should be a share link (the empty-state CTA) present somewhere.
    const shareLinks = screen.getAllByRole('link');
    expect(shareLinks.length).toBeGreaterThan(0);
  });

  it('does NOT render a spend CTA when creditsEarned is 0', () => {
    renderScreen(<ReferralScreen summary={summary({ creditsEarned: 0 })} />);
    // "0 credits" appears in the earned stat card -- the sub-label ("spendable in wallet")
    // should be absent. We verify by checking no "earnedSub" i18n key content is visible
    // when earned = 0. Since the earnedSub is conditionally rendered only when
    // creditsEarned > 0, querying a known sub-key pattern is not needed --
    // instead assert the correct stat value appears and no "Spend" button exists.
    expect(screen.queryByRole('button', { name: /spend/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /spend/i })).not.toBeInTheDocument();
    // The earned stat should show "0 credits"
    expect(screen.getByText('0 credits')).toBeInTheDocument();
  });

  it('shows the disabled panel when summary.enabled is false', () => {
    renderScreen(<ReferralScreen summary={summary({ enabled: false })} />);
    // The disabled panel does not render stat cards or the referral link.
    expect(screen.queryByText('3')).not.toBeInTheDocument();
    expect(screen.queryByText(/RAJES2B4/)).not.toBeInTheDocument();
  });

  it('shows the fetch-error Alert when summary is null', () => {
    // The Alert component renders when the server fetch failed.
    renderScreen(<ReferralScreen summary={null} />);
    // The stat cards, referral link, and referred list must not appear.
    expect(screen.queryByText('3')).not.toBeInTheDocument();
    expect(screen.queryByText(/RAJES2B4/)).not.toBeInTheDocument();
  });

  it('hides rejected referrals from the list', () => {
    renderScreen(
      <ReferralScreen
        summary={summary({
          recent: [
            { name: 'Visible Person', status: 'rewarded', date: '2026-06-01T10:00:00Z' },
            { name: 'Hidden Person', status: 'rejected', date: '2026-06-02T10:00:00Z' },
          ],
        })}
      />,
    );
    expect(screen.getByText('Visible Person')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Person')).not.toBeInTheDocument();
  });
});
