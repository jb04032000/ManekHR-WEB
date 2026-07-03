import { describe, it, expect, vi } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { Job } from './jobs.types';
import type { PromotedListingResolved } from '@/features/connect/marketplace/PromotedListingAdCard';

/**
 * Job-detail rail boost (placement `jobs_detail`). The first-party promoted
 * listing card renders in ConnectRightRail ONLY when the page resolves a boost
 * (the `promoted` prop); a no-fill (null) shows no ad. Mirrors the company /
 * storefront rails that use the same PromotedListingAdCard.
 */

// The screen's actions + child controls hit the network / app router; stub them
// so the render is pure. The ads beacon action is stubbed so the rail card's
// useAdBeacons never touches next/headers; the IntersectionObserver rides the
// inert vitest.setup stub and never fires here.
vi.mock('./jobs.actions', () => ({
  acceptApplication: vi.fn(),
  applyToJob: vi.fn(),
  closeJob: vi.fn(),
  saveJob: vi.fn(),
  setApplicationStatus: vi.fn(),
  unsaveJob: vi.fn(),
  updateJob: vi.fn(),
  withdrawApplication: vi.fn(),
}));
vi.mock('./JobComposer', () => ({ default: () => null }));
vi.mock('@/features/connect/inbox/StartConversationButton', () => ({ default: () => null }));
vi.mock('@/features/connect/ads/ads.actions', () => ({
  recordImpression: vi.fn(async () => undefined),
  recordClick: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import JobDetailScreen from './JobDetailScreen';

const BASE_JOB: Job = {
  _id: 'job-1',
  companyUserId: 'u-co',
  companyPageId: null,
  title: 'Multi-needle machine operator',
  description: 'Festive season work.',
  responsibilities: [],
  category: 'embroidery-zari',
  role: 'operator',
  wageType: 'daily',
  wageMin: 500,
  wageMax: 700,
  openings: 2,
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  skills: [],
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

const PROMOTED: PromotedListingResolved = {
  listing: {
    _id: 'L7',
    ownerUserId: 'u-seller',
    title: 'Promoted zari border',
    description: 'Hand zardozi border',
    category: 'embroidery-zari',
    priceType: 'fixed',
    priceMin: 900,
    images: [],
    verified: false,
  },
  impressionToken: 'imp-job',
  campaignId: 'cmp-job',
};

function renderScreen(promoted: PromotedListingResolved | null) {
  return renderWithIntl(
    <AntApp>
      <JobDetailScreen
        job={BASE_JOB}
        isCompany={false}
        applications={[]}
        myApplication={null}
        promoted={promoted}
      />
    </AntApp>,
  );
}

describe('JobDetailScreen promoted rail', () => {
  it('renders the promoted listing card when a boost resolves', () => {
    renderScreen(PROMOTED);
    // The "Promoted" disclosure (the card's role=note, aria-label "Promoted") +
    // the listing link prove the card is mounted in the rail. Query by the
    // aria-label so we hit the boost card, not the rail's sample-content note
    // (also role=note). The link targets the listing detail.
    expect(screen.getByRole('note', { name: 'Promoted' })).toBeInTheDocument();
    expect(screen.getByText('Promoted zari border')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Promoted zari border/i }).getAttribute('href')).toBe(
      '/connect/marketplace/listing/L7',
    );
  });

  it('renders no promoted card on a no-fill (null)', () => {
    renderScreen(null);
    expect(screen.queryByRole('note', { name: 'Promoted' })).not.toBeInTheDocument();
  });
});
