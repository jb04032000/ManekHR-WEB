import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import ModuleTabs, { type ModuleTab } from './ModuleTabs';

/**
 * `usePathname` is fixed; `useSearchParams` is driven per-test via the mutable
 * `currentParams` so we can exercise active-tab resolution and href building.
 */
let currentParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/connect/network',
  useSearchParams: () => currentParams,
}));

const TABS: ModuleTab[] = [
  { key: 'invitations', label: 'Invitations', count: 4 },
  { key: 'connections', label: 'Connections', count: 67 },
  { key: 'following', label: 'Following', count: 0 },
];

function tabLink(name: string | RegExp): HTMLAnchorElement {
  return screen.getByRole('tab', { name }) as HTMLAnchorElement;
}

describe('ModuleTabs', () => {
  beforeEach(() => {
    currentParams = new URLSearchParams();
  });

  it('renders every tab as a tab-role link', () => {
    renderWithIntl(<ModuleTabs tabs={TABS} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('links each tab to ?tab=<key> on the current path', () => {
    renderWithIntl(<ModuleTabs tabs={TABS} />);
    expect(tabLink(/Connections/).getAttribute('href')).toBe('/connect/network?tab=connections');
  });

  it('selects the first tab when no ?tab= param is present', () => {
    renderWithIntl(<ModuleTabs tabs={TABS} />);
    expect(tabLink(/Invitations/).getAttribute('aria-selected')).toBe('true');
    expect(tabLink(/Connections/).getAttribute('aria-selected')).toBe('false');
  });

  it('honours an explicit defaultTab when no ?tab= param is present', () => {
    renderWithIntl(<ModuleTabs tabs={TABS} defaultTab="connections" />);
    expect(tabLink(/Connections/).getAttribute('aria-selected')).toBe('true');
  });

  it('reads the active tab from the ?tab= search param', () => {
    currentParams = new URLSearchParams('tab=following');
    renderWithIntl(<ModuleTabs tabs={TABS} />);
    expect(tabLink(/Following/).getAttribute('aria-selected')).toBe('true');
    expect(tabLink(/Following/).getAttribute('aria-current')).toBe('page');
  });

  it('falls back to the default tab when ?tab= is an unknown key', () => {
    currentParams = new URLSearchParams('tab=nonsense');
    renderWithIntl(<ModuleTabs tabs={TABS} />);
    expect(tabLink(/Invitations/).getAttribute('aria-selected')).toBe('true');
  });

  it('renders a positive count badge but not a zero one', () => {
    renderWithIntl(<ModuleTabs tabs={TABS} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('67')).toBeInTheDocument();
    // The following tab has count 0 - no badge node.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('caps a large count at 99+', () => {
    renderWithIntl(<ModuleTabs tabs={[{ key: 'a', label: 'Alerts', count: 1200 }]} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('preserves other search params when building tab hrefs', () => {
    currentParams = new URLSearchParams('q=zari&tab=invitations');
    renderWithIntl(<ModuleTabs tabs={TABS} />);
    const href = tabLink(/Following/).getAttribute('href') ?? '';
    expect(href).toContain('q=zari');
    expect(href).toContain('tab=following');
  });

  it('exposes the bar as a tablist with its accessible label', () => {
    renderWithIntl(<ModuleTabs tabs={TABS} ariaLabel="Network sections" />);
    expect(screen.getByRole('tablist', { name: 'Network sections' })).toBeInTheDocument();
  });
});
