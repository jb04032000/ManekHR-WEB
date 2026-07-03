import { SkeletonLine } from '@/components/connect/Skeleton';
import { Container } from '@/components/marketing/ui/Container';

/**
 * Loading skeleton for /erp/pricing - mirrors page.tsx section-for-section so
 * the swap to real content is shift-free: centred hero, the billing toggle, a
 * 4-card pricing grid, the headcount-recommender panel, the Bill & Accounts
 * "coming soon" strip, and the Custom contact band.
 *
 * Server-only (no 'use client', no hooks). Uses the shared `.skeleton` shimmer
 * via the SkeletonLine primitive (components/connect/Skeleton.tsx). Keep in sync
 * with app/(marketing)/erp/pricing/page.tsx if its sections change.
 */
export default function ErpPricingLoading() {
  return (
    <div aria-hidden="true">
      {/* Hero (centred header) */}
      <section className="bg-white">
        <Container className="flex flex-col items-center py-16 text-center sm:py-20 lg:py-[104px]">
          <SkeletonLine w={150} h={30} radius={999} />
          <div className="mt-6 flex w-full flex-col items-center gap-3">
            <SkeletonLine w="60%" h={40} radius={10} />
            <SkeletonLine w="44%" h={40} radius={10} />
          </div>
          <div className="mt-6 flex w-full flex-col items-center gap-2">
            <SkeletonLine w="50%" h={14} radius={6} />
            <SkeletonLine w="38%" h={14} radius={6} />
          </div>
        </Container>
      </section>

      {/* Toggle + cards + selector */}
      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          {/* Billing-cycle toggle */}
          <div className="flex flex-col items-center gap-2.5">
            <SkeletonLine w={220} h={44} radius={10} />
            <SkeletonLine w={160} h={13} radius={6} />
          </div>

          {/* 4 pricing cards */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:mt-12 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, cardIndex) => (
              <div
                key={cardIndex}
                className="flex h-full flex-col rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-6 sm:p-7"
              >
                <SkeletonLine w="40%" h={20} radius={6} />
                <div className="pt-4">
                  <SkeletonLine w="55%" h={34} radius={8} />
                </div>
                <div className="pt-4">
                  <SkeletonLine w="70%" h={13} radius={6} />
                </div>
                <div className="mt-6 flex flex-1 flex-col gap-3">
                  {Array.from({ length: 4 }, (_, lineIndex) => (
                    <SkeletonLine
                      key={lineIndex}
                      w={lineIndex % 2 === 0 ? '90%' : '78%'}
                      h={12}
                      radius={6}
                    />
                  ))}
                </div>
                <div className="mt-6">
                  <SkeletonLine w="100%" h={40} radius={10} />
                </div>
              </div>
            ))}
          </div>

          {/* Headcount-recommender panel */}
          <div className="mx-auto mt-12 max-w-2xl rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-6 text-center sm:p-7">
            <div className="flex flex-col items-center gap-2.5">
              <SkeletonLine w="45%" h={18} radius={6} />
              <SkeletonLine w="65%" h={13} radius={6} />
              <div className="mt-3">
                <SkeletonLine w={320} h={36} radius={10} />
              </div>
              <SkeletonLine w="40%" h={13} radius={6} />
            </div>
          </div>

          {/* Bill & Accounts "coming soon" strip */}
          <div className="mx-auto mt-12 max-w-3xl rounded-[16px] border border-dashed border-[var(--cr-neutral-300)] bg-[var(--cr-neutral-50)] p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <SkeletonLine w={160} h={18} radius={6} />
              <SkeletonLine w={90} h={20} radius={999} />
            </div>
            <div className="mt-3">
              <SkeletonLine w="80%" h={13} radius={6} />
            </div>
          </div>
        </Container>
      </section>

      {/* Custom contact band */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-[20px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] p-8 text-center sm:p-10">
            <SkeletonLine w={120} h={14} radius={6} />
            <SkeletonLine w="55%" h={28} radius={8} />
            <SkeletonLine w="70%" h={13} radius={6} />
            <div className="mt-4">
              <SkeletonLine w={180} h={46} radius={10} />
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
