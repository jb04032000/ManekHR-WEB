'use client';

/**
 * CompanyStoreCard - the attached storefront shown on a company page (public
 * Store section + Overview). Redirect-first: it previews the store identity +
 * a few featured products, then sends buyers to the full storefront at
 * /store/[slug]. Products are NEVER managed here (the storefront module owns
 * them). Links to: the public storefront page (/store/[slug]) + the company
 * page's public products (getCompanyPageListings -> ConnectListingRef[]).
 * Gotcha: `featured` items are ConnectListingRef (listingId/coverImage/images),
 * not the seller-facing Listing shape - keep in sync with search.types.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Store, ArrowRight } from 'lucide-react';
import type { Storefront } from './entities.types';
import type { ConnectListingRef } from '../search.types';

export default function CompanyStoreCard({
  store,
  productCount,
  featured = [],
}: {
  store: Pick<Storefront, 'slug' | 'name' | 'logo'>;
  productCount: number;
  featured?: ConnectListingRef[];
}) {
  const t = useTranslations('connect.companyPage');
  const storeHref = `/store/${store.slug}`;
  return (
    <section
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 16,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden"
          style={{ borderRadius: 'var(--cr-radius-md)', background: 'var(--cr-surface-3)' }}
        >
          {store.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- small store logo creative; next/image adds no optimisation here
            <img src={store.logo} alt="" aria-hidden className="h-full w-full object-cover" />
          ) : (
            <Store size={18} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {store.name}
          </div>
          <div className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('storeProductCount', { count: productCount })}
          </div>
        </div>
        <Link
          href={storeHref}
          className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold no-underline"
          style={{ color: 'var(--cr-primary)' }}
        >
          {t('visitStore')} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      {featured.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {featured.slice(0, 6).map((p) => {
            const thumb = p.coverImage ?? p.images?.[0] ?? null;
            return (
              <Link
                key={p.listingId}
                href={storeHref}
                className="block aspect-square overflow-hidden no-underline"
                style={{ borderRadius: 'var(--cr-radius-md)', background: 'var(--cr-surface-3)' }}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- product thumbnail creative; next/image adds no optimisation here
                  <img src={thumb} alt={p.title} className="h-full w-full object-cover" />
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
