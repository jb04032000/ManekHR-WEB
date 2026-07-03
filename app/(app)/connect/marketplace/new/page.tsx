import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import NewListingScreen from '@/features/connect/marketplace/NewListingScreen';
import { listMyStorefronts } from '@/features/connect/entities/storefront.actions';
import { getMyCollections } from '@/features/connect/entities/collection.actions';
import { getMyListings } from '@/features/connect/marketplace/marketplace.actions';
import type { ListingUnit } from '@/features/connect/marketplace/marketplace.types';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/marketplace/new` - the seller create-listing form (M1.6.3).
 *
 * A thin Server Component for metadata; the form itself is the client island
 * `NewListingScreen` (AntD Form + the shared `MediaUploadGrid`). The create
 * action derives the owner from the JWT, so this route needs no params. We
 * preload the seller's shops so a multi-shop seller can pick where the product
 * is filed (single-shop sellers never see a picker).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.marketplace.new');
  return { title: t('metaTitle') };
}

interface NewListingPageProps {
  searchParams: Promise<{ storefrontId?: string | string[] }>;
}

export default async function ConnectNewListingPage({ searchParams }: NewListingPageProps) {
  const { storefrontId } = await searchParams;
  // Set when arriving from a shop's "Add product" so the product files into it.
  const defaultStorefrontId = Array.isArray(storefrontId) ? storefrontId[0] : storefrontId;
  // Reuse the marketplace rail placement to feed the ad section on this page.
  // The seller's own listings seed "duplicate from existing".
  const [res, promoted, mineRes] = await Promise.all([
    listMyStorefronts(),
    resolvePromotedRailListing('marketplace_rail'),
    getMyListings(),
  ]);
  const storefronts = res.ok ? res.data.map((s) => ({ id: s._id, name: s.name })) : [];
  // The owner's collections per shop, so the in-form picker is scoped to whichever
  // shop the product files into. Few shops in practice, so per-shop reads are fine.
  const collectionsByShop: Record<string, { id: string; title: string }[]> = {};
  await Promise.all(
    storefronts.map(async (s) => {
      const cRes = await getMyCollections(s.id);
      collectionsByShop[s.id] = cRes.ok
        ? cRes.data.map((c) => ({ id: c.collection._id, title: c.collection.title }))
        : [];
    }),
  );
  const duplicable = mineRes.ok
    ? mineRes.data.map((l) => ({
        id: l._id,
        title: l.title,
        values: {
          title: l.title,
          category: l.category,
          description: l.description ?? undefined,
          priceType: l.priceType,
          priceMin: l.priceMin ?? undefined,
          priceMax: l.priceMax ?? undefined,
          unit: (l.unit as ListingUnit | undefined) ?? undefined,
          moq: l.moq ?? undefined,
          leadTimeDays: l.leadTimeDays ?? undefined,
          district: l.location?.district ?? undefined,
          city: l.location?.city ?? undefined,
          state: l.location?.state ?? undefined,
          // Course fields (Institutes Phase 1): copy the reusable ones so
          // duplicating a course seeds its shape. `batchStart` is deliberately
          // dropped (it is a Dayjs in the form and a new batch needs a fresh date,
          // like photos are not copied either).
          ...(l.courseDetails
            ? {
                courseDurationLabel: l.courseDetails.durationLabel,
                courseMode: l.courseDetails.mode,
                courseFeeType: l.courseDetails.feeType,
                courseSeats: l.courseDetails.seats ?? undefined,
                courseCertificate: l.courseDetails.certificate,
                courseSkillsTaught: l.courseDetails.skillsTaught,
              }
            : {}),
          // Service fields (Slice B2): copy the reusable ones so duplicating a
          // service listing seeds its shape, mirroring the course prefill above.
          ...(l.serviceDetails
            ? {
                serviceDeliveryMode: l.serviceDetails.deliveryMode,
                servicePricingModel: l.serviceDetails.pricingModel,
                serviceCoverageArea: l.serviceDetails.coverageArea ?? undefined,
                serviceYearsExperience: l.serviceDetails.yearsExperience ?? undefined,
                serviceAvailability: l.serviceDetails.availability ?? undefined,
              }
            : {}),
        },
      }))
    : [];
  return (
    <NewListingScreen
      storefronts={storefronts}
      defaultStorefrontId={defaultStorefrontId}
      promoted={promoted}
      duplicable={duplicable}
      collectionsByShop={collectionsByShop}
    />
  );
}
