'use client';

/**
 * CategoryStrip - the marketplace's horizontally-scrollable category icon pills
 * (redesign). Owns the `?category=` URL facet (single-select, mirrors the
 * backend facet); the active pill clears on a second tap. Counts are omitted
 * until a `categoryCounts` facet lands (no fabricated numbers). This is the ONE
 * place category is selected (the filter rail no longer carries category).
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Boxes,
  Briefcase,
  Cog,
  Droplets,
  GraduationCap,
  Hammer,
  Layers,
  LayoutGrid,
  Printer,
  Scissors,
  Shirt,
  Sparkles,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { MARKETPLACE_CATEGORY_PILLS, SERVICE_CATEGORY_SLUGS } from '../search.types';

const CATEGORY_ICON: Record<string, LucideIcon> = {
  weaving: Layers,
  dyeing: Droplets,
  printing: Printer,
  'embroidery-zari': Sparkles,
  'job-work': Scissors,
  'raw-material': Boxes,
  machinery: Cog,
  'finished-goods': Shirt,
  // Institutes Phase 1: the training-course category pill.
  course: GraduationCap,
  // Service categories (Slice B3) - used when CategoryStrip drives the Services
  // browse (/connect/services) service-type sub-filter. Re-used trade icons for
  // the shared categories (dyeing/printing/embroidery/job-work) come from above.
  consulting: Briefcase,
  maintenance: Wrench,
  'machine-repair': Wrench,
  testing: Boxes,
  installation: Hammer,
  transport: Truck,
  logistics: Truck,
  contractor: Hammer,
};

/**
 * categoryCounts: real per-category listing counts (backend facet distribution),
 * rendered on each pill (e.g. "Zari & kasab 86"). Corpus-wide on the bare
 * landing; narrowed to the active filter set on the search path. Absent / empty
 * => pills render with no count (honest: never a fabricated number). Keys are
 * the canonical category slugs.
 *
 * mode (Slice B3): `'marketplace'` (default) keeps the original behavior - all 9
 * LISTING_CATEGORIES, pushing to /connect/marketplace. `'services'` drives the
 * Services browse (/connect/services): only the SERVICE_CATEGORY_SLUGS render
 * (the service-type sub-filter), the "All" pill reads "All services", and pushes
 * go to /connect/services. Both modes own the SAME `?category=` single-select
 * facet, so the service-type filter maps straight to the existing BE category
 * filter - no new endpoint.
 */
interface CategoryStripProps {
  categoryCounts?: Record<string, number>;
  mode?: 'marketplace' | 'services';
}

export default function CategoryStrip({
  categoryCounts,
  mode = 'marketplace',
}: CategoryStripProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCat = useTranslations('connect.search.listing.category');
  const tMk = useTranslations('connect.marketplace');
  const active = searchParams.get('category');

  const isServices = mode === 'services';
  const basePath = isServices ? '/connect/services' : '/connect/marketplace';
  // The service-type sub-filter is the service-category set; marketplace shows the
  // original product-category pills (not the service categories - those live on
  // /connect/services).
  const categories: readonly string[] = isServices
    ? SERVICE_CATEGORY_SLUGS
    : MARKETPLACE_CATEGORY_PILLS;

  const go = (category: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (category && category !== active) params.set('category', category);
    else params.delete('category');
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  // "All" shows the corpus total (sum) only when real counts are present. In
  // services mode the counts may include non-service categories (the facet is
  // corpus-wide), so sum only the service slugs to keep the "All services" tally
  // honest to what this strip filters by.
  const hasCounts = Boolean(categoryCounts && Object.keys(categoryCounts).length > 0);
  const totalCount = hasCounts
    ? categories.reduce((a, c) => a + (categoryCounts?.[c] ?? 0), 0)
    : undefined;

  return (
    <nav
      className="mb-4 flex gap-2 overflow-x-auto pb-1.5"
      aria-label={isServices ? tMk('services.categoriesAria') : tMk('categoriesAria')}
    >
      <Pill active={!active} onClick={() => go(null)} Icon={LayoutGrid} count={totalCount}>
        {isServices ? tMk('services.categoryAll') : tMk('categoryAll')}
      </Pill>
      {categories.map((c) => (
        <Pill
          key={c}
          active={active === c}
          onClick={() => go(c)}
          Icon={CATEGORY_ICON[c]}
          count={categoryCounts?.[c]}
        >
          {tCat(c)}
        </Pill>
      ))}
    </nav>
  );
}

function Pill({
  active,
  onClick,
  Icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  Icon: LucideIcon;
  /** Real listing count for this category; omitted (undefined) renders no number. */
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex h-[38px] shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors"
      style={{
        border: '1px solid var(--cr-border-light)',
        background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
        color: active ? 'var(--cr-on-primary, #fff)' : 'var(--cr-text-2)',
      }}
    >
      <Icon
        size={15}
        aria-hidden
        style={{ color: active ? 'var(--cn-gold, #e6c46a)' : 'var(--cn-gold, #b8860b)' }}
      />
      {children}
      {typeof count === 'number' && (
        <span
          className="tabular-nums"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: active ? 'var(--cr-on-primary, #fff)' : 'var(--cr-text-4)',
            opacity: active ? 0.85 : 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
