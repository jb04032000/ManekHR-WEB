import {
  SkeletonCard,
  SkeletonCircle,
  SkeletonLine,
  SkeletonPersonRow,
  SkeletonRailPanel,
} from '@/components/connect/Skeleton';

/**
 * `/connect/feed` loading skeleton - mirrors `FeedScreen` section-for-section so
 * the swap to real content is shift-free (binding: route loading skeletons).
 *
 * Layout parity with FeedScreen (`features/connect/feed/FeedScreen.tsx`):
 *  - Wrapper matches `ConnectPage` ("mx-auto w-full flex justify-center gap-5",
 *    capped by --cn-content-max-w) so the column geometry is identical.
 *  - LEFT rail returns at `lg` (Rail breakpoint="lg"): mini-profile card +
 *    strength meter + quick-links / ERP / promo panels.
 *  - CENTRE column width comes from --cn-feed-max-w (600 / 680 collapsed). On
 *    mobile it carries the in-feed profile card (lg:hidden) + PYMK (md:hidden)
 *    that the rails own at larger widths, so the small-screen skeleton matches.
 *  - RIGHT rail returns at `xl` (default Rail breakpoint): people + companies +
 *    industry + trending panels.
 *
 * Server-only: no 'use client', no hooks. Primitives come straight from
 * `components/connect/Skeleton` (not the client barrel). Keep the rail panel
 * counts in sync with FeedScreen if its rail composition changes.
 */
export default function ConnectFeedLoading() {
  return (
    <div
      className="mx-auto flex w-full justify-center gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      {/* LEFT RAIL - returns at lg, like Rail side="left" breakpoint="lg". */}
      <aside className="hidden shrink-0 lg:block" style={{ width: 'var(--cn-rail-left-w, 240px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
          {/* Mini-profile card - banner strip + overlapping avatar + identity. */}
          <SkeletonCard style={{ padding: 0, overflow: 'hidden' }}>
            <div className="skeleton" style={{ height: 56, borderRadius: 0 }} />
            <div
              style={{
                padding: '0 var(--cr-space-md) var(--cr-space-md)',
                marginTop: -22,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <SkeletonCircle size={56} />
              <SkeletonLine w="62%" h={13} />
              <SkeletonLine w="82%" h={10} />
            </div>
          </SkeletonCard>

          {/* Profile-strength meter - title + progress bar + a few checklist rows. */}
          <SkeletonCard>
            <SkeletonLine w={120} h={12} />
            <SkeletonLine w="100%" h={8} radius="var(--cr-radius-full)" style={{ marginTop: 12 }} />
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SkeletonCircle size={18} />
                  <SkeletonLine w="70%" h={11} />
                </div>
              ))}
            </div>
          </SkeletonCard>

          {/* Quick links (6) + ERP shortcut + promo panels. */}
          <SkeletonRailPanel titleW={110} rows={6} />
          <SkeletonRailPanel titleW={90} rows={2} />
          <SkeletonRailPanel titleW={120} rows={2} />
        </div>
      </aside>

      {/* CENTRE COLUMN - width from the sidebar-responsive feed token. */}
      <main className="w-full" style={{ maxWidth: 'var(--cn-feed-max-w, 600px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
          {/* In-feed profile card - only below lg (the left rail carries it at lg+),
              matching FeedScreen's `lg:hidden` FeedProfileCard. */}
          <div className="lg:hidden">
            <SkeletonCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SkeletonCircle size={44} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonLine w="50%" h={12} />
                  <SkeletonLine w="70%" h={10} />
                </div>
              </div>
              <SkeletonLine
                w="100%"
                h={8}
                radius="var(--cr-radius-full)"
                style={{ marginTop: 12 }}
              />
            </SkeletonCard>
          </div>

          {/* Composer card - avatar + share trigger, then the 3 media shortcuts
              (Photo / Video / Voice) under a divider. */}
          <SkeletonCard style={{ padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <SkeletonCircle size={40} />
              <SkeletonLine w="100%" h={44} radius="var(--cr-radius-full)" />
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                borderTop: '1px solid var(--cr-border-light)',
                padding: '10px 14px',
              }}
            >
              {[0, 1, 2].map((i) => (
                <SkeletonLine key={i} w="100%" h={20} />
              ))}
            </div>
          </SkeletonCard>
        </div>

        {/* Tabs (For you / Following). */}
        <div
          style={{
            display: 'flex',
            gap: 18,
            borderBottom: '1px solid var(--cr-border)',
            padding: '14px 4px 12px',
            marginTop: 'var(--cr-space-md)',
          }}
        >
          {[80, 72].map((w, i) => (
            <SkeletonLine key={i} w={w} h={14} />
          ))}
        </div>

        {/* In-feed people-to-follow - only below md (the right rail carries it at
            xl+), matching FeedScreen's `md:hidden` FeedPeopleToFollow. */}
        <div className="md:hidden" style={{ marginTop: 'var(--cr-space-md)' }}>
          <SkeletonCard>
            <SkeletonLine w={130} h={11} />
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[0, 1].map((i) => (
                <SkeletonPersonRow key={i} avatar={36} />
              ))}
            </div>
          </SkeletonCard>
        </div>

        {/* Post cards - header (avatar + name + meta), body lines, media, actions. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            marginTop: 'var(--cr-space-lg)',
          }}
        >
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SkeletonCircle size={40} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonLine w="40%" h={12} />
                  <SkeletonLine w="55%" h={10} />
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SkeletonLine w="95%" h={11} />
                <SkeletonLine w="85%" h={11} />
              </div>
              <SkeletonLine
                w="100%"
                h={180}
                radius="var(--cr-radius-md)"
                style={{ marginTop: 12 }}
              />
              <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
                {[60, 70, 60].map((w, j) => (
                  <SkeletonLine key={j} w={w} h={14} />
                ))}
              </div>
            </SkeletonCard>
          ))}
        </div>
      </main>

      {/* RIGHT RAIL - returns at xl, like the default Rail side="right". */}
      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
          {/* People to follow. */}
          <SkeletonCard>
            <SkeletonLine w={130} h={10} />
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[0, 1, 2].map((i) => (
                <SkeletonPersonRow key={i} avatar={36} />
              ))}
            </div>
          </SkeletonCard>

          {/* Companies to follow. */}
          <SkeletonCard>
            <SkeletonLine w={150} h={10} />
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[0, 1, 2].map((i) => (
                <SkeletonPersonRow key={i} avatar={36} />
              ))}
            </div>
          </SkeletonCard>

          {/* Industry + trending panels. */}
          <SkeletonRailPanel titleW={130} rows={3} />
          <SkeletonRailPanel titleW={110} rows={3} />
        </div>
      </aside>
    </div>
  );
}
