import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  getPublicStorefront,
  getStorefrontListings,
} from '@/features/connect/entities/storefront.actions';
import { getPublicCollections } from '@/features/connect/entities/collection.actions';
import { getSellerReviews } from '@/features/connect/reviews/reviews.actions';
import Link from 'next/link';
import StorefrontView from '@/features/connect/entities/StorefrontView';
import ViewBeacon from '@/features/connect/views/ViewBeacon';
import ConnectPage from '@/components/connect/ConnectPage';
import RailPanel from '@/components/connect/RailPanel';
import EntityAdRail from '@/features/connect/ads/EntityAdRail';
import MobileAdInline from '@/features/connect/ads/MobileAdInline';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/store/[slug]` -- the IN-APP (authenticated) view of a Storefront,
 * inside the Connect shell. Mirrors `/connect/company/[slug]`: no logged-out
 * "Join Connect" CTA and `noindex` (the public `/store/[slug]` mirror owns SEO).
 * The proxy redirects a signed-in member here from the public route so they
 * never land on the logged-out page. Read-only for everyone (incl. the owner) -
 * the owner edits from the Storefronts hub's "Manage", so "View public" links
 * resolve here without bouncing into an edit form.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('connect.storefront');
  const res = await getPublicStorefront(slug);
  if (!res.ok) {
    return { title: t('notFoundTitle'), robots: { index: false, follow: false } };
  }
  return { title: res.data.storefront.name, robots: { index: false, follow: false } };
}

export default async function ConnectStorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  const res = await getPublicStorefront(slug);
  if (!res.ok) notFound();

  const { storefront, erpLink } = res.data;
  // reviews -> the seller's rating aggregate warm-starts the header rating row +
  // the Reviews tab (the public storefront read does not carry a rating itself).
  const [listingsRes, collectionsRes, reviewsRes, promoted] = await Promise.all([
    getStorefrontListings(storefront._id),
    getPublicCollections(storefront._id),
    getSellerReviews(storefront.ownerUserId),
    resolvePromotedRailListing('storefront_page'),
  ]);
  const listings = listingsRes.ok ? listingsRes.data : [];
  const collections = collectionsRes.ok ? collectionsRes.data : [];
  const rating = reviewsRes.ok ? reviewsRes.data.aggregate : undefined;

  const view = (
    <>
      <ViewBeacon
        targetType="storefront"
        targetId={storefront._id}
        ownerUserId={storefront.ownerUserId}
      />
      <StorefrontView
        storefront={storefront}
        erpLinked={erpLink.linked}
        listings={listings}
        collections={collections}
        rating={rating}
      />
    </>
  );

  // The ad rail keeps the Google AdSlots + a first-party promoted listing, but
  // its floor content is BUYER-relevant here: a buyer browsing a shop has no use
  // for the default "list a product" seller promo, so it is replaced with a
  // "discover more on the marketplace" CTA. On < xl the rail is hidden.
  const t = await getTranslations('connect.storefront');
  const buyerFloor = (
    <RailPanel title={t('discoverTitle')}>
      <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-3)' }}>
        {t('discoverBody')}
      </p>
      <Link
        href="/connect/marketplace"
        className="mt-2.5 inline-block text-[12.5px] font-semibold no-underline"
        style={{ color: 'var(--cr-primary)' }}
      >
        {t('discoverCta')}
      </Link>
    </RailPanel>
  );
  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {view}
        {/* Mobile-only ad: the rail (same boost + Google slot) is hidden below xl,
            so phone users get the inventory inline here instead. */}
        <MobileAdInline promoted={promoted} />
      </main>
      <EntityAdRail promoted={promoted} floorPanel={buyerFloor} />
    </ConnectPage>
  );
}
