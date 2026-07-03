import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMyStorefront, listMyStorefronts } from '@/features/connect/entities/storefront.actions';
import {
  getMyListings,
  getReceivedInquiries,
} from '@/features/connect/marketplace/marketplace.actions';
import { getMyCollections } from '@/features/connect/entities/collection.actions';
import { getStorefrontViewSummary } from '@/features/connect/views.actions';
import ManageStorefrontScreen from '@/features/connect/entities/ManageStorefrontScreen';
// First-party promoted-listing ad for the manage-console rail (placement
// `storefront_manage`). Hydrates via the PUBLIC listing getter (no owner leak);
// null on a no-fill. Sits between the Google connect.right.* slots already there.
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

export const metadata: Metadata = {
  title: 'Manage storefront',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * `/connect/stores/[id]` -- manage one of the owner's Storefronts (tabbed
 * console: Overview / Products / Inquiries / Settings). The BE 404s a shop the
 * caller does not own (no existence leak) -> notFound().
 */
export default async function ManageStorefrontRoute({ params }: Props) {
  const { id } = await params;
  const res = await getMyStorefront(id);
  if (!res.ok) notFound();

  const [listingsRes, viewsRes, inquiriesRes, storesRes, collectionsRes, promoted] =
    await Promise.all([
      getMyListings(id), // this shop's OWN products (all statuses)
      getStorefrontViewSummary(id), // 7d/30d views + per-listing
      getReceivedInquiries(), // seller inbox (filtered to this shop below)
      listMyStorefronts(), // for the shop switcher
      getMyCollections(id), // the shop's collections (Collections tab)
      resolvePromotedRailListing('storefront_manage'), // rail boost (single slot)
    ]);

  const listings = listingsRes.ok ? listingsRes.data : [];
  const collections = collectionsRes.ok ? collectionsRes.data : [];
  const views = viewsRes.ok ? viewsRes.data : null;
  const listingIds = new Set(listings.map((l) => l._id));
  // The seller inbox is keyset-paginated across ALL the seller's shops; filter
  // the first page down to THIS shop here, and hand the screen the raw cursor so
  // "Load more" can keep paginating (and filtering) the rest. (See
  // ManageStorefrontScreen - the cursor is the unfiltered position, not per-shop.)
  const inquiriesPage = inquiriesRes.ok ? inquiriesRes.data : { items: [], nextCursor: null };
  const inquiries = inquiriesPage.items.filter((q) => listingIds.has(q.listingId));
  const stores = storesRes.ok ? storesRes.data.map((s) => ({ id: s._id, name: s.name })) : [];

  return (
    <ManageStorefrontScreen
      store={res.data}
      listings={listings}
      views={views}
      inquiries={inquiries}
      inquiriesNextCursor={inquiriesPage.nextCursor}
      stores={stores}
      collections={collections}
      promoted={promoted}
    />
  );
}
