import { SkeletonLine, SkeletonButton, SkeletonRailPanel } from '@/components/connect/Skeleton';

/** One form-section card placeholder (title + a few labelled field rows) -
 *  mirrors `FormSection` in ListingForm. */
function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        padding: 'var(--cr-space-lg)',
        marginBottom: 'var(--cr-space-md)',
      }}
    >
      <SkeletonLine w={130} h={15} />
      <div className="mt-4 flex flex-col gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <SkeletonLine w={90} h={12} />
            <SkeletonLine w="100%" h={36} radius={8} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** The live-preview rail card placeholder: a cover block + a few text lines -
 *  mirrors NewListingScreen's `previewPanel`. */
function PreviewPanelSkeleton() {
  return (
    <div
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        padding: 'var(--cr-space-md)',
      }}
    >
      <SkeletonLine w={100} h={12} />
      <div
        className="mt-3 overflow-hidden"
        style={{ border: '1px solid var(--cr-border-light)', borderRadius: 'var(--cr-radius-md)' }}
      >
        <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 0 }} />
        <div className="flex flex-col gap-2 p-3">
          <SkeletonLine w="70%" h={13} />
          <SkeletonLine w="40%" h={11} />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading UI for the new/edit listing page (`/connect/marketplace/new`). Mirrors
 * NewListingScreen section-for-section: the main column (back link, title,
 * subtitle, required-note pill, the four form-section cards, submit row) and the
 * right rail (listing progress, live preview, tips). Server-only, composed from
 * the shared Skeleton primitives so the swap to the real form is shift-free.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Back link + title + subtitle + required-note pill. */}
        <SkeletonLine w={90} h={12} />
        <div className="mt-2.5">
          <SkeletonLine w={200} h={22} />
        </div>
        <div className="mt-2">
          <SkeletonLine w={320} h={13} />
        </div>
        <div className="mt-3 mb-4">
          <SkeletonLine w={150} h={24} radius={999} />
        </div>

        {/* Photos section: a small image grid. */}
        <section
          style={{
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-lg)',
            background: 'var(--cr-surface)',
            padding: 'var(--cr-space-lg)',
            marginBottom: 'var(--cr-space-md)',
          }}
        >
          <SkeletonLine w={110} h={15} />
          <div
            className="mt-4 grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ aspectRatio: '1 / 1', borderRadius: 'var(--cr-radius-md)' }}
              />
            ))}
          </div>
        </section>

        {/* Basics (incl. category), Details, Pricing. */}
        <SectionSkeleton rows={4} />
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={3} />

        {/* Submit row. */}
        <div className="mt-2 flex flex-wrap gap-2">
          <SkeletonButton w={150} h={40} />
          <SkeletonButton w={130} h={40} />
        </div>
      </main>

      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div className="flex flex-col gap-4">
          <SkeletonRailPanel titleW={120} rows={3} />
          <PreviewPanelSkeleton />
          <SkeletonRailPanel titleW={150} rows={3} />
        </div>
      </aside>
    </div>
  );
}
