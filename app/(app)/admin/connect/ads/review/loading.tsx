/**
 * Route skeleton for /admin/connect/ads/review - mirrors <AdminAdReview>:
 * a heading, a revenue tile, the Pending review queue, the Live boosts list, the
 * Placements list, and the Pricing card. Server-only (no hooks); uses the shared
 * .skeleton shimmer so the swap to the real console is shift-free.
 * Keep in sync with features/connect/ads/AdminAdReview.tsx.
 */

/** A bordered card placeholder with a row of content lines. */
function CardSkeleton({ height = 64 }: { height?: number }) {
  return (
    <div
      style={{
        border: '1px solid var(--cr-border-light)',
        borderRadius: 'var(--cr-radius-md)',
        padding: 16,
      }}
    >
      <div className="skeleton" style={{ height, width: '100%', borderRadius: 8 }} />
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Heading + lede */}
      <div>
        <div
          className="skeleton"
          style={{ height: 28, width: 220, borderRadius: 6, marginBottom: 8 }}
        />
        <div className="skeleton" style={{ height: 16, width: 440, borderRadius: 6 }} />
      </div>

      {/* Revenue tile */}
      <div className="skeleton" style={{ height: 78, width: 280, borderRadius: 16 }} />

      {/* Pending review */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 22, width: 160, borderRadius: 6 }} />
        <CardSkeleton height={120} />
        <CardSkeleton height={120} />
      </section>

      {/* Live boosts */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 22, width: 130, borderRadius: 6 }} />
        <CardSkeleton />
        <CardSkeleton />
      </section>

      {/* Placements */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 22, width: 120, borderRadius: 6 }} />
        <CardSkeleton />
        <CardSkeleton />
      </section>

      {/* Pricing */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 22, width: 90, borderRadius: 6 }} />
        <CardSkeleton height={140} />
      </section>
    </div>
  );
}
