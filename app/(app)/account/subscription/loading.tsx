/**
 * Route loading skeleton for /account/subscription. Mirrors the real overview
 * section-for-section (headline plan card, the 3-up ERP quick-links grid, the
 * recent-activity card) so the swap to content is shift-free. Server-only: no
 * 'use client', no hooks; composes the shared Connect skeleton primitives (the
 * `.skeleton` shimmer). The whole tree is aria-hidden (decorative placeholder).
 *
 * Links: app/account/subscription/page.tsx (the real layout this mirrors),
 * components/connect/Skeleton.tsx (primitives).
 */
import {
  SkeletonCard,
  SkeletonLine,
  SkeletonCircle,
  SkeletonButton,
} from '@/components/connect/Skeleton';

export default function AccountSubscriptionLoading() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {/* Headline plan card: icon tile + title/sub on the left, period + actions
          on the right. */}
      <SkeletonCard style={{ borderRadius: 16, padding: 'var(--cr-space-lg)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <SkeletonCircle size={48} />
            <div className="flex flex-col gap-2">
              <SkeletonLine w={160} h={16} />
              <SkeletonLine w={110} h={11} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1.5">
              <SkeletonLine w={48} h={10} />
              <SkeletonLine w={84} h={12} />
            </div>
            <SkeletonButton w={120} h={34} />
          </div>
        </div>
      </SkeletonCard>

      {/* ERP quick-links grid (3 cards): icon tile + title + one body line. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} style={{ borderRadius: 16 }}>
            <div className="flex items-start gap-3">
              <SkeletonCircle size={40} />
              <div className="flex flex-1 flex-col gap-2">
                <SkeletonLine w="55%" h={13} />
                <SkeletonLine w="85%" h={10} />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Recent activity card: header line + 3 rows. */}
      <SkeletonCard style={{ borderRadius: 16 }}>
        <SkeletonLine w={120} h={14} />
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: 'var(--cr-surface-2)' }}
            >
              <SkeletonLine w={140} h={12} />
              <SkeletonLine w={88} h={12} />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
