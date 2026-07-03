import type { Metadata } from 'next';
import {
  listMyCompanyPages,
  getMyCompanyPageStats,
} from '@/features/connect/entities/company-page.actions';
import CompanyPagesHub from '@/features/connect/entities/CompanyPagesHub';
// First-party promoted-listing ad for the hub rail (placement `pages_hub`).
// Hydrates via the PUBLIC listing getter (no owner leak); null on a no-fill.
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

export const metadata: Metadata = {
  title: 'Company pages',
  robots: { index: false, follow: false },
};

/**
 * `/connect/pages` -- the signed-in owner's Company Pages hub (list + create).
 * Person-centric: lists only the caller's own pages.
 */
export default async function ConnectCompanyPagesHubPage() {
  // Single-slot page so no shared pageRequestId is needed (dedupe is a no-op).
  const [res, statsRes, promoted] = await Promise.all([
    listMyCompanyPages(),
    getMyCompanyPageStats(),
    resolvePromotedRailListing('pages_hub'),
  ]);
  const pages = res.ok ? res.data : [];
  const stats = statsRes.ok
    ? statsRes.data
    : { pages: [], totals: { pages: 0, followers: 0, posts: 0, openJobs: 0 } };
  return <CompanyPagesHub initialPages={pages} stats={stats} promoted={promoted} />;
}
