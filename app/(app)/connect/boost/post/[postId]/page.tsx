import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getPublicPost } from '@/features/connect/feed.actions';
import { getWallet } from '@/features/connect/ads/ads.actions';
import { getMe } from '@/lib/actions/auth.actions';
import BoostComposer from '@/features/connect/ads/BoostComposer';
import BoostLoadError from '@/features/connect/ads/BoostLoadError';

/**
 * /connect/boost/post/[postId] - the Boost composer for a regular feed post.
 * Reuses the shipped <BoostComposer> with a `post` target.
 *
 * Owner + public guard (mirrors the backend boost gate): only the post AUTHOR may
 * boost, and only a `public` post. We load the post via the `@Public`
 * `getPublicPost` (there is no "my post by id" action) and compare its `authorId`
 * to the signed-in user's id (`me._id` - the same id `post.authorId` carries and
 * the feed uses as `viewerId`). Anything not owned / not public / deleted (a
 * deleted post 404s -> getPublicPost fails) redirects to the feed. The backend
 * re-enforces author + public + no-duplicate-boost on submit, binding the boost
 * to the live `feed_promoted_post` placement so it serves through the existing
 * feed render path. Person-centric: no workspaceId, no <Can>.
 *
 * Links: feed.actions getPublicPost (post source); ads.actions createPostBoost
 * (submit, via BoostComposer); the promoted card renders via AdCard -> PostCard.
 */

interface Props {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations('connect.ads.boost');
  return { title: t('metaTitlePost'), robots: { index: false, follow: false } };
}

/** Trim a post body to a short, single-line snippet for the composer preview. */
function postSnippet(body: string, fallback: string): string {
  const clean = body.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 90 ? clean.slice(0, 87).trimEnd() + '...' : clean;
}

export default async function BoostPostPage({ params }: Props) {
  const { postId } = await params;

  // getMe is guarded (it throws, unlike the ActionResult reads). Here it is also
  // LOAD-BEARING for the ownership gate below (me._id), so a getMe failure must
  // not let us skip the check - we surface a retryable error instead of crashing
  // or wrongly redirecting an owner away.
  const [postRes, walletRes, me] = await Promise.all([
    getPublicPost(postId),
    getWallet(),
    getMe().catch(() => null),
  ]);
  if (!postRes.ok) {
    // The post read FAILED (outage) - distinct from a deleted/ineligible post.
    return <BoostLoadError retryHref={`/connect/boost/post/${postId}`} backHref="/connect/feed" />;
  }
  if (!me) {
    // Ownership cannot be verified without the signed-in user; treat as retryable.
    return <BoostLoadError retryHref={`/connect/boost/post/${postId}`} backHref="/connect/feed" />;
  }

  const post = postRes.data;
  // Gate: author-owned AND public AND not a repost wrapper (a repost is someone
  // else's content; only original posts are boostable). A non-owned / non-public
  // post never reaches the composer.
  const owned = post.authorId === me._id;
  if (!owned || post.visibility !== 'public' || post.repostOf) {
    redirect('/connect/feed');
  }

  const t = await getTranslations('connect.boosts.cfg');

  return (
    <BoostComposer
      post={{ _id: post._id, title: postSnippet(post.body, t('step1.kickerPost')) }}
      wallet={walletRes.ok ? walletRes.data : null}
      viewerName={me.name}
    />
  );
}
