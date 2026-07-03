import { SkeletonLine, SkeletonButton } from '@/components/connect/Skeleton';

/**
 * Loading UI for the Company Page manage console (`/connect/pages/[id]`).
 * Mirrors ManageCompanyPageScreen section-for-section: breadcrumb, the header
 * card (cover + overlapping logo + name/status + action cluster + public-URL
 * strip), the three-KPI strip, the pill-track tab bar, and the Overview body
 * (setup checklist + products card), plus the right rail. Plain markup so this
 * server `loading.tsx` pulls no client components.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Breadcrumb. */}
        <div className="mb-2 flex items-center gap-2">
          <SkeletonLine w={60} h={12} />
          <SkeletonLine w={120} h={12} />
        </div>

        {/* Header card. */}
        <section
          className="overflow-hidden"
          style={{
            background: 'var(--cr-surface)',
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-lg)',
          }}
        >
          <div className="skeleton h-[140px] w-full" style={{ borderRadius: 0 }} />
          <div className="px-5 pb-4">
            <div className="flex flex-wrap items-start gap-4">
              {/* Logo overlapping the cover. */}
              <div
                className="shrink-0"
                style={{
                  marginTop: -46,
                  padding: 4,
                  borderRadius: 'var(--cr-radius-lg)',
                  background: 'var(--cr-surface)',
                }}
              >
                <div
                  className="skeleton h-[92px] w-[92px]"
                  style={{ borderRadius: 'var(--cr-radius-lg)' }}
                />
              </div>
              {/* Name + status pill. */}
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-2.5">
                <SkeletonLine w={220} h={22} />
                <SkeletonLine w={120} h={20} radius={999} />
              </div>
              {/* Action cluster. */}
              <div className="flex shrink-0 items-center gap-2 pt-2.5">
                <SkeletonButton w={110} h={38} />
                <SkeletonButton w={120} h={38} />
                <SkeletonButton w={96} h={38} />
                <SkeletonButton w={38} h={38} />
              </div>
            </div>

            {/* Public URL strip. */}
            <div
              className="mt-3.5 h-[42px] w-full"
              style={{ background: 'var(--cr-surface-2)', borderRadius: 'var(--cr-radius-md)' }}
            />
          </div>
        </section>

        {/* KPI strip. */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4"
              style={{
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-lg)',
              }}
            >
              <div className="skeleton h-10 w-10" style={{ borderRadius: 'var(--cr-radius-md)' }} />
              <div className="flex flex-col gap-2">
                <SkeletonLine w={40} h={20} />
                <SkeletonLine w={72} h={11} />
              </div>
            </div>
          ))}
        </div>

        {/* Pill-track tab bar. */}
        <div className="mt-5 mb-5">
          <SkeletonLine w={420} h={42} radius={999} />
        </div>

        {/* Overview body: setup checklist + products card. */}
        <div className="flex flex-col gap-5">
          <div
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              padding: 'var(--cr-space-lg)',
            }}
          >
            <SkeletonLine w={160} h={16} />
            <div className="mt-4 flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-5 w-5" style={{ borderRadius: 999 }} />
                  <SkeletonLine w={i % 2 === 0 ? '70%' : '55%'} h={13} />
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex items-center gap-3"
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              padding: 'var(--cr-space-lg)',
            }}
          >
            <div className="skeleton h-8 w-8" style={{ borderRadius: 'var(--cr-radius-md)' }} />
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonLine w={140} h={15} />
              <SkeletonLine w={260} h={12} />
            </div>
            <SkeletonLine w={120} h={13} />
          </div>
        </div>
      </main>

      {/* Right rail: share + needs + people panels. */}
      <aside
        className="hidden shrink-0 lg:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div className="flex flex-col gap-4">
          <div
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              padding: 'var(--cr-space-md)',
            }}
          >
            <SkeletonLine w={90} h={12} />
            <div
              className="skeleton mt-3 h-[120px] w-[120px]"
              style={{ borderRadius: 'var(--cr-radius-md)', margin: '12px auto 0' }}
            />
            <div className="mt-3 flex flex-col gap-2">
              <SkeletonLine w="100%" h={11} />
              <SkeletonLine w="80%" h={11} />
            </div>
          </div>
          <div
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              padding: 'var(--cr-space-md)',
            }}
          >
            <SkeletonLine w={130} h={12} />
            <div className="mt-3 flex flex-col gap-2.5">
              {[0, 1].map((i) => (
                <SkeletonLine key={i} w="90%" h={12} />
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
