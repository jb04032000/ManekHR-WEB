import ProfileSkeleton from '@/features/connect/profile/ProfileSkeleton';

/** Route-level loading UI while the own-profile Server Component fetches. */
export default function Loading() {
  return <ProfileSkeleton />;
}
