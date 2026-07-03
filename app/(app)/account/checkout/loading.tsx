/**
 * Route loading skeleton for /account/checkout. Mirrors the rebuilt page
 * section-for-section so the swap to content is shift-free: the back link +
 * title + subtitle header, the 3-step stepper, then the 2-column body - LEFT
 * (numbered section cards: plan, pay tiles, payment-method preview) and RIGHT
 * (the sticky Order summary card: line item + breakdown + total + coupon + Pay).
 *
 * Server-only: no 'use client', no hooks; composes the shared Connect skeleton
 * primitives (the `.skeleton` shimmer). The whole tree is aria-hidden.
 *
 * Links: app/account/checkout/page.tsx + components/subscription/CheckoutView.tsx
 * (the real layout this mirrors), components/connect/Skeleton.tsx (primitives).
 */
import { SkeletonCard, SkeletonLine, SkeletonButton } from '@/components/connect/Skeleton';

/** A numbered section-card skeleton: badge + heading row, then body slot. */
function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonCard style={{ borderRadius: 16 }}>
      <div className="mb-3 flex items-center gap-2.5">
        <SkeletonLine w={24} h={24} radius={12} />
        <SkeletonLine w={130} h={14} />
      </div>
      {children}
    </SkeletonCard>
  );
}

export default function CheckoutLoading() {
  return (
    <div className="mx-auto max-w-5xl" aria-hidden>
      {/* Header: back link + title + subtitle. */}
      <SkeletonLine w={90} h={12} />
      <div className="mt-4 flex items-center gap-2">
        <SkeletonLine w={28} h={28} radius={8} />
        <SkeletonLine w={220} h={24} />
      </div>
      <div className="mt-2">
        <SkeletonLine w="60%" h={12} />
      </div>

      {/* 3-step stepper row. */}
      <div className="mt-8 flex items-center gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <SkeletonLine w={20} h={20} radius={10} />
            <SkeletonLine w={84} h={12} />
          </div>
        ))}
      </div>

      {/* 2-column body: numbered sections (left) + sticky order summary (right). */}
      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* LEFT: plan card + pay tiles + payment-method preview. */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 lg:basis-3/5">
          {/* 1. Your plan - inner highlighted card: name row + tagline + 2-col bullets. */}
          <SectionSkeleton>
            <div className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <SkeletonLine w={36} h={36} radius={8} />
                  <SkeletonLine w={120} h={16} />
                </div>
                <SkeletonLine w={80} h={12} />
              </div>
              <div className="mt-3">
                <SkeletonLine w="70%" h={11} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonLine key={i} w="85%" h={10} />
                ))}
              </div>
            </div>
          </SectionSkeleton>

          {/* 2. How would you like to pay? - two pay tiles. */}
          <SectionSkeleton>
            <div className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between">
                    <SkeletonLine w="40%" h={14} />
                    <SkeletonLine w={64} h={18} radius={9} />
                  </div>
                  <div className="mt-2">
                    <SkeletonLine w="55%" h={11} />
                  </div>
                </div>
              ))}
            </div>
          </SectionSkeleton>

          {/* 3. Payment method - chips + disabled card-form preview. */}
          <SectionSkeleton>
            <div className="mb-4 flex gap-2">
              {[0, 1, 2].map((i) => (
                <SkeletonLine key={i} w={84} h={32} radius={8} />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <SkeletonLine key={i} w="100%" h={36} radius={8} />
              ))}
            </div>
          </SectionSkeleton>
        </div>

        {/* RIGHT: order summary card - heading, line item, breakdown, total, coupon, CTA. */}
        <aside className="w-full lg:basis-2/5">
          <SkeletonCard style={{ borderRadius: 16 }}>
            <SkeletonLine w={130} h={16} />
            <div className="mt-2">
              <SkeletonLine w="55%" h={11} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <SkeletonLine w={140} h={14} />
              <SkeletonLine w={72} h={14} />
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <SkeletonLine w={110} h={12} />
                  <SkeletonLine w={72} h={12} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
              <SkeletonLine w={120} h={16} />
              <SkeletonLine w={96} h={24} />
            </div>
            <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
              <SkeletonLine w="100%" h={36} radius={8} />
              <SkeletonButton w={84} h={36} />
            </div>
            <div className="mt-4">
              <SkeletonButton w="100%" h={44} />
            </div>
          </SkeletonCard>
        </aside>
      </div>
    </div>
  );
}
