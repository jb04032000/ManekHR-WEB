import { SkeletonLine, SkeletonButton } from '@/components/connect/Skeleton';

/** One EntityHubCard placeholder: cover band + overlapping logo, name/location,
 *  a status pill, the three-stat row, the public-address row, and the footer
 *  actions - mirrors the shared `EntityHubCard` the Storefronts hub now uses
 *  (same shape as the Company Pages hub skeleton). */
function HubCardSkeleton() {
  return (
    <li
      className="flex flex-col overflow-hidden"
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
      }}
    >
      <div className="skeleton h-14 w-full" style={{ borderRadius: 0 }} />
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        <div
          className="-mt-6 h-[58px] w-[58px]"
          style={{
            borderRadius: 'var(--cr-radius-lg)',
            padding: 3,
            background: 'var(--cr-surface)',
          }}
        >
          <div className="skeleton h-full w-full" style={{ borderRadius: 'var(--cr-radius-md)' }} />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonLine w="55%" h={15} />
          <SkeletonLine w={56} h={18} radius={999} />
        </div>
        <SkeletonLine w="45%" h={12} />
        <div
          className="mt-2.5 flex gap-6 border-t pt-2.5"
          style={{ borderColor: 'var(--cr-divider)' }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <SkeletonLine w={26} h={16} />
              <SkeletonLine w={42} h={10} />
            </div>
          ))}
        </div>
        <div
          className="mt-2.5 h-8 w-full"
          style={{ background: 'var(--cr-surface-2)', borderRadius: 'var(--cr-radius-md)' }}
        />
        <div className="mt-2.5 flex items-center gap-2">
          <SkeletonLine w="100%" h={38} radius={8} style={{ flex: 1 }} />
          <SkeletonButton w={140} h={38} />
        </div>
      </div>
    </li>
  );
}

/** Loading UI for the Storefronts hub (`/connect/stores`). Mirrors StoresHub:
 *  header + create CTA, the four-KPI strip, the owned-store card grid, and the
 *  right-rail next-steps panel. */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Header: title + subtitle, create button on the right. */}
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <SkeletonLine w={180} h={22} />
            <SkeletonLine w={300} h={13} />
          </div>
          <SkeletonButton w={150} h={38} />
        </header>

        {/* KPI strip (4 metrics). */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 p-3.5"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-lg)',
              }}
            >
              <div className="flex items-center gap-2">
                <div className="skeleton h-6 w-6" style={{ borderRadius: 'var(--cr-radius-md)' }} />
                <SkeletonLine w={36} h={24} />
              </div>
              <SkeletonLine w={64} h={11} />
            </div>
          ))}
        </div>

        {/* Owned-store card grid. */}
        <ul
          className="m-0 grid list-none gap-3 p-0"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
        >
          {Array.from({ length: 3 }, (_, i) => (
            <HubCardSkeleton key={i} />
          ))}
        </ul>
      </main>

      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div
          style={{
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-lg)',
            background: 'var(--cr-surface)',
            padding: 'var(--cr-space-md)',
          }}
        >
          <SkeletonLine w={110} h={12} />
          <div className="mt-3 flex flex-col gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonLine key={i} w="90%" h={12} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
