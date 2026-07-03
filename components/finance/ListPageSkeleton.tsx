// Shared loading skeleton for finance list pages (DsPageHeader row + filter bar + table).
// Server-only (no 'use client', no hooks) so it can be used directly inside a route
// loading.tsx. Cross-link: app/.../finance/.../sales/*/loading.tsx. Watch: keep the shape
// (header + N filters + rows) aligned with the list pages it stands in for, per the binding
// loading.tsx rule (mirror the real layout to avoid layout shift on swap).
const bar = (w: string, h = 14): React.CSSProperties => ({
  width: w,
  height: h,
  borderRadius: 6,
  background: 'var(--cr-surface-2, #eee)',
});

export function ListPageSkeleton({ filters = 5, rows = 9 }: { filters?: number; rows?: number }) {
  const filterWidths = ['240px', '200px', '180px', '140px', '160px'];
  return (
    <div aria-hidden className="animate-pulse">
      {/* Header: title + CTA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={bar('180px', 24)} />
        <div style={bar('130px', 34)} />
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          padding: 16,
          marginBottom: 16,
          borderRadius: 8,
          background: 'var(--cr-surface, #fff)',
          border: '1px solid var(--cr-border, #eee)',
        }}
      >
        {Array.from({ length: filters }).map((_, i) => (
          <div key={i} style={bar(filterWidths[i % filterWidths.length], 32)} />
        ))}
      </div>

      {/* Table rows */}
      <div
        style={{
          borderRadius: 8,
          border: '1px solid var(--cr-border, #eee)',
          background: 'var(--cr-surface, #fff)',
          overflow: 'hidden',
        }}
      >
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
            <div style={bar('120px')} />
            <div style={bar('90px')} />
            <div style={bar('160px')} />
            <div style={bar('80px')} />
            <div style={bar('100px')} />
          </div>
        ))}
      </div>
    </div>
  );
}
