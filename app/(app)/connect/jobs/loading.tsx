import JobsHubSkeleton from '@/features/connect/jobs/JobsHubSkeleton';

/**
 * Route-level loading UI for `/connect/jobs`. A loading.tsx cannot read
 * searchParams, so it renders the BOARD (default tab) skeleton. The tab-AWARE
 * skeleton runs from page.tsx's <Suspense> fallback (it knows the parsed `?tab=`),
 * which covers the data fetch; this route fallback only shows for the instant
 * before that. Keep the shared shell in sync via JobsHubSkeleton.
 */
export default function Loading() {
  return <JobsHubSkeleton tab="board" />;
}
