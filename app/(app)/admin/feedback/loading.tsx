// Route skeleton for /admin/feedback. Mirrors header + filter row + table rows
// so the swap to the real screen is shift-free. Server-only (no hooks).
export default function Loading() {
  return (
    <div aria-hidden>
      <div style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <div
          className="skeleton"
          style={{ height: 26, width: 160, borderRadius: 6, marginBottom: 8 }}
        />
        <div className="skeleton" style={{ height: 16, width: 460, borderRadius: 6 }} />
      </div>
      <div
        className="skeleton"
        style={{ height: 36, width: 560, borderRadius: 8, marginBottom: 16 }}
      />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 44, width: '100%', borderRadius: 6, marginBottom: 8 }}
        />
      ))}
    </div>
  );
}
