import { describe, it, expect, vi, afterEach } from 'vitest';
import { Layout } from 'antd';
import { renderWithIntl, screen } from '@/test-utils/render';

/**
 * Force the mobile-viewport media query (`max-width: 767.98px`) for a test so the
 * nav's `useSyncExternalStore` reads as mobile. Mirrors the sidebar's own
 * MOBILE_VIEWPORT_QUERY. Restored by `afterEach` below.
 */
function setMobileViewport(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width') ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

vi.mock('next/navigation', () => ({ usePathname: () => '/connect/feed' }));
// Isolate the nav - ModeSwitcher pulls in auth/router stores it does not own.
vi.mock('@/components/layout/ModeSwitcher', () => ({ default: () => null }));
// The Network badge hook reaches a server action - stub it to a fixed count.
vi.mock('@/features/connect/network/useNetworkBadge', () => ({
  useNetworkBadge: () => 0,
}));

import ConnectModuleNav from './ConnectModuleNav';

function renderNav() {
  return renderWithIntl(
    <Layout>
      <ConnectModuleNav
        collapsed={false}
        onCollapse={() => {}}
        mobileOpen={false}
        onMobileClose={() => {}}
      />
    </Layout>,
  );
}

describe('ConnectModuleNav', () => {
  it('renders the main module items', () => {
    renderNav();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
  });

  it('renders the "Your presence" group with only My Profile', () => {
    renderNav();
    expect(screen.getByText('Your presence')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    // Pre-reframe singular storefront / lead-manager entries are removed -
    // data-driven Company Pages / Storefronts groups land in Phase 4.
    expect(screen.queryByText('My Storefront')).not.toBeInTheDocument();
    expect(screen.queryByText('Lead Manager')).not.toBeInTheDocument();
  });

  // The keyboard-shortcuts cheat-sheet is a desktop-only affordance (no
  // physical keyboard on a touch phone), so the footer trigger must hide
  // below the mobile breakpoint while still rendering on desktop.
  it('shows the keyboard-shortcuts trigger on desktop', () => {
    setMobileViewport(false);
    renderNav();
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
  });

  it('hides the keyboard-shortcuts trigger on a mobile viewport', () => {
    setMobileViewport(true);
    renderNav();
    expect(screen.queryByText('Keyboard shortcuts')).not.toBeInTheDocument();
  });
});

afterEach(() => {
  // Restore the inert desktop matchMedia stub from vitest.setup.ts so a mobile
  // override does not leak into later tests.
  setMobileViewport(false);
});
