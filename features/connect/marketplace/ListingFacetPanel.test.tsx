import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithIntl, screen, fireEvent, act } from '@/test-utils/render';

/**
 * M1.6.1 - ListingFacetPanel tests.
 *
 * The listings facet panel sits at the top of `/connect/marketplace` (and is
 * reused on the `/connect/search` listings tab in M1.6.6). It owns four
 * controls that all reduce to existing backend DTO params:
 *
 *   - category single-select pills -> `?category=`
 *   - keyword (debounced) -> `?q=`
 *   - district (debounced) -> `?district=`
 *   - price range slider -> `?priceMin=&priceMax=` (slider drag covered by the
 *     pure `priceRangeToParams` unit test; here we cover the param controls)
 *   - clear all -> drops every facet param at once
 *
 * Every change reads the live URL via `useSearchParams`, mutates only the
 * relevant key(s), and pushes the new URL with `router.push`. The panel reads
 * `usePathname` so the same component works on `/connect/marketplace` and
 * `/connect/search`.
 */
const { push, pathnameRef, searchParamsRef } = vi.hoisted(() => ({
  push: vi.fn(),
  pathnameRef: { current: '/connect/marketplace' },
  searchParamsRef: { current: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchParamsRef.current,
}));

import ListingFacetPanel from './ListingFacetPanel';

/** Extract the query string from the most recent `router.push` call. */
function lastPushedParams(): URLSearchParams {
  const target = push.mock.calls[push.mock.calls.length - 1]?.[0] as string;
  const qs = target.split('?')[1] ?? '';
  return new URLSearchParams(qs);
}

beforeEach(() => {
  push.mockReset();
  pathnameRef.current = '/connect/marketplace';
  searchParamsRef.current = new URLSearchParams();
});

describe('ListingFacetPanel - rendering', () => {
  it('renders the keyword, district, and price controls', () => {
    // Category moved to the top CategoryStrip; the rail owns keyword / district /
    // price / tags only.
    renderWithIntl(<ListingFacetPanel />);
    expect(screen.getByLabelText('Search listings')).toBeInTheDocument();
    expect(screen.getByLabelText('District')).toBeInTheDocument();
    expect(screen.getByText('Price range')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Weaving' })).not.toBeInTheDocument();
  });

  it('hides Clear all when no facet is set', () => {
    renderWithIntl(<ListingFacetPanel />);
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
  });

  it('shows Clear all when at least one facet is set', () => {
    searchParamsRef.current = new URLSearchParams('category=weaving');
    renderWithIntl(<ListingFacetPanel />);
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });
});

describe('ListingFacetPanel - keyword + district debounced inputs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces the keyword before pushing q', () => {
    renderWithIntl(<ListingFacetPanel />);
    const input = screen.getByLabelText('Search listings');
    fireEvent.change(input, { target: { value: 'zari thread' } });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(lastPushedParams().get('q')).toBe('zari thread');
  });

  it('debounces the district before pushing it', () => {
    renderWithIntl(<ListingFacetPanel />);
    const input = screen.getByLabelText('District');
    fireEvent.change(input, { target: { value: 'Surat' } });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(lastPushedParams().get('district')).toBe('Surat');
  });

  it('drops the district param when the input is cleared', () => {
    searchParamsRef.current = new URLSearchParams('district=Surat');
    renderWithIntl(<ListingFacetPanel />);
    const input = screen.getByLabelText('District');
    fireEvent.change(input, { target: { value: '' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(lastPushedParams().has('district')).toBe(false);
  });
});

describe('ListingFacetPanel - clear all', () => {
  it('drops every facet param at once', () => {
    searchParamsRef.current = new URLSearchParams(
      'q=cotton&category=weaving&district=Surat&priceMin=1000&priceMax=5000',
    );
    renderWithIntl(<ListingFacetPanel />);
    screen.getByRole('button', { name: 'Clear all filters' }).click();
    const params = lastPushedParams();
    expect(params.has('q')).toBe(false);
    expect(params.has('category')).toBe(false);
    expect(params.has('district')).toBe(false);
    expect(params.has('priceMin')).toBe(false);
    expect(params.has('priceMax')).toBe(false);
  });
});

describe('ListingFacetPanel - showKeyword=false (reused on the /connect/search listings tab)', () => {
  it('hides the keyword field and preserves q on clear-all', () => {
    searchParamsRef.current = new URLSearchParams('q=cotton&category=weaving');
    renderWithIntl(<ListingFacetPanel showKeyword={false} />);
    // The header ConnectSearchBar owns q on /connect/search, so the panel's own
    // keyword field is hidden there.
    expect(screen.queryByLabelText('Search listings')).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Clear all filters' }).click();
    const params = lastPushedParams();
    expect(params.get('q')).toBe('cotton');
    expect(params.has('category')).toBe(false);
  });
});

describe('ListingFacetPanel - tag single-select chips', () => {
  it('renders the "Product types" group when tagCounts is non-empty', () => {
    renderWithIntl(<ListingFacetPanel tagCounts={{ kanjivaram: 5, zari: 2 }} />);
    expect(screen.getByText('Product types')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'kanjivaram' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'zari' })).toBeInTheDocument();
  });

  it('does not render the "Product types" group when tagCounts is empty', () => {
    renderWithIntl(<ListingFacetPanel tagCounts={{}} />);
    expect(screen.queryByText('Product types')).not.toBeInTheDocument();
  });

  it('does not render the "Product types" group when tagCounts is absent', () => {
    renderWithIntl(<ListingFacetPanel />);
    expect(screen.queryByText('Product types')).not.toBeInTheDocument();
  });

  it('sets ?tag=kanjivaram when the kanjivaram chip is clicked', () => {
    searchParamsRef.current = new URLSearchParams('q=silk');
    renderWithIntl(<ListingFacetPanel tagCounts={{ kanjivaram: 5, zari: 2 }} />);
    screen.getByRole('button', { name: 'kanjivaram' }).click();
    expect(push).toHaveBeenCalledTimes(1);
    const params = lastPushedParams();
    expect(params.get('tag')).toBe('kanjivaram');
    // Existing params preserved.
    expect(params.get('q')).toBe('silk');
  });

  it('removes ?tag= when the active chip is clicked again', () => {
    searchParamsRef.current = new URLSearchParams('tag=kanjivaram');
    renderWithIntl(<ListingFacetPanel tagCounts={{ kanjivaram: 5, zari: 2 }} />);
    // Active chip should be marked aria-pressed=true.
    expect(screen.getByRole('button', { name: 'kanjivaram' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    screen.getByRole('button', { name: 'kanjivaram' }).click();
    expect(lastPushedParams().has('tag')).toBe(false);
  });

  it('replaces the active tag when a different chip is clicked', () => {
    searchParamsRef.current = new URLSearchParams('tag=kanjivaram');
    renderWithIntl(<ListingFacetPanel tagCounts={{ kanjivaram: 5, zari: 2 }} />);
    screen.getByRole('button', { name: 'zari' }).click();
    expect(lastPushedParams().get('tag')).toBe('zari');
  });

  it('sorts chips by count descending', () => {
    renderWithIntl(<ListingFacetPanel tagCounts={{ zari: 2, kanjivaram: 5, banarasi: 8 }} />);
    const buttons = screen.getAllByRole('button', {
      name: (name) => ['zari', 'kanjivaram', 'banarasi'].includes(name),
    });
    // banarasi (8) > kanjivaram (5) > zari (2)
    expect(buttons[0]).toHaveTextContent('banarasi');
    expect(buttons[1]).toHaveTextContent('kanjivaram');
    expect(buttons[2]).toHaveTextContent('zari');
  });

  it('clears the tag param on clear-all', () => {
    searchParamsRef.current = new URLSearchParams('tag=kanjivaram&category=weaving');
    renderWithIntl(<ListingFacetPanel tagCounts={{ kanjivaram: 5 }} />);
    screen.getByRole('button', { name: 'Clear all filters' }).click();
    const params = lastPushedParams();
    expect(params.has('tag')).toBe(false);
    expect(params.has('category')).toBe(false);
  });
});

describe('ListingFacetPanel - location quick-pick chips', () => {
  it('renders title-cased Location chips with counts when districtCounts is non-empty', () => {
    renderWithIntl(<ListingFacetPanel districtCounts={{ surat: 92, 'ring road': 78 }} />);
    expect(screen.getByRole('button', { name: /Surat/ })).toHaveTextContent('92');
    expect(screen.getByRole('button', { name: /Ring Road/ })).toHaveTextContent('78');
  });

  it('renders no Location chips when districtCounts is absent', () => {
    renderWithIntl(<ListingFacetPanel />);
    // The free-text District input still renders; there are just no chips.
    expect(screen.getByLabelText('District')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Surat/ })).not.toBeInTheDocument();
  });

  it('caps the chips at the top-N (6) by count', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 10; i++) many[`d${i}`] = i + 1;
    renderWithIntl(<ListingFacetPanel districtCounts={many} />);
    const chips = screen
      .getAllByRole('button')
      .filter((b) => /^D\d/.test((b.textContent ?? '').trim()));
    expect(chips).toHaveLength(6);
  });

  it('sets ?district= with the display-cased value when a chip is clicked', () => {
    renderWithIntl(<ListingFacetPanel districtCounts={{ 'ring road': 92 }} />);
    screen.getByRole('button', { name: /Ring Road/ }).click();
    expect(lastPushedParams().get('district')).toBe('Ring Road');
  });

  it('marks the active chip case-insensitively and clears the param on re-click', () => {
    searchParamsRef.current = new URLSearchParams('district=surat');
    renderWithIntl(<ListingFacetPanel districtCounts={{ surat: 92 }} />);
    const chip = screen.getByRole('button', { name: /Surat/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    chip.click();
    expect(lastPushedParams().has('district')).toBe(false);
  });

  it('drops empty district keys (no blank chip)', () => {
    renderWithIntl(<ListingFacetPanel districtCounts={{ '': 5, surat: 92 }} />);
    expect(screen.getByRole('button', { name: /Surat/ })).toBeInTheDocument();
    // The empty-key entry (count 5) must not render a chip.
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });
});
