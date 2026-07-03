'use client';

/**
 * ProfileView - the read-only ManekHR Connect profile.
 *
 * One component serves both surfaces: the owner's own profile
 * (`/connect/profile`, `isOwner`) and the public profile (`/u/[userId]`).
 * Identity (name + avatar) is canonical on `User` and passed in as
 * `displayName` / `avatarUrl` - the own page sources it from the auth store,
 * the public page from the populated `userId` (IDENTITY-MODEL.md: name/avatar
 * are never duplicated onto `ConnectProfile`).
 *
 * The ERP-linked moat badge + trust panel are driven by `erpLinked` /
 * `erpSince` - derived live by the backend `ErpLinkService`, never stored.
 *
 * Layout is mobile-first: a single column at < 1024px, then a main column +
 * 320px right rail at `lg`. The rail (strength card / ERP panel) is DOM-first
 * so it sits on top on mobile, and grid-placed into column 2 on desktop.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { App as AntApp, Dropdown, type MenuProps } from 'antd';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck,
  Briefcase,
  Camera,
  Copy,
  Clock,
  FileText,
  GraduationCap,
  Images,
  IndianRupee,
  Lock,
  Mail,
  Pencil,
  Play,
  Plus,
  Quote,
  Share2,
  Sparkles,
  Star,
  Users,
  Video,
  Wrench,
} from 'lucide-react';
import { InfoTooltip } from '@/components/ui';
import ConnectAvatar from '@/components/connect/ConnectAvatar';
// "Sample" disclosure pill beside the name for a seeded demo profile (isDemo).
import SampleBadge from '@/components/connect/SampleBadge';
import SellerReviews from '@/components/connect/SellerReviews';
// Verified-but-anonymous broker reviews (Slice 3wA). Display-only; shown only
// for a broker profile, right after the seller Reviews section. Self-fetches the
// proof-led public payload from the broker-reviews module (introductions anchor).
import BrokerReviews from '@/components/connect/BrokerReviews';
import DsButton from '@/components/ui/DsButton';
import {
  ConnectPage,
  // PAUSED 2026-05-20 - Preferred-contact-channel UI hidden from the public +
  // own profile until the in-app DM flow (Phase 7) ships. The selector
  // component is kept on the design surface (`/design-system`) and the
  // backend field on the schema. Revive via:
  //   rg "PAUSED 2026-05-20 - Preferred-contact-channel"
  // ContactPreferenceSelector,
  ERPLinkedPanel,
  // ERP-linked consent verification (ADR-0004). The one-time suggestion banner +
  // the persistent grant/revoke setting are owner-only; both self-fetch the
  // consent state and call connect/profile/erp-verification. Badge rendering is
  // unchanged (it follows the backend `erpLinked` boolean, now consent-gated).
  ERPConsentBanner,
  ERPConsentSetting,
  ProfileSection,
  ProfileStrengthCard,
  RateRow,
  TrustBadgeRow,
  WhatsAppIcon,
  type StrengthItem,
  type TrustBadgeKind,
} from '@/components/connect';
import { formatMonthYear } from '@/lib/connect/format';
import type {
  ConnectExperienceItem,
  ConnectPortfolioItem,
  ConnectProfileBody,
  ConnectRecommendation,
  ConnectTrainingItem,
  ProfileOpenJobs,
} from '../profile.types';
import type { CompanyPageRef } from '../feed.types';
import type { RatingAggregate } from '../reviews/reviews.types';
import { strengthKeyToSection, type ProfileEditSection } from './EditSectionModal';
// Rich, audience-scoped intent cards, replacing the old flat openTo pill row.
// Cards deep-link into Jobs / RFQ / marketplace / inbox.
import IntentCards from './IntentCards';
// LinkedIn-style "Message" CTA in the profile header -> inbox `startInboxDm`.
// Self-hides when the inbox module is off; the server DM gate enforces who may
// actually message (public = anyone, non-public = connections only).
import StartConversationButton from '@/features/connect/inbox/StartConversationButton';
// First-party promoted listing (boost) for this previously rail-LESS profile page
// (placement `profile_view`): a desktop card in the side aside + an inline mobile
// block, so phone users get the same ad inventory the rail-having pages carry.
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '@/features/connect/marketplace/PromotedListingAdCard';
import MobileAdInline from '../ads/MobileAdInline';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';
import { noDownloadVideoProps } from '@/lib/connect/media-guard';

interface ProfileViewProps {
  /**
   * Canonical share token for the public-profile URL (`/u/<token>`). Both
   * the own-profile screen and the public profile page pass it down - they
   * each prefer `User.handle` (LinkedIn-style human-readable URL) when
   * present and fall back to the 24-hex `ObjectId` for pre-backfill rows.
   * The backend `:slug` resolver accepts both forms.
   *
   * Not part of `ConnectProfileBody` because that type is the profile body
   * alone (identity lives on `User`, per IDENTITY-MODEL.md). The component
   * receives the already-resolved token rather than reaching back into the
   * auth store so it stays usable from the logged-out public route.
   */
  userId: string;
  profile: ConnectProfileBody;
  displayName: string;
  avatarUrl?: string;
  /** Derived ERP-linked verdict (`ErpLinkService`). */
  erpLinked: boolean;
  /** ISO date the workspace's ERP activity began. */
  erpSince?: string | null;
  /** True when the viewer owns this profile - unlocks edit + strength card. */
  isOwner: boolean;
  /**
   * Owner-only - opens the per-section edit modal. Each section card and
   * each strength-checklist row passes its section key (e.g. 'about' for
   * the bio card, 'skills' for the chip row). Strength items are mapped
   * through `strengthKeyToSection` so a strength row like 'bio' opens the
   * About modal. Earlier shape: a single ProfileStrengthKey focus param
   * for the all-in-one edit form - replaced with section-level routing.
   */
  onEdit?: (section: ProfileEditSection) => void;
  /**
   * Non-owner header actions - the Connect / Follow buttons for a signed-in
   * public viewer (`/u/[userId]`). Omitted for the owner's own view and a
   * logged-out viewer.
   */
  actions?: ReactNode;
  /**
   * Public social-proof counts for the header - `{ connections, followers }`,
   * each an independent edge count. Optional: surfaces that don't load them
   * (or a counts-fetch failure) omit it and the row simply doesn't render.
   */
  stats?: { connections: number; followers: number };
  /**
   * The Activity teaser - the member's recent posts as static `ActivityCard`s,
   * rendered directly under the About card for EVERY viewer. The own-profile
   * screen feeds the owner's own posts; the public profile feeds that member's
   * PUBLIC posts; both link to the full activity route. (Phase 2 dropped the
   * earlier owner-only gate - the owner additionally gets the tabbed
   * `/connect/profile/activity` view; visitors get this posts-only preview.)
   */
  activity?: ReactNode;
  /**
   * Owner-only "Your limits" slot (the consolidated usage card). Rendered at the
   * foot of the main column. Undefined for visitors / when not supplied, so the
   * public profile is unchanged. Links: components/connect/ConnectLimitsCard.tsx.
   */
  limits?: ReactNode;
  /**
   * The subject's canonical `User` _id (24-hex ObjectId), distinct from the
   * `userId` SHARE TOKEN above (which may be a handle). Drives the Reviews &
   * Ratings block (marketplace Phase C). Omit to hide the reviews section.
   */
  subjectUserId?: string;
  /** Seller rating aggregate (R2) - warm-starts the reviews header. */
  rating?: RatingAggregate;
  /**
   * Owner header stat - lifetime profile-view count. Own screen only; the
   * public route never receives it, so the "profile views" stat stays
   * owner-private. Appended to the social-proof counts row when not null.
   */
  profileViews?: number;
  /**
   * Live hiring numbers (open-role + applicant counts) for the Hiring intent
   * card. Sourced by the caller from the jobs module
   * (GET jobs/by-user/:id/open) and passed straight through to `IntentCards`.
   */
  openJobs?: ProfileOpenJobs;
  /**
   * Logged-in non-owner viewer (`/u/[slug]` while authenticated). Drives the
   * IntentCards CTA auth routing - a signed-out viewer's CTA points at the
   * join page instead of the deep link. Defaults to false.
   */
  isSignedIn?: boolean;
  /**
   * First-party promoted listing (boost), placement `profile_view`, or null on a
   * no-fill. This page has no dedicated rail; when set, the side aside is forced
   * on (lg+) to hold the desktop ad, and a MobileAdInline carries it below lg.
   */
  promoted?: PromotedListingResolved | null;
  /**
   * True for a seeded demo / sample account (User.isDemo) -> renders a Sample
   * disclosure pill beside the name. The public page passes profile.userId.isDemo;
   * the own-profile screen omits it (a real owner is never demo). One source of
   * truth with the feed/search demo down-rank (backend demo-rank.ts).
   */
  isDemo?: boolean;
}

/** `true` when at least one rate is quoted on the card. */
function hasAnyRate(profile: ConnectProfileBody): boolean {
  const r = profile.rateCard;
  return !!(r && ((r.dailyWage ?? 0) > 0 || (r.pieceRate ?? 0) > 0 || (r.monthly ?? 0) > 0));
}

export default function ProfileView({
  userId,
  profile,
  displayName,
  avatarUrl,
  erpLinked,
  erpSince,
  isOwner,
  onEdit,
  actions,
  stats,
  activity,
  limits,
  subjectUserId,
  rating,
  profileViews,
  openJobs,
  isSignedIn = false,
  promoted = null,
  isDemo = false,
}: ProfileViewProps) {
  const t = useTranslations('connect.profile');
  const tReviews = useTranslations('connect.reviews');
  const tBrokerReviews = useTranslations('connect.brokerReviews');
  const { message: messageApi } = AntApp.useApp();
  // Hide the poster-first play badge once the intro video starts (mirrors the
  // marketplace ListingDetailScreen + the feed PostCard).
  const [videoStarted, setVideoStarted] = useState(false);

  /**
   * The canonical share target - every Connect profile is reachable at
   * `/u/[slug]` where `slug` is the human-readable `User.handle` (preferred)
   * or the 24-hex `ObjectId` fallback. The caller resolves which form to use
   * and hands the result down via the `userId` prop, so this hook is purely
   * the URL-string builder.
   */
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/u/${userId}`;
    return `${window.location.origin}/u/${userId}`;
  }, [userId]);

  /** Copy the share URL to the clipboard. */
  const handleCopyShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      messageApi.success(t('share.copied'));
    } catch {
      messageApi.error(t('share.failed'));
    }
  }, [shareUrl, messageApi, t]);

  /** Open WhatsApp with a pre-filled share message. `wa.me` is the free,
   *  open-graph-friendly link that works on every WA client. */
  const handleShareWhatsApp = useCallback(() => {
    if (typeof window === 'undefined') return;
    const text = encodeURIComponent(t('share.whatsappMessage', { url: shareUrl }));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }, [shareUrl, t]);

  /** Open the user's mail client with a pre-filled subject + body. */
  const handleShareEmail = useCallback(() => {
    if (typeof window === 'undefined') return;
    const subject = encodeURIComponent(t('share.emailSubject', { name: displayName }));
    const body = encodeURIComponent(t('share.emailBody', { name: displayName, url: shareUrl }));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [shareUrl, displayName, t]);

  /** Share-menu items - Copy / WhatsApp / Email. The dropdown opens from the
   *  identity-header Share chip; each item handler builds the link target on
   *  the fly so the URL stays in lockstep with `userId` / `displayName`. */
  const shareMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'copy',
        icon: <Copy size={14} aria-hidden />,
        label: t('share.menu.copy'),
        onClick: () => void handleCopyShare(),
      },
      {
        key: 'whatsapp',
        icon: <WhatsAppIcon size={14} />,
        label: t('share.menu.whatsapp'),
        onClick: handleShareWhatsApp,
      },
      {
        key: 'email',
        icon: <Mail size={14} aria-hidden />,
        label: t('share.menu.email'),
        onClick: handleShareEmail,
      },
    ],
    [t, handleCopyShare, handleShareWhatsApp, handleShareEmail],
  );

  // ERP-linked is the derived moat badge; the paid "Verified seller" marker
  // (M2.3) rides on `profile.verified` from the public read. GST / Udyam /
  // verified-channel badges arrive with their providers (paid APIs).
  const badges: TrustBadgeKind[] = [
    ...(erpLinked ? (['erp'] as const) : []),
    ...(profile.verified ? (['verified'] as const) : []),
    // Broker / dalal self-declaration (Broker badge, Slice 1). Flows onto
    // PersonCard/CompanyCard automatically via TrustBadgeRow. Mirrors the erp /
    // verified pushes above; driven by the self-set `profile.isBroker` flag.
    ...(profile.isBroker ? (['broker'] as const) : []),
  ];

  // Single open-to status for the avatar ring. work/hiring are mutually
  // exclusive (editor-enforced) and deals/customOrders are paused, so this is
  // at most one value. On the public profile the received openTo is already
  // audience-trimmed server-side, so deriving straight from it is correct.
  const openStatus: 'work' | 'hiring' | null = profile.openTo.hiring
    ? 'hiring'
    : profile.openTo.work
      ? 'work'
      : null;

  // The current company shown under the headline: the most-recent ongoing
  // experience entry (no `to` date). When it links a CompanyPage (id resolves
  // in experienceCompanies), the line links to /company/<slug>; otherwise plain
  // text. Hidden when there is no ongoing entry.
  const currentCompany = useMemo(() => {
    const ongoing = (profile.experience ?? []).filter((e) => !e.to);
    ongoing.sort((a, b) => (b.from ? +new Date(b.from) : 0) - (a.from ? +new Date(a.from) : 0));
    return ongoing[0] ?? null;
  }, [profile.experience]);
  const currentCompanyRef = currentCompany?.companyPageId
    ? profile.experienceCompanies?.[currentCompany.companyPageId]
    : undefined;

  // Current-company - TWO renders, one per breakpoint (see headerCard):
  //  - MOBILE (`companyChip`): a subtle TEXT-ONLY line under the headline
  //    (LinkedIn intro pattern). No logo, because the CompanyLogo fallback read
  //    as a broken briefcase on phones.
  //  - DESKTOP (`companyChipDesktop`): the chip beside the name (logo + bold
  //    name), pinned to the right of the identity row on lg+. Uses the real
  //    company logo when the page resolves, else the CompanyLogo default icon.
  // Both link to /company/<slug> when the page id resolves; names truncate so a
  // long company name can't overflow. Cross-links: company-pages module.
  const companyChip = currentCompany ? (
    currentCompanyRef ? (
      <Link
        href={`/company/${currentCompanyRef.slug}`}
        className="block max-w-full truncate text-[13.5px] font-medium no-underline"
        style={{ color: 'var(--cr-text-2)' }}
        title={currentCompany.workshop}
      >
        {currentCompany.workshop}
      </Link>
    ) : (
      <span
        className="block max-w-full truncate text-[13.5px] font-medium"
        style={{ color: 'var(--cr-text-2)' }}
        title={currentCompany.workshop}
      >
        {currentCompany.workshop}
      </span>
    )
  ) : null;
  const companyChipDesktop = currentCompany ? (
    currentCompanyRef ? (
      <Link
        href={`/company/${currentCompanyRef.slug}`}
        className="inline-flex max-w-[220px] min-w-0 items-center gap-2 no-underline"
        title={currentCompany.workshop}
      >
        <CompanyLogo company={currentCompanyRef} size={32} />
        <span
          className="min-w-0 truncate text-[14px] font-semibold"
          style={{ color: 'var(--cr-text)' }}
        >
          {currentCompany.workshop}
        </span>
      </Link>
    ) : (
      <span
        className="inline-flex max-w-[220px] min-w-0 items-center gap-2"
        title={currentCompany.workshop}
      >
        {/* No page -> CompanyLogo renders its default icon. */}
        <CompanyLogo company={currentCompanyRef} size={32} />
        <span
          className="min-w-0 truncate text-[14px] font-semibold"
          style={{ color: 'var(--cr-text)' }}
        >
          {currentCompany.workshop}
        </span>
      </span>
    )
  ) : null;

  const showStrengthCard = isOwner;
  // A promoted listing forces the side aside on (lg+) so this rail-less page has a
  // clean desktop home for the ad, even for a non-owner / non-ERP-linked viewer
  // whose aside would otherwise be absent.
  const hasRail = showStrengthCard || erpLinked || !!promoted;

  // Profile-strength checklist - mirrors the backend `computeStrength` weights.
  const strengthItems: StrengthItem[] = (
    [
      { key: 'headline', done: !!profile.headline.trim() },
      { key: 'bio', done: !!profile.bio.trim() },
      { key: 'banner', done: !!profile.banner.trim() },
      { key: 'skills', done: profile.skills.length >= 3 },
      { key: 'portfolio', done: profile.portfolio.length >= 1 },
      { key: 'experience', done: profile.experience.length >= 1 },
      { key: 'rateCard', done: hasAnyRate(profile) },
    ] as const
  ).map((item) => ({
    key: item.key,
    label: t(`strength.${item.key}`),
    done: item.done,
    action: item.done
      ? undefined
      : { label: t('strength.add'), onClick: () => onEdit?.(strengthKeyToSection(item.key)) },
  }));

  // Small pencil affordance rendered in each ProfileSection's `actions`
  // slot for the owner. Click opens the matching per-section edit modal.
  // Hidden for non-owner viewers; ProfileSection's `actions` slot collapses
  // when nothing is passed.
  const sectionPencil = (section: ProfileEditSection) =>
    isOwner ? (
      <button
        type="button"
        onClick={() => onEdit?.(section)}
        aria-label={t('edit.editSection')}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted transition-colors hover:bg-surface-2 hover:text-heading"
      >
        <Pencil size={14} aria-hidden />
      </button>
    ) : undefined;

  // About - sits directly under the header, above the Activity teaser, so a
  // visitor reads who the person is before what they have posted.
  const aboutSection =
    profile.bio.trim() || isOwner ? (
      <ProfileSection
        icon={<FileText size={16} aria-hidden />}
        title={t('sections.about')}
        actions={sectionPencil('about')}
      >
        {profile.bio.trim() ? (
          <p
            className="m-0 text-[14px] leading-relaxed whitespace-pre-line"
            style={{ color: 'var(--cr-text-2)' }}
          >
            {profile.bio}
          </p>
        ) : (
          <EmptyHint
            text={t('empty.about')}
            addLabel={t('empty.add')}
            onAdd={() => onEdit?.('about')}
          />
        )}
      </ProfileSection>
    ) : null;

  // ── Intro video (poster-first) ─────────────────────────────────────────────
  // At most one clip (the editor + backend cap it). Sits right under About, so a
  // visitor reads who the person is and then sees them introduce themselves,
  // before the activity feed. A visitor sees the player only when a clip exists;
  // the owner additionally sees an empty-hint + edit pencil to add one. Painted
  // poster-first with preload="metadata" + a non-interactive play badge that
  // hides once playback starts - the SAME pattern as the marketplace
  // ListingDetailScreen. Native <video controls> is keyboard accessible; the
  // badge is aria-hidden (decorative cue only). Absent entirely for a visitor
  // when there is no video.
  const introVideo = profile.videos?.[0];
  const videoSection =
    introVideo || isOwner ? (
      <ProfileSection
        icon={<Video size={16} aria-hidden />}
        title={t('video.displayTitle')}
        actions={sectionPencil('videos')}
      >
        {introVideo ? (
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
              poster={introVideo.posterUrl || undefined}
              src={introVideo.url}
              aria-label={t('video.play')}
              onPlay={() => {
                setVideoStarted(true);
                // Additive funnel telemetry: video play on the profile surface.
                trackEvent(ConnectEvents.videoPlay, { surface: 'profile' });
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
        ) : (
          <EmptyHint
            text={t('video.emptyHint')}
            addLabel={t('empty.add')}
            onAdd={() => onEdit?.('videos')}
          />
        )}
      </ProfileSection>
    ) : null;

  // Owner-only privacy setting - lives in the rail with the other owner meta,
  // not in the content stream (it is a setting, not profile content).
  const visibilitySection = isOwner ? (
    <ProfileSection
      icon={<Lock size={16} aria-hidden />}
      title={t('edit.visibilitySection')}
      actions={sectionPencil('visibility')}
    >
      <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
        {t(`visibility.${profile.visibility}`)}
      </p>
      {/* Persistent ERP-verification grant/revoke (ADR-0004). Lives with the
          other privacy controls; owner-only by virtue of sitting inside this
          isOwner-gated section. Self-fetches its own consent state. */}
      <ERPConsentSetting />
    </ProfileSection>
  ) : null;

  // The profile body, in craft-forward order: the visual work showcase
  // (Portfolio) leads, then Experience, Skills, Rates, and peer Recommendations.
  const mainSections = (
    <>
      {/* ── Portfolio ───────────────────────────────────────────── */}
      {(profile.portfolio.length > 0 || isOwner) && (
        <ProfileSection
          icon={<Images size={16} aria-hidden />}
          title={t('sections.portfolio')}
          titleAside={<InfoTooltip text={t('portfolioHelpTitle')} body={t('portfolioHelp')} />}
          actions={sectionPencil('portfolio')}
        >
          {profile.portfolio.length > 0 ? (
            <PortfolioGrid items={profile.portfolio} />
          ) : (
            <EmptyHint
              text={t('empty.portfolio')}
              addLabel={t('empty.add')}
              onAdd={() => onEdit?.('portfolio')}
            />
          )}
        </ProfileSection>
      )}

      {/* ── Experience ──────────────────────────────────────────── */}
      {(profile.experience.length > 0 || isOwner) && (
        <ProfileSection
          icon={<Briefcase size={16} aria-hidden />}
          title={t('sections.experience')}
          actions={sectionPencil('experience')}
        >
          {profile.experience.length > 0 ? (
            <ExperienceList
              items={profile.experience}
              companies={profile.experienceCompanies}
              presentLabel={t('experience.present')}
            />
          ) : (
            <EmptyHint
              text={t('empty.experience')}
              addLabel={t('empty.add')}
              onAdd={() => onEdit?.('experience')}
            />
          )}
        </ProfileSection>
      )}

      {/* ── Training ────────────────────────────────────────────── */}
      {/* Course / training credentials, right after Experience. Linked entries
          (companyPageId resolves in trainingCompanies, an EXACT mirror of
          experienceCompanies) link the institute to /company/<slug> with its
          logo; free-typed ones render plain. Phase 2: a per-entry confirmation
          marker is added in TrainingList - only an institute-confirmed entry gets
          verified styling; self-declared/pending/declined do not.
          `?? []`: `training` is the newest profile array (Institutes Phase 1), so
          a LEGACY profile doc predating it comes back without the field. Reading
          `.length` on undefined here threw and blanked the whole route ("Connect
          could not load"). The backend read now normalizes this to [] too; this
          guard is the matching FE belt-and-suspenders (same pattern as the
          `experience ?? []` / `videos?.[0]` guards above). Keep in sync with the
          backend `attachExperienceCompanies` training projection. */}
      {((profile.training ?? []).length > 0 || isOwner) && (
        <ProfileSection
          icon={<GraduationCap size={16} aria-hidden />}
          title={t('sections.training')}
          actions={sectionPencil('training')}
        >
          {(profile.training ?? []).length > 0 ? (
            <TrainingList
              items={profile.training ?? []}
              institutes={profile.trainingCompanies}
              viewCertificateLabel={t('training.viewCertificate')}
              awaitingLabel={t('training.awaitingConfirmation')}
              confirmedByLabel={(institute: string) => t('training.confirmedBy', { institute })}
            />
          ) : (
            <EmptyHint
              text={t('empty.training')}
              addLabel={t('empty.add')}
              onAdd={() => onEdit?.('training')}
            />
          )}
        </ProfileSection>
      )}

      {/* ── Skills ──────────────────────────────────────────────── */}
      {(profile.skills.length > 0 || isOwner) && (
        <ProfileSection
          icon={<Sparkles size={16} aria-hidden />}
          title={t('sections.skills')}
          actions={sectionPencil('skills')}
        >
          {profile.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="text-[13px] font-semibold"
                  style={{
                    padding: '5px 13px',
                    borderRadius: 'var(--cr-radius-full)',
                    background: 'var(--cr-primary-light)',
                    border: '1px solid var(--cr-border-light)',
                    color: 'var(--cr-primary)',
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <EmptyHint
              text={t('empty.skills')}
              addLabel={t('empty.add')}
              onAdd={() => onEdit?.('skills')}
            />
          )}
        </ProfileSection>
      )}

      {/* ── Services I provide ──────────────────────────────────── */}
      {/* Services the member offers (freelancer / job-work layer). Free-typed,
          edited via the per-section modal ('services'). Mirrors the Skills
          section's owner-empty-hint pattern. */}
      {(profile.services.length > 0 || isOwner) && (
        <ProfileSection
          icon={<Wrench size={16} aria-hidden />}
          title={t('sections.services')}
          actions={sectionPencil('services')}
        >
          {profile.services.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {profile.services.map((service, i) => (
                <li key={`${service.title}-${i}`}>
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                    {service.title}
                  </div>
                  {service.note && (
                    <div className="text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
                      {service.note}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint
              text={t('empty.services')}
              addLabel={t('empty.add')}
              onAdd={() => onEdit?.('services')}
            />
          )}
        </ProfileSection>
      )}

      {/* ── Rates ───────────────────────────────────────────────── */}
      {/* Login-gated: rates are commercial data shown to signed-in members
          only. The backend already strips `rateCard` from a logged-out public
          read, so this is the matching UI -- a guest sees a sign-in prompt, the
          owner + signed-in viewers see the real rates. */}
      <ProfileSection
        icon={<IndianRupee size={16} aria-hidden />}
        title={t('sections.rates')}
        actions={sectionPencil('rates')}
      >
        {isOwner || isSignedIn ? (
          <RateRow rateCard={profile.rateCard} />
        ) : (
          <LockedNotice
            title={t('lockedRates.title')}
            body={t('lockedRates.body')}
            cta={t('lockedRates.cta')}
          />
        )}
      </ProfileSection>

      {/* ── Recommendations ─────────────────────────────────────── */}
      {(profile.recommendations.length > 0 || isOwner) && (
        <ProfileSection
          icon={<Quote size={16} aria-hidden />}
          title={t('sections.recommendations')}
        >
          {profile.recommendations.length > 0 ? (
            <RecommendationList
              items={profile.recommendations}
              attribution={t('recommendations.attribution')}
            />
          ) : (
            <EmptyHint text={t('empty.recommendations')} />
          )}
        </ProfileSection>
      )}

      {/* ── Reviews & Ratings (marketplace Phase C) ─────────────── */}
      {/* Login-gated list (owner decision, 2026-06-10): the star average stays
          public (passed as `initialAggregate` from the public profile read);
          the individual reviews are shown to signed-in members only.
          `lockListForGuests` makes SellerReviews skip the list fetch + show a
          sign-in prompt for a logged-out viewer. */}
      {subjectUserId && (
        <ProfileSection icon={<Star size={16} aria-hidden />} title={tReviews('title')}>
          <SellerReviews
            subjectUserId={subjectUserId}
            subjectName={displayName}
            initialAggregate={rating}
            lockListForGuests
          />
        </ProfileSection>
      )}

      {/* ── Broker reviews (Slice 3wA) ──────────────────────────── */}
      {/* Verified-but-anonymous reviews of this person AS A BROKER, shown only
          when they self-declare as a broker (profile.isBroker). Display-only:
          the write form lives on a confirmed introduction (Slice 3wB). Mirrors
          the SellerReviews guest-gate (proof header public, cards login-gated).
          BrokerReviews self-fetches from the broker-reviews module. */}
      {subjectUserId && profile.isBroker && (
        <ProfileSection icon={<BadgeCheck size={16} aria-hidden />} title={tBrokerReviews('title')}>
          <BrokerReviews brokerUserId={subjectUserId} lockListForGuests isOwner={isOwner} />
        </ProfileSection>
      )}
    </>
  );

  // The banner + identity header - extracted to a JSX variable so the
  // same block can sit inside the body grid's left column (when a rail
  // mounts on the right) or stand on its own (no rail). Earlier this card
  // spanned the full ConnectPage width (~1180 px), giving the banner a
  // ~7:1 aspect ratio that distorted user-uploaded banner images. Inside
  // the left col it reads at ~940 px wide - banner aspect tightens to
  // ~5:1, close to the LinkedIn 4:1 convention banner uploads target.
  const headerCard = (
    <header
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
      className="overflow-hidden"
    >
      {/* Banner aspect-locked at 4:1 - the same ratio LinkedIn / Twitter
            upload guidelines target. With `background-size: cover` we used
            a fixed height (h-32 / sm:h-48) which silently changed the
            displayed crop between expanded-sidebar (~4.4:1) and
            collapsed-sidebar (~5.4:1) widths. The aspect-ratio lock keeps
            uploaded images proportional regardless of container width -
            mobile gets a shorter banner, wide-collapsed gets a taller one,
            but the cropping behaviour matches the user's upload
            expectations everywhere. Mobile capped via `max-h` so an
            unusually-wide phone doesn't push the banner past a comfortable
            reading height. */}
      {/* Banner wrapper is `relative` so the owner-only "Edit cover" pill can
          pin to its top-right corner. The pill routes to the header edit modal
          (same section as the cover-photo field). */}
      <div className="relative">
        <div
          className="aspect-[4/1] max-h-64 w-full"
          style={
            profile.banner
              ? {
                  backgroundImage: `url(${profile.banner})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {
                  background:
                    'linear-gradient(135deg, var(--cr-indigo-700) 0%, var(--cr-primary) 100%)',
                }
          }
          role="presentation"
        />
        {isOwner && (
          <button
            type="button"
            onClick={() => onEdit?.('header')}
            aria-label={t('edit.coverSection')}
            className="inline-flex cursor-pointer items-center gap-1.5 border-0 text-[12px] font-semibold"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '5px 11px',
              borderRadius: 'var(--cr-radius-full)',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
            }}
          >
            <Camera size={14} aria-hidden />
            {t('edit.coverSection')}
          </button>
        )}
      </div>

      <div className="px-4 pb-4 sm:px-6 sm:pb-5">
        {/* Row 1 - photo overlaps the banner (left) + header actions (right).
            LinkedIn-style header: the identity block (name / headline / counts)
            sits BELOW the photo in Row 2, kept to a left column so the right
            side of that row stays open for a future element.
            `flex-wrap` is the mobile-overflow guard: on a phone the avatar +
            three action buttons cannot sit on one line, so the action cluster
            wraps to its own line below the avatar instead of forcing the row
            (and, since this sits inside the single-column grid, every card)
            wider than the viewport. Keep it. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="-mt-12 sm:-mt-16" style={{ flexShrink: 0 }}>
            {/* White padding ring frames the photo against the banner; ConnectAvatar
                carries the floating colored "open to" ring + pill as the single
                source of truth for status (it replaced the old AvatarStatusRibbon
                pinned here). status is at most one of work | hiring | null. */}
            <span
              className="relative inline-flex rounded-full"
              style={{ padding: 4, background: 'var(--cr-surface)' }}
            >
              <ConnectAvatar name={displayName} src={avatarUrl} size={112} status={openStatus} />
            </span>
          </div>

          {/* Header action cluster - Share is always available (clipboard
                copy of the public-profile URL). Owners additionally see Edit;
                signed-in non-owner viewers see the caller-supplied actions
                (Connect / Follow buttons from `/u/[userId]`).
                Mobile: full-width + LEFT-aligned so the buttons wrap into tidy
                left-aligned rows instead of right-aligning into a ragged
                staircase (justify-end made the wrapped rows' left edges step).
                sm+: restores the right-aligned cluster (`ml-auto`) beside the
                avatar. Dropped the old `flexShrink: 0`, which pinned this row to
                a min width wider than a phone and overflowed the card. */}
          <div className="flex w-full flex-wrap items-center justify-start gap-2 pt-3 sm:ml-auto sm:w-auto sm:justify-end">
            {/* Order (LinkedIn pattern): lead with the intent/relationship CTAs,
                Share (a utility) comes LAST for both owner and non-owner. Was
                leading with Share, which pushed the primary actions to the right
                and read oddly. Non-owner: Message -> Connect/Follow -> Share.
                Owner: Manage -> Edit -> Share. */}
            {isOwner ? (
              <>
                {/* "Open to" manage shortcut - opens the openTo editor, the same
                    target as each intent card's pencil. */}
                <DsButton
                  dsVariant="primary"
                  dsSize="sm"
                  icon={<Plus size={14} aria-hidden />}
                  onClick={() => onEdit?.('openTo')}
                >
                  {t('intents.manageButton')}
                </DsButton>
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  icon={<Pencil size={14} aria-hidden />}
                  onClick={() => onEdit?.('header')}
                >
                  {t('editProfile')}
                </DsButton>
              </>
            ) : (
              <>
                {/* Primary "Message" CTA (LinkedIn pattern): a signed-in non-owner
                    can start a 1:1 chat straight from the header. Only shown when
                    signed in (a DM needs an account) and the canonical recipient id
                    is known. The public profile only loads `public` profiles, so the
                    button is always valid here; the authoritative who-can-message
                    rule lives on the server (findOrCreateDmThread). */}
                {isSignedIn && subjectUserId && (
                  <StartConversationButton
                    recipientUserId={subjectUserId}
                    partyName={displayName}
                    dsVariant="primary"
                    dsSize="sm"
                  />
                )}
                {actions}
              </>
            )}
            {/* Share dropdown - Copy link / WhatsApp / Email. A multi-channel
                chooser so users can hand the profile off to the channel their
                contact actually reads. Rendered last (utility action). */}
            <Dropdown menu={{ items: shareMenuItems }} trigger={['click']} placement="bottomRight">
              <DsButton dsVariant="ghost" dsSize="sm" icon={<Share2 size={14} aria-hidden />}>
                {t('share.label')}
              </DsButton>
            </Dropdown>
          </div>
        </div>

        {/* Row 2 - identity stacked below the photo on the LEFT (name ->
            headline -> counts -> badges), with the current-company card pinned
            to the RIGHT (LinkedIn intro pattern; this is the right-side slot we
            reserved). On mobile the right card wraps under the identity block
            via flex-wrap. The left column is capped via an explicit pixel
            max-width (NOT a `max-w-*` token - this project's theme resizes those
            so `max-w-xl` collapsed the column to min-content). */}
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          {/* Full width on mobile (min-w-0 + no cap) so a long name/headline wraps
              cleanly across the phone width; the 560px cap returns from lg up where
              the right-side company card shares the row. Arbitrary max-w-[560px] is
              safe here (the theme only resizes NAMED max-w-* tokens, not px values). */}
          <div className="min-w-0 lg:max-w-[560px]" style={{ marginTop: openStatus ? 22 : 16 }}>
            <div className="flex flex-wrap items-center gap-2">
              {/* min-w-0 + break-words so a long name (or a long single-word
                  name with no spaces) wraps inside the identity column instead
                  of overflowing the card on mobile. */}
              <h1
                className="m-0 min-w-0 font-display text-[24px] leading-tight font-bold break-words sm:text-[28px]"
                style={{ color: 'var(--cr-text)' }}
              >
                {displayName}
              </h1>
              {isDemo && <SampleBadge />}
              {isOwner && <VisibilityChip visibility={profile.visibility} t={t} />}
            </div>

            {profile.headline ? (
              <p className="m-0 mt-1 text-[15px]" style={{ color: 'var(--cr-text-2)' }}>
                {profile.headline}
              </p>
            ) : (
              isOwner && (
                <button
                  type="button"
                  onClick={() => onEdit?.('header')}
                  className="mt-1 inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-medium"
                  style={{ color: 'var(--cr-primary)' }}
                >
                  <Plus size={14} aria-hidden />
                  {t('headlinePlaceholder')}
                </button>
              )
            )}

            {/* Current company - MOBILE ONLY: subtle text line under the headline
                (LinkedIn intro pattern). Desktop shows the logo chip beside the
                name instead (lg:hidden here, hidden lg:block on the right slot). */}
            {companyChip && <div className="mt-1 lg:hidden">{companyChip}</div>}

            {/* Social proof - connections + followers, two independent edge
                counts. Rendered whenever the caller loaded `stats`. */}
            {stats && (
              <div
                className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12.5px] font-semibold"
                style={{ color: 'var(--cr-text-3)' }}
              >
                <span>{t('counts.connections', { count: stats.connections })}</span>
                <span aria-hidden style={{ color: 'var(--cr-text-4)' }}>
                  ·
                </span>
                <span>{t('counts.followers', { count: stats.followers })}</span>
                {/* Owner-only profile-view count, appended when the caller
                  loaded it (own screen only). */}
                {profileViews != null && (
                  <>
                    <span aria-hidden style={{ color: 'var(--cr-text-4)' }}>
                      ·
                    </span>
                    <span>{t('counts.profileViews', { count: profileViews })}</span>
                  </>
                )}
              </div>
            )}

            {badges.length > 0 && (
              <div className="mt-2">
                <TrustBadgeRow badges={badges} max={Infinity} />
              </div>
            )}
          </div>

          {/* Current company - DESKTOP ONLY: logo + name chip pinned to the right
              of the identity row on lg+ (the previous style). Mobile uses the
              text-only line under the headline above (lg:hidden). */}
          {companyChipDesktop && (
            <div className="hidden lg:block" style={{ marginTop: openStatus ? 24 : 18 }}>
              {companyChipDesktop}
            </div>
          )}
        </div>

        {/* Open-to intent cards - rich, audience-scoped, actionable. Replaces the
            old flat pill row. Cards wire to Jobs / RFQ / inquiry / inbox. */}
        <div className="mt-4">
          <IntentCards
            openTo={profile.openTo}
            openToDetails={profile.openToDetails}
            isOwner={isOwner}
            isSignedIn={isSignedIn}
            userId={userId}
            subjectUserId={subjectUserId}
            openJobs={openJobs}
            onEdit={() => onEdit?.('openTo')}
          />
        </div>

        {/* PAUSED 2026-05-20 - Preferred-contact-channel UI hidden from the
              public + own profile until the in-app DM flow (Phase 7) ships.
              Surfacing the channel preference (WhatsApp / Call) before that
              nudges users to connect off-platform, undermining the network
              value Connect is being built for. The backend
              `ConnectProfile.contactPreference` field is RETAINED - the data
              the user has already set keeps living on the document - only
              the UI render is paused. Revive via
              `rg "PAUSED 2026-05-20 - Preferred-contact-channel"` when
              Phase 7 decides whether / how to surface the preference. */}
        {/* <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--cr-border-light)' }}>
            <ContactPreferenceSelector value={profile.contactPreference} readOnly />
          </div> */}
      </div>
    </header>
  );

  return (
    <ConnectPage>
      {hasRail ? (
        // `min-w-0` on both grid children is the second half of the mobile
        // overflow guard: a CSS grid track sizes to its widest child's
        // min-content, so without this any wide row (e.g. the header action
        // cluster) would inflate the single mobile column and push every card
        // off-screen. min-w-0 lets the column shrink to the viewport and the
        // children's own content wrap.
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <aside className="flex min-w-0 flex-col gap-4 lg:col-start-2">
            {showStrengthCard && (
              <ProfileStrengthCard strength={profile.strength} items={strengthItems} />
            )}
            <ERPLinkedPanel linked={erpLinked} since={erpSince} />
            {/* One-time "verify with your ERP" suggestion (ADR-0004). Self-hides
                unless the owner is eligible + has not granted/dismissed. Sits
                right after the ERP panel so the suggestion is next to its result. */}
            <ERPConsentBanner isOwner={isOwner} />
            {/* Desktop boost card (this page has no rail). Hidden below lg, where
                the aside stacks under the content and the MobileAdInline below
                carries the same boost instead, so the ad never double-shows. */}
            {promoted && (
              <div className="hidden lg:block">
                <PromotedListingAdCard {...promoted} />
              </div>
            )}
            {visibilitySection}
          </aside>
          <div className="flex min-w-0 flex-col gap-4 pb-6 lg:col-start-1 lg:row-start-1">
            {headerCard}
            {aboutSection}
            {videoSection}
            {activity}
            {mainSections}
            {limits}
            {/* Mobile-only ad: below lg the aside stacks under this column, so the
                desktop boost card is hidden there and this inline block carries
                the same boost + Google slot for phone/tablet. */}
            <MobileAdInline promoted={promoted} breakpoint="lg" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-6">
          {headerCard}
          {aboutSection}
          {videoSection}
          {activity}
          {mainSections}
          {limits}
          {/* No-rail layout (no boost resolved): still surface the mobile Google
              unit so phone users get an ad. Desktop has no aside here. */}
          <MobileAdInline promoted={promoted} breakpoint="lg" />
        </div>
      )}
    </ConnectPage>
  );
}

/* ── Local building blocks ──────────────────────────────────────────── */

/**
 * Login gate for a section whose content is members-only (e.g. rates). Shows a
 * short reason + a sign-in CTA pointing at the Connect join/sign-in entry. Used
 * only on the public profile for a logged-out viewer.
 */
function LockedNotice({ title, body, cta }: { title: string; body: string; cta: string }) {
  return (
    <div
      className="flex flex-col items-start gap-2 p-4 text-[13px]"
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-md)',
        background: 'var(--cr-surface-2)',
      }}
    >
      <span
        className="inline-flex items-center gap-1.5 font-semibold"
        style={{ color: 'var(--cr-text-2)' }}
      >
        <Lock size={14} aria-hidden />
        {title}
      </span>
      <span style={{ color: 'var(--cr-text-4)' }}>{body}</span>
      <Link
        href="/connect"
        className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold no-underline"
        style={{ background: 'var(--cr-primary)', color: '#ffffff' }}
      >
        {cta}
      </Link>
    </div>
  );
}

/** Owner-only "this section is empty - add something" prompt. */
function EmptyHint({
  text,
  addLabel,
  onAdd,
}: {
  text: string;
  addLabel?: string;
  onAdd?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-start gap-2 p-4 text-[13px]"
      style={{
        border: '1px dashed var(--cr-border)',
        borderRadius: 'var(--cr-radius-md)',
        background: 'var(--cr-surface-2)',
        color: 'var(--cr-text-3)',
      }}
    >
      <span>{text}</span>
      {onAdd && addLabel && (
        <DsButton dsVariant="ghost" dsSize="sm" onClick={onAdd}>
          <span className="inline-flex items-center gap-1">
            <Plus size={14} aria-hidden />
            {addLabel}
          </span>
        </DsButton>
      )}
    </div>
  );
}

/** Owner-only visibility chip - `public` shows nothing (the default state). */
function VisibilityChip({
  visibility,
  t,
}: {
  visibility: ConnectProfileBody['visibility'];
  t: ReturnType<typeof useTranslations>;
}) {
  if (visibility === 'public') return null;
  const Icon = visibility === 'hidden' ? Lock : Users;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold"
      style={{
        padding: '3px 9px',
        borderRadius: 'var(--cr-radius-full)',
        background: 'var(--cr-surface-2)',
        color: 'var(--cr-text-3)',
      }}
    >
      <Icon size={11} aria-hidden />
      {t(`visibility.${visibility}`)}
    </span>
  );
}

/** Responsive grid of work-sample photos with machine / work-type chips. */
function PortfolioGrid({ items }: { items: ConnectPortfolioItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item, i) => (
        <figure
          key={`${item.image}-${i}`}
          className="m-0 overflow-hidden"
          style={{
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr-surface-2)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 image of unknown dimensions; <img> + object-cover is the established Connect pattern */}
          <img
            src={item.image}
            alt={item.caption || ''}
            className="h-32 w-full object-cover sm:h-36"
            loading="lazy"
          />
          {(item.caption || item.machineType || item.workType) && (
            <figcaption className="p-2">
              {item.caption && (
                <p className="m-0 text-[12px] leading-snug" style={{ color: 'var(--cr-text-2)' }}>
                  {item.caption}
                </p>
              )}
              {(item.machineType || item.workType) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {[item.machineType, item.workType]
                    .filter((v): v is string => !!v)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium"
                        style={{
                          padding: '1px 6px',
                          borderRadius: 'var(--cr-radius-full)',
                          background: 'var(--cr-surface)',
                          border: '1px solid var(--cr-border)',
                          color: 'var(--cr-text-4)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              )}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

/** Build the "Mon YYYY – Mon YYYY / Present" period label for one entry. */
function experiencePeriod(exp: ConnectExperienceItem, presentLabel: string): string {
  const start = exp.from ? formatMonthYear(exp.from) : '';
  const end = exp.to ? formatMonthYear(exp.to) : presentLabel;
  if (!start) return exp.to ? end : '';
  return `${start} – ${end}`;
}

/**
 * Square company logo (or briefcase placeholder) used as the left column of an
 * experience row AND the current-company header card. When `ref.logo` resolves
 * (company-pages module hydration) it shows the uploaded logo; otherwise a tidy
 * placeholder square so the list always reads as a clean timeline (LinkedIn
 * pattern). `size` defaults to 40 (list rows); the header card passes 32.
 */
// `company` (not `ref`): `ref` is a reserved React prop name and trips the
// react-hooks/refs lint rule when accessed during render.
function CompanyLogo({ company, size = 40 }: { company?: CompanyPageRef; size?: number }) {
  if (company?.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 logo of unknown dimensions; the Connect pattern uses <img> + object-cover
      <img
        src={company.logo}
        alt=""
        width={size}
        height={size}
        className="flex-shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-md"
      style={{
        width: size,
        height: size,
        background: 'var(--cr-surface-2)',
        border: '1px solid var(--cr-border)',
      }}
    >
      <Briefcase size={18} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
    </span>
  );
}

/**
 * Vertical work-history list, LinkedIn-style: each row leads with a logo column
 * (the linked CompanyPage's logo, else a briefcase placeholder) so the list
 * reads as a tidy timeline. When an entry's `companyPageId` resolves in
 * `companies` (hydrated by the profile read from the company-pages module), the
 * company name links to `/company/<slug>`; otherwise the plain free-text
 * `workshop` shows. Depends on CompanyLogo above + the company-pages module.
 */
function ExperienceList({
  items,
  companies,
  presentLabel,
}: {
  items: ConnectExperienceItem[];
  companies?: Record<string, CompanyPageRef>;
  presentLabel: string;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {items.map((exp, i) => {
        const period = experiencePeriod(exp, presentLabel);
        const ref = exp.companyPageId ? companies?.[exp.companyPageId] : undefined;
        // The company name: linked CompanyPage -> /company/<slug> link; a
        // free-typed company -> plain text. The logo now lives in the left
        // column (CompanyLogo), so this node is name-only.
        const companyNode = ref ? (
          <Link
            href={`/company/${ref.slug}`}
            className="no-underline"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {exp.workshop}
          </Link>
        ) : (
          exp.workshop
        );
        return (
          <li key={`${exp.workshop}-${i}`} className="flex gap-3">
            {/* Logo column: the linked company's logo, else a building-icon
                placeholder. Always present so the list reads as a tidy
                timeline (LinkedIn pattern). */}
            <CompanyLogo company={ref} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                {exp.role || exp.workshop}
              </div>
              <div
                className="flex flex-wrap items-center text-[13px]"
                style={{ color: 'var(--cr-text-3)' }}
              >
                {exp.role ? companyNode : null}
                {exp.role && period ? <span className="px-1">·</span> : null}
                {period}
              </div>
              {exp.description && (
                <p
                  className="m-0 mt-1 text-[13px] leading-relaxed"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {exp.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Vertical training / credential list - cloned from ExperienceList, LinkedIn-
 * style, each row leading with the institute logo column (CompanyLogo: the
 * linked institute's logo, else a placeholder). When an entry's `companyPageId`
 * resolves in `institutes` (hydrated by the profile read from the company-pages
 * module, field name `trainingCompanies`), the institute name links to
 * `/company/<slug>`; otherwise the plain free-text `instituteName` shows with NO
 * logo link (mirrors ExperienceList's linked-vs-freetext branch 1:1). Row:
 * course (bold) / institute name + completion month sub-line / a Phase-2
 * confirmation marker / optional "View certificate" link. The marker is the ONLY
 * place verified styling appears: 'confirmed' (the institute page-owner confirmed
 * via the company-pages credential-requests flow) renders a "Confirmed by
 * [Institute]" pill; 'pending' (the student asked) renders a muted "Awaiting
 * confirmation" chip; 'self'/'declined' render plainly (self-declared, as Phase 1).
 * Depends on CompanyLogo above + the company-pages module.
 */
// Exported for the colocated read-side test (TrainingList.test.tsx): the test
// asserts the Phase-2 confirmation markers in isolation, without standing up the
// whole ProfileView.
export function TrainingList({
  items,
  institutes,
  viewCertificateLabel,
  awaitingLabel,
  confirmedByLabel,
}: {
  items: ConnectTrainingItem[];
  institutes?: Record<string, CompanyPageRef>;
  viewCertificateLabel: string;
  /** Muted "Awaiting confirmation" chip copy (confirmStatus==='pending'). */
  awaitingLabel: string;
  /** "Confirmed by [Institute]" badge copy (confirmStatus==='confirmed' only). */
  confirmedByLabel: (institute: string) => string;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {items.map((tr, i) => {
        const ref = tr.companyPageId ? institutes?.[tr.companyPageId] : undefined;
        const period = tr.completedAt ? formatMonthYear(tr.completedAt) : '';
        // Phase 2 confirmation marker. ONLY 'confirmed' earns the verified
        // "Confirmed by [Institute]" pill (locked owner wording); 'pending'
        // shows a muted, honest "Awaiting confirmation" chip; 'self'/'declined'
        // render plainly with no marker (exactly as Phase 1 did). The badge name
        // prefers the resolved institute ref, falling back to the free-text
        // instituteName when the page is hidden/unresolved.
        const instituteLabel = ref?.name ?? tr.instituteName;
        // The institute name: linked CompanyPage -> /company/<slug> link; a
        // free-typed institute -> plain text (no link). The logo lives in the
        // left column (CompanyLogo), so this node is name-only - same branch as
        // ExperienceList's company name.
        const instituteNode = ref ? (
          <Link
            href={`/company/${ref.slug}`}
            className="no-underline"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {tr.instituteName}
          </Link>
        ) : (
          tr.instituteName
        );
        return (
          <li key={`${tr.instituteName}-${i}`} className="flex gap-3">
            {/* Logo column: the linked institute's logo, else a placeholder, so
                the list reads as a tidy timeline (LinkedIn pattern). */}
            <CompanyLogo company={ref} />
            <div className="min-w-0 flex-1">
              {/* Course is the bold primary line (falls back to the institute
                  name when no course is given). */}
              <div className="text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                {tr.course || tr.instituteName}
              </div>
              <div
                className="flex flex-wrap items-center text-[13px]"
                style={{ color: 'var(--cr-text-3)' }}
              >
                {tr.course ? instituteNode : null}
                {tr.course && period ? <span className="px-1">·</span> : null}
                {period}
              </div>
              {/* Confirmation marker (Phase 2). Verified pill ONLY for
                  'confirmed'; muted chip for 'pending'; nothing for
                  'self'/'declined'. */}
              {tr.confirmStatus === 'confirmed' ? (
                <span
                  className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold"
                  style={{
                    padding: '2px 9px',
                    borderRadius: 'var(--cr-radius-full)',
                    background: 'var(--cr-success-light, var(--cr-primary-light))',
                    color: 'var(--cr-success, var(--cr-primary))',
                  }}
                >
                  <BadgeCheck size={13} aria-hidden />
                  {confirmedByLabel(instituteLabel)}
                </span>
              ) : tr.confirmStatus === 'pending' ? (
                <span
                  className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium"
                  style={{
                    padding: '2px 9px',
                    borderRadius: 'var(--cr-radius-full)',
                    background: 'var(--cr-surface-2)',
                    color: 'var(--cr-text-4)',
                  }}
                >
                  <Clock size={12} aria-hidden />
                  {awaitingLabel}
                </span>
              ) : null}
              {tr.certificateUrl && (
                <a
                  href={tr.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium no-underline"
                  style={{ color: 'var(--cr-primary)' }}
                >
                  <FileText size={13} aria-hidden />
                  {viewCertificateLabel}
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Peer-recommendation quote cards. */
function RecommendationList({
  items,
  attribution,
}: {
  items: ConnectRecommendation[];
  attribution: string;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((rec, i) => (
        <li
          key={`${rec.createdAt}-${i}`}
          className="p-3"
          style={{
            background: 'var(--cr-surface-2)',
            borderRadius: 'var(--cr-radius-md)',
          }}
        >
          <Quote size={16} aria-hidden style={{ color: 'var(--cr-primary)' }} />
          <p className="m-0 mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-2)' }}>
            {rec.text}
          </p>
          <div className="mt-2 text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
            {attribution} · {formatMonthYear(rec.createdAt)}
          </div>
        </li>
      ))}
    </ul>
  );
}
