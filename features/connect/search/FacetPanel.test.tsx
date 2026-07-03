import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithIntl, screen, fireEvent, act } from '@/test-utils/render';

/**
 * S1.6.4 - FacetPanel tests.
 *
 * The panel sits above the results body, between the type tabs and the body.
 * It owns three facets that all reduce to the existing backend DTO params
 * (`skills`, `district`, `openToWork`) - no new param is introduced. Every
 * change reads the live URL via `useSearchParams`, mutates only the relevant
 * key(s), and pushes the new URL with `router.push`. Other URL params (`q`,
 * `type`, `#tags` inside q, future facets) are preserved across every change.
 *
 * The district input is the only debounced facet (typing produces many
 * intermediate values; we wait 300 ms after the last keystroke before
 * navigating). Skills chip add / remove and the open-to-work switch are
 * discrete events - they push immediately.
 */
const { push, pathnameRef, searchParamsRef } = vi.hoisted(() => ({
  push: vi.fn(),
  pathnameRef: { current: '/connect/search' },
  searchParamsRef: { current: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchParamsRef.current,
}));

import FacetPanel from './FacetPanel';

/** Extract the query string from the most recent `router.push` call. */
function lastPushedParams(): URLSearchParams {
  const target = push.mock.calls[push.mock.calls.length - 1]?.[0] as string;
  const qs = target.split('?')[1] ?? '';
  return new URLSearchParams(qs);
}

beforeEach(() => {
  push.mockReset();
  pathnameRef.current = '/connect/search';
  searchParamsRef.current = new URLSearchParams('q=zari&type=people');
});

describe('FacetPanel - rendering', () => {
  it('renders the three facet sections with i18n labels', () => {
    renderWithIntl(<FacetPanel />);
    expect(screen.getByLabelText('Skills')).toBeInTheDocument();
    expect(screen.getByLabelText('District')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Open to work/ })).toBeInTheDocument();
  });

  it('reflects the existing URL state when first mounted', () => {
    searchParamsRef.current = new URLSearchParams(
      'q=zari&type=people&skills=embroidery&skills=zardozi&district=Surat&openToWork=true',
    );
    renderWithIntl(<FacetPanel />);
    expect(screen.getByText('embroidery')).toBeInTheDocument();
    expect(screen.getByText('zardozi')).toBeInTheDocument();
    expect(screen.getByLabelText('District')).toHaveValue('Surat');
    expect(screen.getByRole('switch', { name: /Open to work/ })).toBeChecked();
  });

  it('hides the Clear all action when no facet is set', () => {
    renderWithIntl(<FacetPanel />);
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
  });

  it('shows the Clear all action when at least one facet is set', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people&openToWork=true');
    renderWithIntl(<FacetPanel />);
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });
});

describe('FacetPanel - skills chip add / remove', () => {
  it('adds a skill when the user types it and presses Enter', () => {
    renderWithIntl(<FacetPanel />);
    const input = screen.getByLabelText('Skills');
    fireEvent.change(input, { target: { value: 'embroidery' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledTimes(1);
    const params = lastPushedParams();
    expect(params.getAll('skills')).toEqual(['embroidery']);
    // q + type are preserved.
    expect(params.get('q')).toBe('zari');
    expect(params.get('type')).toBe('people');
  });

  it('appends to an existing skills list rather than replacing it', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people&skills=zardozi');
    renderWithIntl(<FacetPanel />);
    const input = screen.getByLabelText('Skills');
    fireEvent.change(input, { target: { value: 'embroidery' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const params = lastPushedParams();
    expect(params.getAll('skills')).toEqual(['zardozi', 'embroidery']);
  });

  it('does not add a duplicate skill', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people&skills=zari');
    renderWithIntl(<FacetPanel />);
    const input = screen.getByLabelText('Skills');
    fireEvent.change(input, { target: { value: 'zari' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('removes a skill when its chip remove button is clicked', () => {
    searchParamsRef.current = new URLSearchParams(
      'q=zari&type=people&skills=embroidery&skills=zardozi',
    );
    renderWithIntl(<FacetPanel />);
    screen.getByRole('button', { name: 'Remove skill embroidery' }).click();
    const params = lastPushedParams();
    expect(params.getAll('skills')).toEqual(['zardozi']);
  });

  it('drops the skills param entirely when the last chip is removed', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people&skills=embroidery');
    renderWithIntl(<FacetPanel />);
    screen.getByRole('button', { name: 'Remove skill embroidery' }).click();
    const params = lastPushedParams();
    expect(params.has('skills')).toBe(false);
    expect(params.get('q')).toBe('zari');
  });
});

describe('FacetPanel - district debounced input', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not push until the debounce window elapses', () => {
    renderWithIntl(<FacetPanel />);
    const input = screen.getByLabelText('District');
    fireEvent.change(input, { target: { value: 'Sur' } });
    fireEvent.change(input, { target: { value: 'Sura' } });
    fireEvent.change(input, { target: { value: 'Surat' } });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    const params = lastPushedParams();
    expect(params.get('district')).toBe('Surat');
  });

  it('drops the district param when the input is cleared', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people&district=Surat');
    renderWithIntl(<FacetPanel />);
    const input = screen.getByLabelText('District');
    fireEvent.change(input, { target: { value: '' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const params = lastPushedParams();
    expect(params.has('district')).toBe(false);
    expect(params.get('q')).toBe('zari');
  });
});

describe('FacetPanel - open-to-work switch', () => {
  it('pushes openToWork=true immediately when toggled on', () => {
    renderWithIntl(<FacetPanel />);
    screen.getByRole('switch', { name: /Open to work/ }).click();
    expect(push).toHaveBeenCalledTimes(1);
    const params = lastPushedParams();
    expect(params.get('openToWork')).toBe('true');
  });

  it('drops openToWork from the URL when toggled off', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people&openToWork=true');
    renderWithIntl(<FacetPanel />);
    screen.getByRole('switch', { name: /Open to work/ }).click();
    const params = lastPushedParams();
    expect(params.has('openToWork')).toBe(false);
  });
});

describe('FacetPanel - providing-services switch', () => {
  it('pushes providingServices=true immediately when toggled on', () => {
    renderWithIntl(<FacetPanel />);
    screen.getByRole('switch', { name: /Providing services/ }).click();
    expect(push).toHaveBeenCalledTimes(1);
    const params = lastPushedParams();
    expect(params.get('providingServices')).toBe('true');
    // q + type are preserved.
    expect(params.get('q')).toBe('zari');
    expect(params.get('type')).toBe('people');
  });

  it('drops providingServices from the URL when toggled off', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people&providingServices=true');
    renderWithIntl(<FacetPanel />);
    screen.getByRole('switch', { name: /Providing services/ }).click();
    const params = lastPushedParams();
    expect(params.has('providingServices')).toBe(false);
  });
});

describe('FacetPanel - clear all', () => {
  it('clears every facet param at once but preserves q + type', () => {
    searchParamsRef.current = new URLSearchParams(
      'q=zari&type=people&skills=embroidery&skills=zardozi&district=Surat&openToWork=true&providingServices=true',
    );
    renderWithIntl(<FacetPanel />);
    screen.getByRole('button', { name: 'Clear all filters' }).click();
    const params = lastPushedParams();
    expect(params.has('skills')).toBe(false);
    expect(params.has('district')).toBe(false);
    expect(params.has('openToWork')).toBe(false);
    expect(params.has('providingServices')).toBe(false);
    expect(params.get('q')).toBe('zari');
    expect(params.get('type')).toBe('people');
  });
});
