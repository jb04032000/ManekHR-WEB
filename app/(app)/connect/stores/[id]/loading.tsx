import { SkeletonLine, SkeletonRailPanel } from '@/components/connect/Skeleton';

/** One glance-strip stat tile placeholder: icon chip + value + label - mirrors
 *  the StatTile in ManageStorefrontScreen. */
function StatTileSkeleton() {
  return (
    <div
      className="flex h-full items-center gap-2.5 rounded-lg p-3.5"
      style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
    >
      <div
        className="skeleton h-[34px] w-[34px] shrink-0"
        style={{ borderRadius: 'var(--cr-radius-md)' }}
      />
      <div className="flex flex-col gap-1.5">
        <SkeletonLine w={28} h={20} />
        <SkeletonLine w={64} h={11} />
      </div>
    </div>
  );
}

/**
 * Loading UI for the manage-storefront console (`/connect/stores/[id]`). Mirrors
 * ManageStorefrontScreen: breadcrumb, title + status pill, the public-URL row,
 * the four-tile glance strip, the tab bar, a content block, and the right rail.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Breadcrumb */}
        <SkeletonLine w={160} h={13} style={{ marginBottom: 10 }} />

        {/* Title + status pill */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <SkeletonLine w={180} h={26} />
          <SkeletonLine w={76} h={26} radius={999} />
        </div>

        {/* Public-URL row: address field + view button */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SkeletonLine w={260} h={34} radius={8} />
          <SkeletonLine w={150} h={34} radius={8} />
        </div>

        {/* Four-tile glance strip */}
        <div
          className="mb-4 grid items-stretch gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))' }}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>

        {/* Tab bar */}
        <div className="mb-5 flex gap-2">
          {[88, 96, 104, 92].map((w, i) => (
            <SkeletonLine key={i} w={w} h={30} radius={8} />
          ))}
        </div>

        {/* Content block */}
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 140, borderRadius: 'var(--cr-radius-lg)' }}
            />
          ))}
        </div>
      </main>

      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div className="flex flex-col gap-4">
          <SkeletonRailPanel titleW={90} rows={2} />
          <SkeletonRailPanel titleW={120} rows={3} />
        </div>
      </aside>
    </div>
  );
}
