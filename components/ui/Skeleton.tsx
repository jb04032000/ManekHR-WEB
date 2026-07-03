/**
 * Connect skeleton primitives - plain, SERVER-RENDERABLE building blocks (no
 * `use client`, no hooks) that all use the shared `.skeleton` shimmer
 * (globals.css). Compose these into per-screen loaders so each skeleton mirrors
 * its real layout section-for-section → zero layout shift on the swap to
 * content, and a believable "this exact page is loading" placeholder.
 *
 * Import directly so a server
 * `loading.tsx` doesn't pull the barrel's client components.
 */
import type { CSSProperties, ReactNode } from 'react';

/** A shimmering bar. `w`/`h` accept px numbers or CSS strings (e.g. '60%'). */
export function SkeletonLine({
  w = '100%',
  h = 12,
  radius,
  style,
}: {
  w?: number | string;
  h?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, ...(radius != null ? { borderRadius: radius } : {}), ...style }}
    />
  );
}

/** A circular shimmer (avatar). */
export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return (
    <div
      className="skeleton"
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
    />
  );
}

/** A pill/button-shaped shimmer. */
export function SkeletonButton({ w = 84, h = 30 }: { w?: number | string; h?: number }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: 8, flexShrink: 0 }} />
  );
}

/** A bordered card frame (mirrors a surface card / `RailPanel`). */
export function SkeletonCard({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 'var(--cr-space-md)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A rail panel: an uppercase-title line + a stack of body lines. */
export function SkeletonRailPanel({ titleW = 120, rows = 3 }: { titleW?: number; rows?: number }) {
  return (
    <SkeletonCard>
      <SkeletonLine w={titleW} h={10} />
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonLine key={i} w={i % 2 === 0 ? '90%' : '70%'} h={11} />
        ))}
      </div>
    </SkeletonCard>
  );
}

/** Avatar + name/sub lines + optional trailing action - the people-card row. */
export function SkeletonPersonRow({
  action = true,
  avatar = 44,
}: {
  action?: boolean;
  avatar?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cr-space-sm)' }}>
      <SkeletonCircle size={avatar} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonLine w="42%" h={12} />
        <SkeletonLine w="64%" h={10} />
      </div>
      {action && <SkeletonButton />}
    </div>
  );
}
