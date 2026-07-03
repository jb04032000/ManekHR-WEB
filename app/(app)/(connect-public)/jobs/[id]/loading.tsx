/**
 * Public job page loading skeleton. Mirrors `/jobs/[id]` section-for-section
 * (share row, then the JobDetailScreen hero card + sectioned detail cards) so
 * the swap to content is shift-free. Server-only - composes the shared Skeleton
 * primitives, no client code. Keep in sync with JobDetailScreen's section order.
 */
import { SkeletonButton, SkeletonCard, SkeletonLine } from '@/components/connect/Skeleton';

export default function PublicJobLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-3 flex justify-end">
        <SkeletonButton w={160} h={32} />
      </div>
      {/* Hero card: title + status + employer + spec strip */}
      <SkeletonCard style={{ padding: 'var(--cr-space-lg)' }}>
        <SkeletonLine w="60%" h={24} />
        <SkeletonLine w="40%" h={12} style={{ marginTop: 10 }} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonLine key={i} w="100%" h={44} radius={8} />
          ))}
        </div>
      </SkeletonCard>
      {/* Sectioned cards: About / Requirements / Pay / Company */}
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonCard
          key={i}
          style={{ marginTop: 'var(--cr-space-md)', padding: 'var(--cr-space-lg)' }}
        >
          <SkeletonLine w={140} h={14} />
          <div className="mt-3 flex flex-col gap-2">
            <SkeletonLine w="100%" h={11} />
            <SkeletonLine w="90%" h={11} />
            <SkeletonLine w="75%" h={11} />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
