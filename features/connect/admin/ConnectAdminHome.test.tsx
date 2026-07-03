import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import ConnectAdminHome from './ConnectAdminHome';

/**
 * M3.1 - the Connect admin hub links only to surfaces that exist today; this
 * guards against a dead link sneaking in (or a route typo) as the admin area grows.
 */
describe('ConnectAdminHome', () => {
  it('links to each existing Connect admin surface', () => {
    renderWithIntl(<ConnectAdminHome />);
    const href = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href(/Marketplace moderation/)).toBe('/admin/connect/marketplace/review');
    expect(href(/Ad review/)).toBe('/admin/connect/ads/review');
    expect(href(/Connect plans/)).toBe('/admin/plans?product=connect');
    expect(href(/Connect tiers/)).toBe('/admin/tiers?product=connect');
  });
});
