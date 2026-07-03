import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getPublicListing } from '@/features/connect/marketplace/marketplace.actions';
import { getStorefrontListings } from '@/features/connect/entities/storefront.actions';
import { getPublicConnectProfileBySlug } from '@/features/connect/profile.actions';
import ListingDetailScreen from '@/features/connect/marketplace/ListingDetailScreen';
import type { ConnectPerson } from '@/components/connect';
import { env } from '@/lib/env';
import { entitySeo, notFoundSeo } from '@/lib/connect/seo-meta';
import { JsonLd } from '@/components/marketing/JsonLd';
import {
  productJsonLd,
  courseJsonLd,
  serviceJsonLd,
  breadcrumbJsonLd,
} from '@/components/connect/seo/connect-schema';
import { SERVICE_CATEGORIES } from '@/features/connect/marketplace/marketplace.types';
import ShareButton from '@/components/connect/ShareButton';

/**
 * `/products/[id]` -- the PUBLIC, SEO-indexable product (listing) detail +
 * WhatsApp share landing. This is the planned `(connect-public)` product route
 * (see the group layout comment): SSR, works logged-out, Product (or Course, for
 * a `course`-category institute listing) + Breadcrumb JSON-LD, OG tags so a
 * shared link unfurls on WhatsApp, and a Join-Connect CTA.
 *
 * Reads the same `@Public` listing endpoint the in-app `/connect/marketplace/
 * listing/[id]` mirror uses (`ListingService.getPublic`): only an active +
 * approved, NON-suppressed listing resolves; anything else (draft / paused /
 * over-limit-suppressed) 404s, so crawlers see exactly what users see. The
 * authed `/connect/*` mirror owns the buyer inquiry flow; an authenticated
 * member is bounced there by the proxy, so this page serves crawlers + guests.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

const loadListing = cache((id: string) => getPublicListing(id));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('connect.marketplace');
  const res = await loadListing(id);
  if (!res.ok) return notFoundSeo(t('metaTitle'));

  const listing = res.data;
  const storeName = listing.storefront?.name;
  // "{Product} · {Store}" -- the root template appends " | ManekHR".
  const title = storeName ? `${listing.title} · ${storeName}` : listing.title;
  const description = listing.description.trim().slice(0, 160) || t('metaTitle');

  return entitySeo({
    path: `/products/${id}`,
    title,
    description,
    image: listing.images?.[0],
    ogType: 'website',
  });
}

export default async function PublicProductPage({ params }: PageProps) {
  const { id } = await params;
  const res = await loadListing(id);
  if (!res.ok) notFound();
  const listing = res.data;

  const t = await getTranslations('connect.profile');

  // Seller identity + the shop's other products (best-effort; a failure just
  // omits the seller mini-card / siblings). No `getMyListings` here: a public
  // visitor is never the owner (authed members are mirror-redirected to the
  // in-app page), and calling an authed action logged-out only logs 401 noise.
  const [sellerRes, siblingsRes] = await Promise.all([
    getPublicConnectProfileBySlug(listing.ownerUserId),
    listing.storefront
      ? getStorefrontListings(listing.storefront.id)
      : Promise.resolve({ ok: false as const, error: 'no storefront' }),
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

  const productUrl = `${env.appUrl}/products/${id}`;
  const store = listing.storefront;
  // A course listing (Institutes Phase 1) is an educational offering, not a
  // retail SKU, so it gets Course JSON-LD; everything else stays Product. Both
  // emit a price/free offer only when the page actually shows one.
  const isCourse = listing.category === 'course' && !!listing.courseDetails;
  // A service-category listing (Slice B2) is a service offer, not a retail SKU, so
  // it gets Service JSON-LD instead of Product (mirrors the course swap). Uses the
  // broad SERVICE_CATEGORIES set so pre-existing service-ish categories (dyeing,
  // printing, job-work, embroidery-zari) carrying serviceDetails also emit Service.
  const isService =
    !isCourse &&
    (SERVICE_CATEGORIES as readonly string[]).includes(listing.category) &&
    !!listing.serviceDetails;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      {/* Course (institute) vs Service (service offer) vs Product structured data;
          offers/price emitted ONLY when the page shows one. */}
      <JsonLd
        data={
          isCourse
            ? courseJsonLd(listing, {
                url: productUrl,
                providerName: store?.name,
                providerUrl: store ? `/store/${store.slug}` : undefined,
              })
            : isService
              ? serviceJsonLd(listing, {
                  url: productUrl,
                  providerName: store?.name,
                  providerUrl: store ? `/store/${store.slug}` : undefined,
                })
              : productJsonLd(listing, {
                  url: productUrl,
                  sellerName: store?.name,
                  sellerUrl: store ? `/store/${store.slug}` : undefined,
                })
        }
      />
      {/* Breadcrumb structured data when the shop crumb is shown (Store > Product). */}
      {store ? (
        <JsonLd
          data={breadcrumbJsonLd([
            { name: store.name, path: `/store/${store.slug}` },
            { name: listing.title, path: `/products/${id}` },
          ])}
        />
      ) : null}

      <div className="mb-3 flex justify-end">
        <ShareButton surface="listing" url={productUrl} name={listing.title} size="small" />
      </div>

      <ListingDetailScreen listing={listing} seller={seller} siblings={siblings} isOwner={false} />

      {/* Logged-out conversion CTA (reuses the profile join copy). */}
      <div className="mx-auto mt-6 w-full max-w-[1100px]">
        <div
          className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: 'var(--cr-wash-indigo)',
            border: '1px solid var(--cr-primary-border)',
            borderRadius: 'var(--cr-radius-lg)',
          }}
        >
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
              {t('joinCtaTitle')}
            </div>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('joinCtaBody')}
            </p>
          </div>
          <Link
            href="/connect"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold no-underline"
            style={{ background: 'var(--cr-primary)', color: '#ffffff', flexShrink: 0 }}
          >
            {t('joinCtaButton')}
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
