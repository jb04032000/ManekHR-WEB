/**
 * Loading skeleton for the in-app plans hub (/account/subscription/plans).
 *
 * What it does: mirrors the real page section-for-section so the swap to content
 * is shift-free and reads as "this exact page is loading" - the gold trial
 * banner, the "Choose a plan" header, the 4-up plan-card grid, and the gold
 * "custom plan" lead card. Replaces the old bare centred <Spin>, which gave the
 * trial banner (and the cards) no placeholder at all.
 *
 * Server-renderable (no 'use client', no hooks) so the SAME component backs BOTH
 * the route-level loading.tsx AND the client page's in-flight fetch state. It
 * composes the shared `.skeleton` shimmer primitives; the whole tree is
 * aria-hidden (decorative placeholder).
 *
 * Cross-module links: ./page.tsx (the real layout this mirrors) + ./loading.tsx
 * (route loader that renders it); components/subscription/TrialStatusBanner.tsx
 * (gold banner shape mirrored) and ./PlanCard.tsx (card anatomy mirrored). Keep
 * roughly in sync if the banner or card layout changes.
 */
import { SkeletonLine, SkeletonButton } from '@/components/connect/Skeleton';

// Curated bullet count per tier (free/starter/growth/business) so the skeleton's
// card heights are believable; mirrors FEATURE_COUNT in PlanCard.tsx.
const CARD_BULLETS = [4, 3, 3, 6];
// Growth is the most-popular card - mirror its 2px border + ribbon so that card
// doesn't visually jump on the swap to content.
const MOST_POPULAR_INDEX = 2;

/**
 * Standalone skeleton for JUST the trial banner (the gold in-trial status card
 * shape: icon chip + label + headline + slim progress bar). Exported separately
 * because the trial banner has its OWN load (the trial API resolves on a
 * different timeline from the plans), so the page keeps this skeleton visible
 * until the trial response lands - the cards rendering must NOT hide it. mb-6
 * matches the real banner's bottom gap so the swap is shift-free.
 */
export function TrialBannerSkeleton() {
  return (
    <div
      aria-hidden
      className="mb-6 flex items-center gap-4 rounded-2xl border border-[var(--cr-gold-400)] bg-[var(--cr-gold-100)] px-4 py-4 sm:px-5"
    >
      <SkeletonLine w={44} h={44} radius={12} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonLine w={120} h={10} />
        <SkeletonLine w={200} h={15} />
        <SkeletonLine w="100%" h={6} radius={999} />
      </div>
    </div>
  );
}

export function PlansSkeleton() {
  return (
    <div aria-hidden>
      {/* Trial banner placeholder (same component the page keeps on its own
          longer-lived trial-loading state). */}
      <TrialBannerSkeleton />

      {/* "Choose a plan" header (title + subtitle). */}
      <div className="mt-2 mb-5 flex flex-col gap-2">
        <SkeletonLine w={180} h={26} />
        <SkeletonLine w={280} h={14} />
      </div>

      {/* 4-up plan-card grid: xs 1 / sm 2 / lg 4 at gap-5 (matches the real
          Row gutter of 20). Each card mirrors PlanCard's anatomy and pins its
          button to the bottom (mt-auto), so the slack from unequal bullet counts
          lands as one clean gap - same as the live cards. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CARD_BULLETS.map((bullets, i) => {
          const popular = i === MOST_POPULAR_INDEX;
          return (
            <div
              key={i}
              className={`relative flex h-full flex-col rounded-2xl bg-[var(--cr-surface)] p-6 ${
                popular
                  ? 'border-2 border-primary shadow-[0_18px_40px_-24px_rgba(11,110,79,0.45)]'
                  : 'border border-[var(--cr-border)]'
              }`}
            >
              {popular && (
                <SkeletonLine
                  w={92}
                  h={18}
                  radius={999}
                  style={{ position: 'absolute', top: -9, left: 16 }}
                />
              )}

              {/* Identity: icon chip + name. */}
              <div className="flex items-center gap-3">
                <SkeletonLine w={44} h={44} radius={12} />
                <SkeletonLine w={90} h={16} />
              </div>

              {/* Tagline. */}
              <div className="mt-3">
                <SkeletonLine w="80%" h={11} />
              </div>

              {/* Price headline + sub-notes. */}
              <div className="mt-4">
                <SkeletonLine w={120} h={28} />
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <SkeletonLine w={150} h={10} />
                <SkeletonLine w={120} h={10} />
              </div>

              {/* Divider between cost and what-you-get (mirrors PlanCard). */}
              <div className="mt-4 border-t border-border-light" />

              {/* Staff cap. */}
              <div className="mt-4">
                <SkeletonLine w={150} h={13} />
              </div>

              {/* Feature bullets. */}
              <div className="mt-3 flex flex-col gap-2.5">
                {Array.from({ length: bullets }, (_, b) => (
                  <SkeletonLine key={b} w={b % 2 === 0 ? '88%' : '72%'} h={12} />
                ))}
              </div>

              {/* CTA pinned to the bottom on one baseline across cards. */}
              <div className="mt-auto pt-5">
                <SkeletonButton w="100%" h={40} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom-plan lead card (gold dashed shell, icon + copy on the left,
          button on the right). */}
      <div className="pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[1.5px] border-dashed border-[var(--cr-gold-400)] bg-[var(--cr-gold-100)] p-6">
          <div className="flex items-center gap-3.5">
            <SkeletonLine w={44} h={44} radius={12} />
            <div className="flex flex-col gap-2">
              <SkeletonLine w={160} h={15} />
              <SkeletonLine w={240} h={11} />
            </div>
          </div>
          <SkeletonButton w={150} h={40} />
        </div>
      </div>
    </div>
  );
}

export default PlansSkeleton;
