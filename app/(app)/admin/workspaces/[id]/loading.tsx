// Route skeleton for /admin/workspaces/[id] (AC-3.5, binding rule). Mirrors the
// real screen: a back-link, then two stacked cards (Workspace Info, Email
// Configuration). Server-only (no 'use client', no hooks); aria-hidden. Uses the
// shared `.skeleton` shimmer, matching the other admin loaders.
function CardSkeleton({ titleW, rows }: { titleW: number; rows: number }) {
  return (
    <div
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 'var(--cr-space-md)',
        marginBottom: 'var(--cr-space-md)',
      }}
    >
      <div
        className="skeleton"
        style={{ height: 18, width: titleW, borderRadius: 6, marginBottom: 16 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 16, width: i % 2 === 0 ? '70%' : '50%', borderRadius: 6 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-hidden>
      {/* Back link */}
      <div
        className="skeleton"
        style={{ height: 32, width: 150, borderRadius: 8, marginBottom: 16 }}
      />
      <CardSkeleton titleW={140} rows={4} />
      <CardSkeleton titleW={180} rows={6} />
    </div>
  );
}
