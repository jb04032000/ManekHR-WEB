import {
  SkeletonButton,
  SkeletonCard,
  SkeletonCircle,
  SkeletonLine,
} from '@/components/connect/Skeleton';

/**
 * ProfileSkeleton - loading placeholder for the profile screens (own + in-app +
 * public) and their route `loading.tsx`. Server-renderable. Mirrors
 * `ProfileView`: the identity header card (banner -> overlapping avatar -> name /
 * headline / 3-stat counts row / IntentCards grid), the body section cards, and
 * the right rail (strength + ERP) on `lg` - so the swap to content does not shift.
 *
 * Kept in sync with `ProfileView.tsx`: the header stats row now carries three
 * counts (connections / followers / profile-views) and the old flat openTo pill
 * row was replaced by the `IntentCards` grid (a `sm:grid-cols-2` set of bordered
 * cards, each a title + detail line + CTA). The placeholders below mirror both.
 */
export default function ProfileSkeleton() {
  const header = (
    <SkeletonCard style={{ padding: 0, overflow: 'hidden' }}>
      {/* Banner - 4:1, the ratio ProfileView locks. */}
      <div
        className="skeleton"
        style={{ width: '100%', aspectRatio: '4 / 1', maxHeight: 256, borderRadius: 0 }}
      />
      <div className="px-4 pb-4 sm:px-6 sm:pb-5">
        {/* Overlapping avatar + identity lines. The negative margin lives on
            the AVATAR alone (mirrors ProfileView's `-mt-12 sm:-mt-14`) so the
            name / headline lines stay in the white area below the banner. The
            earlier `marginTop: -48` on the whole row dragged the identity lines
            up across the banner seam - the reported skeleton bug. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="-mt-12 sm:-mt-14" style={{ flexShrink: 0 }}>
            <span
              className="inline-flex rounded-full"
              style={{ padding: 4, background: 'var(--cr-surface)' }}
            >
              <SkeletonCircle size={96} />
            </span>
          </div>
          <div
            className="min-w-0 flex-1 sm:pt-3"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {/* Name + headline. */}
            <SkeletonLine w={200} h={22} />
            <SkeletonLine w={280} h={13} />
            {/* Social-proof counts row - three short lines now: connections,
                followers, and (own screen only) profile-views. Mirrors the
                three inline spans ProfileView renders in the counts row. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 2 }}>
              <SkeletonLine w={84} h={12} />
              <SkeletonLine w={74} h={12} />
              <SkeletonLine w={96} h={12} />
            </div>
          </div>
        </div>
        {/* IntentCards grid - the rich "open to" cards that replaced the flat
            pill row. Mirrors ProfileView's `mt-4` wrapper + IntentCards'
            `grid gap-3 sm:grid-cols-2`: two bordered cards, each a title +
            detail line + a CTA button. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} style={{ borderRadius: 'var(--cr-radius-lg)' }}>
              <SkeletonLine w="55%" h={14} />
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonLine w="90%" h={11} />
                <SkeletonLine w="70%" h={11} />
              </div>
              <div style={{ marginTop: 12 }}>
                <SkeletonButton w={120} h={28} />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonCard>
  );

  const section = (key: number, lines: number) => (
    <SkeletonCard key={key}>
      <SkeletonLine w={120} h={14} />
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonLine key={i} w={i === lines - 1 ? '70%' : '95%'} h={11} />
        ))}
      </div>
    </SkeletonCard>
  );

  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Right rail - strength + ERP panels (column 2 on lg). min-w-0 keeps the
            single mobile grid column shrinkable (matches ProfileView). */}
        <aside className="flex min-w-0 flex-col gap-4 lg:col-start-2">
          <SkeletonRailCard titleW={140} rows={2} />
          <SkeletonRailCard titleW={120} rows={1} />
        </aside>
        {/* Main - header + body sections (column 1 on lg). */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          {header}
          {section(0, 2)}
          {section(1, 3)}
          {section(2, 2)}
        </div>
      </div>
    </div>
  );
}

/** A small rail card (title + body lines) - local to the profile skeleton. */
function SkeletonRailCard({ titleW, rows }: { titleW: number; rows: number }) {
  return (
    <SkeletonCard>
      <SkeletonLine w={titleW} h={12} />
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonLine key={i} w="90%" h={10} />
        ))}
      </div>
    </SkeletonCard>
  );
}
