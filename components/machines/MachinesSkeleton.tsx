// Shared route loading skeletons for the Machines module. Server-only (no
// 'use client', no hooks) so each machines route's loading.tsx can render it as
// an instant Suspense fallback during navigation - the machines pages already
// show internal <Skeleton> once mounted; this covers the gap before mount.
//
// Cross-link: app/dashboard/machines/**/loading.tsx. Variants mirror the real
// page chrome (DsPageHeader row + content) to avoid layout shift on swap, per the
// route-loading-skeleton rule in crewroster-web/CLAUDE.md. Keep shapes roughly
// aligned with the page they stand in for if those layouts change.

const bar = (w: string, h = 14, r = 6): React.CSSProperties => ({
  width: w,
  height: h,
  borderRadius: r,
  background: 'var(--cr-surface-2, #eee)',
});

const card: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--cr-border, #eee)',
  background: 'var(--cr-surface, #fff)',
};

/** DsPageHeader stand-in: title block + optional right-side action buttons. */
function HeaderRow({ actions = 1 }: { actions?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={bar('200px', 22)} />
        <div style={bar('320px', 12)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: actions }).map((_, i) => (
          <div key={i} style={bar('120px', 34)} />
        ))}
      </div>
    </div>
  );
}

function TableBlock({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ['120px', '90px', '160px', '80px', '100px', '70px'];
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '14px 16px',
            borderTop: i === 0 ? 'none' : '1px solid var(--cr-border-light, #f0f0f0)',
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} style={bar(widths[c % widths.length])} />
          ))}
        </div>
      ))}
    </div>
  );
}

function TileRow({ count }: { count: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`,
        gap: 10,
        marginBottom: 16,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ ...card, padding: '14px 16px' }}>
          <div style={{ ...bar('70%', 10), marginBottom: 10 }} />
          <div style={bar('50%', 20)} />
        </div>
      ))}
    </div>
  );
}

function TabBar() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        padding: '0 4px 12px',
        marginBottom: 16,
        borderBottom: '1px solid var(--cr-border, #eee)',
      }}
    >
      {['64px', '74px', '70px', '58px', '66px'].map((w, i) => (
        <div key={i} style={bar(w, 16)} />
      ))}
    </div>
  );
}

export type MachinesSkeletonVariant = 'list' | 'detail' | 'board' | 'form';

/**
 * @param variant
 *  - `list`   list pages (machines, locations, resource-scopes, bulk entry)
 *  - `detail` machine detail (header + KPI tiles + tabbed body)
 *  - `board`  shop-floor control board (chips + KPI grid + tabbed canvas)
 *  - `form`   create machine (header + form card)
 */
export function MachinesSkeleton({ variant = 'list' }: { variant?: MachinesSkeletonVariant }) {
  return (
    <div aria-hidden className="animate-pulse" style={{ padding: 24 }}>
      {variant === 'board' && (
        <>
          <HeaderRow actions={3} />
          {/* order filter chips */}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 16 }}>
            {['110px', '140px', '130px', '120px'].map((w, i) => (
              <div key={i} style={bar(w, 34, 999)} />
            ))}
          </div>
          <TileRow count={6} />
          <TabBar />
          <div style={{ ...card, height: 360 }} />
        </>
      )}

      {variant === 'detail' && (
        <>
          <HeaderRow actions={2} />
          <TileRow count={4} />
          <TabBar />
          <div style={{ ...card, height: 260 }} />
        </>
      )}

      {variant === 'form' && (
        <>
          <HeaderRow actions={1} />
          <div style={{ ...card, padding: 24, maxWidth: 720 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <div style={{ ...bar('120px', 12), marginBottom: 8 }} />
                <div style={bar('100%', 34)} />
              </div>
            ))}
            <div style={{ ...bar('140px', 38), marginTop: 8 }} />
          </div>
        </>
      )}

      {variant === 'list' && (
        <>
          <HeaderRow actions={1} />
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <div style={bar('260px', 34)} />
            <div style={bar('180px', 34)} />
          </div>
          <TableBlock rows={9} />
        </>
      )}
    </div>
  );
}
