import { SkeletonLine, SkeletonPersonRow, SkeletonRailPanel } from '@/components/connect/Skeleton';

/**
 * Route-level loading UI for `/connect/search` - mirrors the redesigned
 * `SearchResultsScreen`: header (title -> subtitle), the type-tab strip, the
 * facet bar, and a framed result-section CARD of people rows, plus the right
 * "Search tips" rail. Keep in sync with the card layout in SearchResultsScreen /
 * SearchResultSection so the skeleton -> content swap stays shift-free (binding
 * route-skeleton rule).
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Header: title -> subtitle */}
        <div style={{ marginBottom: 'var(--cr-space-md)' }}>
          <SkeletonLine w={140} h={22} />
          <SkeletonLine w={260} h={13} style={{ marginTop: 8 }} />
        </div>

        {/* Type-tab strip (mirrors ModuleTabs: a row of labels over a divider). */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--cr-space-md)',
            paddingBottom: 'var(--cr-space-sm)',
            marginBottom: 'var(--cr-space-md)',
            borderBottom: '1px solid var(--cr-border)',
          }}
        >
          {[40, 54, 48, 60, 44, 52].map((w, i) => (
            <SkeletonLine key={i} w={w} h={14} />
          ))}
        </div>

        {/* Facet bar (mirrors FacetPanel: a cream rounded filter strip). */}
        <SkeletonLine
          w="100%"
          h={56}
          radius="var(--cr-radius-md)"
          style={{ marginBottom: 'var(--cr-space-md)' }}
        />

        {/* Result section card: section-title header + people rows with dividers. */}
        <div
          className="cr-surface"
          style={{ boxShadow: 'var(--cr-shadow-card)', overflow: 'hidden' }}
        >
          <div
            style={{
              padding: 'var(--cr-space-md) var(--cr-space-md) var(--cr-space-sm)',
              borderBottom: '1px solid var(--cr-border-light)',
            }}
          >
            <SkeletonLine w={96} h={15} />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                borderBottom: i < 4 ? '1px solid var(--cr-border-light)' : 'none',
              }}
            >
              <SkeletonPersonRow avatar={40} />
            </div>
          ))}
        </div>
      </main>

      {/* Right rail - Search tips. */}
      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 280px)' }}
      >
        <SkeletonRailPanel titleW={90} rows={3} />
      </aside>
    </div>
  );
}
