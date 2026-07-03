import { SkeletonCard, SkeletonLine } from '@/components/connect/Skeleton';

/**
 * Route-level loading UI for `/connect/notifications/preferences` - header + a
 * stack of toggle-row cards (label + switch), mirroring `PreferencesForm`.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <SkeletonLine w={200} h={22} />
      <SkeletonLine w={320} h={13} style={{ marginTop: 8 }} />

      <div className="mt-5 flex flex-col gap-3" style={{ maxWidth: 640 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonCard
            key={i}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <SkeletonLine w="50%" h={14} />
            <div
              className="skeleton"
              style={{
                width: 40,
                height: 22,
                borderRadius: 'var(--cr-radius-full)',
                flexShrink: 0,
              }}
            />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
