import { SkeletonLine, SkeletonButton, SkeletonCard } from '@/components/connect/Skeleton';

/**
 * Loading skeleton for `/connect/referrals`.
 *
 * What: server-only (no 'use client') shimmer that mirrors ReferralScreen's
 *   layout section-for-section so the swap to real content is shift-free.
 *   Sections: hero card (link + share buttons), 3 stat cards, referred list
 *   (3 rows), how-it-works (3 steps). Matches the visual weight of each section.
 *
 * Cross-module links: primitives from components/connect/Skeleton.tsx (imported
 *   directly, NOT via the connect barrel, to avoid pulling client components into
 *   a server-only loading.tsx). ReferralScreen.tsx is the real layout reference.
 *
 * Watch: update this skeleton whenever ReferralScreen's section structure changes
 *   (binding rule from crewroster-web/CLAUDE.md -- loading.tsx mirrors the page).
 */

/** Three stat card skeletons: Referred / Credits earned / Credits pending. */
function StatCardsSkeleton() {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i}>
          <SkeletonLine w={56} h={10} />
          <div style={{ marginTop: 8 }}>
            <SkeletonLine w={80} h={28} />
          </div>
          <div style={{ marginTop: 6 }}>
            <SkeletonLine w="70%" h={10} />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/** One referred-list row: avatar placeholder + name + status chip + date. */
function ReferredRowSkeleton() {
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: '1px solid var(--cr-divider)' }}
    >
      <div className="skeleton h-9 w-9 shrink-0" style={{ borderRadius: '50%' }} />
      <div className="flex flex-1 flex-col gap-1.5">
        <SkeletonLine w="38%" h={12} />
        <SkeletonLine w="22%" h={10} />
      </div>
      <SkeletonLine w={60} h={22} radius={999} />
      <SkeletonLine w={64} h={10} />
    </div>
  );
}

/** Three how-it-works step skeletons. */
function HowItWorksSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="skeleton h-8 w-8 shrink-0" style={{ borderRadius: '50%' }} />
          <div className="flex flex-1 flex-col gap-1.5 pt-1">
            <SkeletonLine w="55%" h={12} />
            <SkeletonLine w="80%" h={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      {/* Hero card: referral link + copy/share buttons + earn line. */}
      <SkeletonCard style={{ marginBottom: 'var(--cr-space-md, 20px)' }}>
        <SkeletonLine w={160} h={14} style={{ marginBottom: 12 }} />
        <div className="flex items-center gap-2">
          <SkeletonLine w="100%" h={40} radius={8} style={{ flex: 1 }} />
          <SkeletonButton w={88} h={40} />
        </div>
        <div className="mt-3 flex gap-2">
          <SkeletonButton w={140} h={36} />
          <SkeletonButton w={120} h={36} />
        </div>
        <SkeletonLine w="75%" h={12} style={{ marginTop: 12 }} />
      </SkeletonCard>

      {/* 3 stat cards. */}
      <StatCardsSkeleton />

      {/* Referred list. */}
      <SkeletonCard style={{ marginBottom: 'var(--cr-space-md, 20px)' }}>
        <SkeletonLine w={120} h={14} style={{ marginBottom: 4 }} />
        {[0, 1, 2].map((i) => (
          <ReferredRowSkeleton key={i} />
        ))}
      </SkeletonCard>

      {/* How it works. */}
      <SkeletonCard>
        <SkeletonLine w={130} h={14} style={{ marginBottom: 16 }} />
        <HowItWorksSkeleton />
      </SkeletonCard>
    </div>
  );
}
