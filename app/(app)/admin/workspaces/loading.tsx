// Route skeleton for /admin/workspaces (AC-3.5, binding rule). Mirrors the real
// screen: a card with a title + search box in the header, then a table of
// workspace rows. Server-only (no 'use client', no hooks); aria-hidden so SRs
// skip it. Uses the shared `.skeleton` shimmer, matching the other admin loaders.
export default function Loading() {
  return (
    <div aria-hidden>
      <div
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
          padding: 'var(--cr-space-md)',
        }}
      >
        {/* Card header: title + search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--cr-space-md)',
          }}
        >
          <div className="skeleton" style={{ height: 20, width: 160, borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 32, width: 220, borderRadius: 8 }} />
        </div>
        {/* Table header strip */}
        <div
          className="skeleton"
          style={{ height: 40, width: '100%', borderRadius: 6, marginBottom: 8 }}
        />
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 48, width: '100%', borderRadius: 6, marginBottom: 8 }}
          />
        ))}
      </div>
    </div>
  );
}
