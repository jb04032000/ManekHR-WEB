import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getPublicPost } from '@/features/connect/feed.actions';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import { getSuggestions, getPeople } from '@/features/connect/network.actions';
import { getMe } from '@/lib/actions/auth.actions';
import ConnectLayout from '@/components/connect/ConnectLayout';
import ProfileMiniCard from '@/components/connect/ProfileMiniCard';
import AdSlot from '@/components/connect/AdSlot';
import PeopleYouMayKnow from '@/components/connect/PeopleYouMayKnow';
import PostCard from '@/components/connect/PostCard';
// First-party promoted-listing boost for the right rail (placement `post_detail`).
// Resolver hydrates via the PUBLIC listing getter (no owner leak); null on a
// no-fill. Sits in the same right rail as the existing Google connect.right.top.
import PromotedListingAdCard from '@/features/connect/marketplace/PromotedListingAdCard';
import MobileAdInline from '@/features/connect/ads/MobileAdInline';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/posts/[id]` - the IN-APP single-post permalink (authed).
 *
 * Where reaction / comment notifications and in-feed permalinks land. Lives
 * inside the Connect app shell (so PostCard's Ant `App` / realtime / query
 * providers are present), is `noindex` (the public `/p/[id]` mirror - a later
 * pass - owns SEO), and shows the full interactive comment thread because the
 * viewer is signed in.
 *
 * Rendered on the shared 3-column `ConnectLayout` so the permalink matches the
 * feed / activity shell: the viewer's identity card + ad on the left, "people
 * you may know" + ad on the right, the post in the centre column.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('connect.feed.postDetail');
  const res = await getPublicPost(id);
  if (!res.ok) {
    return { title: t('notFoundTitle'), robots: { index: false, follow: false } };
  }
  const name = res.data.author?.name;
  return {
    title: name ? t('metaTitleBy', { name }) : t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function ConnectPostDetailPage({ params }: PageProps) {
  const { id } = await params;
  // `promoted` is the rail boost; single-slot page so no shared pageRequestId is
  // needed (dedupe is a no-op). Resolves to null on a no-fill -> no ad rendered.
  const [postRes, me, profileRes, sugRes, promoted] = await Promise.all([
    getPublicPost(id),
    getMe(),
    getMyConnectProfile(),
    getSuggestions(),
    resolvePromotedRailListing('post_detail'),
  ]);
  if (!postRes.ok) notFound();

  const t = await getTranslations('connect.feed.postDetail');

  // Right-rail suggestions - hydrate the top few into people cards, the same
  // way the activity page does (getSuggestions -> getPeople).
  const suggestionIds = sugRes.ok ? sugRes.data.slice(0, 5).map((s) => s.userId) : [];
  const peopleRes = suggestionIds.length > 0 ? await getPeople(suggestionIds) : null;
  const suggestions = peopleRes?.ok ? peopleRes.data : [];
  // Left card is the viewer's own identity anchor (headline best-effort).
  const headline = profileRes.ok ? profileRes.data.headline : undefined;

  return (
    <ConnectLayout
      topBar={
        <Link
          href="/connect/feed"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold no-underline"
          style={{ color: 'var(--cr-text-3)' }}
        >
          <ArrowLeft size={15} aria-hidden />
          {t('backToFeed')}
        </Link>
      }
      left={
        <>
          <ProfileMiniCard
            name={me.name}
            href="/connect/profile"
            avatarUrl={me.profilePicture}
            headline={headline}
          />
          <AdSlot placement="connect.left.top" />
        </>
      }
      right={
        <>
          <PeopleYouMayKnow people={suggestions} />
          {/* First-party promoted listing (boost), under the Google slot. Renders
              nothing on a no-fill (placement `post_detail`). */}
          <AdSlot placement="connect.right.top" />
          {promoted ? <PromotedListingAdCard {...promoted} /> : null}
        </>
      }
    >
      <PostCard post={postRes.data} viewerId={me._id} onboarded defaultShowComments />
      {/* Mobile-only ad: the ConnectLayout right rail (same boost + Google slot)
          is hidden below lg, so phone/tablet users get the inventory inline. */}
      <MobileAdInline promoted={promoted} breakpoint="lg" />
    </ConnectLayout>
  );
}
