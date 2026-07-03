import StorefrontViewSkeleton from '@/features/connect/entities/StorefrontViewSkeleton';

/** Route-level loading UI while the public storefront is server-rendered.
 *  Mirrors the page's `max-w-[960px]` wrapper so there is no shift on swap. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 sm:py-8">
      <StorefrontViewSkeleton />
    </div>
  );
}
