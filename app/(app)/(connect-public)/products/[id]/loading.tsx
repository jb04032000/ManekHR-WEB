/**
 * Public product page loading skeleton. Mirrors `/products/[id]` section-for-
 * section (share row, then the two-column ListingDetailScreen: gallery + detail
 * cards left, buy box + seller rail right) so the swap to content is shift-free.
 * Server-only - composes the shared Skeleton primitives, no client code.
 * Keep in sync with app/connect/marketplace/listing/[id]/loading.tsx.
 */
import {
  SkeletonButton,
  SkeletonCard,
  SkeletonCircle,
  SkeletonLine,
} from '@/components/connect/Skeleton';

export default function PublicProductLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-3 flex justify-end">
        <SkeletonButton w={160} h={32} />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="min-w-0">
          <SkeletonCard style={{ padding: 14 }}>
            <div
              className="skeleton"
              style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--cr-radius-md)' }}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonLine key={i} w={64} h={64} radius={8} />
              ))}
            </div>
          </SkeletonCard>
          <SkeletonCard style={{ marginTop: 'var(--cr-space-md)', padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={120} h={10} />
            <SkeletonLine w="70%" h={22} style={{ marginTop: 10 }} />
            <SkeletonLine w="45%" h={12} style={{ marginTop: 10 }} />
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
        </div>
        <aside className="flex flex-col gap-4 self-start">
          <SkeletonCard style={{ padding: 'var(--cr-space-lg)' }}>
            <SkeletonLine w={150} h={26} />
            <div style={{ marginTop: 14 }}>
              <SkeletonButton w="100%" h={48} />
            </div>
          </SkeletonCard>
          <SkeletonCard style={{ padding: 'var(--cr-space-lg)' }}>
            <div className="flex items-center gap-3">
              <SkeletonCircle size={44} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <SkeletonLine w="60%" h={12} />
                <SkeletonLine w="80%" h={10} />
              </div>
            </div>
          </SkeletonCard>
        </aside>
      </div>
    </div>
  );
}
