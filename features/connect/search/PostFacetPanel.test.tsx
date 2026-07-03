import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';

/**
 * PostFacetPanel (search redesign Phase C.1) - the posts content-kind filter.
 * URL-synced: reads `?kind=`, single-select, clears on re-click. One shared
 * next/navigation mock (router.push + live searchParams).
 */
const { push, pathnameRef, searchParamsRef } = vi.hoisted(() => ({
  push: vi.fn(),
  pathnameRef: { current: '/connect/search' },
  searchParamsRef: { current: new URLSearchParams('q=zari&type=posts') },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchParamsRef.current,
}));

import PostFacetPanel from './PostFacetPanel';

beforeEach(() => {
  push.mockClear();
  searchParamsRef.current = new URLSearchParams('q=zari&type=posts');
});

describe('PostFacetPanel', () => {
  it('renders a chip per content kind', () => {
    renderWithIntl(<PostFacetPanel />);
    expect(screen.getByRole('button', { name: 'Photos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voice' })).toBeInTheDocument();
  });

  it('sets ?kind= on click, preserving the existing q + type params', () => {
    renderWithIntl(<PostFacetPanel />);
    screen.getByRole('button', { name: 'Photos' }).click();
    expect(push).toHaveBeenCalledTimes(1);
    const params = new URLSearchParams((push.mock.calls[0]?.[0] as string).split('?')[1] ?? '');
    expect(params.get('kind')).toBe('photo');
    expect(params.get('q')).toBe('zari');
    expect(params.get('type')).toBe('posts');
  });

  it('marks the active kind and clears it when clicked again', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=posts&kind=photo');
    renderWithIntl(<PostFacetPanel />);
    const photo = screen.getByRole('button', { name: 'Photos' });
    expect(photo).toHaveAttribute('aria-pressed', 'true');
    photo.click();
    const params = new URLSearchParams((push.mock.calls[0]?.[0] as string).split('?')[1] ?? '');
    expect(params.get('kind')).toBeNull();
  });
});
