import { SkeletonLine, SkeletonPersonRow, SkeletonRailPanel } from '@/components/connect/Skeleton';

/**
 * Route-level loading UI for `/connect/network` - mirrors `NetworkScreen`
 * section-for-section: a flex row of the main column (title → tab bar → person
 * rows) and the right rail ("Manage my network" + "Grow your network" panels),
 * so the swap to real content does not shift.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        {/* Title */}
        <SkeletonLine w={170} h={24} style={{ marginBottom: 'var(--cr-space-md)' }} />

        {/* Tab bar (Invitations · Connections · Following · Followers · Suggestions) */}
        <div
          style={{
            display: 'flex',
            gap: 18,
            borderBottom: '1px solid var(--cr-border)',
            paddingBottom: 12,
          }}
        >
          {[80, 96, 84, 84, 92].map((w, i) => (
            <SkeletonLine key={i} w={w} h={14} />
          ))}
        </div>

        {/* Person rows */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--cr-space-md)',
            paddingTop: 'var(--cr-space-lg)',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <SkeletonPersonRow key={i} />
          ))}
        </div>
      </main>

      {/* Right rail - Manage my network + Grow your network. */}
      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 280px)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
          <SkeletonRailPanel titleW={140} rows={2} />
          <SkeletonRailPanel titleW={120} rows={2} />
        </div>
      </aside>
    </div>
  );
}
