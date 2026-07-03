import ProfileSkeleton from '@/features/connect/profile/ProfileSkeleton';

/** Route-level loading UI while the public profile is server-rendered. */
export default function Loading() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <ProfileSkeleton />
    </div>
  );
}
