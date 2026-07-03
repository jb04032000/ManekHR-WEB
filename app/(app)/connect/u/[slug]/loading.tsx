import ProfileSkeleton from '@/features/connect/profile/ProfileSkeleton';

/**
 * Route-level loading UI for the in-app profile (`/connect/u/[slug]`) while the
 * Server Component resolves the profile + relationship + social-proof counts.
 * Reuses the same `ProfileSkeleton` as the public `/u/[slug]` route so the two
 * profile surfaces share one loading shape (no layout shift on hydration).
 */
export default function Loading() {
  return <ProfileSkeleton />;
}
