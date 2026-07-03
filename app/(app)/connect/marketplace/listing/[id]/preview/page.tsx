import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getMyListings } from '@/features/connect/marketplace/marketplace.actions';
import { getMyStorefront } from '@/features/connect/entities/storefront.actions';
import ListingDetailScreen from '@/features/connect/marketplace/ListingDetailScreen';
import type { ListingDetail, ListingUnit } from '@/features/connect/marketplace/marketplace.types';

/**
 * `/connect/marketplace/listing/[id]/preview` - the seller's PREVIEW of their
 * own listing (any status, drafts included). Unlike the public detail route, it
 * reads via `getMyListings` (owner-scoped, so a non-owner / missing id 404s),
 * which lets a draft be previewed before it is published. `ListingDetailScreen`
 * renders the same buyer-facing surface wrapped in `preview` chrome (banner,
 * back-to-edit, Publish, readiness checklist).
 */
interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.marketplace.preview');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function ConnectListingPreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const res = await getMyListings();
  if (!res.ok) notFound();
  const owned = res.data.find((l) => l._id === id);
  if (!owned) notFound();

  // The owning shop (for the breadcrumb + "View storefront"). Best-effort: a
  // legacy listing with no storefront simply omits it.
  const storeRes = owned.storefrontId ? await getMyStorefront(owned.storefrontId) : null;
  const storefront =
    storeRes && storeRes.ok
      ? { id: storeRes.data._id, name: storeRes.data.name, slug: storeRes.data.slug }
      : null;

  // Map the owner listing onto the buyer-facing ListingDetail shape the screen
  // renders. `verified` is not part of the owner read; preview never shows the
  // verified badge.
  const listing: ListingDetail = {
    _id: owned._id,
    ownerUserId: owned.ownerUserId,
    title: owned.title,
    description: owned.description ?? '',
    category: owned.category,
    priceType: owned.priceType,
    priceMin: owned.priceMin ?? null,
    priceMax: owned.priceMax ?? null,
    unit: (owned.unit as ListingUnit | undefined) ?? null,
    moq: owned.moq ?? null,
    leadTimeDays: owned.leadTimeDays ?? null,
    location: owned.location,
    images: owned.images ?? [],
    verified: false,
    storefront,
    createdAt: owned.createdAt,
  };

  return <ListingDetailScreen listing={listing} seller={null} preview />;
}
