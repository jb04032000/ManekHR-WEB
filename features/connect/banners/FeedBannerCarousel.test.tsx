/**
 * FeedBannerCarousel unit tests. Covers the two spec-critical behaviours:
 *  - empty list => renders NOTHING (no DOM, no carousel chrome);
 *  - a link banner is an anchor (new tab, safe rel); a no-link banner is not.
 * Plus structural coverage of slides + dots. jsdom has no layout/media queries,
 * so behaviour is asserted structurally (DOM presence/attributes), matching the
 * FeedScreen spotlight test's approach.
 */
import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import FeedBannerCarousel from './FeedBannerCarousel';
import type { FeedBanner } from './banner.types';

function banner(over: Partial<FeedBanner> & { id: string }): FeedBanner {
  return { imageUrl: `https://cdn/${over.id}.jpg`, linkUrl: '', alt: over.id, order: 0, ...over };
}

describe('FeedBannerCarousel', () => {
  it('renders nothing when the banner list is empty', () => {
    const { container } = renderWithIntl(<FeedBannerCarousel banners={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one image per banner with its alt text and lazy loading', () => {
    const banners = [banner({ id: 'a', alt: 'First' }), banner({ id: 'b', alt: 'Second' })];
    renderWithIntl(<FeedBannerCarousel banners={banners} />);

    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(screen.getByAltText('First')).toBeInTheDocument();
    expect(imgs[0]).toHaveAttribute('loading', 'lazy');
  });

  it('wraps a banner with a linkUrl in a new-tab anchor with a safe rel', () => {
    const banners = [banner({ id: 'a', alt: 'Promo', linkUrl: 'https://shop.example.com' })];
    renderWithIntl(<FeedBannerCarousel banners={banners} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://shop.example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders a bare-domain link as an absolute URL (not relative to the page)', () => {
    const banners = [banner({ id: 'a', linkUrl: 'manekhr.in' })];
    renderWithIntl(<FeedBannerCarousel banners={banners} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://manekhr.in');
  });

  it('renders no anchor for a banner without a linkUrl', () => {
    const banners = [banner({ id: 'a', alt: 'Promo', linkUrl: '' })];
    renderWithIntl(<FeedBannerCarousel banners={banners} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders one dot control per banner when there is more than one', () => {
    const banners = [banner({ id: 'a' }), banner({ id: 'b' }), banner({ id: 'c' })];
    renderWithIntl(<FeedBannerCarousel banners={banners} />);

    // Dots are buttons whose accessible name references the slide index.
    const dots = screen.getAllByRole('button', { name: /banner \d/i });
    expect(dots).toHaveLength(3);
  });

  it('renders no prev/next/dots for a single banner', () => {
    renderWithIntl(<FeedBannerCarousel banners={[banner({ id: 'solo' })]} />);
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /banner \d/i })).not.toBeInTheDocument();
  });
});
