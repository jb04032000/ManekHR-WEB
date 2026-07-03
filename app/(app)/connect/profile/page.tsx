import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  getMyConnectProfile,
  getMyErpLink,
  getMyProfileViews,
} from '@/features/connect/profile.actions';
import { getNetworkCounts } from '@/features/connect/network.actions';
import { getMyActivity } from '@/features/connect/feed.actions';
// First-party promoted-listing boost for this previously rail-LESS profile page
// (placement `profile_view`). Hydrates via the PUBLIC listing getter (leak-safe);
// null on a no-fill. Shown in the profile aside (desktop) + inline on mobile.
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';
import OwnProfileClient from './OwnProfileClient';

/**
 * `/connect/profile` - the owner's Connect profile (view + edit).
 *
 * A Server Component does the initial data load (ENGINEERING-STANDARDS #7);
 * `OwnProfileClient` adds the canonical identity from the auth store, the
 * view/edit toggle, and the save mutation.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.profile');
  return { title: t('ownTitle') };
}

export default async function ConnectProfilePage() {
  const [profileResult, erpResult, countsResult, activityResult, viewsRes, promoted] =
    await Promise.all([
      getMyConnectProfile(),
      getMyErpLink(),
      getNetworkCounts(),
      // Server-fetch the recent posts for the compact Activity teaser, so the
      // profile renders it without a client round-trip or a PostCard socket. The
      // full tabbed view lazy-loads on its own route.
      getMyActivity('posts'),
      // Own profile-view totals for the header stat (connect views module).
      // Best-effort - omitted on failure so the rest of the header still renders.
      getMyProfileViews(),
      // Promoted listing (boost) for the profile aside (placement `profile_view`).
      resolvePromotedRailListing('profile_view'),
    ]);

  // Own social-proof counts for the header. Best-effort - omitted on failure.
  const stats = countsResult.ok
    ? { connections: countsResult.data.connections, followers: countsResult.data.followers }
    : undefined;

  // Recent posts for the teaser. Best-effort - an empty list just renders the
  // "no posts yet" hint plus the "Show all activity" link.
  const activityPreview = activityResult.ok ? activityResult.data.posts : [];

  return (
    <OwnProfileClient
      profileResult={profileResult}
      erpResult={erpResult}
      stats={stats}
      activityPreview={activityPreview}
      profileViews={viewsRes.ok ? viewsRes.data.total : undefined}
      promoted={promoted}
    />
  );
}
