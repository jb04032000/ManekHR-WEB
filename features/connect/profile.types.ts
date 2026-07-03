/**
 * Connect profile - shared types for the web (mirrors the backend
 * `ConnectProfile` schema + `ErpLinkService` contract).
 */

import type { RatingAggregate } from './reviews/reviews.types';
// CompanyPageRef is the canonical minimal company-page identity (id/name/slug/
// logo/erpLinked), defined in feed.types and re-used by company-page.actions.
// The experience editor links an entry to a CompanyPage by id; the profile read
// hydrates those ids into refs (experienceCompanies) so the view can show the
// company logo + a link to /company/<slug>. Keep in sync with the BE CompanyPageRef.
import type { CompanyPageRef } from './feed.types';
// Typed plan-limit detail attached to a blocked create result (additive). See
// connect-limit.ts; the create screens render LimitReachedDialog from it.
import type { ConnectLimitInfo } from './connect-limit';

export type ConnectProfileVisibility = 'public' | 'connections' | 'hidden';

/** How a person prefers to be reached first - mirrors the backend enum. */
export type ConnectContactPreference = 'whatsapp' | 'phone' | 'dm';

export interface ConnectPortfolioItem {
  image: string;
  caption?: string;
  machineType?: string;
  workType?: string;
}

/** A single "Services I provide" entry - a short title plus an optional note.
 *  Mirrors the backend `ConnectServiceItem`. Free-typed; no taxonomy this phase. */
export interface ConnectServiceItem {
  title: string;
  note?: string;
}

/**
 * One intro video on a Connect profile. Mirrors the backend profile `videos`
 * sub-schema and the marketplace `ListingVideo` shape (same feed video
 * pipeline): `url` is the clip, `posterUrl` an optional client-captured still
 * (poster-first render), `durationSec` the server-derived length. The profile
 * carries at most one (the form + backend cap it at one). Shaped identically to
 * marketplace `ListingVideo` on purpose so the poster-first player + the video
 * MediaUploadGrid mode are reused verbatim; keep the two in sync.
 */
export interface ConnectProfileVideo {
  url: string;
  posterUrl?: string;
  durationSec?: number;
}

export interface ConnectExperienceItem {
  workshop: string;
  role?: string;
  /** ISO date string */
  from?: string;
  /** ISO date string; null/absent = current */
  to?: string | null;
  description?: string;
  /**
   * Optional link to a ManekHR CompanyPage (company-pages module). When set,
   * the read-side `experienceCompanies` map resolves it to a `CompanyPageRef`
   * so the profile shows the company logo + a link; `workshop` stays the
   * required free-text display name (fallback when the id is hidden/missing).
   */
  companyPageId?: string | null;
}

/**
 * One training / course credential on a Connect profile. Mirrors the backend
 * `ConnectTrainingItem`. Self-declared only (no verification this phase), so
 * the view renders it plainly with NO verified/certified styling. When
 * `companyPageId` is set, the read-side `trainingCompanies` map resolves it to a
 * `CompanyPageRef` (institute CompanyPage, company-pages module) so the row
 * shows the institute logo + a link; `instituteName` stays the required
 * free-text display name (fallback when the id is hidden/missing). Cloned from
 * `ConnectExperienceItem` - keep the linked-vs-freetext contract in lockstep.
 */
export interface ConnectTrainingItem {
  /**
   * Stable server-assigned id for this credential (Phase 2). Present on the
   * read; round-tripped on write so editing an existing entry preserves it
   * (new rows have none - the server assigns one). Mirrors the BE training
   * sub-doc `id`. The credential-confirm flow (institute page-owner) keys off
   * this id (company-pages module credential-requests endpoints).
   */
  id?: string;
  instituteName: string;
  /** Optional link to an institute CompanyPage (kind='institute'). */
  companyPageId?: string | null;
  course?: string;
  /** ISO date string - month the course completed. */
  completedAt?: string;
  /** https URL to a certificate (self-supplied). */
  certificateUrl?: string;
  /**
   * Confirmation lifecycle for this credential (Phase 2). 'self' = self-declared
   * (default, no verification); 'pending' = the student asked the linked
   * institute to confirm; 'confirmed' = the institute page-owner confirmed it
   * (only this state earns the "Confirmed by [Institute]" verified badge in the
   * read); 'declined' = the institute declined (renders plainly, like self).
   * On WRITE the student may only set 'self' or 'pending' (see the PATCH write
   * shape below); the server rejects 'confirmed'/'declined' from the student.
   * Mirrors the BE `confirmStatus`.
   */
  confirmStatus?: 'self' | 'pending' | 'confirmed' | 'declined';
  /**
   * ISO date string the institute confirmed at (read-only; null when not yet
   * confirmed). Never sent on write (the server stamps it). Mirrors the BE
   * `confirmedAt`. NB: the BE never exposes `confirmedByUserId`, so it is absent
   * from this type by design.
   */
  confirmedAt?: string | null;
  /**
   * Per-credential DPDP consent (Phase 2): when true the student opted in to be
   * shown on this institute's public alumni / placements page. Default OFF.
   * Read + write. Mirrors the BE `shareWithInstitute`.
   */
  shareWithInstitute?: boolean;
}

/**
 * The write shape for a single training entry on the profile PATCH (Phase 2).
 * Narrower than the read `ConnectTrainingItem`: the student may round-trip `id`,
 * set `confirmStatus` to ONLY 'self' or 'pending' (the server rejects
 * 'confirmed'/'declined'), and toggle `shareWithInstitute`; `confirmedAt` /
 * `confirmedByUserId` are never sent. Keep the allowed-write fields in lockstep
 * with the BE `UpdateConnectProfileDto` training item.
 */
export interface ConnectTrainingItemWrite {
  /** Round-tripped so editing an existing entry preserves the server id. */
  id?: string;
  instituteName: string;
  companyPageId?: string | null;
  course?: string;
  completedAt?: string;
  certificateUrl?: string;
  /** Student may only request: 'self' (default) or 'pending'. Never 'confirmed'/'declined'. */
  confirmStatus?: 'self' | 'pending';
  /** Per-credential opt-in to the institute's public alumni/placements page. */
  shareWithInstitute?: boolean;
}

export interface ConnectRecommendation {
  fromUserId: string;
  text: string;
  createdAt: string;
}

export interface ConnectRateCard {
  /** all amounts in paise */
  dailyWage?: number;
  pieceRate?: number;
  monthly?: number;
}

export interface ConnectOpenTo {
  work: boolean;
  hiring: boolean;
  deals: boolean;
  customOrders: boolean;
}

export type ConnectOpenToAudience = 'all' | 'network';

/** Rich detail for one "open to" intent (mirrors backend ConnectOpenToDetail). */
export interface ConnectOpenToDetail {
  detail?: string;
  audience: ConnectOpenToAudience;
}

/** Per-intent rich details, keyed to the openTo booleans. */
export interface ConnectOpenToDetails {
  work?: ConnectOpenToDetail;
  hiring?: ConnectOpenToDetail;
  deals?: ConnectOpenToDetail;
  customOrders?: ConnectOpenToDetail;
}

export interface ConnectProfile {
  _id?: string;
  userId: string;
  headline: string;
  bio: string;
  banner: string;
  skills: string[];
  /**
   * Home district / textile hub (e.g. "Surat") - powers GeoLocal discovery AND
   * is the value boost region-targeting matches against (ads matcher compares a
   * targeted district NAME to this, case-insensitive). The profile/onboarding
   * StateDistrictPicker now writes the canonical india-geo district NAME here.
   */
  district?: string;
  /**
   * Structured canonical location (additive; mirrors the BE ConnectProfile schema
   * + UpdateConnectProfileDto). Slugs from the shared india-geo dataset written
   * alongside `district` by the StateDistrictPicker; optional/absent for legacy
   * rows that only have the free-text district.
   */
  geoStateSlug?: string;
  geoDistrictSlug?: string;
  geoCity?: string;
  portfolio: ConnectPortfolioItem[];
  experience: ConnectExperienceItem[];
  /**
   * Training / course credentials (self-declared). Empty for legacy docs.
   * Mirrors the BE profile `training`; rendered in ProfileView right after
   * Experience. Linked entries resolve via `trainingCompanies` (below).
   */
  training: ConnectTrainingItem[];
  /** Services the member offers (freelancer / job-work layer). Empty for legacy docs. */
  services: ConnectServiceItem[];
  /**
   * Intro video(s) - at most one. Rendered poster-first on the profile (same
   * player as the marketplace listing detail). Optional/absent for legacy docs
   * and for profiles that never added one. Mirror of the BE profile `videos`.
   */
  videos?: ConnectProfileVideo[];
  recommendations: ConnectRecommendation[];
  rateCard?: ConnectRateCard;
  openTo: ConnectOpenTo;
  openToDetails: ConnectOpenToDetails;
  visibility: ConnectProfileVisibility;
  /** Preferred first-contact channel - defaults to `whatsapp` on the backend. */
  contactPreference: ConnectContactPreference;
  /**
   * Broker / dalal self-declaration (Broker badge, Slice 1). When true the
   * profile + entity cards show a "Broker" trust badge (see TrustBadgeRow
   * 'broker' + ProfileView header badges). Present on both the own + public read.
   * `false`/absent for legacy docs. Mirrors the BE ConnectProfile `isBroker`.
   */
  isBroker?: boolean;
  /**
   * When the user first marked themselves a broker (ISO date string). Read-only:
   * the backend stamps it on the first false→true flip and never accepts it on
   * write. Absent until first enabled. Mirrors the BE `brokerSince`.
   */
  brokerSince?: string | null;
  /** 0–100 */
  strength: number;
  /** ISO date string; absent until the user finishes the onboarding flow. */
  onboardedAt?: string | null;
  /** The persona picked at onboarding; `null`/absent until onboarding completes. */
  onboardingIntent?: ConnectOnboardingIntent | null;
  /**
   * Seller verified marker (M2.3) - present on the public profile read, driven
   * by the person's Connect verifiedBadge entitlement. Absent on the own-profile
   * read (no badge there yet).
   */
  verified?: boolean;
  /**
   * Hydrated company-page identities for the experience entries, keyed by
   * `companyPageId`. Populated on the profile read (own + public) from the
   * company-pages module; hidden/missing pages are absent (the view falls back
   * to the free-text `workshop`). Optional so existing fixtures/readers and the
   * PATCH payload (which never sends it) stay valid.
   */
  experienceCompanies?: Record<string, CompanyPageRef>;
  /**
   * Hydrated institute-page identities for the training entries, keyed by
   * `companyPageId`. EXACT mirror of `experienceCompanies` (BE read field name
   * is "trainingCompanies"); populated on the profile read from the
   * company-pages module. Hidden/missing pages are absent (the view falls back
   * to the free-text `instituteName`). Optional so existing fixtures/readers and
   * the PATCH payload (which never sends it) stay valid.
   */
  trainingCompanies?: Record<string, CompanyPageRef>;
  createdAt?: string;
  updatedAt?: string;
}

/** PATCH payload - every field optional (recommendations are not self-edited). */
export interface UpdateConnectProfileInput {
  headline?: string;
  bio?: string;
  banner?: string;
  skills?: string[];
  /**
   * Home district NAME (canonical india-geo name) - the boost-matched location.
   * Sent by the profile/onboarding StateDistrictPicker alongside the slugs below.
   * Mirrors the BE UpdateConnectProfileDto. (Was previously sent by the header
   * section but missing from this type.)
   */
  district?: string;
  /** State slug from the india-geo dataset (additive structured location). */
  geoStateSlug?: string;
  /** District slug from the india-geo dataset (additive structured location). */
  geoDistrictSlug?: string;
  /** Optional free-text city (additive; not yet collected by the picker UI). */
  geoCity?: string;
  portfolio?: ConnectPortfolioItem[];
  experience?: ConnectExperienceItem[];
  /**
   * Training / course credentials; mirrors the BE PATCH shape. Uses the narrower
   * `ConnectTrainingItemWrite` (Phase 2): `id` round-trips, `confirmStatus` is
   * limited to 'self'|'pending', `shareWithInstitute` toggles the institute opt-in.
   */
  training?: ConnectTrainingItemWrite[];
  services?: ConnectServiceItem[];
  /**
   * Intro video(s) - at most one. Only `url` + optional `posterUrl` are sent;
   * the backend derives `durationSec` and ownership-checks both URLs. Mirrors
   * the marketplace listing `videos` PATCH shape.
   */
  videos?: Pick<ConnectProfileVideo, 'url' | 'posterUrl'>[];
  rateCard?: ConnectRateCard;
  openTo?: ConnectOpenTo;
  openToDetails?: ConnectOpenToDetails;
  visibility?: ConnectProfileVisibility;
  contactPreference?: ConnectContactPreference;
  /**
   * Broker / dalal self-declaration (Broker badge, Slice 1). The only broker
   * field sent on write; `brokerSince` is server-stamped, never sent. Mirrors
   * the BE UpdateConnectProfileDto `isBroker`.
   */
  isBroker?: boolean;
}

export interface ErpLinkSignals {
  attendance: number;
  payrollRuns: number;
  invoices: number;
}

export interface ErpLinkStatus {
  linked: boolean;
  /** ISO date string */
  since: string | null;
  signals: ErpLinkSignals;
}

/**
 * Public, privacy-trimmed ERP-linked status - what `/u/[userId]` may show.
 * The raw activity `signals` are intentionally absent (privacy wall -
 * design-decisions doc §9.1).
 */
export interface PublicErpLinkStatus {
  linked: boolean;
  /** ISO date string */
  since: string | null;
}

/**
 * Consent-first ERP-linked verification - the PERSON consent state the web
 * suggestion banner + settings toggle render from (ADR-0004 / 2026-06-18 spec).
 * Mirrors the BE `ErpVerificationState` returned by
 * `GET /me/connect/profile/erp-verification` (it is NOT folded into the profile
 * "me" payload - it is its own endpoint, served by `ErpVerificationService.getState`).
 *  - `eligible`           the user has >=1 active workspace membership (the only
 *                         people for whom an ERP badge could ever derive). A
 *                         read-only check - no consent needed to COMPUTE it.
 *  - `consentStatus`      'granted' | 'revoked' | null (never asked).
 *  - `suggestionDismissed` whether the one-time "verify" banner was dismissed.
 *  - `consentVersion`     the version the user agreed to (null when not granted).
 * Cross-module: drives ERPConsentBanner (one-time suggestion) + the persistent
 * grant/revoke control in the owner-only privacy section of ProfileView.
 */
export interface ErpVerificationState {
  eligible: boolean;
  consentStatus: 'granted' | 'revoked' | null;
  suggestionDismissed: boolean;
  consentVersion: string | null;
}

/** A person open-jobs summary for the profile Hiring card (GET jobs/by-user/:id/open). */
export interface ProfileOpenJobs {
  count: number;
  applicants: number;
  jobs: { _id: string; title: string; role?: string | null }[];
}

/** Owner profile-view totals (GET connect/views/profile/summary). */
export interface ProfileViewSummary {
  views7d: number;
  views30d: number;
  total: number;
}

/** Canonical identity (from `User`) - populated onto a public profile read. */
export interface ConnectProfileUser {
  _id: string;
  name: string;
  profilePicture?: string;
  /**
   * Public-profile slug - the canonical share URL prefers `handle` over
   * `_id` so a link reads `/u/jayesh-bambhaniya` instead of `/u/6a0a…`. Old
   * ObjectId URLs continue to resolve (backend dual-input `:slug` param).
   * Absent for pre-backfill rows.
   */
  handle?: string | null;
  /**
   * True for a seeded demo / sample account (User.isDemo). Drives the /u/[slug]
   * noindex gate (keeps demo profiles out of Google) and the "Sample" header tag.
   * See DEMO-CONTENT-TRUST-UX-PLAN.md.
   */
  isDemo?: boolean;
}

/** A public profile read - `userId` is populated with the viewer-facing identity. */
export interface PublicConnectProfile extends Omit<ConnectProfile, 'userId'> {
  userId: ConnectProfileUser;
  /** Seller rating aggregate (R2) - present only when the person is rated. */
  rating?: RatingAggregate;
}

/**
 * The profile body without the identity key - the shape `ProfileView`
 * renders. Both `ConnectProfile` (own - `userId` is a string) and
 * `PublicConnectProfile` (`userId` populated) widen to this, so one view
 * component serves both the authenticated and the public surface.
 */
export type ConnectProfileBody = Omit<ConnectProfile, 'userId'>;

/** `/connect` smart-entry state - from `GET /me/connect/profile/entry`. */
export interface ConnectEntryState {
  connectEnabled: boolean;
  onboarded: boolean;
  policyAccepted: boolean;
}

/** The four onboarding intents - mirrors the backend enum. */
export type ConnectOnboardingIntent = 'workshop_owner' | 'karigar' | 'buyer' | 'explorer';

/**
 * The profile-strength checklist keys - mirrors the backend `STRENGTH_WEIGHTS`.
 * Shared so the feed card, the profile view, and the edit form all agree, and
 * so a strength item can deep-link to the matching edit-form section.
 */
export const PROFILE_STRENGTH_KEYS = [
  'headline',
  'bio',
  'banner',
  'skills',
  'portfolio',
  'experience',
  'rateCard',
] as const;
export type ProfileStrengthKey = (typeof PROFILE_STRENGTH_KEYS)[number];

/**
 * A featured workshop on the Day-1 home - a public (workshop-owner) profile
 * with the populated viewer-facing identity.
 */
export type FeaturedWorkshop = PublicConnectProfile;

// ── Handle (username slug) ──────────────────────────────────────────────

/**
 * Format rules mirror the backend `HANDLE_FORMAT_RE` - single source of truth
 * for the client-side pre-check before the debounced availability call. Keep
 * in lockstep with `src/modules/users/utils/handle.util.ts`.
 */
export const HANDLE_MIN_LEN = 3;
export const HANDLE_MAX_LEN = 30;
export const HANDLE_FORMAT_RE = /^[a-z](?:[a-z0-9]|-(?!-))*[a-z0-9]$/;

/**
 * The reason an availability check rejected a candidate. Mirrors the backend
 * `HandleAvailability` discriminator so the client renders the right inline
 * copy (`format` / `reserved` / `taken`).
 */
export type HandleAvailabilityReason = 'format' | 'reserved' | 'taken';

export type HandleAvailability =
  | { available: true }
  | { available: false; reason: HandleAvailabilityReason };

/** Successful `claimHandle` payload - used by the optimistic store update. */
export interface ClaimHandleResult {
  handle: string;
  /** ISO date string */
  handleChangedAt: string;
}

/**
 * Discriminated error codes the BE returns when `claimHandle` rejects. The
 * client maps these to localized inline messages without parsing free-text.
 */
export type ClaimHandleErrorCode =
  | 'HANDLE_INVALID_FORMAT'
  | 'HANDLE_RESERVED'
  | 'HANDLE_TAKEN'
  | 'HANDLE_COOLDOWN';

/** Discriminated result for Connect server actions. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /** A `423` from the backend `PinUnlockGuard` - the session is App-Locked. */
      locked?: boolean;
      /**
       * A `401` that survived `serverHttp`'s refresh-retry - the session is
       * genuinely signed out (refresh token expired/revoked). The smart-entry
       * routes to sign-in; it must never mis-degrade to the "coming soon" panel.
       */
      authFailed?: boolean;
      /**
       * Set when the create was blocked by a Connect plan COUNT limit (the typed
       * `CONNECT_LIMIT_REACHED` 403). The create screen shows the LimitReachedDialog
       * instead of a generic toast. Additive + optional, so every other action
       * (and every existing reader) is unaffected. See features/connect/connect-limit.ts.
       */
      limitReached?: ConnectLimitInfo;
    };
