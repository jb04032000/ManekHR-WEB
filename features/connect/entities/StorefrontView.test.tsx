import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithIntl, screen } from '@/test-utils/render';

// The "Contact seller" DsButton renders in link mode, which calls useRouter().
// useSearchParams returns a STABLE instance (real Next keeps the reference stable
// per navigation; a new instance each render would loop the seeding effect).
vi.mock('next/navigation', () => {
  const sp = new URLSearchParams();
  return {
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => '/connect/store/rajesh-shop',
    useSearchParams: () => sp,
  };
});

import StorefrontView from './StorefrontView';
import type { Storefront } from './entities.types';
import type { ConnectListingRef } from '../search.types';

const STORE: Storefront = {
  _id: 'sf-1',
  ownerUserId: 'u-1',
  slug: 'rajesh-shop',
  name: 'Rajesh Shop',
  logo: '',
  banner: '',
  description: 'Zari threads and trims, wholesale.',
  categories: ['raw-material', 'embroidery-zari'],
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  companyPageId: null,
  erpWorkspaceId: null,
  visibility: 'public',
};

const LISTING: ConnectListingRef = {
  listingId: 'l1',
  ownerUserId: 'u-1',
  title: 'Golden zari thread',
  description: 'Pure zari',
  category: 'raw-material',
  priceType: 'negotiable',
  priceMin: null,
  priceMax: null,
  unit: null,
  district: 'Surat',
  coverImage: 'https://img.example/zari.jpg',
  verified: false,
  createdAt: '2026-01-01',
};

/** Activate the Products tab (the identity header + Overview are the default;
 *  the product grid lives under the Products tab, mirroring the company page). */
function openProducts() {
  fireEvent.click(screen.getByRole('tab', { name: 'Products' }));
}

describe('StorefrontView', () => {
  it('renders the shop identity, description (Overview), and its products (Products tab)', () => {
    renderWithIntl(<StorefrontView storefront={STORE} erpLinked={false} listings={[LISTING]} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Rajesh Shop' })).toBeInTheDocument();
    expect(screen.getByText('Surat, Gujarat')).toBeInTheDocument();
    // Overview is the default tab: About description shows without a tab switch.
    expect(screen.getByText(/Zari threads and trims/)).toBeInTheDocument();
    openProducts();
    expect(screen.getByText('Golden zari thread')).toBeInTheDocument();
  });

  it('shows the empty-products message when the shop has none', () => {
    renderWithIntl(<StorefrontView storefront={STORE} erpLinked={false} listings={[]} />);
    openProducts();
    expect(screen.getByText('No products listed yet.')).toBeInTheDocument();
  });

  it('filters the grid to a collection when its tab is pressed', () => {
    const bridal = {
      ...LISTING,
      listingId: 'l1',
      title: 'Golden zari thread',
      collectionIds: ['c1'],
    };
    const cotton = {
      ...LISTING,
      listingId: 'l2',
      title: 'Reactive dye drum',
      collectionIds: ['c2'],
    };
    const collections = [
      {
        id: 'c1',
        title: 'Bridal',
        slug: 'bridal',
        description: '',
        coverImage: '',
        productCount: 1,
      },
      {
        id: 'c2',
        title: 'Cotton',
        slug: 'cotton',
        description: '',
        coverImage: '',
        productCount: 1,
      },
    ];
    renderWithIntl(
      <StorefrontView
        storefront={STORE}
        erpLinked={false}
        listings={[bridal, cotton]}
        collections={collections}
      />,
    );
    openProducts();
    // Both products show before any filter.
    expect(screen.getByText('Golden zari thread')).toBeInTheDocument();
    expect(screen.getByText('Reactive dye drum')).toBeInTheDocument();
    // Pressing the Cotton tab narrows the grid to just that collection.
    fireEvent.click(screen.getByRole('button', { name: /Cotton/ }));
    expect(screen.queryByText('Golden zari thread')).not.toBeInTheDocument();
    expect(screen.getByText('Reactive dye drum')).toBeInTheDocument();
  });

  it('hides a collection with no live products from the tab row', () => {
    const collections = [
      {
        id: 'c1',
        title: 'Bridal',
        slug: 'bridal',
        description: '',
        coverImage: '',
        productCount: 1,
      },
      { id: 'c2', title: 'Empty', slug: 'empty', description: '', coverImage: '', productCount: 0 },
    ];
    renderWithIntl(
      <StorefrontView
        storefront={STORE}
        erpLinked={false}
        listings={[{ ...LISTING, collectionIds: ['c1'] }]}
        collections={collections}
      />,
    );
    openProducts();
    expect(screen.getByRole('button', { name: /Bridal/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Empty/ })).not.toBeInTheDocument();
  });

  it('writes the active tab to the ?tab= URL so it survives navigating away and back', () => {
    // Clicking a tab must update the URL (replaceState), not just local state -
    // otherwise opening a product and pressing back resets to the first tab.
    renderWithIntl(<StorefrontView storefront={STORE} erpLinked={false} listings={[LISTING]} />);
    openProducts();
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('products');
    fireEvent.click(screen.getByRole('tab', { name: 'Reviews & Ratings' }));
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('reviews');
  });

  it('offers a sort control once the shop has more than one product', () => {
    const a = { ...LISTING, listingId: 'l1', title: 'A' };
    const b = { ...LISTING, listingId: 'l2', title: 'B' };
    renderWithIntl(<StorefrontView storefront={STORE} erpLinked={false} listings={[a, b]} />);
    openProducts();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('hides products without a cover photo from the public grid', () => {
    // A photoless live product reads as broken on a buyer-facing store, so the
    // grid only shows products with a cover image.
    renderWithIntl(
      <StorefrontView
        storefront={STORE}
        erpLinked={false}
        listings={[{ ...LISTING, coverImage: null }]}
      />,
    );
    openProducts();
    expect(screen.queryByText('Golden zari thread')).not.toBeInTheDocument();
    expect(screen.getByText('No products listed yet.')).toBeInTheDocument();
  });
});
