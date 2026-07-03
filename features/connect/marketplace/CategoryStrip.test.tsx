import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';

/**
 * CategoryStrip - the marketplace's category icon pills. It owns the `?category=`
 * facet (single-select; the active pill clears on a second tap). These tests
 * migrated from ListingFacetPanel when category moved into the strip.
 */
const { push, searchParamsRef } = vi.hoisted(() => ({
  push: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParamsRef.current,
}));

import CategoryStrip from './CategoryStrip';

function lastPushed(): URLSearchParams {
  const target = push.mock.calls[push.mock.calls.length - 1]?.[0] as string;
  return new URLSearchParams(target.split('?')[1] ?? '');
}

beforeEach(() => {
  push.mockReset();
  searchParamsRef.current = new URLSearchParams();
});

describe('CategoryStrip', () => {
  it('renders the All pill and the category pills', () => {
    renderWithIntl(<CategoryStrip />);
    expect(screen.getByRole('button', { name: /All/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Weaving/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Machinery/ })).toBeInTheDocument();
  });

  it('marks the active category from the URL with aria-pressed', () => {
    searchParamsRef.current = new URLSearchParams('category=weaving');
    renderWithIntl(<CategoryStrip />);
    expect(screen.getByRole('button', { name: /Weaving/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Dyeing/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sets the category param when a pill is clicked, preserving q', () => {
    searchParamsRef.current = new URLSearchParams('q=cotton');
    renderWithIntl(<CategoryStrip />);
    screen.getByRole('button', { name: /Machinery/ }).click();
    const params = lastPushed();
    expect(params.get('category')).toBe('machinery');
    expect(params.get('q')).toBe('cotton');
  });

  it('clears the category when the active pill is clicked again', () => {
    searchParamsRef.current = new URLSearchParams('category=weaving');
    renderWithIntl(<CategoryStrip />);
    screen.getByRole('button', { name: /Weaving/ }).click();
    expect(lastPushed().has('category')).toBe(false);
  });

  it('clears the category when All is pressed', () => {
    searchParamsRef.current = new URLSearchParams('category=weaving');
    renderWithIntl(<CategoryStrip />);
    screen.getByRole('button', { name: /All/ }).click();
    expect(lastPushed().has('category')).toBe(false);
  });

  it('renders the real per-category counts on the pills when provided', () => {
    renderWithIntl(<CategoryStrip categoryCounts={{ weaving: 74, machinery: 5 }} />);
    expect(screen.getByRole('button', { name: /Weaving/ })).toHaveTextContent('74');
    expect(screen.getByRole('button', { name: /Machinery/ })).toHaveTextContent('5');
    // "All" shows the corpus total (sum of the real counts), not a fabricated one.
    expect(screen.getByRole('button', { name: /All/ })).toHaveTextContent('79');
  });

  it('omits counts entirely when none are provided (no fabricated numbers)', () => {
    renderWithIntl(<CategoryStrip />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Weaving/ })).not.toHaveTextContent(/[0-9]/);
  });

  it('omits counts when categoryCounts is an empty map', () => {
    renderWithIntl(<CategoryStrip categoryCounts={{}} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  /**
   * Slice B3 - services mode drives the /connect/services service-type sub-filter:
   * only the service categories render, the "All" pill reads "All services", and
   * pushes go to /connect/services. The selected service type maps to the SAME
   * `?category=` BE filter, so picking one narrows results exactly like the
   * marketplace category facet.
   */
  describe('services mode', () => {
    it('renders only the service categories (constrains to services)', () => {
      renderWithIntl(<CategoryStrip mode="services" />);
      // Service categories are present.
      expect(screen.getByRole('button', { name: /Consulting/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Transport/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Machine repair/ })).toBeInTheDocument();
      // Non-service product categories are NOT offered here.
      expect(screen.queryByRole('button', { name: /Weaving/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Machinery/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Raw material/ })).not.toBeInTheDocument();
    });

    it('labels the All pill "All services"', () => {
      renderWithIntl(<CategoryStrip mode="services" />);
      expect(screen.getByRole('button', { name: /All services/ })).toBeInTheDocument();
    });

    it('narrows results by setting the category param and pushes to /connect/services', () => {
      searchParamsRef.current = new URLSearchParams('district=Surat');
      renderWithIntl(<CategoryStrip mode="services" />);
      screen.getByRole('button', { name: /Transport/ }).click();
      const target = push.mock.calls[push.mock.calls.length - 1]?.[0] as string;
      expect(target.startsWith('/connect/services')).toBe(true);
      const params = lastPushed();
      expect(params.get('category')).toBe('transport');
      // Existing facets (location) are preserved while the service type narrows.
      expect(params.get('district')).toBe('Surat');
    });

    it('sums only the service-slug counts for the "All services" tally', () => {
      // The facet distribution can include non-service categories; the services
      // strip must only count what it actually filters by (transport + dyeing),
      // never the product `machinery` count.
      renderWithIntl(
        <CategoryStrip
          mode="services"
          categoryCounts={{ transport: 4, dyeing: 6, machinery: 100 }}
        />,
      );
      expect(screen.getByRole('button', { name: /All services/ })).toHaveTextContent('10');
    });
  });
});
