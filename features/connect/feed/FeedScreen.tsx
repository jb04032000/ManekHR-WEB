'use client';

/**
 * FeedScreen - the interactive shell for `/connect/feed` (Phase 3 - Feed).
 *
 * The Server Component (`page.tsx`) loads the active tab's first feed page +
 * the right-rail suggestions and hands them down. This client island renders
 * the three-column layout (mobile-first: the feed column alone below `xl`,
 * rails appearing at `xl`), the composer trigger, the URL-synced `Following` /
 * `For You` tabs, and `FeedList`. A feed load failure degrades to a recoverable
 * in-panel error.
 *
 * Rail composition (2026-05-21) - switched from a single panel per rail to
 * multi-panel stacks, modelled on the LinkedIn / X feed:
 *  - Left rail: mini-profile card · profile-strength · quick links · ERP
 *    shortcut (if the viewer owns a workspace) · "coming soon" promo slot.
 *  - Right rail: people-to-follow · industry-pulse placeholder · trending
 *    placeholder · footer link strip.
 *  Placeholders carry an explicit "Coming with Phase N" badge - honest,
 *  per the no-shortcut build philosophy. They populate the rails without
 *  inventing data.
 *
 * Scroll behavior - `<Rail>` pins via `position: sticky` so when its
 * content fits the viewport, the rail stays put while the feed scrolls.
 * Once rail content exceeds viewport height, the rail scrolls naturally
 * with the page until its bottom edge meets the viewport bottom, then
 * the sticky kicks in for any remaining bottom content. Each rail behaves
 * independently. (LinkedIn pattern.)
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  ImagePlus,
  Megaphone,
  Mic,
  TrendingUp,
  TriangleAlert,
  Video,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { DsAvatar } from '@/components/ui';
import type { AttachMode } from '@/components/connect/Composer';
import {
  Composer,
  ConnectErrorBoundary,
  ConnectPage,
  MiniProfileCard,
  ModuleTabs,
  PersonCard,
  ProfileStrengthCard,
  Rail,
  RailPanel,
  type ConnectPerson,
  type ModuleTab,
  type StrengthItem,
} from '@/components/connect';
import FeedList from './FeedList';
import FeedPeopleToFollow from './FeedPeopleToFollow';
import FeedCompanyFollowButton from './FeedCompanyFollowButton';
import { prependToFeedCache } from './feed-cache';
import { type FeedSponsoredCard } from './feed-ads';
import SpotlightRailCard from '@/features/connect/ads/SpotlightRailCard';
import FeedBannerCarousel from '@/features/connect/banners/FeedBannerCarousel';
import type { FeedBanner } from '@/features/connect/banners/banner.types';
// Google (AdSense) rail slots - reuses the shared connect.right.* placements +
// AdSlot seam (same as ConnectRightRail). Renders nothing until the owner wires
// AdSense, so it adds no box today; the first-party Spotlight boost is untouched.
import AdSlot from '@/components/connect/AdSlot';
import PersonCardActions from '../network/PersonCardActions';
import ConnectErpCrossSell from '@/components/connect/ConnectErpCrossSell';
import FeedProfileCard from '@/components/connect/FeedProfileCard';
// Dismissible top-of-feed "sample content" disclosure strip (launch period).
import SampleContentBanner from '@/components/connect/SampleContentBanner';
import type { FeedItem, FeedTab, HydratedFeedItem, HydratedFeedPage } from '../feed.types';
import type { PersonRef } from '../network.types';
import type { ConnectProfile, ConnectRateCard } from '../profile.types';
import type { CompanyPageBrowseItem } from '../entities/entities.types';
import type { TrendingRailItem } from '../feed.actions';

/**
 * The feed payload from the Server Component - the loaded page, or an error
 * string when the feed read failed.
 */
export type FeedScreenData = { page: HydratedFeedPage } | { error: string };

/** The signed-in viewer - drives the composer trigger + comment controls. */
export interface FeedViewer {
  id: string;
  name: string;
  avatar: string | null;
  /** Whether the viewer owns / is a member of any workspace. Drives the
   *  conditional ERP-shortcut left-rail panel. */
  hasWorkspace: boolean;
}

interface FeedScreenProps {
  tab: FeedTab;
  data: FeedScreenData;
  viewer: FeedViewer;
  /** Right-rail "people to follow" - already hydrated + capped by the page. */
  suggestions: ConnectPerson[];
  /** Right-rail "companies to follow" - public company pages for newcomers to
   *  seed their network with (a textile buyer's first follow is often a
   *  mill/brand, not a person). Capped by the page; empty hides the panel. */
  companySuggestions?: CompanyPageBrowseItem[];
  /** The company-page ids the viewer already follows - seeds each rail card's
   *  Follow button so an already-followed company reads "Following", not
   *  "Follow". Empty for a logged-out viewer (the button still works, falling
   *  through to the join surface on a 401). Mirrors the directory's seeding. */
  followedCompanyIds?: string[];
  /** Right-rail trending posts. Empty falls back to the placeholder copy. */
  trending?: TrendingRailItem[];
  /** Whether the viewer has completed Connect onboarding. When false, write
   *  actions (compose, react, comment) redirect to `/connect/onboarding`. */
  onboarded: boolean;
  /** The viewer's own Connect profile - drives the top-of-feed setup card,
   *  the left-rail mini-profile, and the strength meter. `null` on a load
   *  error (each consumer falls back gracefully). */
  profile: ConnectProfile | null;
  /**
   * Server-resolved in-feed sponsored cards (Phase 1 "boosts in the feed") - any
   * boost kind, from the unified `feed_sponsored` auction. Forwarded directly to
   * FeedList, which drops them into the cadence slots; empty falls back to house
   * promos. See feed-ads.
   */
  sponsoredCards?: FeedSponsoredCard[];
  /**
   * Premium Spotlight rail card (Phase 2) - any boost kind that opted into the
   * Spotlight upgrade, rendered at the top of the right rail (desktop). `null`
   * when none. See feed-ads / SpotlightRailCard.
   */
  spotlightCard?: FeedSponsoredCard | null;
  /**
   * Admin-curated feed banners for the top-of-feed carousel (live-window
   * filtered + order-sorted by the backend). Empty renders no carousel at all.
   * See features/connect/banners (FeedBannerCarousel + banner.actions).
   */
  banners?: FeedBanner[];
}

/** True when the rate card carries at least one populated rate. Mirrors
 *  the heuristic in `features/connect/profile/ProfileView.tsx` so the
 *  feed-side strength meter agrees with the profile page's meter. */
function hasAnyRate(rate: ConnectRateCard | undefined): boolean {
  if (!rate) return false;
  return Boolean(rate.dailyWage || rate.pieceRate || rate.monthly);
}

export default function FeedScreen({
  tab,
  data,
  viewer,
  suggestions,
  companySuggestions = [],
  followedCompanyIds = [],
  trending = [],
  onboarded,
  profile,
  sponsoredCards,
  spotlightCard,
  banners = [],
}: FeedScreenProps) {
  const t = useTranslations('connect.feed');
  const tStrength = useTranslations('connect.profile');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<AttachMode>('none');
  // Bumped per open so the composer remounts + re-seeds its mode from
  // `initialMode` - a Photo / Video / Voice shortcut launches straight into it.
  const [composerKey, setComposerKey] = useState(0);

  /** Open the composer, optionally pre-set to a media mode. Onboarding-gated. */
  const openComposer = (m: AttachMode = 'none') => {
    if (!onboarded) {
      router.push('/connect/onboarding');
      return;
    }
    setComposerMode(m);
    setComposerKey((k) => k + 1);
    setComposerOpen(true);
  };

  /**
   * After a post publishes, prepend it to the live feed cache so the author
   * sees it INSTANTLY - a plain `router.refresh()` does not repaint the
   * already-mounted infinite-query cache (the "my own post never showed" bug).
   * Then refresh to reconcile the rails / counts from the server.
   */
  const handlePosted = useCallback(
    (post: FeedItem) => {
      const author: PersonRef = {
        userId: viewer.id,
        name: viewer.name,
        avatar: viewer.avatar,
        headline: profile?.headline || null,
      };
      // A freshly created post is never a repost - no embedded original.
      const hydrated: HydratedFeedItem = { ...post, author, original: null };
      queryClient.setQueryData<InfiniteData<HydratedFeedPage>>(['connect-feed', tab], (old) =>
        prependToFeedCache(old, hydrated),
      );
      // The prepend is instant feedback for the author's current view, not a
      // permanent pin. Mark the feed stale so it reconciles to true ranked /
      // chronological order on the next mount or load; refetchType 'none' keeps
      // the post in place on the current screen (no jarring same-screen jump).
      void queryClient.invalidateQueries({ queryKey: ['connect-feed', tab], refetchType: 'none' });
      router.refresh();
    },
    [queryClient, router, tab, viewer.id, viewer.name, viewer.avatar, profile?.headline],
  );

  const tabs = useMemo<ModuleTab[]>(
    () => [
      { key: 'foryou', label: t('tabs.foryou') },
      { key: 'following', label: t('tabs.following') },
    ],
    [t],
  );

  /**
   * Profile-strength items for the left-rail meter. Mirrors the weights +
   * order used by `ProfileView` so the two surfaces agree. Each incomplete
   * item links into `/connect/profile` (the edit surface) - they cannot
   * fire an inline edit from here.
   */
  const strengthItems = useMemo<StrengthItem[]>(() => {
    if (!profile) return [];
    const items: { key: string; done: boolean }[] = [
      { key: 'headline', done: !!profile.headline.trim() },
      { key: 'bio', done: !!profile.bio.trim() },
      { key: 'banner', done: !!profile.banner.trim() },
      { key: 'skills', done: profile.skills.length >= 3 },
      { key: 'portfolio', done: profile.portfolio.length >= 1 },
      { key: 'experience', done: profile.experience.length >= 1 },
      { key: 'rateCard', done: hasAnyRate(profile.rateCard) },
    ];
    return items.map((item) => ({
      key: item.key,
      label: tStrength(`strength.${item.key}` as Parameters<typeof tStrength>[0]),
      done: item.done,
      action: item.done
        ? undefined
        : { label: tStrength('strength.add'), href: '/connect/profile' },
    }));
  }, [profile, tStrength]);

  // The strength meter renders only when the profile is loaded AND the
  // viewer hasn't hit 100. A complete profile doesn't need rail real
  // estate dedicated to its meter - the in-feed `FeedProfileCard` already
  // celebrates completion.
  const showStrengthCard = profile !== null && profile.strength < 100;

  /**
   * Right-rail panels, extracted so they render in BOTH the xl side rail and
   * a below-feed block on tablet (md to xl). Design-decisions doc §4.2: on
   * tablet the right rail folds below the content. The two copies are
   * visibility-toggled by breakpoint (only one shows at a time); RailPanel
   * derives its aria ids from useId, so the duplicate carries no id collision.
   */
  const rightRailPanels = (
    <>
      {/* 0. Premium Spotlight boost (Phase 2) - sits at the very top of the rail,
          the prime "next to what people read" spot. Only present when a Spotlight
          campaign won the spotlight_rail auction. */}
      {spotlightCard && (
        <div style={{ marginBottom: 'var(--cr-space-md)' }}>
          <SpotlightRailCard card={spotlightCard} />
        </div>
      )}
      {/* Google AdSense rail slot (third-party fill) below the first-party
          Spotlight boost. Reuses the connect.right.top placement; renders nothing
          when AdSense is unconfigured, so it is shift-free + a no-op today. Links:
          AdSlot -> GoogleAdUnit -> app/connect/layout.tsx loader. */}
      <AdSlot placement="connect.right.top" />
      {/* 1. People to follow - already hydrated by the page. */}
      <RailPanel
        title={t('rightRail.title')}
        titleAction={
          <Link
            href="/connect/network?tab=suggestions"
            className="no-underline"
            style={{ color: 'var(--cr-primary)' }}
          >
            {t('rightRail.seeAll')}
          </Link>
        }
      >
        {suggestions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--cr-text-4)', lineHeight: 1.5 }}>
            {t('rightRail.empty')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-sm)' }}>
            {suggestions.map((person) => (
              <PersonCard
                key={person.userId}
                person={person}
                action={<PersonCardActions userId={person.userId} mode="followOnly" />}
              />
            ))}
          </div>
        )}
      </RailPanel>

      {/* 2. Companies to follow - seed a newcomer's network with mills / brands
          (often a buyer's first follow). Hidden when there are none. */}
      {companySuggestions.length > 0 && (
        <RailPanel
          title={t('rightRail.companiesTitle')}
          titleAction={
            <Link
              href="/connect/companies"
              className="no-underline"
              style={{ color: 'var(--cr-primary)' }}
            >
              {t('rightRail.seeAll')}
            </Link>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-sm)' }}>
            {companySuggestions.map((company) => {
              const place = [company.location?.district, company.location?.state]
                .map((p) => p?.trim())
                .filter(Boolean)
                .join(', ');
              return (
                // Row = identity link + Follow button side by side. The button
                // sits OUTSIDE the link (an anchor can't wrap a button) so the
                // name/avatar opens the page while Follow toggles in place,
                // mirroring the "People to follow" rail above.
                <div key={company.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Link
                    href={`/connect/company/${company.slug}`}
                    className="no-underline"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}
                  >
                    <DsAvatar name={company.name} src={company.logo || undefined} size={36} />
                    <span style={{ minWidth: 0 }}>
                      <span
                        className="truncate"
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--cr-text)',
                        }}
                      >
                        {company.name}
                      </span>
                      {place && (
                        <span
                          className="truncate"
                          style={{ display: 'block', fontSize: 12, color: 'var(--cr-text-4)' }}
                        >
                          {place}
                        </span>
                      )}
                    </span>
                  </Link>
                  <div style={{ flexShrink: 0 }}>
                    <FeedCompanyFollowButton
                      pageId={company.id}
                      companyName={company.name}
                      initialFollowing={followedCompanyIds.includes(company.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </RailPanel>
      )}

      {/* 3. Industry pulse - placeholder until a news / pulse module ships. */}
      <RailPanel title={t('rightRail.industryTitle')}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span
            aria-hidden
            style={{
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-4)',
            }}
          >
            <TrendingUp size={16} />
          </span>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: 'var(--cr-text-4)',
              }}
            >
              {t('rightRail.industryBody')}
            </p>
            <ComingSoonBadge label={t('comingPhase7')} />
          </div>
        </div>
      </RailPanel>

      {/* 3. Trending in your trade - real recent-popular posts (falls back to
          the placeholder copy when there is nothing trending yet). */}
      <RailPanel title={t('rightRail.trendingTitle')}>
        {trending.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--cr-text-4)' }}>
            {t('rightRail.trendingEmpty')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-sm)' }}>
            {trending.map((item) => (
              <Link
                key={item.postId}
                href={`/connect/posts/${item.postId}`}
                className="no-underline"
                style={{ display: 'block' }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    color: 'var(--cr-text-2)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {item.snippet || t('rightRail.trendingUntitled')}
                </span>
                {item.reactionCount > 0 && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--cr-text-4)' }}>
                    {t('rightRail.trendingReactions', { count: item.reactionCount })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </RailPanel>
    </>
  );

  return (
    <ConnectPage className="flex justify-center gap-5">
      {/* LEFT RAIL (returns at lg = 1024). Below lg the ERP shell sidebar
          holds the left edge, so a second 240px rail there would crush the
          feed; design-decisions doc §4.2 keeps left context on tablet while
          the ERP nav covers the small-tablet band. */}
      <Rail side="left" breakpoint="lg">
        {/* 1. Mini-profile card - viewer identity + headline + view-profile link. */}
        <MiniProfileCard
          name={viewer.name}
          avatar={viewer.avatar}
          headline={profile?.headline ?? null}
          banner={profile?.banner ?? null}
        />

        {/* 2. Profile-strength meter - only while < 100. Owns its own card chrome
            so it sits as a direct Rail child, not wrapped in RailPanel. */}
        {showStrengthCard && profile && (
          <ProfileStrengthCard strength={profile.strength} items={strengthItems} />
        )}

        {/* 3. Quick links - Profile + Network. */}
        <RailPanel title={t('leftRail.title')}>
          <nav aria-label={t('leftRail.title')}>
            {[
              { href: '/connect/profile', label: t('leftRail.profile') },
              { href: '/connect/network', label: t('leftRail.network') },
              { href: '/connect/saved', label: t('leftRail.saved') },
              { href: '/connect/rfq', label: t('leftRail.rfqs') },
              { href: '/connect/jobs', label: t('leftRail.jobs') },
              { href: '/connect/stores', label: t('leftRail.stores') },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="no-underline"
                style={{
                  display: 'block',
                  padding: '7px 0',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--cr-text-2)',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </RailPanel>

        {/* 4. ERP shortcut - conditional on the viewer actually having a
            workspace. Connect-only users see no ERP nav anywhere; this is
            the bridge for owner-intent users. */}
        {viewer.hasWorkspace && (
          <RailPanel title={t('leftRail.erpTitle')}>
            <Link
              href="/dashboard"
              className="no-underline"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--cr-primary)',
              }}
            >
              <span>{t('leftRail.erpOpen')}</span>
              <ArrowRight size={14} aria-hidden />
            </Link>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--cr-text-4)',
              }}
            >
              {t('leftRail.erpBody')}
            </p>
          </RailPanel>
        )}

        {/* 5. Promo slot - honest "Coming soon" placeholder. Will swap to live
            Marketplace setup CTA once Phase 4 ships. */}
        <RailPanel title={t('leftRail.promoTitle')} ariaLabel={t('leftRail.promoTitle')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span
              aria-hidden
              style={{
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--cr-primary-light)',
                color: 'var(--cr-primary)',
              }}
            >
              <Megaphone size={16} />
            </span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--cr-text)',
                  lineHeight: 1.4,
                }}
              >
                {t('leftRail.promoTitleBody')}
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('leftRail.promoBody')}
              </p>
              <ComingSoonBadge label={t('comingPhase4')} />
            </div>
          </div>
        </RailPanel>
      </Rail>

      {/* MIDDLE - composer trigger, setup cards, tabs, feed.
          Header (title + subtitle) dropped - the composer trigger anchors the
          column naturally, LinkedIn-style. Width comes from the
          sidebar-responsive `--cn-feed-max-w` token (600 expanded / 680
          collapsed) so the feed column grows alongside the rails when the
          product sidebar collapses. */}
      <main className="w-full" style={{ maxWidth: 'var(--cn-feed-max-w, 600px)' }}>
        {/* Top-of-feed stack - the setup cards (each self-hides to null) + the
            composer in ONE gap'd flex column. Flex `gap` only counts rendered
            flex items: it skips `display:none` AND truly-absent (null) children,
            but it DOES count an empty wrapper element. So each optional card must
            render BARE (no wrapper div) and own its own hide logic - otherwise a
            wrapper that stays in the DOM when its card is null is not
            `display:none` on mobile (a `lg:hidden`/`xl:hidden` only bites at that
            breakpoint up), keeps a `gap` slot, and pushes the composer ~16px down
            on phones. Hence ConnectErpCrossSell and FeedProfileCard are both bare. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
          {/* Sample-content disclosure strip. Bare child: it returns null when
              dismissed / disabled, so the flex gap leaves no empty slot. */}
          <SampleContentBanner />
          <ConnectErpCrossSell intent={profile?.onboardingIntent} />
          {/* In-feed dismissible strength meter. Rendered BARE: it owns its own
              `lg:hidden` (at lg+ the left rail's `ProfileStrengthCard` carries the
              meter) so that when it self-hides it emits no empty flex node. */}
          <FeedProfileCard profile={profile} />

          {/* BOOST-UI (owner 2026-06-19): Spotlight on MOBILE. The right rail
              (which hosts the Spotlight card) only appears at md+ (the below-feed
              tablet band) and xl (the side rail), so phones (<768px) never saw a
              Spotlight boost. Most users are mobile, so surface JUST the Spotlight
              card here at the top of the feed column on phones only (md:hidden,
              mutually exclusive with the tablet/desktop rail copies). Reuses the
              same already-resolved spotlightCard prop the page passes down; the
              full rail panel set is intentionally NOT dumped onto mobile.
              Cross-module: SpotlightRailCard fires the spotlight_rail MRC beacons,
              same as the rail copies. */}
          {spotlightCard && (
            <div className="md:hidden">
              <SpotlightRailCard card={spotlightCard} />
            </div>
          )}

          {/* Composer card - avatar + "share" trigger on top, media
              quick-shortcuts (Photo / Video / Voice) below a divider. Each
              shortcut opens the composer pre-set to that mode (the modes
              already exist; this just surfaces quick entry points, LinkedIn
              pattern). Voice is our karigar-friendly differentiator. */}
          <div
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <DsAvatar name={viewer.name} src={viewer.avatar ?? undefined} size={40} />
              <button
                type="button"
                onClick={() => openComposer('none')}
                style={{
                  flex: 1,
                  // minWidth:0 lets this flex child shrink below its text width so
                  // the ellipsis below can engage; without it flex keeps the pill
                  // at content width and the long prompt wraps. The pill is a
                  // radius-full stadium - it must stay ONE line on every width, or
                  // it grows into an awkward 2-3 line oval on phones. nowrap +
                  // ellipsis keeps it a clean single line in all four locales.
                  minWidth: 0,
                  textAlign: 'start',
                  padding: '11px 16px',
                  minHeight: 44,
                  borderRadius: 'var(--cr-radius-full)',
                  border: '1px solid var(--cr-border)',
                  background: 'var(--cr-surface)',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  color: 'var(--cr-text-4)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {t('composer.trigger')}
              </button>
            </div>
            <div style={{ display: 'flex', borderTop: '1px solid var(--cr-border-light)' }}>
              {(
                [
                  { mode: 'photo', label: t('composer.mode.photo'), Icon: ImagePlus },
                  { mode: 'video', label: t('composer.mode.video'), Icon: Video },
                  { mode: 'voice', label: t('composer.mode.voice'), Icon: Mic },
                ] as const
              ).map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => openComposer(mode)}
                  className="transition-colors hover:bg-surface-2"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 8px',
                    minHeight: 44,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--cr-text-3)',
                  }}
                >
                  <Icon size={18} aria-hidden style={{ color: 'var(--cr-primary)' }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Admin-curated promo carousel. Renders nothing when `banners` is
            empty, so the composer sits flush against the tabs as before. Data:
            features/connect/banners (public GET /connect/banners). */}
        {banners.length > 0 && (
          <div style={{ marginTop: 'var(--cr-space-md)' }}>
            <FeedBannerCarousel banners={banners} />
          </div>
        )}

        <div style={{ marginTop: 'var(--cr-space-md)' }}>
          <ModuleTabs tabs={tabs} defaultTab="foryou" ariaLabel={t('tablistAria')} />
        </div>

        <div role="tabpanel" style={{ paddingTop: 'var(--cr-space-lg)' }}>
          {/* In-feed PYMK, mobile only (below md). On tablet the right rail
              folds below the feed and carries PYMK there; at xl+ the side rail
              does. So a member with no follows still gets a follow prompt. */}
          {suggestions.length > 0 && (
            <div className="md:hidden" style={{ marginBottom: 'var(--cr-space-md)' }}>
              <FeedPeopleToFollow people={suggestions} />
            </div>
          )}
          <ConnectErrorBoundary>
            {'error' in data ? (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 'var(--cr-space-sm)',
                  padding: 'var(--cr-space-xl) var(--cr-space-md)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--cr-error-bg)',
                    color: 'var(--cr-error)',
                  }}
                >
                  <TriangleAlert size={22} />
                </span>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text)' }}>
                  {t('loadErrorTitle')}
                </h2>
                <p
                  style={{
                    margin: 0,
                    maxWidth: 360,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--cr-text-4)',
                  }}
                >
                  {t('loadError')}
                </p>
                <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.refresh()}>
                  {t('retry')}
                </DsButton>
              </div>
            ) : (
              <FeedList
                tab={tab}
                initialPage={data.page}
                viewerId={viewer.id}
                onboarded={onboarded}
                sponsoredCards={sponsoredCards}
              />
            )}
          </ConnectErrorBoundary>
          {/* Mobile-only Google unit. The feed's first-party boosts already
              interleave in-feed on every width, but the Google connect.right.top
              slot lives in rightRailPanels (shown at md+ only). Phones (<md) never
              saw it, so surface it here once, md:hidden (mutually exclusive with
              the tablet/desktop rail copies). keep in sync with rightRailPanels. */}
          <div className="md:hidden" style={{ marginTop: 'var(--cr-space-md)' }}>
            <AdSlot placement="connect.right.top" />
          </div>
        </div>

        {/* Right rail folds BELOW the feed on tablet (md to xl), per
            design-decisions doc §4.2. Hidden on mobile (the in-feed people
            strip above covers it) and at xl (the side rail takes over). */}
        <div className="hidden md:block xl:hidden" style={{ marginTop: 'var(--cr-space-lg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
            {rightRailPanels}
          </div>
        </div>
      </main>

      {/* RIGHT RAIL - xl side column. On tablet (md to xl) these same panels
          fold below the feed content (see the below-feed block in <main>),
          per design-decisions doc §4.2. */}
      <Rail side="right">{rightRailPanels}</Rail>

      <Composer
        key={composerKey}
        open={composerOpen}
        initialMode={composerMode}
        onClose={() => setComposerOpen(false)}
        onPosted={handlePosted}
      />
    </ConnectPage>
  );
}

/**
 * Small "Coming with Phase N" badge used by the placeholder panels. Sits
 * inline below the body copy so the panel reads as honestly-unfinished
 * rather than fake-populated.
 */
function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: 8,
        padding: '2px 8px',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: 'var(--cr-surface-2)',
        color: 'var(--cr-text-4)',
        borderRadius: 999,
      }}
    >
      {label}
    </span>
  );
}
