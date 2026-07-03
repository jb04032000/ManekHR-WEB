import type { Metadata } from 'next';
import { listListingReview } from '@/features/connect/marketplace/marketplace-admin.actions';
import AdminListingReview from '@/features/connect/marketplace/AdminListingReview';

/**
 * /admin/connect/marketplace/review - platform-admin marketplace moderation.
 *
 * Guarded by AdminLayout (client isAdmin redirect) + the backend IsAdminGuard.
 * Loads the pending-listing queue; a read failure degrades to an empty queue
 * rather than erroring the page.
 */

export const metadata: Metadata = { title: 'Marketplace Review' };

export default async function AdminConnectMarketplaceReviewPage() {
  const res = await listListingReview();
  const listings = res.ok ? res.data : [];

  return <AdminListingReview listings={listings} />;
}
