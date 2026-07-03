'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck,
  LayoutDashboard,
  MapPin,
  Package,
  Star,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import TrustBadgeRow from '@/components/connect/TrustBadgeRow';
// Per-item "Sample" disclosure pill on a seeded demo storefront (storefront.isDemo).
// One source of truth with the marketplace/search demo down-rank (BE demo-rank).
import SampleBadge from '@/components/connect/SampleBadge';
import RatingStars from '@/components/connect/RatingStars';
import SellerReviews from '@/components/connect/SellerReviews';
import { ListingGridCard } from '@/components/connect';
import type { ConnectListingRef } from '../search.types';
import type { Storefront } from './entities.types';
import type { PublicCollection } from './collections.types';
import type { RatingAggregate } from '../reviews/reviews.types';

/** The storefront's public tabs. Mirrors `CompanyPageView` (overview / products
 *  / reviews) so the two public surfaces read as one family. */
type TabKey = 'overview' | 'products' | 'reviews';

const TAB_ICON: Record<TabKey, LucideIcon> = {
  overview: LayoutDashboard,
  products: Package,
  reviews: Star,
};

/** Sort orders offered by the store toolbar. */
type SortKey = 'recent' | 'priceLow' | 'priceHigh';

/** A single collection tab pill. `aria-pressed` exposes the toggle state. */
function CollectionTab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 cursor-pointer rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors"
      style={{
        border: '1px solid var(--cr-border-light)',
        background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
        color: active ? 'var(--cr-on-primary, #fff)' : 'var(--cr-text-2)',
      }}
    >
      {children}
      {typeof count === 'number' && (
        <span style={{ marginLeft: 5, opacity: 0.7, fontWeight: 600 }}>{count}</span>
      )}
    </button>
  );
}

interface Props {
  storefront: Storefront;
  erpLinked: boolean;
  listings: ConnectListingRef[];
  /** The shop's public collections (empty when it has none yet). */
  collections?: PublicCollection[];
  /** Seller rating roll-up (by ownerUserId) - warm-starts the header rating row
   *  + the Reviews tab. Omitted on surfaces that do not fetch it. */
  rating?: RatingAggregate;
}

function formatLocation(loc: Storefront['location']): string {
  // Title-case each word so raw lowercase entries ("surat") render as places.
  const titleCase = (s: string) => s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  return [loc?.district, loc?.city, loc?.state]
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => titleCase(p.trim()))
    .join(', ');
}

/**
 * Public, read-only Storefront view (the `/store/[slug]` SEO surface). The
 * seller's branded shop: banner, logo, name, optional ERP-linked badge,
 * description, categories, and a grid of its own products (the same listings
 * that also appear in the shared marketplace). Member-facing, i18n'd, WCAG-AA.
 */
export default function StorefrontView({
  storefront,
  erpLinked,
  listings,
  collections,
  rating,
}: Props) {
  const t = useTranslations('connect.storefront');
  const tReviews = useTranslations('connect.reviews');
  const searchParams = useSearchParams();
  const location = formatLocation(storefront.location);
  // Public store grid: only products WITH a cover photo. A photoless card reads
  // as broken; the backend already returns only active + approved listings, so
  // `active + approved + cover photo` is the visibility gate. This is EXACTLY the
  // seller-console `isLive` definition + the backend `live` stat, so what a buyer
  // sees here always equals the "Live products" count the seller is shown.
  const visible = useMemo(() => listings.filter((l) => !!l.coverImage), [listings]);
  // Member-since year from the ISO createdAt (no Date parsing needed).
  const memberSince = storefront.createdAt?.slice(0, 4);

  // Collection browser: only collections that have at least one LIVE product
  // (the backend counts live; a zero-count collection would be a dead tab).
  const browseCollections = useMemo(
    () => (collections ?? []).filter((c) => c.productCount > 0),
    [collections],
  );
  // Active collection id (null = All), seeded from the `?c=<slug>` deep-link.
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('recent');

  // Seed the active collection from `?c=<slug>` on mount / when the link changes.
  useEffect(() => {
    const slug = searchParams.get('c');
    const match = slug ? browseCollections.find((c) => c.slug === slug) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveCollection(match ? match.id : null);
  }, [searchParams, browseCollections]);

  // Select a collection: update local state + the `?c=` URL (no navigation, so
  // the client filter stays instant and the view is still deep-linkable).
  const selectCollection = (id: string | null) => {
    setActiveCollection(id);
    const slug = id ? browseCollections.find((c) => c.id === id)?.slug : undefined;
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set('c', slug);
    else url.searchParams.delete('c');
    window.history.replaceState(null, '', url.toString());
  };

  const activeCollectionMeta = activeCollection
    ? browseCollections.find((c) => c.id === activeCollection)
    : undefined;

  const shown = useMemo(() => {
    const filtered = activeCollection
      ? visible.filter((l) => (l.collectionIds ?? []).includes(activeCollection))
      : visible;
    // No-price products sort to the end of either price order.
    const arr = [...filtered];
    if (sort === 'recent') {
      arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (sort === 'priceLow') {
      arr.sort((a, b) => (a.priceMin ?? Infinity) - (b.priceMin ?? Infinity));
    } else {
      arr.sort((a, b) => (b.priceMin ?? -Infinity) - (a.priceMin ?? -Infinity));
    }
    return arr;
  }, [visible, activeCollection, sort]);

  // Tab model (mirrors CompanyPageView). Overview carries About + categories +
  // the ERP-verified note; Products is the shop's core grid (always present, a
  // shop without products still has a Products tab with an empty state).
  const hasOverview =
    !!storefront.description?.trim() || storefront.categories?.length > 0 || erpLinked;
  // Reviews follow the SELLER (ownerUserId), not this shop's products. Only show
  // the Reviews tab when there is something to show or evaluate: at least one
  // live product, or the seller already has reviews (rating may come from their
  // other shops / profile). A brand-new, empty, unrated shop hides it so it does
  // not invite a review of a seller with nothing to assess yet.
  const showReviews = visible.length > 0 || (rating?.ratingCount ?? 0) > 0;
  const tabs: TabKey[] = [
    ...(hasOverview ? (['overview'] as const) : []),
    'products' as const,
    ...(showReviews ? (['reviews'] as const) : []),
  ];
  // Honor a `?tab=` deep-link when it names a present tab; otherwise the first.
  const requestedTab = searchParams.get('tab') as TabKey | null;
  const [active, setActive] = useState<TabKey>(
    requestedTab && tabs.includes(requestedTab) ? requestedTab : (tabs[0] ?? 'products'),
  );
  const activeTab = tabs.includes(active) ? active : (tabs[0] ?? 'products');
  const shows = (k: TabKey) => (tabs.length > 1 ? activeTab === k : tabs.includes(k));

  // Select a tab: update local state + the `?tab=` URL (replaceState, no
  // navigation, so the switch stays instant). Writing the tab to the URL means
  // it survives a refresh, a shared link, and - the point of this - opening a
  // product then pressing back: the stored history entry carries `?tab=`, and
  // on remount the `requestedTab` seeding above restores it. Mirrors the `?c=`
  // collection deep-link below; both coexist in the query string.
  const selectTab = (k: TabKey) => {
    setActive(k);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', k);
    window.history.replaceState(null, '', url.toString());
  };

  return (
    // Width-agnostic: the host caps it (ConnectPage in-app, a max-w wrapper on
    // the public page) so the in-app view matches the profile's container.
    <article className="mx-auto w-full">
      {/* Identity card -- the hero cover + identity header share one bordered,
          rounded, overflow-clipped card, identical to the Company Page view
          (`CompanyPageView`), so the two public surfaces read as one family. */}
      <section
        className="overflow-hidden"
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        {/* Hero cover -- the uploaded banner, or a textile-warm gradient wash with
            a subtle stitch motif (the same decorative flourish the company page
            uses) so a banner-less shop never shows a blank strip. */}
        <div
          className="relative h-40 w-full overflow-hidden sm:h-52"
          style={{ background: storefront.banner ? undefined : 'var(--cr-grad-hero)' }}
        >
          {storefront.banner ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded banner creative; next/image adds no optimisation here
            <img
              src={storefront.banner}
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
            />
          ) : (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1080 220"
              preserveAspectRatio="none"
              aria-hidden
            >
              <circle
                cx="120"
                cy="44"
                r="120"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeDasharray="2 11"
                opacity="0.22"
              />
              <circle
                cx="900"
                cy="186"
                r="150"
                fill="none"
                stroke="var(--cr-gold-400)"
                strokeWidth="1.2"
                strokeDasharray="2 12"
                opacity="0.4"
              />
              <circle
                cx="560"
                cy="110"
                r="200"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="2 13"
                opacity="0.15"
              />
            </svg>
          )}
        </div>

        {/* Identity header -- the logo overlaps the hero cover; the name + meta
            sit BELOW the banner so they stay readable. Only the logo carries
            `relative z-[1]`, lifting it in front of the position:relative cover. */}
        <header className="flex flex-wrap items-start gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <div
            className="relative z-[1] -mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden sm:-mt-14"
            style={{
              borderRadius: 'var(--cr-radius-md)',
              border: '4px solid var(--cr-surface)',
              background: 'var(--cr-surface-2)',
              boxShadow: 'var(--cr-shadow-md)',
            }}
          >
            {storefront.logo ? (
              // alt="" : decorative - the shop name is the adjacent <h1>, so a
              // non-empty alt would make a screen reader announce it twice.
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo creative; next/image adds no optimisation here
              <img
                src={storefront.logo}
                alt=""
                aria-hidden
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                style={{ fontSize: 34, fontWeight: 700, color: 'var(--cr-text-4)' }}
              >
                {storefront.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {storefront.name}
            </h1>
            {storefront.isDemo && (
              <div className="mt-1.5">
                <SampleBadge size="md" />
              </div>
            )}
            {location && (
              <p
                className="m-0 mt-0.5 inline-flex items-center gap-1 text-[13px]"
                style={{ color: 'var(--cr-text-4)' }}
              >
                <MapPin size={13} aria-hidden />
                {location}
              </p>
            )}
            {/* Trust row: real, derivable signals (product count, member-since) +
                the ERP-linked badge. No rating / response-time (those need data
                that does not exist yet). */}
            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]"
              style={{ color: 'var(--cr-text-4)' }}
            >
              <span>{t('productsCount', { count: visible.length })}</span>
              {memberSince && (
                <>
                  <span aria-hidden>·</span>
                  <span>{t('memberSince', { year: memberSince })}</span>
                </>
              )}
              {erpLinked && <TrustBadgeRow badges={['erp']} />}
            </div>
            {rating && rating.ratingCount > 0 && (
              <div className="mt-1.5">
                <RatingStars
                  value={rating.ratingAvg}
                  count={rating.ratingCount}
                  size={15}
                  showCount
                />
              </div>
            )}
          </div>
          {/* Store-level buyer contact: lands on the seller's Connect profile,
              where the buyer can reach them (there is no store-level inquiry).
              PAUSED 2026-06-05 - "Contact seller" commented out per owner request.
              Revive via `rg "PAUSED 2026-06-05 - Contact seller"`; restore the
              `import DsButton from '@/components/ui/DsButton'` (the only use). The
              `t('contactSeller')` i18n key is left in place for the revival. */}
          {/* <DsButton
            dsVariant="primary"
            dsSize="sm"
            href={`/connect/u/${storefront.ownerUserId}`}
            className="shrink-0 pt-0 sm:ms-auto sm:self-center"
          >
            {t('contactSeller')}
          </DsButton> */}
        </header>
      </section>

      {/* Tab bar - a tinted pill track matching the Company Page view, only when
          more than one tab has content (always true here: Products + Reviews). */}
      {tabs.length > 1 && (
        <div className="mt-6 overflow-x-auto overflow-y-hidden px-4 py-1">
          <nav
            role="tablist"
            aria-label={storefront.name}
            className="inline-flex gap-1 p-1"
            style={{
              background: 'var(--cr-surface-2)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-full)',
            }}
          >
            {tabs.map((k) => {
              const isActive = activeTab === k;
              const Icon = TAB_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectTab(k)}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--cr-text)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--cr-text-4)';
                  }}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-0 px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors"
                  style={{
                    borderRadius: 'var(--cr-radius-full)',
                    background: isActive ? 'var(--cr-surface)' : 'transparent',
                    color: isActive ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                    boxShadow: isActive ? 'var(--cr-shadow-sm)' : 'none',
                  }}
                >
                  <Icon
                    size={15}
                    aria-hidden
                    style={{ color: isActive ? 'var(--cr-primary)' : 'var(--cr-text-4)' }}
                  />
                  {k === 'reviews' ? tReviews('title') : t(`tabs.${k}`)}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* About (Overview tab) */}
      {shows('overview') && storefront.description?.trim() && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-2 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('about')}
          </h2>
          <p
            className="m-0 text-[14px] leading-relaxed whitespace-pre-line"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {storefront.description}
          </p>
        </section>
      )}

      {/* Categories (Overview tab) -- a labelled chip group (heading mirrors the
          About / company-page section rhythm). Bordered chips with a tag glyph
          so the categories read as deliberate tags, not loose text. */}
      {shows('overview') && storefront.categories?.length > 0 && (
        <section className="mt-6 px-4">
          <h2
            className="m-0 mb-2.5 pb-1 text-[15px] font-semibold"
            style={{ color: 'var(--cr-text)' }}
          >
            {t('categoriesTitle')}
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {storefront.categories.map((c) => (
              <li key={c}>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium"
                  style={{
                    background: 'var(--cr-surface-2)',
                    border: '1px solid var(--cr-border)',
                    color: 'var(--cr-text-2)',
                  }}
                >
                  <Tag size={12} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
                  {c}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ERP-verified note (Overview tab) -- honest trust context (an active
          linked ERP account, not a paid placement); the same block the company
          page shows. Only for ERP-linked shops. */}
      {shows('overview') && erpLinked && (
        <section className="mt-6 px-4">
          <div
            className="flex items-start gap-3 p-4"
            style={{
              background: 'var(--cr-wash-indigo)',
              border: '1px solid var(--cr-primary-border)',
              borderRadius: 'var(--cr-radius-md)',
            }}
          >
            <BadgeCheck
              size={18}
              aria-hidden
              style={{ color: 'var(--cr-primary)', flex: 'none', marginTop: 1 }}
            />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                {t('erpNoteTitle')}
              </div>
              <p
                className="m-0 mt-1 text-[12.5px] leading-relaxed"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {t('erpNoteBody')}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Products (Products tab) */}
      {shows('products') && (
        <section className="mt-6 px-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
              {t('products')}
              {visible.length > 0 && (
                <span style={{ color: 'var(--cr-text-4)', fontWeight: 500 }}>
                  {' '}
                  · {visible.length}
                </span>
              )}
            </h2>
            {/* Sort control appears once there is more than one product to order. */}
            {visible.length > 1 && (
              <label
                className="flex items-center gap-1.5 text-[12.5px]"
                style={{ color: 'var(--cr-text-4)' }}
              >
                <span>{t('sortLabel')}</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-md px-2 py-1 text-[12.5px]"
                  style={{
                    border: '1px solid var(--cr-border-light)',
                    background: 'var(--cr-surface)',
                    color: 'var(--cr-text-2)',
                  }}
                >
                  <option value="recent">{t('sortRecent')}</option>
                  <option value="priceLow">{t('sortPriceLow')}</option>
                  <option value="priceHigh">{t('sortPriceHigh')}</option>
                </select>
              </label>
            )}
          </div>

          {/* Collection tabs: the shop's own product groups. Horizontally
            scrollable so a big catalog's collections never wrap into a wall. */}
          {browseCollections.length > 0 && (
            <div
              className="mb-3 flex gap-1.5 overflow-x-auto pb-1"
              role="group"
              aria-label={t('collectionsLabel')}
            >
              <CollectionTab
                active={activeCollection === null}
                onClick={() => selectCollection(null)}
              >
                {t('filterAll')}
              </CollectionTab>
              {browseCollections.map((c) => (
                <CollectionTab
                  key={c.id}
                  active={activeCollection === c.id}
                  count={c.productCount}
                  onClick={() => selectCollection(c.id)}
                >
                  {c.title}
                </CollectionTab>
              ))}
            </div>
          )}

          {/* Active-collection banner: its optional cover + description, so a
            selected collection reads as its own little storefront. */}
          {activeCollectionMeta &&
            (activeCollectionMeta.coverImage || activeCollectionMeta.description) && (
              <div
                className="mb-4 overflow-hidden"
                style={{
                  borderRadius: 'var(--cr-radius-lg)',
                  border: '1px solid var(--cr-border-light)',
                }}
              >
                {activeCollectionMeta.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded collection cover
                  <img
                    src={activeCollectionMeta.coverImage}
                    alt=""
                    aria-hidden
                    className="h-28 w-full object-cover sm:h-36"
                  />
                )}
                {activeCollectionMeta.description && (
                  <p
                    className="m-0 px-4 py-3 text-[13px] leading-relaxed"
                    style={{ color: 'var(--cr-text-3)' }}
                  >
                    {activeCollectionMeta.description}
                  </p>
                )}
              </div>
            )}

          {shown.length === 0 ? (
            <p className="m-0 text-[14px]" style={{ color: 'var(--cr-text-4)' }}>
              {activeCollection ? t('noProductsInCollection') : t('noProducts')}
            </p>
          ) : (
            <ul
              className="m-0 grid list-none gap-3 p-0"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
            >
              {shown.map((l) => (
                <li key={l.listingId} className="flex">
                  <ListingGridCard listing={l} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Reviews & Ratings (Reviews tab) -- buyers rate the seller by
          ownerUserId; the same component the company page + profile use. */}
      {shows('reviews') && (
        <section className="mt-6 px-4">
          <SellerReviews
            subjectUserId={storefront.ownerUserId}
            subjectName={storefront.name}
            initialAggregate={rating}
          />
        </section>
      )}
    </article>
  );
}
