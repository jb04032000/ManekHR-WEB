import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  getPublicConnectProfileBySlug,
  getPublicErpLink,
} from '@/features/connect/profile.actions';
import { getPublicNetworkCounts, getRelationship } from '@/features/connect/network.actions';
import { getPublicActivity } from '@/features/connect/feed.actions';
import ProfileView from '@/features/connect/profile/ProfileView';
import ProfileConnectActions from '@/features/connect/profile/ProfileConnectActions';
import ActivityPreview from '@/features/connect/profile/ActivityPreview';
// First-party promoted-listing boost for this previously rail-LESS profile page
// (placement `profile_view`). Hydrates via the PUBLIC listing getter (leak-safe);
// null on a no-fill. Shown in the profile aside (desktop) + inline on mobile.
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/u/[slug]` - the IN-APP (authenticated) view of another member's
 * profile.
 *
 * Distinct from the public `/u/[slug]` surface: this route lives inside the
 * Connect app shell (sidebar + top bar), carries NO logged-out "Join Connect"
 * conversion CTA, and is `noindex` (the public `/u/[slug]` mirror is the
 * single SEO-canonical copy). Every in-app person link (people cards, search
 * results, invitation rows, feed authors) targets this route so a signed-in
 * member never bounces into the marketing/logged-out experience when they tap
 * a colleague - the gap the public route left.
 *
 * `[slug]` is dual-input - `User.handle` (preferred) or the legacy 24-hex
 * `ObjectId` - resolved by the same backend code path as the public route.
 * Viewing one's own profile redirects to the canonical `/connect/profile`
 * (the owner surface with edit affordances) so there is one self-view, not two.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('connect.profile');
  const res = await getPublicConnectProfileBySlug(slug);
  // `!res.ok` is a backend 404/error; `!res.data.userId` is an orphaned profile
  // (a public row whose owning user was deleted, so the populated identity came
  // back null). Both are "not found" for titling - never dereference a null
  // `userId` here (it would throw in metadata generation too).
  if (!res.ok || !res.data.userId) {
    return { title: t('notFoundTitle'), robots: { index: false, follow: false } };
  }
  // The authed mirror is never indexed - the public `/u/[slug]` route owns SEO.
  return { title: res.data.userId.name, robots: { index: false, follow: false } };
}

export default async function ConnectProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const [profileRes, erpRes, relRes, activityRes, promoted] = await Promise.all([
    getPublicConnectProfileBySlug(slug),
    getPublicErpLink(slug),
    getRelationship(slug),
    getPublicActivity(slug),
    // Promoted listing (boost) for the profile aside (placement `profile_view`).
    resolvePromotedRailListing('profile_view'),
  ]);

  if (!profileRes.ok) notFound();
  // Defence-in-depth: even though the backend now 404s an orphaned profile, the
  // page must never dereference a null `userId` (it reads `.handle`, `._id`,
  // `.name`, `.profilePicture` below). A malformed profile is treated as
  // not-found so it renders the clean 404 page, not the Connect-shell error
  // boundary ("Connect could not load").
  if (!profileRes.data.userId) notFound();

  const relationship = relRes.ok ? relRes.data : null;
  // Own profile → send to the canonical owner surface (view + edit). Keeps a
  // single self-view; avoids a read-only duplicate of one's own page.
  if (relationship?.self) redirect('/connect/profile');

  const profile = profileRes.data;
  const erp = erpRes.ok ? erpRes.data : { linked: false, since: null };

  // Share URL still prefers the human-readable handle (the public form), so a
  // copied link from the in-app view propagates the pretty `/u/<handle>` URL.
  const shareToken = profile.userId.handle || profile.userId._id;

  // Social-proof counts (best-effort - omitted on failure).
  const statsRes = await getPublicNetworkCounts(profile.userId._id);
  const stats = statsRes.ok ? statsRes.data : undefined;

  return (
    <ProfileView
      userId={shareToken}
      profile={profile}
      displayName={profile.userId.name}
      avatarUrl={profile.userId.profilePicture}
      erpLinked={erp.linked}
      erpSince={erp.since}
      stats={stats}
      isOwner={false}
      subjectUserId={profile.userId._id}
      rating={profile.rating}
      promoted={promoted}
      // This is the in-app (authed) shell, so the viewer is always signed in.
      // Passing this keeps the login-gated sections (rates / reviews) unlocked
      // here -- only the logged-out public `/u/[slug]` route gates them.
      isSignedIn
      actions={
        relationship ? (
          <ProfileConnectActions userId={profile.userId._id} relationship={relationship} />
        ) : undefined
      }
      activity={
        <ActivityPreview
          posts={activityRes.ok ? activityRes.data.posts : []}
          // In-app "Show all" stays in the Connect shell (shell + rails), not the
          // bare public `/u/[slug]/activity` page. The public profile keeps its
          // own public target.
          showAllHref={`/connect/u/${shareToken}/activity`}
        />
      }
    />
  );
}
