import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getPublicConnectProfileBySlug } from '@/features/connect/profile.actions';
import { getPublicActivity } from '@/features/connect/feed.actions';
import { isViewerSignedIn } from '@/lib/actions/cookies';
import QueryProvider from '@/components/providers/QueryProvider';
import PublicActivityList from '@/features/connect/profile/PublicActivityList';

/**
 * `/u/[slug]/activity` - the full list of another member's PUBLIC posts, reached
 * from the "Show all activity" link on their public profile.
 *
 * Visitor surface (the public counterpart of the owner-only
 * `/connect/profile/activity` tabs): posts only, no Comments / Reactions tabs.
 * SSR-seeds the first page so the signed-in content paints without a client
 * round-trip; the client `PublicActivityList` pages in the rest.
 *
 * LOGIN-GATED (owner decision, 2026-06-10): the FULL activity list is shown to
 * signed-in members only. A logged-out visitor sees a sign-in prompt instead of
 * the list (the short teaser on `/u/[slug]` itself stays public). The route is
 * marked `noindex` so crawlers don't index the gated shell.
 *
 * `[slug]` is dual-input (handle or legacy ObjectId), resolved by the same
 * backend code path as `/u/[slug]`. A hidden / non-public / unknown profile
 * 404s (the profile read + the activity read both gate on `public` visibility).
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
  // Login-gated route: keep it out of the search index (the public teaser on
  // the profile itself carries the crawlable activity signal).
  return {
    title: t('byUser', { name: res.data.userId.name }),
    robots: { index: false, follow: true },
  };
}

export default async function PublicProfileActivityPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getTranslations('connect.profile.activity');
  // Resolve the profile first (404-gate + name). The activity itself is only
  // fetched for a signed-in viewer -- the full list is login-gated.
  const signedIn = await isViewerSignedIn();
  const profileRes = await loadProfile(slug);

  if (!profileRes.ok) notFound();
  // Defence-in-depth: an orphaned profile (null `userId`) is treated as
  // not-found so the page never dereferences a null identity below.
  if (!profileRes.data.userId) notFound();

  const profile = profileRes.data;
  const name = profile.userId.name;
  // Prefer the human-readable handle for the canonical profile / paging slug.
  const shareToken = profile.userId.handle || profile.userId._id;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4">
        <Link
          href={`/u/${shareToken}`}
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold no-underline"
          style={{ color: 'var(--cr-text-3)' }}
        >
          <ArrowLeft size={15} aria-hidden />
          {t('backToProfile')}
        </Link>
        <h1 className="m-0 text-[20px] font-semibold" style={{ color: 'var(--cr-text)' }}>
          {t('byUser', { name })}
        </h1>
        {signedIn ? (
          <ActivityForSignedInViewer slug={shareToken} name={name} />
        ) : (
          // Login gate: the full activity list is members-only. The short
          // teaser on the profile itself remains public.
          <div
            className="flex flex-col items-start gap-3 p-5"
            style={{
              background: 'var(--cr-wash-indigo)',
              border: '1px solid var(--cr-primary-border)',
              borderRadius: 'var(--cr-radius-lg)',
            }}
          >
            <div className="text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
              {t('signInGate.title')}
            </div>
            <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('signInGate.body', { name })}
            </p>
            <Link
              href="/connect"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold no-underline"
              style={{ background: 'var(--cr-primary)', color: '#ffffff' }}
            >
              {t('signInGate.cta')}
              <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The signed-in branch: SSR-seed the first activity page, then hand off to the
 * client `PublicActivityList` for paging. Split into its own async component so
 * the logged-out gate above never fetches activity at all.
 */
async function ActivityForSignedInViewer({ slug, name }: { slug: string; name: string }) {
  const activityRes = await getPublicActivity(slug);
  const firstPage = activityRes.ok
    ? activityRes.data
    : { posts: [], nextCursor: null, caughtUp: true };
  return (
    <QueryProvider>
      <PublicActivityList slug={slug} name={name} initialPage={firstPage} />
    </QueryProvider>
  );
}
