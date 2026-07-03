/**
 * Route skeleton for /admin/connect/entitlements. Mirrors the header + search
 * card so the swap to the real screen is shift-free. Server-only (no hooks).
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
        <div className="skeleton" style={{ height: 36, width: 460, borderRadius: 8 }} />
      </div>
    </div>
  );
}
