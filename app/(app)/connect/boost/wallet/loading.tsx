/**
 * Loading skeleton for /connect/boost/wallet - mirrors <WalletPanel>: a header
 * (icon + title/subtitle), the balance card (balance + reserved), and the
 * top-up card (preset chips + amount input + add-credits button). Server-only
 * (no 'use client'); composes the shared Skeleton primitives so the swap is
 * shift-free. Keep in sync with features/connect/ads/WalletPanel.tsx.
 */
import {
  SkeletonCard,
  SkeletonLine,
  SkeletonButton,
  SkeletonCircle,
} from '@/components/connect/Skeleton';

export default function WalletLoading() {
  return (
    <main aria-hidden className="w-full" style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Header: icon + title/subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <SkeletonCircle size={40} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLine w={150} h={20} />
          <SkeletonLine w={220} h={13} />
        </div>
      </div>

      {/* Balance card: balance + reserved */}
      <SkeletonCard style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine w={90} h={12} />
            <SkeletonLine w={110} h={26} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine w={70} h={12} />
            <SkeletonLine w={90} h={26} />
          </div>
        </div>
      </SkeletonCard>

      {/* Top-up card: presets + amount input + button */}
      <SkeletonCard style={{ padding: 20 }}>
        <SkeletonLine w={120} h={15} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonButton key={i} w={72} h={32} />
          ))}
        </div>
        <SkeletonLine w={100} h={12} />
        <div style={{ marginTop: 8 }}>
          <SkeletonButton w={220} h={38} />
        </div>
        <div style={{ marginTop: 16 }}>
          <SkeletonButton w={150} h={44} />
        </div>
      </SkeletonCard>
    </main>
  );
}
