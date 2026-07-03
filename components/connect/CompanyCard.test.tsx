import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { CompanyPageBrowseItem } from '@/features/connect/entities/entities.types';
import CompanyCard from './CompanyCard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/companies',
  useSearchParams: () => new URLSearchParams(),
}));

function item(over: Partial<CompanyPageBrowseItem> = {}): CompanyPageBrowseItem {
  return {
    id: 'c1',
    ownerUserId: 'o1',
    slug: 'surat-zari',
    name: 'Surat Zari Works',
    logo: '',
    banner: '',
    about: 'Fine zari embroidery.',
    location: { district: 'Surat', city: 'Surat', state: 'Gujarat' },
    specialization: ['embroidery-zari', 'job-work'],
    erpLinked: true,
    followerCount: 42,
    openJobsCount: 3,
    productCount: 18,
    rating: { ratingAvg: 4.6, ratingCount: 12 },
    ...over,
  };
}

describe('CompanyCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the real product, follower and open-job counts', () => {
    renderWithIntl(<CompanyCard company={item()} onToggleFollow={vi.fn()} />);
    // Catalog stat row + the lighter followers meta line. Labels for the new
    // Products/Rating cells live under connect.companies.* (added separately), so
    // these assert the real values, not the not-yet-catalogued English labels.
    expect(screen.getByText('18')).toBeInTheDocument(); // products
    expect(screen.getByText('42')).toBeInTheDocument(); // followers (meta line)
    expect(screen.getByText('3')).toBeInTheDocument(); // open jobs
    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('Open jobs')).toBeInTheDocument();
  });

  it('shows the seller rating only when the company has reviews', () => {
    renderWithIntl(<CompanyCard company={item()} onToggleFollow={vi.fn()} />);
    // RatingStars renders the average + a muted "(count)" when reviewed.
    expect(screen.getByText('4.6')).toBeInTheDocument();
    expect(screen.getByText('(12)')).toBeInTheDocument();
  });

  it('hides the rating entirely for an unrated company (no hollow 0.0)', () => {
    renderWithIntl(<CompanyCard company={item({ rating: undefined })} onToggleFollow={vi.fn()} />);
    // No average, no zero-count, and the product + open-job cells still render.
    expect(screen.queryByText('4.6')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\(\d+\)$/)).not.toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument(); // products still shown
    expect(screen.getByText('3')).toBeInTheDocument(); // open jobs still shown
  });

  it('shows a zero product count rather than hiding the products cell', () => {
    renderWithIntl(<CompanyCard company={item({ productCount: 0 })} onToggleFollow={vi.fn()} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('links the name to the in-app company page', () => {
    renderWithIntl(<CompanyCard company={item()} onToggleFollow={vi.fn()} />);
    const links = screen.getAllByRole('link', { name: 'Surat Zari Works' });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/connect/company/surat-zari'));
  });

  it('calls onToggleFollow when Follow is clicked', () => {
    const onToggleFollow = vi.fn();
    renderWithIntl(<CompanyCard company={item()} onToggleFollow={onToggleFollow} />);
    screen.getByRole('button', { name: 'Follow Surat Zari Works' }).click();
    expect(onToggleFollow).toHaveBeenCalledTimes(1);
  });

  it('reflects the following state on the button', () => {
    renderWithIntl(<CompanyCard company={item()} following onToggleFollow={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Unfollow Surat Zari Works' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it("marks the caller's own page with Manage instead of Follow", () => {
    renderWithIntl(<CompanyCard company={item()} isOwn onToggleFollow={vi.fn()} />);
    expect(screen.getByText('Your company')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' }).getAttribute('href')).toBe(
      '/connect/pages/c1',
    );
  });
});
