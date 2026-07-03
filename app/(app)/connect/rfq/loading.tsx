import RfqHubSkeleton from '@/features/connect/rfq/RfqHubSkeleton';

/**
 * Route-level loading UI for `/connect/rfq`. A loading.tsx cannot read
 * searchParams, so it renders the BOARD (default tab) skeleton; the tab-aware
 * skeleton runs from page.tsx's <Suspense> fallback (it knows the parsed
 * `?tab=`). Mirrors the jobs route pattern (app/connect/jobs/loading.tsx).
 */
export default function Loading() {
  return <RfqHubSkeleton tab="board" />;
}
