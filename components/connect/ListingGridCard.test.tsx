import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';
import type { ConnectListingRef } from '@/features/connect/search.types';
import ListingGridCard from './ListingGridCard';

const LISTING: ConnectListingRef = {
  listingId: 'L1',
  ownerUserId: 'u',
  title: 'Heavy zari saree work',
  description: '',
  category: 'embroidery-zari',
  priceType: 'range',
  priceMin: 4500,
  priceMax: 8500,
  unit: 'per-piece',
  district: 'surat',
  coverImage: null,
  verified: true,
  moq: 50,
  createdAt: '2026-06-01T00:00:00.000Z',
};

describe('ListingGridCard', () => {
  it('links the title to the listing detail page', () => {
    renderWithIntl(<ListingGridCard listing={LISTING} />);
    const title = screen.getByRole('link', { name: 'Heavy zari saree work' });
    expect(title.getAttribute('href')).toBe('/connect/marketplace/listing/L1');
  });

  it('shows the localized category, price range, MOQ and title-cased district', () => {
    renderWithIntl(<ListingGridCard listing={LISTING} />);
    expect(screen.getByText('Embroidery and Zari')).toBeInTheDocument();
    expect(screen.getByText(/₹4,500/)).toBeInTheDocument();
    expect(screen.getByText('MOQ 50')).toBeInTheDocument();
    expect(screen.getByText('Surat')).toBeInTheDocument();
  });

  it('shows the verified badge and a Get quotation action to the detail', () => {
    renderWithIntl(<ListingGridCard listing={LISTING} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
    const quote = screen.getByRole('link', { name: /Get quotation/ });
    expect(quote.getAttribute('href')).toBe('/connect/marketplace/listing/L1');
  });

  it('shows a play badge only when the listing has a video', () => {
    const { rerender } = renderWithIntl(<ListingGridCard listing={LISTING} />);
    expect(screen.queryByTitle('Has video')).not.toBeInTheDocument();
    rerender(<ListingGridCard listing={{ ...LISTING, hasVideo: true }} />);
    expect(screen.getByTitle('Has video')).toBeInTheDocument();
  });

  it('renders Negotiable without a number', () => {
    renderWithIntl(
      <ListingGridCard
        listing={{ ...LISTING, priceType: 'negotiable', priceMin: null, priceMax: null }}
      />,
    );
    expect(screen.getByText('Negotiable')).toBeInTheDocument();
  });

  it('omits MOQ when the seller did not set one', () => {
    renderWithIntl(<ListingGridCard listing={{ ...LISTING, moq: null }} />);
    expect(screen.queryByText(/MOQ/)).not.toBeInTheDocument();
  });

  it('shows a hover carousel for multiple images and flips the shown image', () => {
    const { container } = renderWithIntl(
      <ListingGridCard
        listing={{ ...LISTING, images: ['https://img/a.jpg', 'https://img/b.jpg'] }}
      />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://img/a.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://img/b.jpg');
  });

  it('shows no carousel controls for a single image', () => {
    renderWithIntl(<ListingGridCard listing={{ ...LISTING, images: ['https://img/only.jpg'] }} />);
    expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument();
  });
});
