/**
 * RfqCardSkeleton - a shimmer placeholder mirroring RfqCard's anatomy (icon
 * tile, title + status, category line, meta row, footer with action). Server-
 * renderable (no 'use client') so BOTH the route loading.tsx (RfqHubSkeleton)
 * and the client board's in-flight state compose it. Keep in sync with RfqCard.
 */
import { SkeletonButton, SkeletonCard, SkeletonLine } from '@/components/connect/Skeleton';

export default function RfqCardSkeleton() {
  return (
    <SkeletonCard>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <SkeletonLine w={44} h={44} radius="var(--cr-radius-md)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <SkeletonLine w="55%" h={14} />
            <SkeletonLine w={64} h={18} radius={999} />
          </div>
          <SkeletonLine w={110} h={10} />
          <SkeletonLine w="70%" h={11} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 12,
              borderTop: '1px solid var(--cr-divider)',
              paddingTop: 10,
            }}
          >
            <SkeletonLine w="45%" h={10} />
            <SkeletonButton w={104} h={34} />
          </div>
        </div>
      </div>
    </SkeletonCard>
  );
}
