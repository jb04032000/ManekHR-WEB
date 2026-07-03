/**
 * Loading skeleton for /connect/boosts (the boosts manager) - mirrors
 * <BoostsManagerScreen>: header (title/lede + wallet CTA), the inline wallet
 * strip, the "how it works" explainer, the "boost something" quick-start, a
 * 4-card KPI strip, the underline tabbar, and a few campaign rows. Server-only
 * (no 'use client');
 * composes the shared Skeleton primitives directly (not via the
 * components/connect barrel, which pulls client components). Keep in sync with
 * features/connect/ads/BoostsManagerScreen.tsx.
 */
import {
  SkeletonCard,
  SkeletonLine,
  SkeletonButton,
  SkeletonCircle,
} from '@/components/connect/Skeleton';
// Same content-width container the real page uses (BoostsManagerScreen wraps in
// ConnectPage), so the skeleton inherits the responsive width (1180px, 1380px on a
// collapsed sidebar) instead of a hardcoded 1180 that left empty space beside it.
import ConnectPage from '@/components/connect/ConnectPage';

/** One KPI card: an icon over a big figure + a label. */
function KpiCardSkeleton() {
  return (
    <SkeletonCard style={{ padding: 16, flex: '1 1 160px' }}>
      <SkeletonCircle size={28} />
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonLine w="50%" h={20} />
        <SkeletonLine w="75%" h={10} />
      </div>
    </SkeletonCard>
  );
}

/** One campaign row: thumb + target/objective + metrics + status/actions. */
function BoostRowSkeleton() {
  return (
    <SkeletonCard style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
        <div
          className="skeleton"
          style={{ width: 48, height: 48, borderRadius: 'var(--cr-radius-md)', flexShrink: 0 }}
        />
        <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonLine w={80} h={10} />
          <SkeletonLine w="55%" h={14} />
          <SkeletonLine w="80%" h={6} />
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}
            >
              <SkeletonLine w={36} h={16} />
              <SkeletonLine w={28} h={8} />
            </div>
          ))}
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          <SkeletonButton w={70} h={22} />
          <SkeletonButton w={120} h={32} />
        </div>
      </div>
    </SkeletonCard>
  );
}

export default function BoostsManagerLoading() {
  return (
    <ConnectPage>
      <div aria-hidden>
        {/* Header: title + lede (no right-side button in the real header). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <SkeletonLine w={140} h={22} />
          <SkeletonLine w={400} h={13} />
        </div>

        {/* Inline wallet strip: icon + balance/reserved + Add-credits */}
        <SkeletonCard style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <SkeletonCircle size={40} />
            <div style={{ display: 'flex', gap: 24 }}>
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonLine w={64} h={10} />
                  <SkeletonLine w={80} h={20} />
                </div>
              ))}
            </div>
            {/* Top-up is gated, so the strip shows a short note here, not a button. */}
            <div style={{ marginLeft: 'auto' }}>
              <SkeletonLine w={170} h={12} />
            </div>
          </div>
        </SkeletonCard>

        {/* "How boosting works" collapses to a single link once there is any boost
          activity (the common returning-user state), so the skeleton mirrors that
          thin line rather than the full first-run explainer card. */}
        <SkeletonLine w={210} h={12} style={{ marginBottom: 20 }} />

        {/* "Boost something" quick-start: heading + a row of item cards */}
        <SkeletonCard style={{ padding: 20, marginBottom: 24 }}>
          <SkeletonLine w={160} h={16} />
          <SkeletonLine w={300} h={12} style={{ marginTop: 8 }} />
          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            }}
          >
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  border: '1px solid var(--cr-border)',
                  borderRadius: 'var(--cr-radius-md)',
                }}
              >
                <div
                  className="skeleton"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--cr-radius-sm)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonLine w="80%" h={13} />
                  <SkeletonLine w="50%" h={10} />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>

        {/* KPI strip (4 cards) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>

        {/* Underline tabbar (4 tabs) */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            borderBottom: '1px solid var(--cr-divider)',
            paddingBottom: 10,
          }}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonButton key={i} w={96} h={24} />
          ))}
        </div>

        {/* A few campaign rows */}
        <div style={{ display: 'grid', gap: 12 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <BoostRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </ConnectPage>
  );
}
