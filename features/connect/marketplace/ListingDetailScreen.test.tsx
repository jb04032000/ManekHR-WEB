import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';
import type { ConnectPerson } from '@/components/connect';
import type { ListingDetail } from './marketplace.types';

/**
 * M1.6.2 - ListingDetailScreen tests.
 *
 * The detail surface renders the full listing (gallery, price block with unit /
 * MOQ / lead time, description, district), a seller mini-card that links to the
 * seller's Connect profile, and a "Contact seller" CTA that opens the inquiry
 * modal. The inquiry action is mocked (the modal's submit path is covered in
 * SendInquiryModal.test); one shared nav mock covers ConnectPage / PersonCard.
 */
const { push, refresh, pathnameRef, searchParamsRef } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  pathnameRef: { current: '/connect/marketplace/listing/L1' },
  searchParamsRef: { current: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchParamsRef.current,
}));
const { sendInquiry } = vi.hoisted(() => ({ sendInquiry: vi.fn() }));
vi.mock('./marketplace.actions', () => ({ sendInquiry }));

import ListingDetailScreen from './ListingDetailScreen';

const LISTING: ListingDetail = {
  _id: 'L1',
  ownerUserId: 'u-meera',
  title: 'Heavy zari saree work',
  description: 'Hand-finished zardozi on silk. Bulk orders welcome.',
  category: 'embroidery-zari',
  priceType: 'range',
  priceMin: 4500,
  priceMax: 8500,
  unit: 'per-piece',
  moq: 50,
  leadTimeDays: 7,
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  images: ['https://img.example/1.jpg', 'https://img.example/2.jpg'],
  verified: false,
  createdAt: '2026-05-28T12:00:00.000Z',
};

const SELLER: ConnectPerson = {
  userId: 'meera-handle',
  name: 'Meera Sharma',
  headline: 'Master zari karigar',
};

beforeEach(() => {
  sendInquiry.mockReset();
});

describe('ListingDetailScreen', () => {
  it('renders the title, description, and location', () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    expect(screen.getByRole('heading', { name: 'Heavy zari saree work' })).toBeInTheDocument();
    expect(
      screen.getByText('Hand-finished zardozi on silk. Bulk orders welcome.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Surat/)).toBeInTheDocument();
  });

  it('renders the price range with unit, MOQ, and lead time', () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    expect(screen.getByText('₹4,500 to ₹8,500')).toBeInTheDocument();
    expect(screen.getByText(/per piece/)).toBeInTheDocument();
    expect(screen.getByText('Minimum order: 50')).toBeInTheDocument();
    expect(screen.getByText('Lead time: 7 days')).toBeInTheDocument();
  });

  it('renders the seller mini-card linking to the seller profile', () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Meera Sharma' });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/connect/u/meera-handle'));
  });

  it('opens the inquiry modal when the contact button is clicked', async () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Contact seller' }));
    expect(await screen.findByText('Contact the seller')).toBeInTheDocument();
  });

  it('shows the Verified marker when the seller is verified (M2.3)', () => {
    renderWithIntl(
      <ListingDetailScreen listing={{ ...LISTING, verified: true }} seller={SELLER} />,
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows no Verified marker for an unverified seller', () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('exposes the verified explanation to assistive tech (M2.5)', () => {
    // The hint must reach screen readers, not only mouse hover via title.
    renderWithIntl(
      <ListingDetailScreen listing={{ ...LISTING, verified: true }} seller={SELLER} />,
    );
    expect(screen.getByText('Verified')).toHaveAccessibleName(/verified plan/i);
  });

  it('renders the seller spec rows as the Specifications grid', () => {
    renderWithIntl(
      <ListingDetailScreen
        listing={{
          ...LISTING,
          specs: [
            { label: 'Fabric', value: 'Micro velvet' },
            { label: 'Work', value: 'Hand zardozi' },
          ],
        }}
        seller={SELLER}
      />,
    );
    expect(screen.getByText('Specifications')).toBeInTheDocument();
    expect(screen.getByText('Fabric')).toBeInTheDocument();
    expect(screen.getByText('Micro velvet')).toBeInTheDocument();
  });

  it('hides the Specifications grid when the seller entered none', () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    expect(screen.queryByText('Specifications')).not.toBeInTheDocument();
  });

  it('renders a poster-first video player when the listing has a video', () => {
    const { container } = renderWithIntl(
      <ListingDetailScreen
        listing={{
          ...LISTING,
          videos: [
            {
              url: 'https://img.example/clip.mp4',
              posterUrl: 'https://img.example/poster.jpg',
              durationSec: 45,
            },
          ],
        }}
        seller={SELLER}
      />,
    );
    expect(screen.getByText('Product video')).toBeInTheDocument();
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://img.example/clip.mp4');
    // Poster-first: the captured still + preload="metadata" (no full preload).
    expect(video?.getAttribute('poster')).toBe('https://img.example/poster.jpg');
    expect(video?.getAttribute('preload')).toBe('metadata');
  });

  it('renders no video player when the listing has no video', () => {
    const { container } = renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    expect(screen.queryByText('Product video')).not.toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
  });

  it('renders the trade-terms card: seller prose rows + lead time as Dispatch fallback', () => {
    renderWithIntl(
      <ListingDetailScreen
        listing={{
          ...LISTING,
          tradeTerms: { payment: 'Advance only', returns: 'Defects within 3 days' },
        }}
        seller={SELLER}
      />,
    );
    expect(screen.getByText('Trade terms')).toBeInTheDocument();
    // No dispatch prose -> the structured lead time fills the Dispatch row.
    expect(screen.getByText('Lead time: 7 days')).toBeInTheDocument();
    expect(screen.getByText('Advance only')).toBeInTheDocument();
    expect(screen.getByText('Defects within 3 days')).toBeInTheDocument();
  });

  it('shows the order estimator for a fixed price and recalculates from the stepper', () => {
    renderWithIntl(
      <ListingDetailScreen
        listing={{ ...LISTING, priceType: 'fixed', priceMin: 100, priceMax: null, moq: 6 }}
        seller={SELLER}
      />,
    );
    // Starts at the MOQ: 6 x 100.
    expect(screen.getByText('₹600')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByText('₹700')).toBeInTheDocument();
    // The stepper never goes below the MOQ.
    const dec = screen.getByRole('button', { name: 'Decrease quantity' });
    fireEvent.click(dec);
    fireEvent.click(dec);
    expect(screen.getByText('₹600')).toBeInTheDocument();
  });

  it('hides the order estimator for a price range (no made-up number)', () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    expect(screen.queryByText('Estimated order')).not.toBeInTheDocument();
  });

  it('shows the honest member-since stat on the seller card', () => {
    renderWithIntl(
      <ListingDetailScreen
        listing={{ ...LISTING, sellerMemberSince: '2024-03-01T00:00:00.000Z' }}
        seller={SELLER}
      />,
    );
    expect(screen.getByText('On ManekHR since 2024')).toBeInTheDocument();
  });

  it('renders the Service details block when serviceDetails is present', () => {
    renderWithIntl(
      <ListingDetailScreen
        listing={{
          ...LISTING,
          category: 'maintenance',
          priceType: 'fixed',
          priceMin: 500,
          priceMax: null,
          unit: undefined,
          serviceDetails: {
            deliveryMode: 'on-site',
            pricingModel: 'per-visit',
            coverageArea: 'Surat and Ahmedabad',
            yearsExperience: 8,
            availability: 'Mon to Sat, 9am to 7pm',
          },
        }}
        seller={SELLER}
      />,
    );
    expect(screen.getByText('Service details')).toBeInTheDocument();
    // Delivery mode + pricing model labels render their localized values.
    expect(screen.getByText('At your site')).toBeInTheDocument();
    expect(screen.getByText('Per visit')).toBeInTheDocument();
    expect(screen.getByText('Surat and Ahmedabad')).toBeInTheDocument();
    expect(screen.getByText('8 years')).toBeInTheDocument();
    expect(screen.getByText('Mon to Sat, 9am to 7pm')).toBeInTheDocument();
  });

  it('hides the Service details block for a non-service listing', () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    expect(screen.queryByText('Service details')).not.toBeInTheDocument();
  });

  it('shows Negotiable with no price unit for a negotiable service', () => {
    renderWithIntl(
      <ListingDetailScreen
        listing={{
          ...LISTING,
          category: 'consulting',
          priceType: 'negotiable',
          priceMin: null,
          priceMax: null,
          unit: undefined,
          serviceDetails: { deliveryMode: 'remote', pricingModel: 'negotiable' },
        }}
        seller={SELLER}
      />,
    );
    expect(screen.getByText('Service details')).toBeInTheDocument();
    // "Negotiable" shows in the buy box price AND as the pricing-model fact.
    expect(screen.getAllByText('Negotiable').length).toBeGreaterThan(0);
  });

  it('switches the visible hero image when a thumbnail is clicked', () => {
    renderWithIntl(<ListingDetailScreen listing={LISTING} seller={SELLER} />);
    // All photos mount (AntD Image, for the zoomable PreviewGroup) but only the
    // active one is shown; the inactive ones are display:none and so excluded
    // from the accessibility tree. Re-query after the swap to get the visible one.
    expect(screen.getByRole('img', { name: 'Heavy zari saree work' }).getAttribute('src')).toBe(
      'https://img.example/1.jpg',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show photo 2' }));
    expect(screen.getByRole('img', { name: 'Heavy zari saree work' }).getAttribute('src')).toBe(
      'https://img.example/2.jpg',
    );
  });
});
