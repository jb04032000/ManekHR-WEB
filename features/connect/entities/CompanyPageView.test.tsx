import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderWithIntl, screen, fireEvent } from '@/test-utils/render';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/app/messages/en.json';
import type { ReactElement, ReactNode } from 'react';

// The component calls useSearchParams() to seed the active tab from `?tab=`.
// useSearchParams returns a STABLE instance (real Next keeps the reference stable
// per navigation; a new instance each render would loop any seeding effect).
// Mirrors StorefrontView.test.tsx's mock so the two public surfaces test alike.
vi.mock('next/navigation', () => {
  const sp = new URLSearchParams();
  return {
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => '/connect/company/rajesh-textiles',
    useSearchParams: () => sp,
  };
});

import CompanyPageView from './CompanyPageView';
import type {
  CompanyPage,
  Storefront,
  InstituteAlumniResult,
  InstitutePlacementResult,
} from './entities.types';
import type { ConnectListingRef } from '../search.types';

// The Alumni tab mounts AlumniList -> useInfiniteQuery, so the institute tests
// wrap the view in a QueryClientProvider (staleTime Infinity so the SSR-seeded
// initialData is not refetched). Mirrors PublicActivityList.test.tsx.
function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Providers });
}

const INSTITUTE: CompanyPage = {
  _id: 'cp-inst',
  ownerUserId: 'u-inst',
  slug: 'surat-skill-academy',
  name: 'Surat Skill Academy',
  logo: '',
  banner: '',
  about: '',
  kind: 'institute',
  industryPanel: { specialization: [], machineCapacity: '', production: '', languages: [] },
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  erpWorkspaceId: null,
  visibility: 'public',
};

const ALUMNI: InstituteAlumniResult = {
  items: [
    {
      userId: 'al-1',
      name: 'Anita Patel',
      headline: 'Power-loom operator',
      avatarUrl: null,
      openStatus: 'work',
    },
    { userId: 'al-2', name: 'Bhavin Shah', headline: null, avatarUrl: null, openStatus: 'work' },
  ],
  total: 2,
  nextCursor: null,
};

const PLACEMENTS: InstitutePlacementResult = {
  employers: [
    {
      company: {
        id: 'emp-1',
        name: 'Rajesh Textiles',
        slug: 'rajesh-textiles',
        logo: '',
        erpLinked: true,
      },
      studentCount: 4,
    },
  ],
  otherEmployerCount: 3,
  totalStudents: 7,
};

const EMPTY_ALUMNI: InstituteAlumniResult = { items: [], total: 0, nextCursor: null };
const EMPTY_PLACEMENTS: InstitutePlacementResult = {
  employers: [],
  otherEmployerCount: 0,
  totalStudents: 0,
};

const PAGE: CompanyPage = {
  _id: 'cp-1',
  ownerUserId: 'u-1',
  slug: 'rajesh-textiles',
  name: 'Rajesh Textiles',
  logo: '',
  banner: '',
  about: 'Family-run zari embroidery unit since 1998.',
  kind: 'business',
  industryPanel: {
    specialization: ['embroidery-zari', 'job-work'],
    machineCapacity: '12 power looms',
    production: '5000 metres / week',
    languages: ['gu', 'hi'],
  },
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  erpWorkspaceId: null,
  visibility: 'public',
};

describe('CompanyPageView', () => {
  it('renders the name, location, about, and capabilities', () => {
    renderWithIntl(<CompanyPageView page={PAGE} erpLinked={false} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Rajesh Textiles' })).toBeInTheDocument();
    expect(screen.getByText('Surat, Gujarat')).toBeInTheDocument();
    expect(screen.getByText(/Family-run zari embroidery/)).toBeInTheDocument();
    expect(screen.getByText('What we do')).toBeInTheDocument();
    expect(screen.getByText('12 power looms')).toBeInTheDocument();
    // Specialization is humanized through categoryLabel -> the i18n catalog, so
    // the raw `embroidery-zari` slug renders as its label "Embroidery and Zari".
    expect(screen.getByText('Embroidery and Zari')).toBeInTheDocument();
  });

  it('shows the ERP-linked badge only when linked', () => {
    const { rerender } = renderWithIntl(<CompanyPageView page={PAGE} erpLinked={false} />);
    expect(screen.queryByText('ERP-linked')).not.toBeInTheDocument();
    rerender(<CompanyPageView page={PAGE} erpLinked />);
    expect(screen.getByText('ERP-linked')).toBeInTheDocument();
  });

  it('omits the capabilities + about sections when empty', () => {
    const bare: CompanyPage = {
      ...PAGE,
      about: '',
      industryPanel: { specialization: [], machineCapacity: '', production: '', languages: [] },
    };
    renderWithIntl(<CompanyPageView page={bare} erpLinked={false} />);
    expect(screen.queryByText('What we do')).not.toBeInTheDocument();
    expect(screen.queryByText('About')).not.toBeInTheDocument();
  });

  it('shows linked products via the redirect-first Store card on Overview (no Products tab)', () => {
    // Products are no longer a tab: the page is redirect-first, so the attached
    // store + a few featured products show on the Overview tab via CompanyStoreCard,
    // with the full catalogue living at /store/[slug]. The card needs `store` to
    // render (a bare `products` array with no store shows nothing).
    const product: ConnectListingRef = {
      listingId: 'L9',
      ownerUserId: 'u-1',
      title: 'Gold zari border roll',
      description: '',
      category: 'embroidery-zari',
      priceType: 'fixed',
      priceMin: 1200,
      priceMax: null,
      unit: 'per-piece',
      district: 'surat',
      coverImage: 'https://img.example/border.jpg',
      verified: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    };
    const store: Storefront = {
      _id: 'sf-9',
      ownerUserId: 'u-1',
      slug: 'rajesh-shop',
      name: 'Rajesh Shop',
      logo: '',
      banner: '',
      description: '',
      categories: [],
      location: { district: 'Surat', city: '', state: 'Gujarat' },
      companyPageId: 'cp-1',
      erpWorkspaceId: null,
      visibility: 'public',
    };
    renderWithIntl(
      <CompanyPageView page={PAGE} erpLinked={false} store={store} products={[product]} />,
    );

    // Overview is the default tab; the Store card shows the shop + a Visit-store
    // link, and the featured product renders as a thumbnail (alt = its title).
    expect(screen.getByText('Rajesh Shop')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Visit store/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gold zari border roll' })).toBeInTheDocument();
    // There is no Products tab any more.
    expect(screen.queryByRole('tab', { name: 'Products' })).not.toBeInTheDocument();
  });

  it('writes the active tab to the ?tab= URL so it survives navigating away and back', () => {
    // Clicking a tab must update the URL (replaceState), not just local state -
    // otherwise opening an item and pressing back resets to the first tab.
    // Mirrors the StorefrontView regression test for the identical fix.
    renderWithIntl(<CompanyPageView page={PAGE} erpLinked={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reviews & Ratings' }));
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('reviews');
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('overview');
  });

  it('always offers a Reviews tab alongside the content (marketplace Phase C)', () => {
    renderWithIntl(<CompanyPageView page={PAGE} erpLinked={false} />);
    // Reviews are open to all, so the tab is always present: a page with one
    // content area (Overview) now shows a 2-tab bar (Overview + Reviews).
    expect(screen.getByRole('tab', { name: 'Reviews & Ratings' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').length).toBeGreaterThanOrEqual(2);
  });

  it('lays the capabilities out as a labelled spec-grid', () => {
    renderWithIntl(<CompanyPageView page={PAGE} erpLinked={false} />);
    // Each populated panel field renders as a labelled cell (label + real value).
    expect(screen.getByText('Specializes in')).toBeInTheDocument();
    expect(screen.getByText('Machines & capacity')).toBeInTheDocument();
    expect(screen.getByText('5000 metres / week')).toBeInTheDocument();
  });

  it('renders the poster-first video player only when a clip is present', () => {
    // No videos -> the player is absent (a visitor never sees an empty slot).
    const { rerender } = renderWithIntl(<CompanyPageView page={PAGE} erpLinked={false} />);
    expect(screen.queryByLabelText('Play video')).not.toBeInTheDocument();

    // With one clip -> the poster-first <video> renders (poster + src + a11y label).
    const withVideo: CompanyPage = {
      ...PAGE,
      videos: [{ url: 'https://cdn/company.mp4', posterUrl: 'https://cdn/company-poster.jpg' }],
    };
    rerender(<CompanyPageView page={withVideo} erpLinked={false} />);
    const player = screen.getByLabelText('Play video');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('src', 'https://cdn/company.mp4');
    expect(player).toHaveAttribute('poster', 'https://cdn/company-poster.jpg');
  });

  it('shows the ERP-verified note only when ERP-linked', () => {
    const { rerender } = renderWithIntl(<CompanyPageView page={PAGE} erpLinked={false} />);
    expect(screen.queryByText('Verified by ManekHR ERP')).not.toBeInTheDocument();
    rerender(<CompanyPageView page={PAGE} erpLinked />);
    expect(screen.getByText('Verified by ManekHR ERP')).toBeInTheDocument();
  });

  it('swaps the capabilities grid to courses/modes for an institute page', () => {
    // An institute page hides the business machines/production cells and shows the
    // institute capabilities (courses + delivery modes) in the same slot. The
    // course names + the language render verbatim (data, not i18n), so we assert
    // on those rather than the freshly-added labels (written by the main session).
    const institute: CompanyPage = {
      ...PAGE,
      kind: 'institute',
      institutePanel: {
        coursesOffered: ['Power-loom Operation', 'Zari Embroidery'],
        modes: ['online', 'offline'],
        languages: ['gu'],
      },
    };
    renderWithIntl(<CompanyPageView page={institute} erpLinked={false} />);
    // Course names show as chips.
    expect(screen.getByText('Power-loom Operation')).toBeInTheDocument();
    expect(screen.getByText('Zari Embroidery')).toBeInTheDocument();
    // The business-only machines/production values are gone.
    expect(screen.queryByText('12 power looms')).not.toBeInTheDocument();
    expect(screen.queryByText('5000 metres / week')).not.toBeInTheDocument();
  });

  // ── Institute Placements + Alumni tabs (Institutes Phase 2, Feature 2) ──────

  it('shows no Placements/Alumni tabs on a business page', () => {
    // The two tabs are institute-only - a business page never gets them, even
    // for the owner.
    renderWithIntl(<CompanyPageView page={PAGE} erpLinked={false} isOwner />);
    expect(screen.queryByRole('tab', { name: 'Placements' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Alumni' })).not.toBeInTheDocument();
  });

  it('shows both institute tabs to the OWNER even when empty, with the invite CTA', () => {
    // Owner always sees Placements + Alumni (to reach the acquisition CTA), even
    // with no opted-in students. Each empty tab renders the "Invite students"
    // button linking to the manage console Students tab.
    renderWithQuery(
      <CompanyPageView
        page={INSTITUTE}
        erpLinked={false}
        isOwner
        alumniPage={EMPTY_ALUMNI}
        placements={EMPTY_PLACEMENTS}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Placements' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Alumni' })).toBeInTheDocument();

    // Placements is the active institute tab on load order (Overview is empty for
    // INSTITUTE, so Jobs/Placements lead). The invite CTA links to the W3 tab.
    fireEvent.click(screen.getByRole('tab', { name: 'Placements' }));
    const placementsCta = screen.getByRole('link', { name: /Invite students/ });
    expect(placementsCta).toHaveAttribute('href', '/connect/pages/cp-inst?tab=students');

    fireEvent.click(screen.getByRole('tab', { name: 'Alumni' }));
    const alumniCta = screen.getByRole('link', { name: /Invite students/ });
    expect(alumniCta).toHaveAttribute('href', '/connect/pages/cp-inst?tab=students');
  });

  it('does NOT show an empty institute tab to a public visitor', () => {
    // A non-owner only ever sees a tab when it carries content; an empty tab is
    // simply absent (the acquisition CTA is owner-only).
    renderWithQuery(
      <CompanyPageView
        page={INSTITUTE}
        erpLinked={false}
        isOwner={false}
        alumniPage={EMPTY_ALUMNI}
        placements={EMPTY_PLACEMENTS}
      />,
    );
    expect(screen.queryByRole('tab', { name: 'Placements' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Alumni' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Invite students/ })).not.toBeInTheDocument();
  });

  it('renders the Alumni tab as a PersonCard grid for a visitor when non-empty', () => {
    renderWithQuery(
      <CompanyPageView page={INSTITUTE} erpLinked={false} isOwner={false} alumniPage={ALUMNI} />,
    );
    // The Alumni tab is present (it has content); the alumni names render.
    fireEvent.click(screen.getByRole('tab', { name: 'Alumni' }));
    expect(screen.getByText('Anita Patel')).toBeInTheDocument();
    expect(screen.getByText('Bhavin Shah')).toBeInTheDocument();
    // Visitor never sees the owner-only invite CTA on a non-empty tab.
    expect(screen.queryByRole('link', { name: /Invite students/ })).not.toBeInTheDocument();
  });

  it('renders Placements as employer cards plus the "other workplaces" line', () => {
    renderWithQuery(
      <CompanyPageView
        page={INSTITUTE}
        erpLinked={false}
        isOwner={false}
        placements={PLACEMENTS}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Placements' }));
    // The employer's company name + the real per-employer student count.
    expect(screen.getByText('Rajesh Textiles')).toBeInTheDocument();
    expect(screen.getByText('4 students here')).toBeInTheDocument();
    // The free-text "other workplaces" roll-up line.
    expect(screen.getByText('and 3 other workplaces')).toBeInTheDocument();
  });
});
