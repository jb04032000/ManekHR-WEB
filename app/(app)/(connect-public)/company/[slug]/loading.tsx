import { SkeletonLine } from '@/components/connect/Skeleton';

/**
 * Loading UI for the PUBLIC company page (`/company/[slug]`) - the logged-out,
 * SEO-canonical mirror. Created with Institutes Phase 2, Feature 2 (the public
 * route now SSR-fetches the institute Alumni / Placements tabs, so the binding
 * route-skeleton rule applies). Mirrors the page section-for-section: the
 * max-w-[960px] wrapper, the top Share row, the identity card (banner +
 * overlapping logo + name/location), the pill-track tab bar, an About block, and
 * a card-grid block (the institute Placements employer tiles / Alumni
 * PersonCards). Server-only: no 'use client', no hooks; root aria-hidden; the
 * Skeleton primitives are imported directly (not via the components/connect
 * barrel, which pulls client components). Keep in sync with the public page.tsx +
 * CompanyPageView.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 sm:py-8" aria-hidden>
      {/* Top Share row (right-aligned). */}
      <div className="mb-3 flex justify-end">
        <SkeletonLine w={84} h={28} radius={999} />
      </div>

      <article className="mx-auto w-full">
        {/* Identity card: banner + identity header in one bordered card. */}
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
              <div className="skeleton h-24 w-24" style={{ borderRadius: 'var(--cr-radius-md)' }} />
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

        {/* Institute tab content (Placements employer tiles / Alumni
            PersonCards): a responsive card grid. Mirrors InstitutePlacementCard +
            the PersonCard `card` grid - cover band, overlapping logo/avatar, a
            name line + a stat line + a CTA. */}
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
    </div>
  );
}
