/**
 * Route skeleton for /admin/connect/banners. Mirrors the console header + the
 * banner table (a few preview rows) so the swap to the real screen is
 * shift-free. Server-only (no hooks). Mirrors the entitlements loading pattern.
 */
export default function Loading() {
  return (
    <div aria-hidden>
      <div style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <div
          className="skeleton"
          style={{ height: 26, width: 180, borderRadius: 6, marginBottom: 8 }}
        />
        <div className="skeleton" style={{ height: 16, width: 420, borderRadius: 6 }} />
      </div>
      <div
        style={{
          border: '1px solid var(--cr-border-light)',
          borderRadius: 'var(--cr-radius-md)',
          padding: 16,
        }}
      >
        {/* Table header + a few rows. */}
        <div
          className="skeleton"
          style={{ height: 28, width: '100%', borderRadius: 6, marginBottom: 12 }}
        />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div className="skeleton" style={{ height: 30, width: 120, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 16, width: 160, borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 16, width: 200, borderRadius: 6 }} />
            <div
              className="skeleton"
              style={{ height: 24, width: 44, borderRadius: 12, marginLeft: 'auto' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
