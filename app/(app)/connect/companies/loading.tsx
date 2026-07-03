import { SkeletonLine, SkeletonButton } from '@/components/connect/Skeleton';

/** One company-card placeholder: cover band + overlapping logo, name, a meta
 *  line, two about lines, a tag row, the three-stat row, and a footer action -
 *  mirrors `CompanyCard` so the swap to content is shift-free. */
function CompanyCardSkeleton() {
  return (
    <li
      className="flex flex-col overflow-hidden"
      style={{
        border: '1px solid var(--cr-border-light)',
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
        <SkeletonLine w="60%" h={15} />
        <SkeletonLine w="45%" h={12} />
        <div className="mt-1 flex flex-col gap-1.5">
          <SkeletonLine w="100%" h={11} />
          <SkeletonLine w="80%" h={11} />
        </div>
        <div className="mt-1 flex gap-1.5">
          <SkeletonLine w={62} h={20} radius={999} />
          <SkeletonLine w={52} h={20} radius={999} />
        </div>
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
        <div className="mt-3">
          <SkeletonButton w={96} h={32} />
        </div>
      </div>
    </li>
  );
}

/** Loading UI for the company directory (`/connect/companies`). Mirrors
 *  CompanyDirectoryScreen: header + create CTA, search band, the specialization
 *  strip, then the left filter rail + the company-card grid, and the right
 *  promote rail. */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <SkeletonLine w={200} h={28} />
            <SkeletonLine w={320} h={13} />
          </div>
          <SkeletonButton w={150} h={32} />
        </header>

        {/* Search band. */}
        <div
          className="mb-4 h-[52px] w-full"
          style={{
            borderRadius: 'var(--cr-radius-lg)',
            border: '1px solid var(--cr-border)',
            background: 'var(--cr-surface)',
          }}
        />

        {/* Specialization strip. */}
        <div className="mb-4 flex gap-2">
          {[72, 132, 96, 88].map((w, i) => (
            <SkeletonLine key={i} w={w} h={36} radius={999} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[236px_minmax(0,1fr)]">
          {/* Left filter rail. */}
          <aside
            className="hidden lg:block"
            style={{
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              background: 'var(--cr-surface)',
              padding: 'var(--cr-space-md)',
              height: 'fit-content',
            }}
          >
            <SkeletonLine w={80} h={16} />
            <div className="mt-4 flex flex-col gap-3">
              <SkeletonLine w={110} h={10} />
              {[0, 1, 2].map((i) => (
                <SkeletonLine key={i} w="85%" h={12} />
              ))}
              <div className="mt-2 border-t pt-3" style={{ borderColor: 'var(--cr-border)' }}>
                <SkeletonLine w={60} h={10} />
                <div className="mt-2.5">
                  <SkeletonLine w="90%" h={12} />
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            {/* Toolbar: count + sort + view toggle. */}
            <div className="mb-3.5 flex items-center gap-3">
              <SkeletonLine w={90} h={13} />
              <div className="ms-auto flex items-center gap-2">
                <SkeletonLine w={168} h={26} radius={8} />
                <SkeletonLine w={58} h={30} radius={8} />
              </div>
            </div>

            <ul
              className="m-0 grid list-none p-0"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 'var(--cr-space-md)',
              }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <CompanyCardSkeleton key={i} />
              ))}
            </ul>
          </div>
        </div>
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
          <div className="skeleton h-9 w-9" style={{ borderRadius: 999 }} />
          <div className="mt-2.5 flex flex-col gap-2">
            <SkeletonLine w="70%" h={14} />
            <SkeletonLine w="100%" h={11} />
            <SkeletonLine w="85%" h={11} />
            <div className="mt-1">
              <SkeletonButton w="100%" h={32} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
