import { SkeletonLine } from '@/components/connect/Skeleton';

/**
 * Loading UI for the in-app company page (`/connect/company/[slug]`). Mirrors
 * CompanyPageView + the EntityAdRail layout: a hero banner, the overlapping logo
 * with name/location beside it, the pill-track tab bar, the About + capabilities
 * blocks, a card-grid block (the Store card + the institute Placements / Alumni
 * tab content - Institutes Phase 2, Feature 2), and two rail panel placeholders.
 * Plain markup so this server `loading.tsx` pulls no client components.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        <article className="mx-auto w-full">
          {/* Identity card: banner + identity header in one bordered card (matches
              CompanyPageView). */}
          <section
            className="overflow-hidden"
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
            }}
          >
            {/* Hero banner. */}
            <div className="skeleton h-40 w-full sm:h-52" style={{ borderRadius: 0 }} />

            {/* Identity header: logo overlaps the banner, name + location beside it. */}
            <div className="flex flex-wrap items-start gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
              <div
                className="-mt-12 shrink-0"
                style={{
                  padding: 4,
                  borderRadius: 'var(--cr-radius-md)',
                  background: 'var(--cr-surface)',
                }}
              >
                <div
                  className="skeleton h-24 w-24"
                  style={{ borderRadius: 'var(--cr-radius-md)' }}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-3">
                <SkeletonLine w={220} h={22} />
                <SkeletonLine w={160} h={13} />
              </div>
              <div className="pt-3">
                <SkeletonLine w={104} h={36} radius={999} />
              </div>
            </div>
          </section>

          {/* Pill-track tab bar. */}
          <div className="mt-6 px-4">
            <SkeletonLine w={300} h={40} radius={999} />
          </div>

          {/* About. */}
          <div className="mt-6 px-4">
            <SkeletonLine w={80} h={15} />
            <div className="mt-3 flex flex-col gap-2">
              <SkeletonLine w="100%" h={12} />
              <SkeletonLine w="92%" h={12} />
              <SkeletonLine w="70%" h={12} />
            </div>
          </div>

          {/* Capabilities spec-grid. */}
          <div className="mt-6 px-4">
            <SkeletonLine w={110} h={15} />
            <div
              className="mt-3 grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-2"
              style={{
                background: 'var(--cr-divider)',
                border: '1px solid var(--cr-divider)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2"
                  style={{ background: 'var(--cr-surface)', padding: '13px 15px' }}
                >
                  <SkeletonLine w={90} h={10} />
                  <SkeletonLine w="60%" h={14} />
                </div>
              ))}
            </div>
          </div>

          {/* Store card (redirect-first): logo + name/count + Visit-store link,
              then a featured-products thumbnail row. Mirrors CompanyStoreCard. */}
          <div className="mt-6 px-4">
            <SkeletonLine w={70} h={15} />
            <div
              className="mt-3"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-lg)',
                padding: 16,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="skeleton h-11 w-11"
                  style={{ borderRadius: 'var(--cr-radius-md)' }}
                />
                <div className="flex flex-1 flex-col gap-2">
                  <SkeletonLine w={140} h={14} />
                  <SkeletonLine w={80} h={12} />
                </div>
                <SkeletonLine w={80} h={13} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="skeleton aspect-square"
                    style={{ borderRadius: 'var(--cr-radius-md)' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Institute tab content (Placements employer tiles / Alumni
              PersonCards): a responsive card grid. Mirrors InstitutePlacementCard
              + the PersonCard `card` grid - cover band, overlapping logo/avatar,
              a name line + a stat line + a CTA. */}
          <div className="mt-6 px-4">
            <SkeletonLine w={110} h={15} />
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden"
                  style={{
                    background: 'var(--cr-surface)',
                    border: '1px solid var(--cr-border-light)',
                    borderRadius: 'var(--cr-radius-lg)',
                  }}
                >
                  <div className="skeleton h-14 w-full" style={{ borderRadius: 0 }} />
                  <div className="flex flex-col gap-2 px-4 pb-4">
                    <div
                      className="skeleton -mt-6 h-[52px] w-[52px]"
                      style={{ borderRadius: 'var(--cr-radius-md)' }}
                    />
                    <SkeletonLine w={140} h={15} />
                    <SkeletonLine w={90} h={12} />
                    <div className="mt-2">
                      <SkeletonLine w="100%" h={30} radius={999} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </main>

      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div className="flex flex-col gap-4">
          <div
            style={{
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              background: 'var(--cr-surface)',
              padding: 'var(--cr-space-md)',
            }}
          >
            <SkeletonLine w={140} h={10} />
            <div className="mt-3 flex flex-col gap-2">
              <SkeletonLine w="100%" h={11} />
              <SkeletonLine w="80%" h={11} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
