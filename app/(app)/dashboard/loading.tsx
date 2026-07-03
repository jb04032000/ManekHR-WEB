// Route loading skeleton for the ManekHR HR overview landing. Mirrors
// HrOverview's anatomy section-for-section so the swap to content is shift-free:
// greeting header, a 4-up metric-card row, two wide cards (payroll snapshot +
// designation breakdown), and a quick-links strip. Server-only (no 'use client');
// composes the shared Connect skeleton primitives (binding loading-skeleton rule).
import { SkeletonLine } from '@/components/connect/Skeleton';

const card = (h: number) => <div className="skeleton" style={{ height: h, borderRadius: 16 }} />;

export default function DashboardLoading() {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
      {/* Greeting header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonLine w={260} h={26} />
        <SkeletonLine w={320} h={14} />
      </div>

      {/* Metric cards (4-up) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i}>{card(132)}</div>
        ))}
      </div>

      {/* Payroll snapshot + designation breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[...Array(2)].map((_, i) => (
          <div key={i}>{card(300)}</div>
        ))}
      </div>

      {/* Quick links strip */}
      {card(140)}
    </div>
  );
}
