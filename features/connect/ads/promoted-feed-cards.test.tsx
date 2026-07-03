/**
 * Tests for the REDESIGNED in-feed promoted cards (2026-06-20).
 *
 * The job + listing feed boosts now reuse the REAL board / grid cards (JobCard
 * `promoted`, ListingGridCard `promoted`) so they carry the same rich signals as
 * the canonical cards; the rfq feed boost is enriched to the board's richness.
 * These tests assert:
 *   - the richer detail shows (job wage, listing price + unit, rfq quantity),
 *   - the "Promoted" disclosure is present (IAB/FTC),
 *   - the tap-through links to the entity,
 *   - the shared MRC click beacon (recordClick) fires on the tap-through.
 *
 * Mirrors new-boost-cards.smoke.test.tsx's mock strategy: ads.actions stubbed so
 * the beacons never touch next/headers; jobs.actions stubbed for JobCard's
 * Save/Apply controls; an inert IntersectionObserver for the viewability observer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { Job } from '@/features/connect/jobs/jobs.types';
import type { ListingDetail } from '@/features/connect/marketplace/marketplace.types';
import type { RfqDetail } from '@/features/connect/rfq/rfq.types';

// useAdBeacons calls these server actions; stub them so the click beacon never
// touches next/headers and we can assert it fired.
const { recordImpression, recordClick } = vi.hoisted(() => ({
  recordImpression: vi.fn().mockResolvedValue(undefined),
  recordClick: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./ads.actions', () => ({ recordImpression, recordClick }));

// JobCard's Save/Apply controls call the jobs server actions; stub them out.
vi.mock('@/features/connect/jobs/jobs.actions', () => ({
  saveJob: vi.fn().mockResolvedValue({ ok: true, data: { saved: true } }),
  unsaveJob: vi.fn().mockResolvedValue({ ok: true, data: { saved: false } }),
  applyToJob: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

import PromotedJobFeedCard from './PromotedJobFeedCard';
import PromotedListingFeedCard from './PromotedListingFeedCard';
import PromotedRfqFeedCard from './PromotedRfqFeedCard';

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

/** Wrap in AntApp so JobCard's App.useApp() (message API) + Modal portal work. */
function renderCard(ui: React.ReactElement) {
  return renderWithIntl(<AntApp>{ui}</AntApp>);
}

const JOB: Job = {
  _id: 'j-1',
  companyUserId: 'u-co',
  companyPageId: null,
  title: 'Beats Designer',
  description: 'Festive season hiring.',
  responsibilities: [],
  category: 'embroidery-zari',
  role: 'designer',
  wageType: 'monthly',
  wageMin: 15000,
  wageMax: 22000,
  openings: 4,
  location: { district: 'Bhavnagar', city: '', state: 'Gujarat' },
  skills: ['Pattern design'],
  machineType: '',
  employmentType: null,
  experienceMin: null,
  shift: null,
  workingDays: '',
  languages: [],
  benefits: [],
  closesAt: null,
  status: 'open',
  applicationsCount: 0,
  views: 0,
  boostCampaignId: null,
};

describe('PromotedJobFeedCard (reuses the real JobCard promoted variant)', () => {
  it('shows the rich job signals: title, REAL wage + unit, openings, status, location', () => {
    renderCard(<PromotedJobFeedCard job={JOB} impressionToken="imp-j" campaignId="c-j" />);
    expect(screen.getByText('Beats Designer')).toBeInTheDocument();
    // The wage (the signal the basic stub was MISSING) renders with its unit.
    expect(screen.getByText(/15,000\s*-\s*22,000/)).toBeInTheDocument();
    expect(screen.getByText('/ month')).toBeInTheDocument();
    // Openings + an open status pill + location are all present now.
    expect(screen.getByText('4 openings')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText(/Bhavnagar/)).toBeInTheDocument();
  });

  it('carries the Promoted disclosure and links to the job', () => {
    renderCard(<PromotedJobFeedCard job={JOB} impressionToken="imp-j" campaignId="c-j" />);
    // JobCard's promoted pill reuses connect.ads.promotedLabel ("Promoted").
    expect(screen.getByText('Promoted')).toBeInTheDocument();
    const titleLink = screen.getByRole('link', { name: /Beats Designer/i });
    expect(titleLink).toHaveAttribute('href', '/connect/jobs/j-1');
  });

  it('fires the shared MRC click beacon when the job is opened (title tap)', () => {
    renderCard(<PromotedJobFeedCard job={JOB} impressionToken="imp-j" campaignId="c-j" />);
    screen.getByRole('link', { name: /Beats Designer/i }).click();
    expect(recordClick).toHaveBeenCalledWith('imp-j');
  });
});

const LISTING: ListingDetail = {
  _id: 'l-1',
  ownerUserId: 'u-s',
  title: 'Pure zari saree',
  description: 'Hand zardozi on silk',
  category: 'weaving',
  priceType: 'fixed',
  priceMin: 4500,
  priceMax: null,
  unit: 'per-piece',
  moq: 10,
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  images: [],
  verified: true,
};

describe('PromotedListingFeedCard (reuses the real ListingGridCard promoted variant)', () => {
  it('shows the rich listing signals: title, REAL price + unit, MOQ, district, verified', () => {
    renderCard(
      <PromotedListingFeedCard listing={LISTING} impressionToken="imp-l" campaignId="c-l" />,
    );
    expect(screen.getByText('Pure zari saree')).toBeInTheDocument();
    // Price (Indian-numbering rupee) renders with its unit suffix.
    expect(screen.getByText(/4,500/)).toBeInTheDocument();
    expect(screen.getByText('/ piece')).toBeInTheDocument();
    // MOQ + district + the verified marker all show (none were in the old stub).
    expect(screen.getByText('MOQ 10')).toBeInTheDocument();
    expect(screen.getByText('Surat')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('carries the Promoted disclosure and links to the listing detail', () => {
    renderCard(
      <PromotedListingFeedCard listing={LISTING} impressionToken="imp-l" campaignId="c-l" />,
    );
    // ListingGridCard's promoted chip exposes the disclosure as role="note".
    expect(screen.getByRole('note', { name: 'Promoted' })).toBeInTheDocument();
    const firstLink = screen.getAllByRole('link')[0];
    expect(firstLink).toHaveAttribute('href', '/connect/marketplace/listing/l-1');
  });

  it('fires the shared MRC click beacon when the listing is tapped', () => {
    renderCard(
      <PromotedListingFeedCard listing={LISTING} impressionToken="imp-l" campaignId="c-l" />,
    );
    // Click bubbles from the card's detail link up to the beacon wrapper's onClick.
    screen.getAllByRole('link')[0].click();
    expect(recordClick).toHaveBeenCalledWith('imp-l');
  });

  it('renders a negotiable listing with the Negotiable pill (no fabricated price)', () => {
    const negotiable: ListingDetail = {
      ...LISTING,
      _id: 'l-2',
      priceType: 'negotiable',
      priceMin: null,
      unit: null,
    };
    renderCard(
      <PromotedListingFeedCard listing={negotiable} impressionToken="imp-l" campaignId="c-l" />,
    );
    expect(screen.getByText('Negotiable')).toBeInTheDocument();
  });
});

const RFQ = {
  _id: 'r-1',
  buyerUserId: 'u-b',
  title: 'Need 5000m cotton, zari border',
  description: 'Bulk order',
  category: 'weaving',
  quantity: 5000,
  unit: 'per-meter',
  budgetMin: 20000,
  budgetMax: 35000,
  neededBy: null,
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  status: 'open',
  quotesCount: 0,
} as unknown as RfqDetail;

describe('PromotedRfqFeedCard (enriched to the board richness)', () => {
  it('shows the rich request signals: category, title, budget, quantity + unit, location', () => {
    renderCard(<PromotedRfqFeedCard rfq={RFQ} impressionToken="imp-r" campaignId="c-r" />);
    expect(screen.getByText('Need 5000m cotton, zari border')).toBeInTheDocument();
    expect(screen.getByText('Weaving')).toBeInTheDocument();
    expect(screen.getByText('₹20,000 - ₹35,000')).toBeInTheDocument();
    // Quantity + unit + location are the new signals (the stub had budget only).
    // The unit label reuses the marketplace card units ("/ meter").
    expect(screen.getByText(/5,000 \/ meter/)).toBeInTheDocument();
    expect(screen.getByText(/Surat/)).toBeInTheDocument();
  });

  it('carries the Promoted disclosure and links to the request', () => {
    renderCard(<PromotedRfqFeedCard rfq={RFQ} impressionToken="imp-r" campaignId="c-r" />);
    expect(screen.getByRole('note', { name: 'Promoted' })).toBeInTheDocument();
    expect(screen.getByText('Send a quote')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connect/rfq/r-1');
  });

  it('fires the shared MRC click beacon when the request is tapped', () => {
    renderCard(<PromotedRfqFeedCard rfq={RFQ} impressionToken="imp-r" campaignId="c-r" />);
    screen.getByRole('link').click();
    expect(recordClick).toHaveBeenCalledWith('imp-r');
  });
});
