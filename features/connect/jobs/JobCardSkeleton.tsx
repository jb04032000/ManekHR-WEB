'use client';

/**
 * JobCardSkeleton - the loading placeholder for one JobCard row. Shown in the
 * board's result list while a filter-change refetch is in flight (see JobBoard's
 * `loading` branch), so the area shows a proper shimmer instead of a blank/dimmed
 * section. Mirrors the JobCard anatomy (icon + title + meta + tag chips + action)
 * so the swap to real cards is shift-free.
 *
 * Cross-module links: features/connect/jobs/JobCard.tsx (the real card) and
 * app/connect/jobs/loading.tsx (the first-load skeleton). Keep the shape roughly
 * in sync with those if the card layout changes.
 */

import { SkeletonLine, SkeletonCircle, SkeletonButton } from '@/components/connect/Skeleton';

export default function JobCardSkeleton() {
  return (
    <div
      aria-hidden
      // h-full so a skeleton stretches to match an equal-height grid row (the real
      // grid cards use h-full); harmless in the single-column list.
      className="h-full p-4"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <div className="flex items-start gap-3">
        <SkeletonCircle size={44} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <SkeletonLine w="55%" h={16} />
          <SkeletonLine w="38%" h={12} />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[60, 80, 52].map((w, k) => (
              <SkeletonLine key={k} w={w} h={22} radius={999} />
            ))}
          </div>
        </div>
        <SkeletonButton w={90} h={34} />
      </div>
    </div>
  );
}
