/**
 * BoostComposerSkeleton - the shared loading skeleton for the three boost
 * composer routes (listing / job / post), which all render the SAME
 * <BoostComposer>. Mirrors its layout: a title/lede header, the LEFT
 * configurator column (4 numbered step cards), and the RIGHT sticky checkout
 * rail (preview + order summary + how-it-works). Server-only (no 'use client',
 * no hooks); composes the shared Skeleton primitives so the swap to the real
 * composer is shift-free.
 *
 * Each route's co-located loading.tsx just re-exports this. Keep in sync with
 * features/connect/ads/BoostComposer.tsx if its section anatomy moves.
 */
import {
  SkeletonCard,
  SkeletonLine,
  SkeletonButton,
  SkeletonCircle,
} from '@/components/connect/Skeleton';

/** One numbered step card: a header band (number + title/sub) + a body block. */
function StepCardSkeleton({ bodyRows = 3 }: { bodyRows?: number }) {
  return (
    <SkeletonCard style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--cr-divider)',
        }}
      >
        <SkeletonCircle size={26} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLine w="40%" h={13} />
          <SkeletonLine w="60%" h={10} />
        </div>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {Array.from({ length: bodyRows }, (_, i) => (
          <SkeletonButton key={i} w={i % 2 === 0 ? 140 : 96} h={36} />
        ))}
      </div>
    </SkeletonCard>
  );
}

/** A rail card: uppercase title band + a body block. */
function RailCardSkeleton({ bodyRows = 3 }: { bodyRows?: number }) {
  return (
    <SkeletonCard style={{ padding: 0, overflow: 'hidden', boxShadow: 'var(--cr-shadow-card)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cr-divider)' }}>
        <SkeletonLine w={90} h={10} />
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: bodyRows }, (_, i) => (
          <SkeletonLine key={i} w={i % 2 === 0 ? '85%' : '65%'} h={12} />
        ))}
      </div>
    </SkeletonCard>
  );
}

export default function BoostComposerSkeleton() {
  return (
    <div aria-hidden style={{ maxWidth: 1180, margin: '0 auto', padding: '0 4px' }}>
      {/* Header: title + lede on the left, a Cancel pill on the right. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonLine w={180} h={22} />
          <SkeletonLine w={420} h={13} />
        </div>
        <SkeletonButton w={90} h={36} />
      </div>

      {/* Two-column grid: configurator + sticky rail (collapses under 1024px). */}
      <div className="bzl-grid" style={{ display: 'grid', alignItems: 'start', gap: 20 }}>
        {/* LEFT: 4 step cards. */}
        <div style={{ minWidth: 0 }}>
          <StepCardSkeleton bodyRows={2} />
          <StepCardSkeleton bodyRows={2} />
          <StepCardSkeleton bodyRows={4} />
          <StepCardSkeleton bodyRows={3} />
        </div>

        {/* RIGHT: sticky checkout rail. */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RailCardSkeleton bodyRows={4} />
          <RailCardSkeleton bodyRows={4} />
          <RailCardSkeleton bodyRows={2} />
        </aside>
      </div>

      <style>{`
        .bzl-grid { grid-template-columns: minmax(0, 1fr) 340px; }
        @media (max-width: 1024px) { .bzl-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
