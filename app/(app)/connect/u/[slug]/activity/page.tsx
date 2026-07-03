import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getPublicConnectProfileBySlug } from '@/features/connect/profile.actions';
import { getPublicActivity } from '@/features/connect/feed.actions';
import { getRelationship, getSuggestions, getPeople } from '@/features/connect/network.actions';
import ConnectLayout from '@/components/connect/ConnectLayout';
import ProfileMiniCard from '@/components/connect/ProfileMiniCard';
import AdSlot from '@/components/connect/AdSlot';
import PeopleYouMayKnow from '@/components/connect/PeopleYouMayKnow';
import PublicActivityList from '@/features/connect/profile/PublicActivityList';
// First-party promoted-listing boost for the right rail (placement
// `activity_feed`). Resolver hydrates via the PUBLIC listing getter (no owner
// leak); null on a no-fill. Sits under the existing Google connect.right.top.
import PromotedListingAdCard from '@/features/connect/marketplace/PromotedListingAdCard';
import MobileAdInline from '@/features/connect/ads/MobileAdInline';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/u/[slug]/activity` - the IN-APP (authenticated) view of another
 * member's full PUBLIC post list, reached from the "Show all activity" link on
 * their in-app profile (`/connect/u/[slug]`).
 *
 * The in-app counterpart of the public `/u/[slug]/activity`: same posts-only
 * list (`PublicActivityList`), but rendered inside the Connect shell with the
 * left / right rails (`ConnectLayout`), so a signed-in member never bounces into
 * the bare logged-out page when they tap "Show all". Mirrors the owner activity
 * route `app/connect/profile/activity` for the rails shape; `noindex` (the
 * public `/u/[slug]/activity` mirror owns SEO).
 *
 * `[slug]` is dual-input (handle or legacy 24-hex ObjectId), resolved by the
 * same backend code path as the profile route. Viewing one's own activity
 * redirects to the canonical owner view (`/connect/profile/activity`), so there
 * is a single self-activity surface.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Request-deduped profile load - shared by `generateMetadata` + the page. */
const loadProfile = cache((slug: string) => getPublicConnectProfileBySlug(slug));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const res = await loadProfile(slug);
  // `!res.ok` is a backend 404/error; `!res.data.userId` is an orphaned profile
  // (owning user deleted → populated identity null). Both title as not-found.
  if (!res.ok || !res.data.userId) {
    const tp = await getTranslations('connect.profile');
    return { title: tp('notFoundTitle'), robots: { index: false, follow: false } };
  }
  const t = await getTranslations('connect.profile.activity');
  // The authed mirror is never indexed - the public route owns SEO.
  return {
    title: t('byUser', { name: res.data.userId.name }),
    robots: { index: false, follow: false },
  };
}

export default async function ConnectProfileActivityPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getTranslations('connect.profile.activity');

  // `promoted` is the rail boost; single-slot page so no shared pageRequestId is
  // needed (dedupe is a no-op). Resolves to null on a no-fill -> no ad rendered.
  const [profileRes, activityRes, relRes, sugRes, promoted] = await Promise.all([
    loadProfile(slug),
    getPublicActivity(slug),
    getRelationship(slug),
    getSuggestions(),
    resolvePromotedRailListing('activity_feed'),
  ]);

  if (!profileRes.ok) notFound();
  // Defence-in-depth: an orphaned profile (null `userId`) is treated as
  // not-found so the page never dereferences a null identity below.
  if (!profileRes.data.userId) notFound();
  // Own activity -> the canonical owner surface (Posts / Comments / Reactions
  // tabs). Keeps one self-activity view, mirrors `/connect/u/[slug]` -> profile.
  if (relRes.ok && relRes.data.self) redirect('/connect/profile/activity');

  const profile = profileRes.data;
  const name = profile.userId.name;
  // Prefer the human-readable handle for the canonical profile / paging slug.
  const shareToken = profile.userId.handle || profile.userId._id;
  const firstPage = activityRes.ok
    ? activityRes.data
    : { posts: [], nextCursor: null, caughtUp: true };

  // Right-rail "people you may know" - the top suggestions hydrated to cards
  // (mirrors the owner activity route). A failure simply leaves the rail empty.
  const suggestionIds = sugRes.ok ? sugRes.data.slice(0, 5).map((s) => s.userId) : [];
  const peopleRes = suggestionIds.length > 0 ? await getPeople(suggestionIds) : null;
  const suggestions = peopleRes?.ok ? peopleRes.data : [];

  return (
    <ConnectLayout
      topBar={
        <Link
          href={`/connect/u/${shareToken}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold no-underline"
          style={{ color: 'var(--cr-text-3)' }}
        >
          <ArrowLeft size={15} aria-hidden />
          {t('backToProfile')}
        </Link>
      }
      left={
        <>
          <ProfileMiniCard
            name={name}
            href={`/connect/u/${shareToken}`}
            avatarUrl={profile.userId.profilePicture}
            headline={profile.headline}
          />
          <AdSlot placement="connect.left.top" />
        </>
      }
      right={
        <>
          <PeopleYouMayKnow people={suggestions} />
          {/* First-party promoted listing (boost), under the Google slot. Renders
              nothing on a no-fill (placement `activity_feed`). */}
          <AdSlot placement="connect.right.top" />
          {promoted ? <PromotedListingAdCard {...promoted} /> : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <h1 className="m-0 text-[20px] font-semibold" style={{ color: 'var(--cr-text)' }}>
          {t('byUser', { name })}
        </h1>
        <PublicActivityList slug={shareToken} name={name} initialPage={firstPage} />
        {/* Mobile-only ad: the ConnectLayout right rail (same boost + Google slot)
            is hidden below lg, so phone/tablet users get the inventory inline. */}
        <MobileAdInline promoted={promoted} breakpoint="lg" />
      </div>
    </ConnectLayout>
  );
}
