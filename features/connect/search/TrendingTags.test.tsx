import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';

/**
 * S1.6.5 - TrendingTags renders the trending list in the rail.
 *
 * The component is dumb: the page fetches `getTrendingTags()` server-side
 * and passes the array down. Each row links to `/connect/search?q=#<slug>`
 * so a tap re-runs the page with that hashtag in the query. The label
 * resolution falls through the active locale, then `en`, then the slug.
 */

import TrendingTags from './TrendingTags';
import type { TrendingTag } from '../search.types';

const TAG_ZARI: TrendingTag = {
  slug: 'zari',
  labels: { en: 'Zari', gu: 'જરી' },
  category: 'generic',
  usageCount: 42,
  trendingScore: 7.3,
};

const TAG_ZARDOZI: TrendingTag = {
  slug: 'zardozi',
  labels: { en: 'Zardozi' },
  category: 'generic',
  usageCount: 18,
  trendingScore: 4.1,
};

const TAG_NO_LABEL: TrendingTag = {
  slug: 'motipearl',
  labels: {},
  category: 'generic',
  usageCount: 9,
  trendingScore: 2.0,
};

describe('TrendingTags', () => {
  it('renders the empty-state message when the list is empty', () => {
    renderWithIntl(<TrendingTags tags={[]} />);
    expect(screen.getByText(/No trending tags yet/i)).toBeInTheDocument();
  });

  it('renders one row per trending tag using the active locale label', () => {
    renderWithIntl(<TrendingTags tags={[TAG_ZARI, TAG_ZARDOZI]} />);
    expect(screen.getByText('Zari')).toBeInTheDocument();
    expect(screen.getByText('Zardozi')).toBeInTheDocument();
  });

  it('falls back to the slug when the labels map has nothing for the active locale or en', () => {
    renderWithIntl(<TrendingTags tags={[TAG_NO_LABEL]} />);
    expect(screen.getByText('motipearl')).toBeInTheDocument();
  });

  it('renders each row as a link to /connect/search with #slug in q and people in type', () => {
    renderWithIntl(<TrendingTags tags={[TAG_ZARI]} />);
    const link = screen.getByRole('link', { name: /Zari/ });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('/connect/search')).toBe(true);
    const params = new URLSearchParams(href.split('?')[1] ?? '');
    expect(params.get('q')).toBe('#zari');
    expect(params.get('type')).toBe('people');
  });

  it('surfaces the usage count next to each label', () => {
    renderWithIntl(<TrendingTags tags={[TAG_ZARI]} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('gives each link a descriptive aria-label that includes the label and the count', () => {
    renderWithIntl(<TrendingTags tags={[TAG_ZARI]} />);
    const link = screen.getByRole('link', { name: /Search Zari, 42 posts/i });
    expect(link).toBeInTheDocument();
  });
});
