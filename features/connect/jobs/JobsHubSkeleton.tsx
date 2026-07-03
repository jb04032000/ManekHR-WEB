import { SkeletonLine, SkeletonButton, SkeletonCircle } from '@/components/connect/Skeleton';

/**
 * Tab-aware loading skeleton for the `/connect/jobs` hub. The shared shell (header
 * + Post CTA, 4-card KPI strip, the tab bar, and the right "How hiring works" rail)
 * is identical on every tab; only the CONTENT area differs:
 *   - board (Open jobs): search band + role strip + (filter rail + job-card list)
 *   - myApplications: the count/sort toolbar + application-card rows
 *   - saved / mine: a plain job-card list
 *
 * Why tab-aware: the active tab now lives in `?tab=` (JobBoard), so a hard load /
 * refresh / shared link can land directly on a non-board tab. A route-level
 * loading.tsx can't read searchParams, so the page wraps its data fetch in a
 * <Suspense> whose fallback IS this component with the parsed tab (see page.tsx);
 * loading.tsx renders the board default for the instant before that.
 *
 * Server-only (no 'use client'); composes the shared Skeleton primitives. Keep in
 * sync with features/connect/jobs/JobBoard.tsx + MyApplicationCard.tsx layouts.
 */

type Tab = 'board' | 'mine' | 'myApplications' | 'saved';

const CARD_STYLE = {
  background: 'var(--cr-surface)',
  border: '1px solid var(--cr-border)',
  borderRadius: 'var(--cr-radius-lg)',
} as const;

/** A job-card row (icon + title + meta + tag chips + an action) - board / saved / mine. */
function JobCardRow() {
  return (
    <div className="p-4" style={CARD_STYLE}>
      <div className="flex items-start gap-3">
        <SkeletonCircle size={44} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <SkeletonLine w="60%" h={16} />
          <SkeletonLine w="40%" h={12} />
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

/** An application row (icon + title + employer/location/date + status chip + action). */
function AppCardRow() {
  return (
    <div className="p-4" style={CARD_STYLE}>
      <div className="flex items-start gap-3">
        <SkeletonCircle size={44} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <SkeletonLine w="55%" h={16} />
          <SkeletonLine w="70%" h={12} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <SkeletonLine w={80} h={20} radius={999} />
          <SkeletonButton w={96} h={34} />
        </div>
      </div>
    </div>
  );
}

export default function JobsHubSkeleton({ tab = 'board' }: { tab?: Tab }) {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Header: title/subtitle + Post CTA (shared). */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <SkeletonLine w={180} h={22} />
            <SkeletonLine w={260} h={13} />
          </div>
          <SkeletonButton w={120} h={38} />
        </div>

        {/* KPI strip - 4 cards (shared). */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4" style={CARD_STYLE}>
              <div className="skeleton h-10 w-10" style={{ borderRadius: 'var(--cr-radius-md)' }} />
              <div className="flex flex-col gap-2">
                <SkeletonLine w={36} h={18} />
                <SkeletonLine w={64} h={10} />
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar - label + count chip, scrollable (shared, matches the tablist). */}
        <div
          className="mb-4 flex gap-x-2 overflow-x-auto pb-2"
          style={{ borderBottom: '1px solid var(--cr-divider)' }}
        >
          {[70, 110, 70, 90].map((w, i) => (
            <div key={i} className="flex shrink-0 items-center gap-1.5 px-1">
              <SkeletonLine w={w} h={16} />
              <SkeletonCircle size={18} />
            </div>
          ))}
        </div>

        {tab === 'board' ? (
          <>
            {/* Search band. */}
            <div className="mb-3 flex items-center gap-2 px-3.5 py-2.5" style={CARD_STYLE}>
              <SkeletonCircle size={18} />
              <SkeletonLine w="40%" h={14} />
            </div>
            {/* Role strip. */}
            <div className="mb-4 flex gap-2 overflow-hidden pb-1.5">
              {[80, 96, 100, 104, 90, 88].map((w, i) => (
                <SkeletonLine key={i} w={w} h={36} radius={999} />
              ))}
            </div>
            {/* Filter rail + result list. */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
              <div
                className="flex flex-col gap-4 p-4"
                style={{ background: 'var(--cr-surface-2)', borderRadius: 'var(--cr-radius-md)' }}
              >
                <SkeletonLine w={90} h={11} />
                {[0, 1, 2, 3].map((g) => (
                  <div key={g} className="flex flex-col gap-2">
                    <SkeletonLine w={100} h={12} />
                    <div className="flex flex-wrap gap-1.5">
                      {[56, 64, 48, 72].map((w, i) => (
                        <SkeletonLine key={i} w={w} h={26} radius={999} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <SkeletonLine w={90} h={13} />
                  <SkeletonLine w={130} h={28} radius={8} />
                </div>
                <div className="flex flex-col gap-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <JobCardRow key={i} />
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : tab === 'myApplications' ? (
          <>
            {/* Count + sort toolbar. */}
            <div className="mb-3 flex items-center justify-between">
              <SkeletonLine w={120} h={13} />
              <SkeletonLine w={170} h={28} radius={8} />
            </div>
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <AppCardRow key={i} />
              ))}
            </div>
          </>
        ) : (
          // saved / mine: a plain job-card list (no rail / search / strip).
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <JobCardRow key={i} />
            ))}
          </div>
        )}
      </main>

      {/* Right rail (shared across tabs): the "How hiring works" panel. */}
      <aside
        className="hidden shrink-0 lg:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div style={{ ...CARD_STYLE, padding: 'var(--cr-space-md)' }}>
          <SkeletonLine w={120} h={12} />
          <div className="mt-3 flex flex-col gap-2">
            <SkeletonLine w="100%" h={11} />
            <SkeletonLine w="85%" h={11} />
            <SkeletonLine w="70%" h={11} />
          </div>
        </div>
      </aside>
    </div>
  );
}
