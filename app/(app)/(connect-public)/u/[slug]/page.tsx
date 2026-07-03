import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  getPublicConnectProfileBySlug,
  getPublicErpLink,
  getPublicOpenJobs,
  recordProfileView,
} from '@/features/connect/profile.actions';
import { getPublicNetworkCounts, getRelationship } from '@/features/connect/network.actions';
import { normalizePublicProfile } from '@/features/connect/profile.normalize';
import { getPublicActivity } from '@/features/connect/feed.actions';
import { isViewerSignedIn } from '@/lib/actions/cookies';
import ProfileView from '@/features/connect/profile/ProfileView';
import ProfileConnectActions from '@/features/connect/profile/ProfileConnectActions';
import ActivityPreview from '@/features/connect/profile/ActivityPreview';
import { env } from '@/lib/env';
import { entitySeo, notFoundSeo } from '@/lib/connect/seo-meta';
import { JsonLd } from '@/components/marketing/JsonLd';
import { personJsonLd } from '@/components/connect/seo/connect-schema';
import ShareButton from '@/components/connect/ShareButton';
import { ReportButton } from '@/components/connect/ReportContentModal';

/**
 * `/u/[slug]` - the public, SEO-indexable Connect profile.
 *
 * `[slug]` is dual-input: the human-readable `User.handle` (preferred -
 * LinkedIn-style, e.g. `/u/jayesh-bambhaniya`) OR the legacy 24-hex
 * `ObjectId` (back-compat for any link already in the wild). Backend resolves
 * both forms through the same code path
 * (`ConnectProfileService.resolveSlugToUserId`).
 *
 * SSR; only `public`-visibility profiles resolve (the backend 404s the rest).
 * Works logged-out with a "Join Connect" conversion CTA. The ERP-linked moat
 * badge is derived live and trimmed of raw activity signals (privacy wall).
 *
 * When the URL uses the ObjectId form AND the user has a handle, the
 * `canonical` URL points to the handle form so search engines de-duplicate
 * to the human-readable URL. Crawlers reaching the ObjectId form follow the
 * canonical hint; clicked links continue to render (no redirect - that would
 * break a bookmarked DM that pre-dates the rename).
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Request-deduped profile load - shared by `generateMetadata` + the page. */
const loadProfile = cache((slug: string) => getPublicConnectProfileBySlug(slug));

/**
 * `true` when the input slug is a 24-hex `ObjectId` rather than a human
 * handle. Used to decide whether the canonical URL should swap to the handle
 * form. Mirrors the backend `isHex24` guard.
 */
function isHex24(s: string): boolean {
  return typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
}

/**
 * Resolve the canonical slug to emit in `<link rel="canonical">`. Prefers the
 * user's handle when the URL was opened with the ObjectId form; otherwise the
 * incoming slug already IS the canonical form.
 */
function canonicalSlugFor(incomingSlug: string, resolvedHandle: string | null | undefined): string {
  if (resolvedHandle && isHex24(incomingSlug)) return resolvedHandle;
  return incomingSlug;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('connect.profile');
  const res = await loadProfile(slug);

  // `!res.ok` is a backend 404/error; `!res.data.userId` is an orphaned profile
  // (public row whose owning user was deleted → populated identity is null).
  // Both are "not found" - never dereference a null `userId` in metadata.
  if (!res.ok || !res.data.userId) return notFoundSeo(t('notFoundTitle'));

  const profile = res.data;
  const name = profile.userId.name;
  // `headline`/`bio` are optional on the backend schema - guard before trim()
  // so metadata generation never throws on a sparsely-filled profile.
  const description =
    (profile.headline ?? '').trim() ||
    (profile.bio ?? '').trim().slice(0, 160) ||
    t('metaFallback', { name });

  const canonicalSlug = canonicalSlugFor(slug, profile.userId.handle);

  const meta = entitySeo({
    path: `/u/${canonicalSlug}`,
    title: name,
    description,
    image: profile.banner,
    ogType: 'profile',
  });
  // Seeded demo/sample profiles must never be indexed as real businesses.
  // Belt-and-braces with the sitemap exclusion (BE connect-sitemap.service).
  // See DEMO-CONTENT-TRUST-UX-PLAN.md (Phase 0).
  if (profile.userId.isDemo) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = await params;
  // Is anyone signed in on this request? Drives both the viewer-scoped calls
  // below and the login-gated sections (rates / reviews / full activity).
  const signedIn = await isViewerSignedIn();
  // The relationship + erp-link endpoints accept the same dual-input slug as
  // the profile read - backend handles the ObjectId vs handle resolution once.
  // `getRelationship` is viewer-scoped: it only resolves for a signed-in
  // viewer, so we SKIP it entirely when logged out. (Previously it was always
  // called and 401'd for guests, logging a red server error on every public
  // profile view; the action buttons already keyed off a null result.)
  const [profileRes, erpRes, activityRes] = await Promise.all([
    loadProfile(slug),
    getPublicErpLink(slug),
    getPublicActivity(slug),
  ]);
  const relRes = signedIn ? await getRelationship(slug) : null;

  if (!profileRes.ok) notFound();
  // Defence-in-depth: never dereference a null `userId` (the page reads
  // `.handle`, `._id`, `.name`, `.profilePicture` below). An orphaned profile
  // is treated as not-found so it renders the clean 404 page instead of
  // crashing into the route error boundary.
  if (!profileRes.data.userId) notFound();

  const t = await getTranslations('connect.profile');
  // Normalize the public read to a complete shape. The backend schema is
  // all-optional, so a sparsely-filled profile can arrive with fields like
  // `bio`, `skills`, or `openTo` absent; `ProfileView` dereferences those
  // directly during render, so an un-backfilled payload crashed a shared
  // `/u/[slug]` link into the route error boundary ("Something went wrong").
  const profile = normalizePublicProfile(profileRes.data);
  const erp = erpRes.ok ? erpRes.data : { linked: false, since: null };
  const relationship = relRes?.ok ? relRes.data : null;

  // Share URL prefers the human-readable handle when available; falls back to
  // the resolved ObjectId for pre-backfill rows. The component itself never
  // sees the inbound slug - only the canonical share token - so a copied
  // link from an ObjectId-form URL still propagates the pretty `/u/<handle>`
  // form, not the ugly hex one.
  const shareToken = profile.userId.handle || profile.userId._id;

  // Public social-proof counts. Fetched after the profile resolves (the counts
  // endpoint keys off the resolved User id, not the slug). Best-effort - a
  // failure just omits the counts row.
  const statsRes = await getPublicNetworkCounts(profile.userId._id);
  const stats = statsRes.ok ? statsRes.data : undefined;

  // This person's open jobs for the Hiring intent card (connect jobs module).
  // Fetched post-resolve like the counts above (keys off the resolved User id,
  // not the slug). Best-effort - a failure just omits the Hiring card.
  const openJobsRes = await getPublicOpenJobs(profile.userId._id);
  const openJobs = openJobsRes.ok ? openJobsRes.data : undefined;

  // Record a profile view (connect views module), best-effort. Self-view rule:
  // `relationship` resolves only for a signed-in viewer and carries a `self`
  // flag (RelationshipState.self) set true when the viewer IS the subject. So
  // we record only for a signed-in NON-self viewer; logged-out (relationship
  // null) and owner-viewing-own-public-page are both skipped. The action
  // swallows its own errors and is awaited only to keep the server action in
  // this request's scope - it never throws and never blocks the render path.
  const isSelf = relationship?.self ?? false;
  if (relationship && !isSelf) {
    await recordProfileView(profile.userId._id);
  }

  // Person/ProfilePage structured data (name + avatar + headline only - the
  // fields the page shows). The share URL uses the pretty handle token.
  const profileUrl = `${env.appUrl}/u/${shareToken}`;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <JsonLd
        data={personJsonLd({
          name: profile.userId.name,
          url: `/u/${shareToken}`,
          image: profile.userId.profilePicture,
          jobTitle: profile.headline,
        })}
      />
      <div className="mx-auto mb-3 flex w-full max-w-[960px] items-center justify-end gap-1">
        <ShareButton surface="profile" url={profileUrl} name={profile.userId.name} size="small" />
        {/* Signed-in viewers can report a profile -> admin moderation queue. */}
        {signedIn && (
          <ReportButton
            target={{
              targetType: 'profile',
              targetId: profile.userId._id,
              targetOwnerUserId: profile.userId._id,
              snapshot: `${profile.userId.name}${profile.headline ? ` - ${profile.headline}` : ''}`,
              targetUrl: `/u/${shareToken}`,
            }}
          />
        )}
      </div>
      <ProfileView
        userId={shareToken}
        profile={profile}
        displayName={profile.userId.name}
        avatarUrl={profile.userId.profilePicture}
        erpLinked={erp.linked}
        erpSince={erp.since}
        stats={stats}
        isOwner={false}
        isDemo={profile.userId.isDemo}
        subjectUserId={profile.userId._id}
        rating={profile.rating}
        openJobs={openJobs}
        isSignedIn={signedIn}
        actions={
          relationship ? (
            <ProfileConnectActions userId={profile.userId._id} relationship={relationship} />
          ) : undefined
        }
        activity={
          <ActivityPreview
            posts={activityRes.ok ? activityRes.data.posts : []}
            showAllHref={`/u/${shareToken}/activity`}
          />
        }
      />

      {/* Logged-out conversion CTA - acceptance criterion #3. */}
      <div className="mx-auto mt-4 w-full max-w-[960px]">
        <div
          className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: 'var(--cr-wash-indigo)',
            border: '1px solid var(--cr-primary-border)',
            borderRadius: 'var(--cr-radius-lg)',
          }}
        >
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
              {t('joinCtaTitle')}
            </div>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('joinCtaBody')}
            </p>
          </div>
          {/* Inline `color: #fff` because Tailwind v4 + the project's `@theme`
              token set does not generate a `text-white` utility - the Tailwind
              class compiled to no-op, leaving the button text invisible on the
              indigo background. Inline style guarantees the contrast. */}
          <Link
            href="/connect"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold no-underline"
            style={{ background: 'var(--cr-primary)', color: '#ffffff', flexShrink: 0 }}
          >
            {t('joinCtaButton')}
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
