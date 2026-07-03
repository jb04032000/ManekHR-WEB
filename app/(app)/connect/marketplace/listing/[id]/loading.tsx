/**
 * Listing detail loading skeleton. Mirrors ListingDetailScreen section-for-
 * section so the swap to content is shift-free: breadcrumb, then the two-column
 * grid - LEFT: gallery card (framed hero + thumb row), title/summary card,
 * specifications card, description card, reviews card; RIGHT (rail): buy box,
 * seller card, trade terms, more-from-shop rows. Wrapper matches ConnectPage
 * (mx-auto + --cn-content-max-w, no extra padding - the shell owns it).
 * Server-only - composes the shared Skeleton primitives, no client code.
 */
import {
  SkeletonButton,
  SkeletonCard,
  SkeletonCircle,
  SkeletonLine,
} from '@/components/connect/Skeleton';

export default function ListingDetailLoading() {
  return (
    <div
      aria-hidden
      className="mx-auto w-full"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
    >
      {/* Breadcrumb: shop > product */}
      <div className="mb-2 flex items-center gap-1.5">
        <SkeletonLine w={110} h={11} />
        <SkeletonLine w={10} h={11} />
        <SkeletonLine w={180} h={11} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] lg:gap-10">
        {/* Left: gallery card, title card, specs, description, reviews */}
        <div className="min-w-0">
          {/* Gallery card: framed 4:3 hero + thumbnail row */}
          <SkeletonCard style={{ padding: 14 }}>
            <div
              className="skeleton"
              style={{
                width: '100%',
                aspectRatio: '4 / 3',
                maxHeight: 520,
                borderRadius: 'var(--cr-radius-md)',
              }}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonLine key={i} w={64} h={64} radius={8} />
              ))}
            </div>
          </SkeletonCard>

          {/* Title / summary card: eyebrow, h1, rating + location row, tag chips */}
          <SkeletonCard style={{ marginTop: 'var(--cr-space-md)', padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={120} h={10} />
            <SkeletonLine w="70%" h={22} style={{ marginTop: 10 }} />
            <SkeletonLine w="45%" h={12} style={{ marginTop: 10 }} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonLine key={i} w={72} h={24} radius={999} />
              ))}
            </div>
          </SkeletonCard>

          {/* Course card (Institutes Phase 1): heading + fact grid; shown only on
              a course listing, mirrored here so the swap stays shift-free. */}
          <SkeletonCard style={{ marginTop: 'var(--cr-space-md)', padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={130} h={14} />
            <div
              className="mt-3 grid gap-2.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonLine key={i} w="100%" h={30} radius={6} />
              ))}
            </div>
          </SkeletonCard>

          {/* Specifications card: heading + 2-col label/value grid */}
          <SkeletonCard style={{ marginTop: 'var(--cr-space-md)', padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={130} h={14} />
            <div
              className="mt-3 grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonLine key={i} w="100%" h={36} radius={8} />
              ))}
            </div>
          </SkeletonCard>

          {/* Description card */}
          <SkeletonCard style={{ marginTop: 'var(--cr-space-md)', padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={150} h={14} />
            <div className="mt-3 flex flex-col gap-2">
              <SkeletonLine w="100%" h={11} />
              <SkeletonLine w="95%" h={11} />
              <SkeletonLine w="80%" h={11} />
            </div>
          </SkeletonCard>

          {/* Reviews card: heading + score panel (avg + bars) + one review row */}
          <SkeletonCard style={{ marginTop: 'var(--cr-space-md)', padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={160} h={14} />
            <div className="mt-4 flex items-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <SkeletonLine w={56} h={34} />
                <SkeletonLine w={70} h={10} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <SkeletonLine key={i} w="100%" h={6} radius={3} />
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <SkeletonCircle size={36} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <SkeletonLine w="40%" h={11} />
                <SkeletonLine w="90%" h={11} />
                <SkeletonLine w="70%" h={11} />
              </div>
            </div>
          </SkeletonCard>
        </div>

        {/* Right rail: buy box, seller, trade terms, more-from-shop */}
        <aside className="flex flex-col gap-4 self-start">
          {/* Buy box: price, MOQ banner, qty + estimate, CTA, share, trust */}
          <SkeletonCard style={{ padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={150} h={26} />
            <SkeletonLine w="100%" h={38} radius={8} style={{ marginTop: 12 }} />
            <SkeletonLine w={70} h={10} style={{ marginTop: 14 }} />
            <SkeletonLine w={140} h={34} radius={8} style={{ marginTop: 6 }} />
            <div className="mt-3 flex items-baseline justify-between">
              <SkeletonLine w={90} h={11} />
              <SkeletonLine w={70} h={15} />
            </div>
            <div style={{ marginTop: 14 }}>
              <SkeletonButton w="100%" h={48} />
            </div>
            <div className="mt-2 flex gap-2">
              <SkeletonButton w={90} h={28} />
              <SkeletonButton w={110} h={28} />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <SkeletonLine w="80%" h={10} />
              <SkeletonLine w="70%" h={10} />
            </div>
          </SkeletonCard>

          {/* Seller card: heading, avatar row, member-since, store link */}
          <SkeletonCard style={{ padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={60} h={10} />
            <div className="mt-3 flex items-center gap-3">
              <SkeletonCircle size={44} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <SkeletonLine w="60%" h={12} />
                <SkeletonLine w="80%" h={10} />
              </div>
            </div>
            <SkeletonLine w={130} h={10} style={{ marginTop: 12 }} />
            <SkeletonLine w={100} h={11} style={{ marginTop: 10 }} />
          </SkeletonCard>

          {/* Trade terms: heading + 3 icon rows */}
          <SkeletonCard style={{ padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={90} h={10} />
            <div className="mt-3 flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <SkeletonLine w={16} h={16} radius={4} />
                  <SkeletonLine w="85%" h={11} />
                </div>
              ))}
            </div>
          </SkeletonCard>

          {/* More from this shop: heading + compact product rows + view-all */}
          <SkeletonCard style={{ padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={130} h={10} />
            <div className="mt-3 flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <SkeletonLine w={48} h={48} radius={8} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <SkeletonLine w="80%" h={11} />
                    <SkeletonLine w="40%" h={10} />
                  </div>
                </div>
              ))}
            </div>
            <SkeletonLine w={80} h={11} style={{ marginTop: 12 }} />
          </SkeletonCard>
        </aside>
      </div>
    </div>
  );
}
