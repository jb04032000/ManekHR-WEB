'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Gauge,
  GraduationCap,
  Handshake,
  Languages,
  Layers,
  LayoutDashboard,
  MapPin,
  MonitorPlay,
  Package,
  PenSquare,
  Play,
  Star,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import TrustBadgeRow from '@/components/connect/TrustBadgeRow';
// Per-item "Sample" disclosure pill on a seeded demo company page (page.isDemo).
// One source of truth with the marketplace/search demo down-rank (BE demo-rank).
import SampleBadge from '@/components/connect/SampleBadge';
import RatingStars from '@/components/connect/RatingStars';
import SellerReviews from '@/components/connect/SellerReviews';
import FollowPageButton from './FollowPageButton';
import CompanyPagePostsList from './CompanyPagePostsList';
import CompanyJobsSection from './CompanyJobsSection';
import CompanyStoreCard from './CompanyStoreCard';
import AlumniList from './AlumniList';
import InstitutePlacementCard from './InstitutePlacementCard';
import HireCandidatesModal from './HireCandidatesModal';
import { isConnectModuleEnabled } from '@/lib/connect/flags';
import { showJobsTab, showPlacementsTab, showAlumniTab } from './companyJobs.logic';
import { languageLabel } from './company-labels';
import { categoryLabel } from '../search.types';
import type {
  CompanyPage,
  Storefront,
  InstituteAlumniResult,
  InstitutePlacementResult,
} from './entities.types';
import type { HydratedFeedPage } from '../feed.types';
import type { Job } from '../jobs/jobs.types';
import type { ConnectListingRef } from '../search.types';
import type { RatingAggregate } from '../reviews/reviews.types';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';
import { noDownloadVideoProps } from '@/lib/connect/media-guard';

interface Props {
  page: CompanyPage;
  /** Derived ERP-linked badge (never stored). */
  erpLinked: boolean;
  /** Follower count for the header. Omit on surfaces that do not show follow. */
  followerCount?: number;
  /** The viewer's own follow state (authed; false logged-out). */
  initialFollowing?: boolean;
  /** SSR-seeded first page of the page's public posts (the Posts tab). */
  postsPage?: HydratedFeedPage;
  /** The page's open jobs (the Jobs tab). Omit/empty to hide. */
  jobs?: Job[];
  /** Public products across the page's linked storefronts. Drives the Store card's
   *  product count + featured preview (NOT a full inline catalogue any more). */
  products?: ConnectListingRef[];
  /** The page's attached public storefront (or null). When present, the Overview
   *  shows a redirect-first Store card; the full catalogue lives at /store/[slug].
   *  Visibility-gated server-side: a hidden/connections store arrives as null. */
  store?: Storefront | null;
  /** Owner's seller rating aggregate (R2) - warm-starts the Reviews tab header. */
  rating?: RatingAggregate;
  /** True when the signed-in viewer owns this page (in-app route only). Unlocks
   *  the owner jobs affordances (Post a job, Manage in Jobs, close); false for
   *  visitors and the logged-out SEO mirror. */
  isOwner?: boolean;
  /** True when the viewer is signed in (the in-app route passes `meRes.ok`; the
   *  logged-out public mirror leaves it false). Institutes Phase 2, Feature 4:
   *  gates the "Hire our trained candidates" button so only a logged-in
   *  non-owner sees it (the lead needs an inbox thread + a real sender). */
  viewerSignedIn?: boolean;
  /** Institute-only (Institutes Phase 2, Feature 2). SSR-seeded first page of the
   *  Alumni / Open-to-work tab. Present only on institute pages; the BE already
   *  DPDP-trims. Omit on business pages. */
  alumniPage?: InstituteAlumniResult;
  /** Institute-only. The Placement wall ("where our students work"). Present only
   *  on institute pages. Omit on business pages. */
  placements?: InstitutePlacementResult;
}

// Products are no longer a tab: the page is redirect-first (a Store card on
// Overview -> /store/[slug]), so the full inline catalogue was removed.
// `placements` + `alumni` are institute-only (Institutes Phase 2, Feature 2):
// the "where our students work" wall + the Alumni / Open-to-work tab.
type TabKey = 'overview' | 'jobs' | 'placements' | 'alumni' | 'posts' | 'reviews';

/** Per-tab icon - mirrors the manage console's tab bar so the two company
 *  surfaces read consistently. */
const TAB_ICON: Record<TabKey, LucideIcon> = {
  overview: LayoutDashboard,
  jobs: Briefcase,
  // Placements = employers (a building); Alumni = people (open-to-work check).
  placements: Building2,
  alumni: Users,
  posts: PenSquare,
  reviews: Star,
};

/** Comma-join the non-empty parts of a location (city, district, state) - the
 *  same natural order the directory card uses, so the location reads identically
 *  across surfaces. */
function formatLocation(loc: CompanyPage['location']): string {
  return [loc?.city, loc?.district, loc?.state].filter((p) => p && p.trim()).join(', ');
}

/**
 * Public, read-only Company Page view (the `/company/[slug]` SEO surface).
 * Person-centric business identity: banner, logo, name, optional ERP-linked
 * badge, about, and the "what we do" capabilities panel. Member-facing, i18n'd,
 * WCAG-AA (alt text, heading order, decorative images aria-hidden).
 */
export default function CompanyPageView({
  page,
  erpLinked,
  followerCount,
  initialFollowing = false,
  postsPage,
  jobs = [],
  products = [],
  store = null,
  rating,
  isOwner = false,
  viewerSignedIn = false,
  alumniPage,
  placements,
}: Props) {
  const t = useTranslations('connect.companyPage');
  const tReviews = useTranslations('connect.reviews');
  const tCat = useTranslations('connect.search.listing.category');
  const locale = useLocale();
  // Hide the poster-first play badge once the company video starts (mirrors the
  // profile ProfileView + the marketplace ListingDetailScreen).
  const [videoStarted, setVideoStarted] = useState(false);
  // "Hire our trained candidates" composer (Institutes Phase 2, Feature 4).
  const [hireOpen, setHireOpen] = useState(false);
  // At most one clip (the form + backend cap it). Shown on the Overview tab.
  const companyVideo = page.videos?.[0];
  const location = formatLocation(page.location);
  // Institute vs business: an institute swaps the capabilities grid (courses +
  // delivery modes) for the business one (machines/production). Older pages have
  // no `kind` -> business. Mirrors BE CompanyPage.kind (default 'business').
  const isInstitute = page.kind === 'institute';
  const panel = page.industryPanel;
  const hasPanel =
    !isInstitute &&
    !!panel &&
    ((panel.specialization?.length ?? 0) > 0 ||
      !!panel.machineCapacity?.trim() ||
      !!panel.production?.trim() ||
      (panel.languages?.length ?? 0) > 0);
  // Institute capabilities grid: shown only for an institute page that has any of
  // courses/modes/languages. Parallel to hasPanel; the two are mutually exclusive.
  const instPanel = page.institutePanel;
  const instModes = (instPanel?.modes ?? []).filter((m) => m === 'online' || m === 'offline');
  const hasInstitutePanel =
    isInstitute &&
    !!instPanel &&
    ((instPanel.coursesOffered?.length ?? 0) > 0 ||
      instModes.length > 0 ||
      (instPanel.languages?.length ?? 0) > 0);

  // "Hire our trained candidates" (Institutes Phase 2, Feature 4): a business
  // sends an institute a hire lead, which becomes an inbox thread. Shown only on
  // an institute page, to a logged-in viewer who is NOT the owner (a self-lead is
  // blocked BE-side), and only once the inbox module's phase is live (mirrors the
  // StartConversationButton handoff gate). The button opens the composer modal.
  const showHire = isInstitute && viewerSignedIn && !isOwner && isConnectModuleEnabled('inbox');

  // The tab bar shows only the tabs that have content. Overview carries the
  // About + "what we do" panel + the redirect-first Store card; the rest are
  // their own surfaces. With a single tab there is no bar (unchanged from the
  // old single-scroll page).
  const hasOverview =
    !!page.about?.trim() || hasPanel || hasInstitutePanel || erpLinked || !!store || !!companyVideo;
  // Institute tabs (Institutes Phase 2, Feature 2): Placements ("where our
  // students work") + Alumni / Open-to-work. Present only on institute pages
  // (gated by `isInstitute`), then owner-always / public-when-non-empty via the
  // pure helpers. Placements carry content when there is at least one platform
  // employer OR any free-text "other workplaces"; alumni when there is at least
  // one opted-in open-to-work student. The data props are absent on business
  // pages, so the `??` defaults keep the flags false there.
  const hasPlacementsContent =
    (placements?.employers.length ?? 0) > 0 || (placements?.otherEmployerCount ?? 0) > 0;
  const hasAlumniContent = (alumniPage?.items.length ?? 0) > 0;
  const showPlacements = isInstitute && showPlacementsTab(hasPlacementsContent, isOwner);
  const showAlumni = isInstitute && showAlumniTab(hasAlumniContent, isOwner);
  const tabs: TabKey[] = [
    ...(hasOverview ? (['overview'] as const) : []),
    ...(showJobsTab(jobs.length, isOwner) ? (['jobs'] as const) : []),
    ...(showPlacements ? (['placements'] as const) : []),
    ...(showAlumni ? (['alumni'] as const) : []),
    ...(postsPage ? (['posts'] as const) : []),
    // Reviews are open to all, so the tab is always present so a buyer always has
    // somewhere to leave (or read) feedback on the page owner.
    'reviews' as const,
  ];
  // Honor a `?tab=` deep-link (e.g. the manage console's "View reviews" opens
  // `?tab=reviews`) when it names a tab that exists; otherwise the first tab.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as TabKey | null;
  const [active, setActive] = useState<TabKey>(
    requestedTab && tabs.includes(requestedTab) ? requestedTab : (tabs[0] ?? 'overview'),
  );
  const activeTab = tabs.includes(active) ? active : (tabs[0] ?? 'overview');
  // Single tab -> render it with no bar; multiple -> render only the active one.
  const shows = (k: TabKey) => (tabs.length > 1 ? activeTab === k : tabs.includes(k));

  // Select a tab: update local state + the `?tab=` URL (replaceState, no
  // navigation, so the switch stays instant). Writing the tab to the URL means
  // it survives a refresh, a shared link, and - the point of this - opening a
  // job/post/review then pressing back: the stored history entry carries
  // `?tab=`, and on remount the `requestedTab` seeding above restores it.
  // Mirrors `StorefrontView`'s `selectTab` so the two public surfaces behave
  // identically; keep the two in sync.
  const selectTab = (k: TabKey) => {
    setActive(k);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', k);
    window.history.replaceState(null, '', url.toString());
  };

  return (
    // Width-agnostic: the host caps it (ConnectPage in-app, a max-w wrapper on
    // the public page) so the in-app view matches the profile's container.
    <article className="mx-auto w-full">
      {/* Identity card -- the hero cover + identity header share one bordered,
          rounded card (matching the manage console header + the canonical
          prototype), so the top section reads as a single contained unit on the
          page background. The card clips the banner's corners (overflow-hidden). */}
      <section
        className="overflow-hidden"
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        {/* Hero cover -- the uploaded banner, or a textile-warm gradient wash with
            a subtle stitch motif as the one decorative flourish. */}
        <div
          className="relative h-40 w-full overflow-hidden sm:h-52"
          style={{ background: page.banner ? undefined : 'var(--cr-grad-hero)' }}
        >
          {page.banner ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded banner creative; next/image adds no optimisation here
            <img src={page.banner} alt="" aria-hidden className="h-full w-full object-cover" />
          ) : (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1080 220"
              preserveAspectRatio="none"
              aria-hidden
            >
              <circle
                cx="120"
                cy="44"
                r="120"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeDasharray="2 11"
                opacity="0.22"
              />
              <circle
                cx="900"
                cy="186"
                r="150"
                fill="none"
                stroke="var(--cr-gold-400)"
                strokeWidth="1.2"
                strokeDasharray="2 12"
                opacity="0.4"
              />
              <circle
                cx="560"
                cy="110"
                r="200"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="2 13"
                opacity="0.15"
              />
            </svg>
          )}
        </div>

        {/* Identity header -- the logo overlaps the hero cover (the canonical
          company-page anatomy), while the name + location sit BELOW the banner so
          they stay readable. Only the logo carries `relative z-[1]`, lifting it in
          front of the position:relative hero cover (the name never overlaps). */}
        <header className="flex flex-wrap items-start gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <div
            className="relative z-[1] -mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden sm:-mt-14"
            style={{
              borderRadius: 'var(--cr-radius-md)',
              border: '4px solid var(--cr-surface)',
              background: 'var(--cr-surface-2)',
              boxShadow: 'var(--cr-shadow-md)',
            }}
          >
            {page.logo ? (
              // alt="" : decorative - the page name is the adjacent <h1>, so a
              // non-empty alt would make a screen reader announce it twice.
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo creative; next/image adds no optimisation here
              <img src={page.logo} alt="" aria-hidden className="h-full w-full object-cover" />
            ) : (
              <span
                aria-hidden
                style={{ fontSize: 34, fontWeight: 700, color: 'var(--cr-text-4)' }}
              >
                {page.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {page.name}
            </h1>
            {page.isDemo && (
              <div className="mt-1.5">
                <SampleBadge size="md" />
              </div>
            )}
            {location && (
              <p
                className="m-0 mt-0.5 inline-flex items-center gap-1 text-[13px]"
                style={{ color: 'var(--cr-text-4)' }}
              >
                <MapPin size={13} aria-hidden />
                {location}
              </p>
            )}
            {/* Institute badge: a small pill on training-institute pages, so a
                visitor reads the page as an institute at a glance (mirrors the
                editor preview's Institute pill). Uses the brand-pill tokens. */}
            {isInstitute && (
              <div className="mt-1.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    borderRadius: 'var(--cr-radius-full)',
                    background: 'var(--cr-pill-brand-bg)',
                    color: 'var(--cr-pill-brand-fg)',
                  }}
                >
                  <GraduationCap size={12} aria-hidden />
                  {t('instituteBadge')}
                </span>
              </div>
            )}
            {erpLinked && (
              <div className="mt-1.5">
                <TrustBadgeRow badges={['erp']} />
              </div>
            )}
            {rating && rating.ratingCount > 0 && (
              <div className="mt-1.5">
                <RatingStars
                  value={rating.ratingAvg}
                  count={rating.ratingCount}
                  size={15}
                  showCount
                />
              </div>
            )}
          </div>
          {/* Primary actions (right of the identity): Follow + the institute-only
              "Hire our trained candidates" lead button. The wrapper still appears
              when only the hire button is present (a logged-out public page omits
              the follower count but a signed-in non-owner can still hire). */}
          {(followerCount !== undefined || showHire) && (
            <div className="flex flex-wrap items-center gap-2 pt-3 sm:ms-auto">
              {showHire && (
                <button
                  type="button"
                  onClick={() => setHireOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
                  style={{
                    border: '1px solid var(--cr-primary)',
                    background: 'var(--cr-surface)',
                    color: 'var(--cr-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <Handshake size={15} aria-hidden />
                  {t('hireCandidates.button')}
                </button>
              )}
              {followerCount !== undefined && (
                <FollowPageButton
                  pageId={page._id}
                  initialFollowing={initialFollowing}
                  initialCount={followerCount}
                />
              )}
            </div>
          )}
        </header>
      </section>

      {/* Tab bar - a tinted pill track matching the manage console, only when
          more than one tab has content. Wrapper scrolls horizontally on narrow
          screens; `overflow-y-hidden` + `py-1` give the active lozenge's shadow
          room without ever showing a vertical scrollbar. */}
      {tabs.length > 1 && (
        <div className="mt-6 overflow-x-auto overflow-y-hidden px-4 py-1">
          <nav
            role="tablist"
            aria-label={page.name}
            className="inline-flex gap-1 p-1"
            style={{
              background: 'var(--cr-surface-2)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-full)',
            }}
          >
            {tabs.map((k) => {
              const isActive = activeTab === k;
              const Icon = TAB_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectTab(k)}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--cr-text)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--cr-text-4)';
                  }}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-0 px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors"
                  style={{
                    borderRadius: 'var(--cr-radius-full)',
                    background: isActive ? 'var(--cr-surface)' : 'transparent',
                    color: isActive ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                    boxShadow: isActive ? 'var(--cr-shadow-sm)' : 'none',
                  }}
                >
                  <Icon
                    size={15}
                    aria-hidden
                    style={{ color: isActive ? 'var(--cr-primary)' : 'var(--cr-text-4)' }}
                  />
                  {k === 'reviews' ? tReviews('title') : t(`tabs.${k}`)}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* About (Overview tab) */}
      {shows('overview') && page.about?.trim() && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-2 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('about')}
          </h2>
          <p
            className="m-0 text-[14px] leading-relaxed whitespace-pre-line"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {page.about}
          </p>
        </section>
      )}

      {/* Industry details (Overview tab) -- a labelled spec-grid of the real
          capabilities panel; only populated cells render. Business pages only:
          `hasPanel` is already false for institutes (gated above), so the
          institute grid below takes its place. */}
      {shows('overview') && hasPanel && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('capabilities')}
          </h2>
          <dl
            className="m-0 grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-2"
            style={{
              background: 'var(--cr-divider)',
              border: '1px solid var(--cr-divider)',
              borderRadius: 'var(--cr-radius-md)',
            }}
          >
            {(panel.specialization?.length ?? 0) > 0 && (
              <SpecCell icon={Layers} label={t('specialization')}>
                <div className="flex flex-wrap gap-1.5">
                  {panel.specialization.map((s) => (
                    <span
                      key={s}
                      className="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                      style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' }}
                    >
                      {categoryLabel(s, tCat)}
                    </span>
                  ))}
                </div>
              </SpecCell>
            )}
            {panel.machineCapacity?.trim() && (
              <SpecCell icon={Gauge} label={t('machineCapacity')}>
                {panel.machineCapacity}
              </SpecCell>
            )}
            {panel.production?.trim() && (
              <SpecCell icon={Package} label={t('production')}>
                {panel.production}
              </SpecCell>
            )}
            {(panel.languages?.length ?? 0) > 0 && (
              <SpecCell icon={Languages} label={t('languages')}>
                {panel.languages.map((l) => languageLabel(l, locale)).join(', ')}
              </SpecCell>
            )}
          </dl>
        </section>
      )}

      {/* Institute details (Overview tab) -- the institute analogue of the industry
          grid: courses offered + delivery modes + languages. Renders in the same
          slot, gated on `hasInstitutePanel` (institute pages only); reuses the
          shared SpecCell so the two grids read identically. */}
      {shows('overview') && hasInstitutePanel && instPanel && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('capabilities')}
          </h2>
          <dl
            className="m-0 grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-2"
            style={{
              background: 'var(--cr-divider)',
              border: '1px solid var(--cr-divider)',
              borderRadius: 'var(--cr-radius-md)',
            }}
          >
            {(instPanel.coursesOffered?.length ?? 0) > 0 && (
              <SpecCell icon={BookOpen} label={t('coursesOffered')}>
                <div className="flex flex-wrap gap-1.5">
                  {instPanel.coursesOffered.map((c) => (
                    <span
                      key={c}
                      className="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                      style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </SpecCell>
            )}
            {instModes.length > 0 && (
              <SpecCell icon={MonitorPlay} label={t('modes')}>
                {instModes
                  .map((m) => (m === 'online' ? t('modeOnline') : t('modeOffline')))
                  .join(', ')}
              </SpecCell>
            )}
            {(instPanel.languages?.length ?? 0) > 0 && (
              <SpecCell icon={Languages} label={t('languages')}>
                {instPanel.languages.map((l) => languageLabel(l, locale)).join(', ')}
              </SpecCell>
            )}
          </dl>
        </section>
      )}

      {/* ERP-verified note (Overview tab) -- honest trust context (an active linked
          ERP account, not a paid placement); shown only for ERP-linked pages. */}
      {shows('overview') && erpLinked && (
        <section className="mt-6 px-4">
          <div
            className="flex items-start gap-3 p-4"
            style={{
              background: 'var(--cr-wash-indigo)',
              border: '1px solid var(--cr-primary-border)',
              borderRadius: 'var(--cr-radius-md)',
            }}
          >
            <BadgeCheck
              size={18}
              aria-hidden
              style={{ color: 'var(--cr-primary)', flex: 'none', marginTop: 1 }}
            />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                {t('erpNoteTitle')}
              </div>
              <p
                className="m-0 mt-1 text-[12.5px] leading-relaxed"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {t('erpNoteBody')}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Company video (Overview tab) - poster-first player, shown only when a
          clip exists (editing is a separate manage route, so no inline pencil
          here; everyone who sees the page sees the player). Painted poster-first
          with preload="metadata" + a non-interactive play badge that hides once
          playback starts - the SAME pattern as the profile ProfileView + the
          marketplace ListingDetailScreen. Native <video controls> is keyboard
          accessible; the badge is aria-hidden (decorative cue only). */}
      {shows('overview') && companyVideo && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('video.displayTitle')}
          </h2>
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--cr-radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--cr-border)',
              background: '#000',
            }}
          >
            <video
              controls
              // Strip the easy download affordances (native download button, PiP,
              // right-click save). Shared with every Connect media player.
              {...noDownloadVideoProps}
              preload="metadata"
              poster={companyVideo.posterUrl || undefined}
              src={companyVideo.url}
              aria-label={t('video.play')}
              onPlay={() => {
                setVideoStarted(true);
                // Additive funnel telemetry: video play on the company surface.
                trackEvent(ConnectEvents.videoPlay, { surface: 'company' });
              }}
              style={{ width: '100%', maxHeight: 520, background: '#000', display: 'block' }}
            />
            {!videoStarted && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(14,24,68,0.55)',
                    color: '#fff',
                  }}
                >
                  <Play size={26} aria-hidden style={{ marginInlineStart: 3 }} />
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Store (Overview tab) - redirect-first: an identity card with a few
          featured products + a Visit-store link to /store/[slug]. The full
          catalogue lives on the storefront page, never inline here. Hidden when
          the page has no attached public store (store === null). */}
      {shows('overview') && store && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('storeSectionTitle')}
          </h2>
          <CompanyStoreCard
            store={store}
            productCount={products.length}
            featured={products.slice(0, 6)}
          />
        </section>
      )}

      {/* Jobs (role-aware: the owner manages, a visitor applies). The empty state
          shows only for the owner; a visitor with no jobs never reaches here
          because the Jobs tab is hidden for them (showJobsTab). */}
      {shows('jobs') && (
        <section className="mt-6 px-4">
          <CompanyJobsSection
            pageId={page._id}
            pageName={page.name}
            jobs={jobs}
            isOwner={isOwner}
          />
        </section>
      )}

      {/* Placements ("where our students work") - institute only. A grid of
          employer tiles (one per platform CompanyPage) showing the real
          per-employer student count, plus an "and N other workplaces" line for
          free-text shops. EMPTY + owner -> the acquisition invite CTA (a public
          visitor never reaches an empty Placements tab; it is hidden for them). */}
      {shows('placements') && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('tabs.placements')}
          </h2>
          {hasPlacementsContent && placements ? (
            <>
              {placements.employers.length > 0 && (
                <ul
                  className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3"
                  aria-label={t('placementsListAria')}
                >
                  {placements.employers.map((e) => (
                    <li key={e.company.id}>
                      <InstitutePlacementCard employer={e} />
                    </li>
                  ))}
                </ul>
              )}
              {/* Students whose current employer is a free-text shop (no page). */}
              {placements.otherEmployerCount > 0 && (
                <p className="m-0 mt-3 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                  {t('otherWorkplaces', { count: placements.otherEmployerCount })}
                </p>
              )}
            </>
          ) : (
            <InstituteInviteEmpty
              pageId={page._id}
              title={t('placementsEmptyTitle')}
              body={t('placementsEmptyOwner')}
              cta={t('inviteStudents')}
            />
          )}
        </section>
      )}

      {/* Alumni / Open-to-work - institute only. A PersonCard grid (variant card)
          of opted-in, open-to-work students, paged via AlumniList. EMPTY + owner
          -> the invite CTA (hidden for a public visitor). */}
      {shows('alumni') && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('tabs.alumni')}
          </h2>
          {hasAlumniContent && alumniPage ? (
            <AlumniList pageId={page._id} initialPage={alumniPage} />
          ) : (
            <InstituteInviteEmpty
              pageId={page._id}
              title={t('alumniEmptyTitle')}
              body={t('alumniEmptyOwner')}
              cta={t('inviteStudents')}
            />
          )}
        </section>
      )}

      {/* Posts */}
      {shows('posts') && postsPage && (
        <section className="mt-6 px-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('postsTitle')}
          </h2>
          <CompanyPagePostsList pageId={page._id} name={page.name} initialPage={postsPage} />
        </section>
      )}

      {/* Reviews & Ratings (marketplace Phase C) */}
      {shows('reviews') && (
        <section className="mt-6 px-4">
          <SellerReviews
            subjectUserId={page.ownerUserId}
            subjectName={page.name}
            initialAggregate={rating}
          />
        </section>
      )}

      {/* Hire-lead composer (Institutes Phase 2, Feature 4) - rendered only when
          the button is shown; destroyOnHidden keeps it clean between opens. */}
      {showHire && (
        <HireCandidatesModal
          pageId={page._id}
          instituteName={page.name}
          open={hireOpen}
          onClose={() => setHireOpen(false)}
        />
      )}
    </article>
  );
}

/**
 * InstituteInviteEmpty - the owner-only acquisition empty state for the institute
 * Placements / Alumni tabs (Institutes Phase 2, Feature 2). When an institute has
 * no opted-in students yet, the OWNER (never a public visitor - their empty tab
 * is hidden entirely) sees a friendly prompt plus an "Invite students" button
 * instead of a blank tab. This empty state IS the acquisition mechanic, not an
 * afterthought.
 *
 * Cross-module links: the CTA links to the manage console's Students tab
 * (`/connect/pages/[pageId]?tab=students`, built in Feature 3 / W3 - that exact
 * `tab=students` key hosts the bulk-invite flow). Keep the tab key in sync with
 * the manage console route. Rendered only inside a `shows(tab)` section, which is
 * present for the owner when the tab is empty - so this never shows to a visitor.
 */
function InstituteInviteEmpty({
  pageId,
  title,
  body,
  cta,
}: {
  pageId: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 px-5 py-8 text-center"
      style={{
        background: 'var(--cr-surface-2)',
        border: '1px dashed var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center"
        style={{
          borderRadius: 'var(--cr-radius-full)',
          background: 'var(--cr-pill-brand-bg)',
          color: 'var(--cr-pill-brand-fg)',
        }}
      >
        <GraduationCap size={20} aria-hidden />
      </span>
      <div>
        <div className="text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
          {title}
        </div>
        <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {body}
        </p>
      </div>
      <Link
        href={`/connect/pages/${pageId}?tab=students`}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold no-underline"
        style={{ background: 'var(--cr-primary)', color: '#ffffff' }}
      >
        <UserPlus size={15} aria-hidden />
        {cta}
      </Link>
    </div>
  );
}

/** One labelled cell in the Industry-details spec-grid (icon + uppercase label +
 *  the real value). Hairline separators come from the grid's `gap-px` + divider
 *  background, so a cell is just a padded white surface. */
function SpecCell({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ background: 'var(--cr-surface)', padding: '13px 15px' }}>
      <div
        className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-4)' }}
      >
        <Icon size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
        {label}
      </div>
      <div
        className="mt-1.5 text-[13px] font-semibold"
        style={{ color: 'var(--cr-text)', lineHeight: 1.5 }}
      >
        {children}
      </div>
    </div>
  );
}
