import { SkeletonLine, SkeletonButton, SkeletonCircle } from '@/components/connect/Skeleton';

/** One introduction-row placeholder: avatar + two text lines + trailing actions.
 *  Mirrors a row in IntroductionsList (Avatar + name/sub + Confirm/Decline or a
 *  status pill). Server-only, aria-hidden via the page wrapper. */
function RowSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <li
      className="flex items-center gap-3 p-3"
      style={{
        border: '1px solid var(--cr-border-light, #e5e7eb)',
        borderRadius: 'var(--cr-radius-md, 10px)',
        background: 'var(--cr-surface)',
      }}
    >
      <SkeletonCircle size={40} />
      <div className="flex flex-1 flex-col gap-2">
        <SkeletonLine w="48%" h={13} />
        <SkeletonLine w="66%" h={11} />
      </div>
      {actions ? (
        <div className="flex shrink-0 gap-2">
          <SkeletonButton w={84} h={30} />
          <SkeletonButton w={84} h={30} />
        </div>
      ) : (
        <SkeletonLine w={72} h={22} radius={999} style={{ flexShrink: 0 }} />
      )}
    </li>
  );
}

/** Loading UI for `/connect/introductions`. Mirrors the page: header (title +
 *  subtitle + Introduce action), then the "To confirm" and "Introductions I made"
 *  sections, each a heading + a short stack of rows. */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full flex-col gap-7"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      {/* Header: title + subtitle, Introduce button on the right. */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <SkeletonLine w={200} h={22} />
          <SkeletonLine w={320} h={13} />
        </div>
        <SkeletonButton w={130} h={38} />
      </header>

      {/* Section 1: To confirm. */}
      <section className="flex flex-col gap-3">
        <SkeletonLine w={120} h={14} />
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {[0, 1].map((i) => (
            <RowSkeleton key={i} actions />
          ))}
        </ul>
      </section>

      {/* Section 2: Introductions I made. */}
      <section className="flex flex-col gap-3">
        <SkeletonLine w={170} h={14} />
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {[0, 1, 2].map((i) => (
            <RowSkeleton key={i} actions={false} />
          ))}
        </ul>
      </section>
    </div>
  );
}
