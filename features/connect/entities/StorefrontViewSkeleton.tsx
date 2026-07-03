/**
 * StorefrontViewSkeleton - the loading placeholder that mirrors `StorefrontView`
 * (banner, overlapping logo + name header, description, category pills, and the
 * products grid) section-for-section, so the swap to real content shifts
 * nothing. Server-renderable (no `use client`), composed from the shared
 * `Skeleton` primitives. Shared by the in-app and public store `loading.tsx`.
 */
import { SkeletonLine } from '@/components/connect/Skeleton';

/** One product-card placeholder: cover block + title + price lines. */
function ListingCardSkeleton() {
  return (
    <div
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        overflow: 'hidden',
        background: 'var(--cr-surface)',
      }}
    >
      <div className="skeleton" style={{ width: '100%', height: 150 }} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonLine w="80%" h={13} />
        <SkeletonLine w="40%" h={12} />
      </div>
    </div>
  );
}

export default function StorefrontViewSkeleton() {
  return (
    <article className="mx-auto w-full" aria-hidden>
      {/* Identity card: hero cover + overlapping logo + name/meta, mirroring the
          card-wrapped header `StorefrontView` now renders. */}
      <section
        className="overflow-hidden"
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        <div className="skeleton h-40 w-full sm:h-52" style={{ borderRadius: 0 }} />
        <header className="flex flex-wrap items-start gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <div
            className="relative z-[1] -mt-12 h-24 w-24 shrink-0 overflow-hidden sm:-mt-14"
            style={{
              borderRadius: 'var(--cr-radius-md)',
              border: '4px solid var(--cr-surface)',
              background: 'var(--cr-surface)',
            }}
          >
            <div className="skeleton h-full w-full" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-3">
            <SkeletonLine w={220} h={22} />
            <SkeletonLine w={140} h={13} />
            <SkeletonLine w={180} h={12} />
          </div>
        </header>
      </section>

      {/* Tab bar (Overview / Products / Reviews) */}
      <div className="mt-6 px-4">
        <SkeletonLine w={260} h={34} radius={999} />
      </div>

      {/* About (Overview is the default tab) */}
      <section className="mt-6 flex flex-col gap-2 px-4">
        <SkeletonLine w="92%" h={13} />
        <SkeletonLine w="78%" h={13} />
      </section>

      {/* Category pills */}
      <div className="mt-4 flex flex-wrap gap-1.5 px-4">
        {[64, 88, 72].map((w, i) => (
          <SkeletonLine key={i} w={w} h={22} radius={999} />
        ))}
      </div>

      {/* Products */}
      <section className="mt-7 px-4">
        <SkeletonLine w={120} h={15} style={{ marginBottom: 14 }} />
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </article>
  );
}
