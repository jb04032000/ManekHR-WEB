import { SkeletonLine, SkeletonButton, SkeletonCircle } from '@/components/connect/Skeleton';

/**
 * Loading UI for `/connect/marketplace` (the buyer browse page). Mirrors
 * MarketplaceBrowseScreen section-for-section: the gold hero (title + subtitle +
 * search band), the category strip, the "how buying works" band, then the
 * 2-column body (filter rail + product grid), and the right safety rail. Plain
 * server markup (no client components); root aria-hidden. Keep in sync with
 * features/connect/marketplace/MarketplaceBrowseScreen.tsx if that layout changes.
 */

const CARD = {
  background: 'var(--cr-surface)',
  border: '1px solid var(--cr-border)',
  borderRadius: 'var(--cr-radius-lg)',
} as const;

/** One product card placeholder: cover image + category eyebrow + 2-line title +
 *  price + a meta row - mirrors ListingGridCard. */
function ProductCardSkeleton() {
  return (
    <li className="flex">
      <div className="flex w-full flex-col overflow-hidden" style={CARD}>
        <div className="skeleton w-full" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
        <div className="flex flex-1 flex-col gap-2 p-3">
          <SkeletonLine w={60} h={10} />
          <SkeletonLine w="92%" h={13} />
          <SkeletonLine w="55%" h={13} />
          <SkeletonLine w={84} h={16} />
          <div className="mt-1 flex items-center gap-2">
            <SkeletonLine w={70} h={10} />
            <SkeletonLine w={50} h={10} />
          </div>
        </div>
      </div>
    </li>
  );
}

export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Hero: gold band with title + subtitle + the search band. */}
        <header
          className="mb-4 overflow-hidden"
          style={{
            borderRadius: 'var(--cr-radius-lg)',
            border: '1px solid var(--cr-gold-100, var(--cr-border))',
            background: 'linear-gradient(135deg, var(--cr-gold-100) 0%, var(--cr-surface) 62%)',
            padding: 'var(--cr-space-lg) var(--cr-space-lg) var(--cr-space-md)',
          }}
        >
          <SkeletonLine w={200} h={24} />
          <div className="mt-2">
            <SkeletonLine w={320} h={13} />
          </div>
          <div
            className="mt-4 flex items-center gap-2"
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              padding: '8px 8px 8px 14px',
            }}
          >
            <SkeletonCircle size={18} />
            <SkeletonLine w="45%" h={14} />
            <div className="ml-auto">
              <SkeletonButton w={90} h={34} />
            </div>
          </div>
        </header>

        {/* Category strip (horizontally-scrollable chips). */}
        <div className="mb-4 flex gap-2 overflow-hidden pb-1.5">
          {[110, 96, 120, 88, 104, 92, 116, 84].map((w, i) => (
            <SkeletonLine key={i} w={w} h={38} radius={999} />
          ))}
        </div>

        {/* "How buying works" band (3 steps). */}
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 p-3" style={CARD}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <SkeletonCircle size={18} />
              <SkeletonLine w={130} h={12} />
            </div>
          ))}
        </div>

        {/* Body: filter rail + product grid. grid-cols-1 base keeps the mobile
            column shrinkable so the skeleton matches the page and never flashes
            wider than the viewport. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* Filter rail. */}
          <div className="flex flex-col gap-4 p-4" style={CARD}>
            <SkeletonLine w={90} h={12} />
            {[0, 1, 2, 3].map((g) => (
              <div key={g} className="flex flex-col gap-2">
                <SkeletonLine w={100} h={12} />
                <div className="flex flex-wrap gap-1.5">
                  {[56, 64, 48, 72].map((w, i) => (
                    <SkeletonLine key={i} w={w} h={26} radius={999} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Results: toolbar (count + sort) + product grid. */}
          <div className="min-w-0">
            <div className="mb-3.5 flex items-center justify-between">
              <SkeletonLine w={120} h={13} />
              <SkeletonLine w={140} h={28} radius={8} />
            </div>
            <ul
              className="m-0 grid list-none gap-3 p-0"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </ul>
          </div>
        </div>
      </main>

      {/* Right rail: the buyer-safety panel. */}
      <aside
        className="hidden shrink-0 lg:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div style={{ ...CARD, padding: 'var(--cr-space-md)' }}>
          <SkeletonLine w={120} h={12} />
          <div className="mt-3 flex flex-col gap-2">
            <SkeletonLine w="100%" h={11} />
            <SkeletonLine w="85%" h={11} />
            <SkeletonLine w="70%" h={11} />
          </div>
        </div>
      </aside>
    </div>
  );
}
