import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  getPublicStorefront,
  getStorefrontListings,
} from '@/features/connect/entities/storefront.actions';
import { getPublicCollections } from '@/features/connect/entities/collection.actions';
import { getSellerReviews } from '@/features/connect/reviews/reviews.actions';
import StorefrontView from '@/features/connect/entities/StorefrontView';
import { env } from '@/lib/env';
import { entitySeo, notFoundSeo } from '@/lib/connect/seo-meta';
import { JsonLd } from '@/components/marketing/JsonLd';
import { organizationJsonLd } from '@/components/connect/seo/connect-schema';
import ShareButton from '@/components/connect/ShareButton';

/**
 * `/store/[slug]` -- the public, SEO-indexable Storefront (shop). SSR; only
 * resolvable, non-hidden shops render. Works logged-out with a "Join Connect"
 * CTA. Shows the shop's own products (the same listings that also appear in the
 * shared marketplace). Mirrors the `/company/[slug]` template.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

const loadStore = cache((slug: string) => getPublicStorefront(slug));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('connect.storefront');
  const res = await loadStore(slug);
  if (!res.ok) return notFoundSeo(t('notFoundTitle'));
  const { storefront } = res.data;
  const description =
    storefront.description.trim().slice(0, 160) || t('metaFallback', { name: storefront.name });
  return entitySeo({
    path: `/store/${storefront.slug}`,
    title: storefront.name,
    description,
    image: storefront.banner,
    ogType: 'website',
  });
}

export default async function PublicStorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  const res = await loadStore(slug);
  if (!res.ok) notFound();

  const { storefront, erpLink } = res.data;
  const t = await getTranslations('connect.profile');
  const [listingsRes, collectionsRes, reviewsRes] = await Promise.all([
    getStorefrontListings(storefront._id),
    getPublicCollections(storefront._id),
    getSellerReviews(storefront.ownerUserId),
  ]);
  const listings = listingsRes.ok ? listingsRes.data : [];
  const collections = collectionsRes.ok ? collectionsRes.data : [];
  const rating = reviewsRes.ok ? reviewsRes.data.aggregate : undefined;

  // Organization structured data for the shop (name + cover + description only -
  // the fields the page actually shows). Crawler-facing, English.
  const storeUrl = `${env.appUrl}/store/${storefront.slug}`;

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 sm:py-8">
      <JsonLd
        data={organizationJsonLd({
          type: 'Organization',
          name: storefront.name,
          url: `/store/${storefront.slug}`,
          logo: storefront.banner,
          description: storefront.description,
        })}
      />
      <div className="mb-3 flex justify-end">
        <ShareButton surface="store" url={storeUrl} name={storefront.name} size="small" />
      </div>
      <StorefrontView
        storefront={storefront}
        erpLinked={erpLink.linked}
        listings={listings}
        collections={collections}
        rating={rating}
      />

      <div className="mx-auto mt-6 w-full max-w-[960px]">
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
