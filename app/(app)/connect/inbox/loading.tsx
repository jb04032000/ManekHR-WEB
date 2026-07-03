// Side-effect import so the fixed full-screen `.cn-inbox-shell` layout (top:64px,
// left: sidebar width, fill to bottom) applies to the skeleton too - it then sits
// exactly where InboxScreen will, so the swap to content is shift-free.
import '@/features/connect/inbox/inbox.css';
import { SkeletonLine, SkeletonCircle } from '@/components/connect/Skeleton';

/**
 * Loading UI for `/connect/inbox` (the messaging hub). Mirrors InboxScreen: the
 * full-screen chat shell with a left thread-list column (search + channel chips +
 * thread rows) and a right conversation pane (header + message bubbles + composer).
 * On the no-thread landing the pane is desktop-only (md:flex), matching the real
 * responsive shell. Server-only; root aria-hidden. Keep in sync with
 * features/connect/inbox/InboxScreen.tsx.
 */

/** One thread-list row: avatar + name/time + a preview line. */
function ThreadRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <SkeletonCircle size={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <SkeletonLine w="45%" h={13} />
          <SkeletonLine w={32} h={10} />
        </div>
        <SkeletonLine w="75%" h={11} />
      </div>
    </div>
  );
}

/** One chat bubble (left = received, right = sent). */
function BubbleSkeleton({ mine, w }: { mine?: boolean; w: string }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="skeleton" style={{ width: w, height: 40, borderRadius: 14 }} />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="cn-inbox-shell" aria-hidden>
      {/* Thread list (left): full width on mobile, fixed 340px on desktop. */}
      <div
        className="flex w-full flex-col md:w-[340px] md:flex-shrink-0"
        style={{ borderRight: '1px solid var(--cr-border)' }}
      >
        {/* Header: search field + channel chips. */}
        <div className="flex flex-col gap-3" style={{ padding: '14px 14px 12px' }}>
          <SkeletonLine w="100%" h={38} radius={10} />
          <div className="flex gap-2">
            {[64, 80, 56, 72].map((w, i) => (
              <SkeletonLine key={i} w={w} h={28} radius={999} />
            ))}
          </div>
        </div>
        {/* Thread rows. */}
        <div
          className="flex-1 overflow-hidden"
          style={{ borderTop: '1px solid var(--cr-border-light)' }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <ThreadRowSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Conversation pane (right): desktop-only on the no-thread landing. */}
      <div className="hidden min-w-0 flex-1 flex-col md:flex">
        {/* Header: party avatar + name. */}
        <div
          className="flex items-center gap-3"
          style={{ padding: '10px 14px', borderBottom: '1px solid var(--cr-border-light)' }}
        >
          <SkeletonCircle size={40} />
          <div className="flex flex-col gap-2">
            <SkeletonLine w={150} h={13} />
            <SkeletonLine w={90} h={10} />
          </div>
        </div>
        {/* Message log. */}
        <div
          className="flex flex-1 flex-col gap-3 overflow-hidden"
          style={{ padding: 'var(--cr-space-xl)' }}
        >
          <BubbleSkeleton w="55%" />
          <BubbleSkeleton mine w="40%" />
          <BubbleSkeleton w="62%" />
          <BubbleSkeleton mine w="48%" />
          <BubbleSkeleton w="35%" />
          <BubbleSkeleton mine w="52%" />
        </div>
        {/* Composer. */}
        <div
          className="flex items-center gap-2"
          style={{ padding: '10px 14px', borderTop: '1px solid var(--cr-border-light)' }}
        >
          <SkeletonLine w="100%" h={40} radius={999} style={{ flex: 1 }} />
          <SkeletonCircle size={40} />
        </div>
      </div>
    </div>
  );
}
