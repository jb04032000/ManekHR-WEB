/**
 * Render smoke tests for the new promoted ad cards (open-to-work / hiring profile
 * boosts + RFQ boost). Verifies the cards render their copy + the correct
 * destination link + fire no error, in jsdom -- the runtime substitute for a
 * browser smoke of these surfaces. Mirrors AdCard.test.tsx's mock strategy
 * (ads.actions server actions + a no-op IntersectionObserver).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { ConnectPerson } from '@/components/connect';
import type { RfqDetail } from '@/features/connect/rfq/rfq.types';

// useAdBeacons calls these server actions; stub them out.
vi.mock('./ads.actions', () => ({
  recordImpression: vi.fn().mockResolvedValue(undefined),
  recordClick: vi.fn().mockResolvedValue(undefined),
}));

import PromotedProfileAdCard from './PromotedProfileAdCard';
import PromotedRfqAdCard from '@/features/connect/rfq/PromotedRfqAdCard';
import SpotlightRailCard from './SpotlightRailCard';
import type { FeedSponsoredCard } from '@/features/connect/feed/feed-ads';

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

const person: ConnectPerson = {
  userId: 'u-7',
  name: 'Asha Patel',
  headline: 'Zari karigar · 12 yrs',
};

describe('PromotedProfileAdCard', () => {
  it('open-to-work: shows the name, the open-to-work badge, and links to the profile', () => {
    renderWithIntl(
      <PromotedProfileAdCard
        person={person}
        impressionToken="t1"
        campaignId="c1"
        kind="open_to_work"
      />,
    );
    expect(screen.getByText('Asha Patel')).toBeInTheDocument();
    expect(screen.getByText('Open to work')).toBeInTheDocument();
    expect(screen.getByText('View profile')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/connect/u/u-7');
  });

  it('hiring: shows the hiring badge', () => {
    renderWithIntl(
      <PromotedProfileAdCard person={person} impressionToken="t1" campaignId="c1" kind="hiring" />,
    );
    expect(screen.getByText('Hiring')).toBeInTheDocument();
  });

  it('falls back to the tagline when the person has no headline', () => {
    renderWithIntl(
      <PromotedProfileAdCard
        person={{ userId: 'u-9', name: 'Ramesh' }}
        impressionToken="t1"
        campaignId="c1"
        kind="open_to_work"
      />,
    );
    expect(screen.getByText('Available for work')).toBeInTheDocument();
  });
});

describe('PromotedRfqAdCard', () => {
  const rfq = {
    _id: 'r-3',
    title: 'Need 5000m cotton, zari border',
    category: 'weaving',
    budgetMin: 20000,
    budgetMax: 35000,
    status: 'open',
  } as unknown as RfqDetail;

  it('shows the request title, a budget line, the send-quote CTA, and links to the request', () => {
    renderWithIntl(<PromotedRfqAdCard rfq={rfq} impressionToken="t1" campaignId="c1" />);
    expect(screen.getByText('Need 5000m cotton, zari border')).toBeInTheDocument();
    expect(screen.getByText('₹20,000 - ₹35,000')).toBeInTheDocument();
    expect(screen.getByText('Send a quote')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connect/rfq/r-3');
  });
});

describe('SpotlightRailCard (Phase 2 premium rail)', () => {
  it('renders a listing spotlight: title, REAL price + unit, category/district meta, Spotlight label, link', () => {
    const card = {
      kind: 'listing',
      impressionToken: 't',
      campaignId: 'c',
      listing: {
        _id: 'l-1',
        title: 'Pure zari saree',
        category: 'weaving',
        images: [],
        priceType: 'fixed',
        priceMin: 4500,
        unit: 'per-piece',
        location: { district: 'Surat' },
      },
    } as unknown as FeedSponsoredCard;
    renderWithIntl(<SpotlightRailCard card={card} />);
    expect(screen.getByText('Pure zari saree')).toBeInTheDocument();
    // The premium card now shows the real price (formatted) + unit suffix, not just a name.
    expect(screen.getByText('₹4,500 / piece')).toBeInTheDocument();
    expect(screen.getByText(/Surat/)).toBeInTheDocument();
    expect(screen.getByText('Spotlight')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connect/marketplace/listing/l-1');
  });

  it('renders a negotiable listing spotlight with a Negotiable pill (no fabricated price)', () => {
    const card = {
      kind: 'listing',
      impressionToken: 't',
      campaignId: 'c',
      listing: {
        _id: 'l-2',
        title: 'Custom embroidery',
        category: 'embroidery-zari',
        images: [],
        priceType: 'negotiable',
        priceMin: null,
      },
    } as unknown as FeedSponsoredCard;
    renderWithIntl(<SpotlightRailCard card={card} />);
    expect(screen.getByText('Negotiable')).toBeInTheDocument();
  });

  it('renders a job spotlight: REAL wage line + role/openings meta + jobs link', () => {
    const card = {
      kind: 'job',
      impressionToken: 't',
      campaignId: 'c',
      job: {
        _id: 'j-1',
        title: 'Zari karigar needed',
        role: 'karigar',
        category: 'embroidery-zari',
        wageType: 'monthly',
        wageMin: 15000,
        wageMax: 22000,
        openings: 3,
        location: { district: 'Surat', state: 'Gujarat' },
      },
    } as unknown as FeedSponsoredCard;
    renderWithIntl(<SpotlightRailCard card={card} />);
    expect(screen.getByText('Zari karigar needed')).toBeInTheDocument();
    expect(screen.getByText('₹15,000 - ₹22,000 / month')).toBeInTheDocument();
    expect(screen.getByText(/3 openings/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connect/jobs/j-1');
  });

  it('renders an rfq spotlight: REAL quantity + unit, linking to the request', () => {
    const card = {
      kind: 'rfq',
      impressionToken: 't',
      campaignId: 'c',
      rfq: {
        _id: 'r-1',
        title: 'Need 5000m cotton',
        category: 'weaving',
        quantity: 5000,
        unit: 'per-meter',
        location: { district: 'Surat' },
      },
    } as unknown as FeedSponsoredCard;
    renderWithIntl(<SpotlightRailCard card={card} />);
    expect(screen.getByText('Need 5000m cotton')).toBeInTheDocument();
    expect(screen.getByText('5,000 / meter')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connect/rfq/r-1');
  });

  it('renders a profile spotlight: intent pill + headline meta, linking to the profile', () => {
    const card = {
      kind: 'profile',
      impressionToken: 't',
      campaignId: 'c',
      intent: 'open_to_work',
      person: { userId: 'u-1', name: 'Asha Patel', headline: 'Zari karigar · 12 yrs' },
    } as unknown as FeedSponsoredCard;
    renderWithIntl(<SpotlightRailCard card={card} />);
    expect(screen.getByText('Asha Patel')).toBeInTheDocument();
    expect(screen.getByText('Open to work')).toBeInTheDocument();
    expect(screen.getByText('Zari karigar · 12 yrs')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connect/u/u-1');
  });

  it('renders a post spotlight as a body snippet linking to the post', () => {
    const card = {
      kind: 'post',
      impressionToken: 't',
      campaignId: 'c',
      post: { _id: 'p-1', body: 'New loom batch ready for dispatch this week.' },
    } as unknown as FeedSponsoredCard;
    renderWithIntl(<SpotlightRailCard card={card} />);
    expect(screen.getByText('New loom batch ready for dispatch this week.')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connect/posts/p-1');
  });
});
