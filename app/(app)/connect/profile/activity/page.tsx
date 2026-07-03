import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import { getSuggestions, getPeople } from '@/features/connect/network.actions';
import { getMe } from '@/lib/actions/auth.actions';
import ConnectLayout from '@/components/connect/ConnectLayout';
import ProfileMiniCard from '@/components/connect/ProfileMiniCard';
import AdSlot from '@/components/connect/AdSlot';
import PeopleYouMayKnow from '@/components/connect/PeopleYouMayKnow';
import ProfileActivity from '@/features/connect/profile/ProfileActivity';
// First-party promoted-listing boost for the right rail (placement
// `activity_feed`). Resolver hydrates via the PUBLIC listing getter (no owner
// leak); null on a no-fill. Sits under the existing Google connect.right.top.
import PromotedListingAdCard from '@/features/connect/marketplace/PromotedListingAdCard';
import MobileAdInline from '@/features/connect/ads/MobileAdInline';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/profile/activity` - the owner's full Activity view (Posts /
 * Comments / Reactions tabs), reached from the "Show all activity" link on the
 * profile. Pulling the heavy tabbed lists onto their own route is the perf fix:
 * the profile itself only renders a lightweight `ActivityPreview`, so it no
 * longer eager-fetches the activity feed or opens a `PostCard` socket per row.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.profile.activity');
  return { title: t('metaTitle') };
}

export default async function ConnectProfileActivityPage() {
  const t = await getTranslations('connect.profile.activity');
  // `promoted` is the rail boost; single-slot page so no shared pageRequestId is
  // needed (dedupe is a no-op). Resolves to null on a no-fill -> no ad rendered.
  const [profileRes, me, sugRes, promoted] = await Promise.all([
    getMyConnectProfile(),
    getMe(),
    getSuggestions(),
    resolvePromotedRailListing('activity_feed'),
  ]);
  if (!profileRes.ok) notFound();
  const profile = profileRes.data;

  // Hydrate the top suggestions into people cards for the right rail.
  const suggestionIds = sugRes.ok ? sugRes.data.slice(0, 5).map((s) => s.userId) : [];
  const peopleRes = suggestionIds.length > 0 ? await getPeople(suggestionIds) : null;
  const suggestions = peopleRes?.ok ? peopleRes.data : [];

  return (
    <ConnectLayout
      topBar={
        <Link
          href="/connect/profile"
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
            name={me.name}
            href="/connect/profile"
            avatarUrl={me.profilePicture}
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
      <ProfileActivity />
      {/* Mobile-only ad: the ConnectLayout right rail (same boost + Google slot)
          is hidden below lg, so phone/tablet users get the inventory inline. */}
      <MobileAdInline promoted={promoted} breakpoint="lg" />
    </ConnectLayout>
  );
}
