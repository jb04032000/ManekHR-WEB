/**
 * RfqHubSkeleton - the tab-aware loading skeleton for /connect/rfq. SERVER-
 * RENDERABLE (no 'use client'): composed by both the route loading.tsx (board
 * default) and the page's Suspense fallback (which knows the ?tab=). Mirrors
 * RfqBoard section-for-section: header + post CTA, 4-up KPI strip, tab bar,
 * then the tab's body (board = search band + chip row + rail|results grid;
 * mine/myQuotes = a plain card list). Keep in sync with RfqBoard's layout.
 */
import {
  SkeletonButton,
  SkeletonCard,
  SkeletonLine,
  SkeletonRailPanel,
} from '@/components/connect/Skeleton';
import RfqCardSkeleton from './RfqCardSkeleton';

export default function RfqHubSkeleton({ tab = 'board' }: { tab?: 'board' | 'mine' | 'myQuotes' }) {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
    >
      <main className="min-w-0 flex-1">
        {/* Header: title + subtitle left, post CTA right. */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <SkeletonLine w={210} h={20} />
            <SkeletonLine w={300} h={12} />
          </div>
          <SkeletonButton w={140} h={36} />
        </div>

        {/* KPI strip (2-up / 4-up). */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SkeletonLine w={24} h={24} radius="var(--cr-radius-md)" />
                <SkeletonLine w={40} h={22} />
              </div>
              <div style={{ marginTop: 6 }}>
                <SkeletonLine w="70%" h={10} />
              </div>
            </SkeletonCard>
          ))}
        </div>

        {/* Tab bar. */}
        <div
          className="mb-4 flex gap-1 pb-2.5"
          style={{ borderBottom: '1px solid var(--cr-divider)' }}
        >
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="px-3.5">
              <SkeletonLine w={92} h={14} />
            </div>
          ))}
        </div>

        {tab === 'board' ? (
          <>
            {/* Search band. */}
            <div className="mb-3">
              <SkeletonLine w="100%" h={46} radius="var(--cr-radius-lg)" />
            </div>
            {/* Category chip row. */}
            <div className="mb-4 flex gap-2 overflow-hidden pb-1.5">
              {Array.from({ length: 7 }, (_, i) => (
                <SkeletonButton key={i} w={i === 0 ? 76 : 120} h={36} />
              ))}
            </div>
            {/* Rail | results. */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
              <div className="hidden lg:block">
                <SkeletonRailPanel titleW={70} rows={9} />
              </div>
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <SkeletonLine w={170} h={12} />
                  <SkeletonLine w={130} h={24} radius="var(--cr-radius-md)" />
                </div>
                <div className="grid gap-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <RfqCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <RfqCardSkeleton key={i} />
            ))}
          </div>
        )}
      </main>

      {/* Right rail (hidden below xl, same as ConnectRightRail). */}
      <aside className="hidden w-[300px] shrink-0 xl:block">
        <SkeletonRailPanel titleW={140} rows={3} />
      </aside>
    </div>
  );
}
