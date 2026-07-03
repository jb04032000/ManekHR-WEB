import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  getPublicListing,
  getMyListings,
} from '@/features/connect/marketplace/marketplace.actions';
import { getStorefrontListings } from '@/features/connect/entities/storefront.actions';
import { getPublicConnectProfileBySlug } from '@/features/connect/profile.actions';
import ListingDetailScreen from '@/features/connect/marketplace/ListingDetailScreen';
import ViewBeacon from '@/features/connect/views/ViewBeacon';
import { ReportButton } from '@/components/connect/ReportContentModal';
import { isViewerSignedIn } from '@/lib/actions/cookies';
import type { ConnectPerson } from '@/components/connect';
// First-party promoted-listing boost for this previously rail-LESS detail page
// (placement `listing_detail`). Hydrates via the PUBLIC listing getter (leak-safe);
// null on a no-fill. Shown in the buy-box aside (desktop) + inline on mobile.
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/marketplace/listing/[id]` - the public listing detail (M1.6.2).
 *
 * A Server Component. It reads the listing via the `@Public` endpoint (only an
 * active + approved listing resolves; anything else `notFound()`s), then
 * hydrates the seller identity from the public profile read (best-effort - the
 * `[slug]` param accepts the 24-hex `ownerUserId`). The seller is `null` when
 * the profile is unavailable, and the detail screen falls back to a plain link.
 */
interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ListingDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getPublicListing(id);
  if (!res.ok) {
    const t = await getTranslations('connect.marketplace');
    return { title: t('metaTitle') };
  }
  return { title: res.data.title };
}

export default async function ConnectListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const listingRes = await getPublicListing(id);
  if (!listingRes.ok) notFound();
  const listing = listingRes.data;

  const [sellerRes, siblingsRes, mineRes, promoted] = await Promise.all([
    getPublicConnectProfileBySlug(listing.ownerUserId),
    listing.storefront
      ? getStorefrontListings(listing.storefront.id)
      : Promise.resolve({ ok: false as const, error: 'no storefront' }),
    getMyListings(),
    resolvePromotedRailListing('listing_detail'),
  ]);
  const seller: ConnectPerson | null = sellerRes.ok
    ? {
        userId: sellerRes.data.userId.handle || sellerRes.data.userId._id,
        name: sellerRes.data.userId.name,
        headline: sellerRes.data.headline,
        avatarUrl: sellerRes.data.userId.profilePicture,
      }
    : null;
  const siblings = siblingsRes.ok ? siblingsRes.data : [];
  // The viewer is the owner when this listing is among their own (a self-inquiry
  // is blocked anyway, so the buyer CTA must not show for them).
  const isOwner = mineRes.ok && mineRes.data.some((l) => l._id === listing._id);
  const signedIn = await isViewerSignedIn();

  return (
    <>
      <ViewBeacon targetType="listing" targetId={listing._id} ownerUserId={listing.ownerUserId} />
      <ListingDetailScreen
        listing={listing}
        seller={seller}
        siblings={siblings}
        isOwner={isOwner}
        promoted={promoted}
      />
      {/* Signed-in non-owners can report a listing -> admin moderation queue. */}
      {signedIn && !isOwner && (
        <div className="mx-auto flex w-full max-w-[1180px] justify-end px-4 pb-6">
          <ReportButton
            target={{
              targetType: 'listing',
              targetId: listing._id,
              targetOwnerUserId: listing.ownerUserId,
              snapshot: listing.title,
              targetUrl: `/connect/marketplace/listing/${listing._id}`,
            }}
          />
        </div>
      )}
    </>
  );
}
