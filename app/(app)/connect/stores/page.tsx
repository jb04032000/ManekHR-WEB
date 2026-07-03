import type { Metadata } from 'next';
import {
  listMyStorefronts,
  getMyStorefrontStats,
} from '@/features/connect/entities/storefront.actions';
import StoresHub from '@/features/connect/entities/StoresHub';
// First-party promoted-listing ad for the hub rail (placement `stores_hub`).
// Hydrates via the PUBLIC listing getter (no owner leak); null on a no-fill.
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

export const metadata: Metadata = { title: 'Storefronts', robots: { index: false, follow: false } };

/** `/connect/stores` -- the signed-in owner's Storefronts hub (list + create). */
export default async function ConnectStorefrontsHubPage() {
  // Single-slot page so no shared pageRequestId is needed (dedupe is a no-op).
  const [storesRes, statsRes, promoted] = await Promise.all([
    listMyStorefronts(),
    getMyStorefrontStats(),
    resolvePromotedRailListing('stores_hub'),
  ]);
  const stores = storesRes.ok ? storesRes.data : [];
  const stats = statsRes.ok ? statsRes.data : [];
  return <StoresHub initialStores={stores} initialStats={stats} promoted={promoted} />;
}
