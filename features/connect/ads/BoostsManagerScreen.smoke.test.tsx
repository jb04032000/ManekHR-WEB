import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntApp } from 'antd';
import en from '@/app/messages/en.json';
import BoostsManagerScreen from './BoostsManagerScreen';
import type { BoostableSummary, BoostListItem, ConnectPricingView, WalletView } from './ads.types';

// Router + Razorpay-loading checkout are not exercised by a render smoke.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('./wallet-topup-checkout', () => ({
  purchaseWalletTopup: vi.fn(),
  CheckoutDismissedError: class extends Error {},
  CheckoutFailedError: class extends Error {},
}));
// The screen + the results drawer it hosts call these server actions; stub the
// ones the tree references (a row-present drawer open never calls getBoost). Full
// stub (no importActual) so the `'use server'` module is never loaded in jsdom.
// BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel +
// spend hidden from users; admin keeps control. The screen no longer imports
// pauseBoost/resumeBoost/cancelBoost, so they are not stubbed. Commented (not
// deleted) to re-enable later.
vi.mock('./ads.actions', () => ({
  getBoost: vi.fn(),
  listBoosts: vi.fn(),
  // pauseBoost: vi.fn(),
  // resumeBoost: vi.fn(),
  // cancelBoost: vi.fn(),
}));

const pricing: ConnectPricingView = {
  boostBidCpm: 40,
  boostBidCpc: 4,
  spotlightMultiplier: 2,
  moderationReviewFee: 25,
  boostMinBudget: 99,
  boostDurations: [3, 7, 14, 30],
  boostBudgetPresets: [99, 299, 500, 1000],
  walletTopupMinAmount: 99,
  walletTopupPresets: [99, 299, 500, 1000],
};

const boostable: BoostableSummary = {
  listings: [
    {
      id: 'L1',
      kind: 'boost_listing',
      title: 'Zari saree',
      image: null,
      subtitle: 'weaving',
      views: null,
    },
  ],
  jobs: [
    {
      id: 'J1',
      kind: 'boost_job',
      title: 'Karigar needed',
      image: null,
      subtitle: 'karigar',
      views: 12,
    },
  ],
  rfqs: [],
  counts: { listings: 1, jobs: 1, rfqs: 0 },
  intents: { work: false, hiring: false, deals: false, customOrders: false },
};

function renderHub(props: Partial<React.ComponentProps<typeof BoostsManagerScreen>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AntApp>
        <BoostsManagerScreen
          boosts={[]}
          stats={null}
          wallet={{ balance: 50, reserved: 0 } as WalletView}
          viewerName="Asha"
          pricing={pricing}
          boostable={boostable}
          {...props}
        />
      </AntApp>
    </NextIntlClientProvider>,
  );
}

describe('BoostsManagerScreen hub (render smoke)', () => {
  it('renders the inline wallet with balance + low-balance nudge', () => {
    renderHub();
    // Balance figure from the inline strip.
    expect(screen.getByText('₹50')).toBeInTheDocument();
    // Low balance (50 < boostMinBudget 99) nudge appears.
    expect(screen.getByText(/Low balance/i)).toBeInTheDocument();
  });

  it('shows the prominent 3-step explainer for a user with no boosts', () => {
    renderHub();
    expect(screen.getByText(en.connect.boosts.howItWorks.title)).toBeInTheDocument();
    expect(screen.getByText(en.connect.boosts.howItWorks.step1Title)).toBeInTheDocument();
    expect(screen.getByText(en.connect.boosts.howItWorks.step3Title)).toBeInTheDocument();
  });

  it('renders the quick-start with the caller-owned listing + job, linking into the composers', () => {
    renderHub();
    const quickStart = screen.getByRole('region', { name: en.connect.boosts.quickStart.title });
    const saree = within(quickStart).getByRole('link', { name: /Boost Zari saree/i });
    expect(saree).toHaveAttribute('href', '/connect/boost/listing/L1');
    const job = within(quickStart).getByRole('link', { name: /Boost Karigar needed/i });
    expect(job).toHaveAttribute('href', '/connect/boost/job/J1');
  });

  it('shows a "Start a boost" CTA that targets the quick-start anchor', () => {
    renderHub();
    const cta = screen.getByRole('link', { name: en.connect.boosts.mgr.empty.startCta });
    expect(cta).toHaveAttribute('href', '#boost-quick-start');
  });

  // A single active boost fixture, reused by the activity / cancel / tab tests.
  const activeListingBoost: BoostListItem = {
    id: 'B1',
    kind: 'boost_listing',
    objective: 'reach',
    status: 'active',
    moderationReason: null,
    totalBudget: 300,
    budgetSpent: 100,
    startAt: '2026-06-01T00:00:00.000Z',
    endAt: '2026-12-01T00:00:00.000Z',
    sourceListingId: 'L1',
    sourceJobId: null,
    sourcePostId: null,
    sourceRfqId: null,
    sourceProfileUserId: null,
    sourceTitle: 'Zari saree',
    sourceImage: null,
    impressions: 1000,
    clicks: 20,
    spend: 100,
    ctr: 0.02,
    costPerClick: 5,
  };

  it('collapses the explainer to a link once the user has boost activity', () => {
    renderHub({ boosts: [activeListingBoost] });
    // The full title is hidden; only the small "How it works" link shows.
    expect(screen.queryByText(en.connect.boosts.howItWorks.step1Title)).toBeNull();
    expect(
      screen.getByRole('button', { name: en.connect.boosts.howItWorks.link }),
    ).toBeInTheDocument();
  });

  it('renders an active row READ-ONLY: no Cancel/Pause control, no spend line, and no View report button', () => {
    // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): no pause/resume/cancel + spend
    // hidden from users. BOOST-UI (owner 2026-06-19): the per-row "View report"
    // button is removed too (redundant - the row already shows the same metrics;
    // the drawer's only unique value, the take-down reason, now shows inline). So
    // an active row has NO user action button at all.
    renderHub({ boosts: [activeListingBoost] });
    expect(screen.queryByRole('button', { name: en.connect.boosts.mgr.action.cancel })).toBeNull();
    expect(screen.queryByRole('button', { name: en.connect.boosts.mgr.action.pause })).toBeNull();
    // Spend "spent of budget" line is hidden from the user (admin-only).
    expect(screen.queryByText(/spent of/i)).toBeNull();
    // The redundant "View report" button is gone (drawer still opens via deep link).
    expect(
      screen.queryByRole('button', { name: en.connect.boosts.mgr.action.viewReport }),
    ).toBeNull();
    // The real metrics the row already shows stay put (Reach value).
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('shows the admin take-down reason INLINE in the row (the drawer button is gone, so the reason must not be lost)', () => {
    // BOOST-UI (owner 2026-06-19): the take-down reason was the drawer's one unique
    // value; with the per-row "View report" button removed, the reason is surfaced
    // inline so an advertiser still sees why a boost was taken down.
    const rejected: BoostListItem = {
      ...activeListingBoost,
      id: 'B-rej',
      status: 'rejected',
      moderationReason: 'Misleading claim in the creative',
    };
    renderHub({ boosts: [rejected] });
    // Drafts tab holds rejected boosts.
    fireEvent.click(screen.getByRole('tab', { name: /Drafts/ }));
    expect(screen.getByText(/Misleading claim in the creative/)).toBeInTheDocument();
  });

  it('shows the boosted item name as the row title, linking to its detail page', () => {
    renderHub({ boosts: [activeListingBoost] });
    // The listing row deep-links to the marketplace listing detail. The default
    // boostable quick-start also lists a "Zari saree" composer link, so assert on
    // the row's detail href specifically (it is unique to the manager row).
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/connect/marketplace/listing/L1');
    expect(links.length).toBeGreaterThan(0);
    // At least one of those links carries the item name as its text.
    expect(links.some((a) => /Zari saree/.test(a.textContent ?? ''))).toBe(true);
  });

  it('hides the Scheduled tab when there are no scheduled boosts', () => {
    renderHub({ boosts: [activeListingBoost] });
    const tablist = screen.getByRole('tablist');
    // Active / Completed / Drafts stay; Scheduled is dropped when its bucket is empty.
    expect(within(tablist).getByRole('tab', { name: /Active/ })).toBeInTheDocument();
    expect(within(tablist).queryByRole('tab', { name: /Scheduled/ })).toBeNull();
  });

  it('does NOT open the results drawer from a row (the per-row "View report" button is removed)', () => {
    // BOOST-UI (owner 2026-06-19): the manual per-row drawer trigger is gone. The
    // drawer now opens ONLY via the `?boost=` deep link (next test). With no row
    // button, the drawer stays closed on a plain list render.
    renderHub({ boosts: [activeListingBoost] });
    expect(
      screen.queryByRole('button', { name: en.connect.boosts.mgr.action.viewReport }),
    ).toBeNull();
    expect(screen.queryByText(en.connect.ads.results.drawerTitle)).toBeNull();
  });

  it('opens the drawer on mount for the `?boost=` deep-link target row', () => {
    renderHub({ boosts: [activeListingBoost], initialBoostId: activeListingBoost.id });
    // Seeded open: the drawer is up for the matching row without any interaction.
    expect(screen.getByText(en.connect.ads.results.drawerTitle)).toBeInTheDocument();
    expect(screen.getByText(en.connect.ads.results.heading)).toBeInTheDocument();
  });
});
