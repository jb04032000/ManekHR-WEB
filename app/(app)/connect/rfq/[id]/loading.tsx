import {
  SkeletonButton,
  SkeletonCard,
  SkeletonLine,
  SkeletonRailPanel,
} from '@/components/connect/Skeleton';

/**
 * Route-level loading UI for `/connect/rfq/[id]` (the request detail). Mirrors
 * RfqDetailScreen section-for-section: back link, the request card (title +
 * status tag, category chip, description lines, the budget/needed-by/location
 * definition grid), then the quotes section heading + two quote cards, plus the
 * right rail panel. Server-only; shared Skeleton primitives.
 */
export default function Loading() {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
    >
      <main className="min-w-0 flex-1">
        <div className="mb-3">
          <SkeletonLine w={110} h={12} />
        </div>

        {/* Request card. */}
        <SkeletonCard style={{ padding: 20 }}>
          <div className="flex items-start justify-between gap-3">
            <SkeletonLine w="55%" h={20} />
            <SkeletonLine w={70} h={22} radius={999} />
          </div>
          <div className="mt-3 flex gap-1.5">
            <SkeletonLine w={110} h={22} radius={999} />
            <SkeletonLine w={70} h={22} radius={999} />
          </div>
          {/* key-facts strip (quantity / budget / deliver-to / need-by). */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonLine key={i} w="100%" h={52} radius="var(--cr-radius-md)" />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <SkeletonLine w={110} h={10} />
            <SkeletonLine w="95%" h={12} />
            <SkeletonLine w="80%" h={12} />
          </div>
        </SkeletonCard>

        {/* Quotes section. */}
        <div className="mt-6 mb-3">
          <SkeletonLine w={140} h={16} />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <SkeletonCard key={i}>
              <div className="flex items-start justify-between gap-2">
                <SkeletonLine w={110} h={16} />
                <SkeletonLine w={80} h={22} radius={999} />
              </div>
              <div className="mt-2 flex flex-col gap-2">
                <SkeletonLine w="50%" h={11} />
                <SkeletonLine w="75%" h={11} />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <SkeletonButton w={92} h={32} />
                <SkeletonButton w={92} h={32} />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </main>

      <aside className="hidden w-[300px] shrink-0 xl:block">
        <SkeletonRailPanel titleW={140} rows={3} />
      </aside>
    </div>
  );
}
