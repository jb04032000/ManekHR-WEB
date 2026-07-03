import { SkeletonLine, SkeletonButton } from '@/components/connect/Skeleton';

/**
 * Loading UI for the job detail page (`/connect/jobs/[id]`). Mirrors
 * JobDetailScreen section-for-section: back link, the hero (gradient band + icon
 * + title + employer strip + 4-tile spec strip), the About / Requirements /
 * Pay-&-benefits / About-company cards, and the right rail (summary + explainer
 * + employer). Plain server markup so this pulls no client components; the swap
 * to the real page is shift-free.
 */
const CARD = {
  background: 'var(--cr-surface)',
  border: '1px solid var(--cr-border)',
  borderRadius: 'var(--cr-radius-lg)',
} as const;

function SectionCard({ rows = 2 }: { rows?: number }) {
  return (
    <section style={{ ...CARD, padding: 20 }}>
      <div className="mb-4 flex items-center gap-2">
        <div className="skeleton h-7 w-7" style={{ borderRadius: 'var(--cr-radius-md)' }} />
        <SkeletonLine w={170} h={15} />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine key={i} w={i === rows - 1 ? '70%' : '100%'} h={13} />
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="flex min-w-0 flex-1 flex-col gap-5">
        <SkeletonLine w={60} h={13} />

        {/* Hero */}
        <section className="overflow-hidden" style={CARD}>
          <div className="skeleton" style={{ height: 6, borderRadius: 0 }} />
          <div style={{ padding: '18px 20px 16px' }}>
            <div className="flex items-start gap-4">
              <div className="skeleton h-14 w-14" style={{ borderRadius: 'var(--cr-radius-lg)' }} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <SkeletonLine w={260} h={22} />
                <SkeletonLine w="70%" h={13} />
              </div>
              <SkeletonLine w={60} h={20} radius={999} />
            </div>
            {/* Employer strip. */}
            <div
              className="mt-3 h-[44px] w-full"
              style={{ background: 'var(--cr-surface-2)', borderRadius: 'var(--cr-radius-md)' }}
            />
          </div>
          {/* Spec strip. */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4"
            style={{ borderTop: '1px solid var(--cr-divider)' }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-2 px-4 py-3"
                style={{ borderInlineStart: '1px solid var(--cr-divider)' }}
              >
                <SkeletonLine w={56} h={11} />
                <SkeletonLine w={84} h={15} />
              </div>
            ))}
          </div>
        </section>

        <SectionCard rows={3} />
        {/* Requirements grid. */}
        <section style={{ ...CARD, padding: 20 }}>
          <div className="mb-4 flex items-center gap-2">
            <div className="skeleton h-7 w-7" style={{ borderRadius: 'var(--cr-radius-md)' }} />
            <SkeletonLine w={190} h={15} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <SkeletonLine w={80} h={11} />
                <SkeletonLine w={140} h={13} />
              </div>
            ))}
          </div>
        </section>
        <SectionCard rows={2} />
      </main>

      {/* Right rail. */}
      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div className="flex flex-col gap-4">
          <div style={{ ...CARD, padding: 'var(--cr-space-md)' }}>
            <SkeletonLine w={90} h={12} />
            <div className="mt-3">
              <SkeletonLine w={140} h={22} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 p-2.5"
                  style={{
                    border: '1px solid var(--cr-border)',
                    borderRadius: 'var(--cr-radius-md)',
                  }}
                >
                  <SkeletonLine w={24} h={16} />
                  <SkeletonLine w={48} h={10} />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <SkeletonButton w="100%" h={40} />
            </div>
          </div>
          <div style={{ ...CARD, padding: 'var(--cr-space-md)' }}>
            <SkeletonLine w={130} h={12} />
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
