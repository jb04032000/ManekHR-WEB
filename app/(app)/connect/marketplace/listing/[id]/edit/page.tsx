import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getMyListings } from '@/features/connect/marketplace/marketplace.actions';
import { getMyCollections } from '@/features/connect/entities/collection.actions';
import EditListingScreen from '@/features/connect/marketplace/EditListingScreen';

/**
 * `/connect/marketplace/listing/[id]/edit` - the seller's edit form (M1.6.4).
 *
 * The owner's listings (any status) are read via `getMyListings` and the target
 * is found by id; a non-owner / missing id 404s. The public `getPublic` read is
 * not used here because it only returns active + approved listings, whereas the
 * owner edits drafts, paused, pending, and rejected listings too.
 */
interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.marketplace.edit');
  return { title: t('metaTitle') };
}

export default async function ConnectEditListingPage({ params }: EditListingPageProps) {
  const { id } = await params;
  const res = await getMyListings();
  if (!res.ok) notFound();
  const listing = res.data.find((l) => l._id === id);
  if (!listing) notFound();
  // The shop's collections, so the editor can assign this product to them.
  const collectionsRes = listing.storefrontId ? await getMyCollections(listing.storefrontId) : null;
  const collections = collectionsRes?.ok ? collectionsRes.data : [];
  return <EditListingScreen listing={listing} collections={collections} />;
}
