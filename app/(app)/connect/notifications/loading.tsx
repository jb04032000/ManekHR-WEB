import {
  SkeletonButton,
  SkeletonCard,
  SkeletonCircle,
  SkeletonLine,
  SkeletonRailPanel,
} from '@/components/connect/Skeleton';

/**
 * Route-level loading UI for `/connect/notifications`. Mirrors the live
 * `NotificationsScreen` section-for-section so the swap is shift-free: a
 * flex-1 main (header actions + tab strip + two day-groups of rich rows) and
 * the right rail (ad floor panel). Keep in sync with NotificationsScreen.tsx.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5 md:min-h-[calc(100dvh-12rem)]"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Header - title + subtitle on the left, the three ghost actions right. */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <SkeletonLine w={150} h={22} />
            <SkeletonLine w={240} h={13} style={{ marginTop: 6 }} />
          </div>
          <div className="flex gap-2">
            <SkeletonButton w={120} h={32} />
            <SkeletonButton w={96} h={32} />
            <SkeletonButton w={96} h={32} />
          </div>
        </div>

        {/* Tab strip - a row of pill tabs. */}
        <div className="mb-4 flex gap-2">
          {[64, 76, 96, 84, 72, 96].map((w, i) => (
            <SkeletonLine key={i} w={w} h={28} radius={999} />
          ))}
        </div>

        {/* Two day-groups, each a header + count and three rich rows. */}
        {[0, 1].map((g) => (
          <div key={g} className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <SkeletonLine w={90} h={11} />
              <SkeletonLine w={16} h={11} />
            </div>
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <SkeletonCircle size={36} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <SkeletonLine w="45%" h={14} />
                      <SkeletonLine w="85%" h={12} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
                        <SkeletonLine w={56} h={10} />
                        <SkeletonLine w={84} h={24} radius={6} />
                      </div>
                    </div>
                  </div>
                </SkeletonCard>
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* Right rail - the always-present ad floor panel. */}
      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <SkeletonRailPanel titleW={130} rows={3} />
      </aside>
    </div>
  );
}
