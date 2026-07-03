import StorefrontViewSkeleton from '@/features/connect/entities/StorefrontViewSkeleton';
import { SkeletonRailPanel } from '@/components/connect/Skeleton';

/**
 * Loading UI for the in-app storefront view (`/connect/store/[slug]`). Mirrors
 * the page's `ConnectPage` (flex gap-5) + right `EntityAdRail` layout: the main
 * column is the StorefrontView skeleton, the rail is two panel placeholders.
 * Replicates the wrappers with plain markup so this server `loading.tsx` pulls
 * no client components.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      <main className="min-w-0 flex-1">
        <StorefrontViewSkeleton />
      </main>
      <aside
        className="hidden shrink-0 xl:block"
        style={{ width: 'var(--cn-rail-right-w, 320px)' }}
      >
        <div className="flex flex-col gap-4">
          <SkeletonRailPanel titleW={90} rows={2} />
          <SkeletonRailPanel titleW={120} rows={3} />
        </div>
      </aside>
    </div>
  );
}
