/**
 * Connect owned-entity types (Company Pages + Storefronts, Phase 4/6).
 * Mirrors the backend `connect/entities` schemas + DTOs. `-1` is not used here;
 * these are content entities, not numeric allowances.
 */

import type { RatingAggregate } from '../reviews/reviews.types';

export type EntityVisibility = 'public' | 'connections' | 'hidden';

export interface EntityLocation {
  district: string;
  city: string;
  state: string;
}

export interface CompanyIndustryPanel {
  specialization: string[];
  machineCapacity: string;
  production: string;
  languages: string[];
}

/** A company page is either a regular business or a training institute. The kind
 *  swaps the Capabilities card (business -> machines/production; institute ->
 *  courses/modes) on the editor + the public view. Mirrors the BE
 *  `CompanyPage.kind` (default 'business'). */
export type CompanyPageKind = 'business' | 'institute';

/** Institute-specific capabilities panel (the institute analogue of
 *  CompanyIndustryPanel). Shown on the public CompanyPageView when
 *  kind==='institute'. `modes` are the delivery modes the institute offers;
 *  `languages` reuses the same free-text language tags as the business panel.
 *  Mirrors the BE `CompanyPage.institutePanel` (all fields optional on write). */
export interface CompanyInstitutePanel {
  coursesOffered: string[];
  modes: ('online' | 'offline')[];
  languages: string[];
}

/**
 * One company-page video clip. Same shape as the marketplace `ListingVideo` +
 * profile `ConnectProfileVideo` (one shared feed video pipeline): `url` is the
 * clip, `posterUrl` an optional client-captured still (poster-first render),
 * `durationSec` the server-derived length. A page carries at most one (the form
 * + the backend cap it at one). Kept identical to those siblings on purpose so
 * the poster-first player + the MediaUploadGrid video mode are reused verbatim;
 * keep the three in sync. Mirrors the BE company-page `videos` sub-schema.
 */
export interface CompanyPageVideo {
  url: string;
  posterUrl?: string;
  durationSec?: number;
}

/** A Company Page (business identity). */
export interface CompanyPage {
  _id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  logo: string;
  banner: string;
  about: string;
  /** Business vs institute. Drives which capabilities panel shows. Default
   *  'business' (BE-defaulted), so older pages read as businesses. */
  kind: CompanyPageKind;
  industryPanel: CompanyIndustryPanel;
  /** Present (and rendered) only on institute pages; absent/empty on businesses. */
  institutePanel?: CompanyInstitutePanel;
  location: EntityLocation;
  /** Company video(s) - at most one. Rendered poster-first on the public page
   *  (CompanyPageView, Overview tab) and editable via CompanyPageForm. Mirror of
   *  the BE company-page `videos`. */
  videos?: CompanyPageVideo[];
  erpWorkspaceId: string | null;
  visibility: EntityVisibility;
  /** True for a seeded sample page (denormalized from the owner's User.isDemo).
   *  Drives the SampleBadge on the page + the demo down-rank. Optional; absent =
   *  real page. Keep `isDemo` in sync with the BE CompanyPage schema + mirrors. */
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Privacy-trimmed ERP-linked signal on a public entity page. */
export interface PublicErpLink {
  linked: boolean;
  since: string | null;
}

/** The public Company Page read payload (page + derived ERP badge + follower count). */
export interface PublicCompanyPage {
  page: CompanyPage;
  erpLink: PublicErpLink;
  /** Members following the page (the viewer's own follow state is a separate
   *  authed `:id/follow-state` call). */
  followerCount: number;
  /** Owner's seller rating aggregate (R2) - present only when rated. */
  rating?: RatingAggregate;
}

export interface CreateCompanyPagePayload {
  name: string;
  about?: string;
  logo?: string;
  banner?: string;
  /** Business vs institute (omit to keep the BE default 'business'). When
   *  'institute' the form sends `institutePanel` instead of `industryPanel`. */
  kind?: CompanyPageKind;
  industryPanel?: Partial<CompanyIndustryPanel>;
  /** Institute capabilities - only built when kind==='institute' and at least one
   *  field has content. Partial so an empty field set can be omitted. */
  institutePanel?: Partial<CompanyInstitutePanel>;
  location?: Partial<EntityLocation>;
  /** Company video(s) - at most one. Only `url` + `posterUrl` are sent on write;
   *  `durationSec` is server-derived. Mirrors the marketplace listing `videos`
   *  PATCH shape, so the BE ownership-checks both URLs. */
  videos?: Pick<CompanyPageVideo, 'url' | 'posterUrl'>[];
  erpWorkspaceId?: string;
  visibility?: EntityVisibility;
}

export type UpdateCompanyPagePayload = Partial<Omit<CreateCompanyPagePayload, 'erpWorkspaceId'>> & {
  /** `null` unlinks ERP, a string (re)links, omit to leave unchanged. */
  erpWorkspaceId?: string | null;
};

/** Result order for the public company directory. */
export type CompanyBrowseSort = 'recent' | 'name' | 'erpVerified';

/** Filters for the public company directory (`/connect/companies`). */
export interface BrowseCompanyPagesInput {
  q?: string;
  district?: string;
  specialization?: string;
  /** Keep only ERP-linked pages (the real trust filter). */
  erpVerified?: boolean;
  /** Keep only pages whose owner's seller rating is at least this (e.g. 4 or 4.5). */
  minRating?: number;
  /** Result order: `recent` (default) or `name`. */
  sort?: CompanyBrowseSort;
  page?: number;
  pageSize?: number;
}

/** One distinct district / city value (+ its count) for the location search and
 *  the create/edit autocomplete. */
export interface LocationSuggestion {
  value: string;
  count: number;
}

/** One directory facet value (a specialization tag or a district) + its real count. */
export interface BrowseFacet {
  value: string;
  count: number;
}

/** One directory card's worth of public company-page data. */
export interface CompanyPageBrowseItem {
  id: string;
  /** The page owner's public Connect user id - used to start a DM from the card. */
  ownerUserId: string;
  slug: string;
  name: string;
  logo: string;
  /** Page banner (cover) URL, '' when none. The card shows it when present and
   *  falls back to a decorative gradient otherwise. */
  banner: string;
  /** A short plain-text snippet of `about` (truncated server-side). */
  about: string;
  location: EntityLocation;
  specialization: string[];
  /** Whether the page is ERP-linked (the derived trust badge). */
  erpLinked: boolean;
  /** Whether the page has a company video (derived server-side from `videos`).
   *  Surfaced for a "has video" signal; the `/connect/companies` row currently
   *  skips a badge (a list row with no banner visual area + a non-user-facing
   *  surface per the product-scope decision), but the field is carried so the
   *  card or any future visual surface can use it without a BE change. */
  hasVideo?: boolean;
  /** Members following this page. */
  followerCount: number;
  /** This page's open job posts (a "currently hiring" signal). */
  openJobsCount: number;
  /** Live products across this company's storefronts (a catalog-depth signal).
   *  Defaults to 0 when the company has no storefront or no live listings. */
  productCount: number;
  /** The owner's seller rating roll-up - present only when the company has at
   *  least one review (absent for unrated companies, so the card never shows a
   *  hollow "0.0"). */
  rating?: RatingAggregate;
  /** True for a seeded sample company page (denormalized from the owner's
   *  User.isDemo). Drives the SampleBadge on a directory card. Optional; absent =
   *  real company. Keep `isDemo` in sync with the BE + every Connect mirror. */
  isDemo?: boolean;
}

/** A page of company-directory results. */
export interface CompanyPageBrowseResult {
  items: CompanyPageBrowseItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** Facet values across the filtered set, with real counts (the spec strip + the
   *  district rail). Each facet ignores its own active selection. */
  facets: { specialization: BrowseFacet[]; district: BrowseFacet[] };
}

/** Per-page hub stats (followers + 30-day posts + open jobs). */
export interface CompanyPageStat {
  pageId: string;
  slug: string;
  name: string;
  logo: string;
  followers: number;
  posts: number;
  openJobs: number;
}

/** The Company Pages hub stats payload: per-page rows + KPI-strip totals. */
export interface CompanyPageStatsResult {
  pages: CompanyPageStat[];
  totals: { pages: number; followers: number; posts: number; openJobs: number };
}

// ── Institute public reads (Institutes Phase 2, Feature 2) ───────────────────
// The logged-out Alumni / Open-to-work tab + the "where our students work"
// Placement wall on an institute CompanyPage. Mirror EXACTLY the BE
// `ConnectProfileService.{InstituteAlumnus,InstituteAlumniResult,
// InstitutePlacementEmployer,InstitutePlacementResult}` (no extra/renamed
// fields). The BE already DPDP-trims (only opted-in, public, open-to-work
// students), so the FE just renders. Consumed by CompanyPageView + AlumniList;
// served by the public actions getInstituteAlumni / getInstitutePlacements.

/** One alumnus card on the institute Alumni tab. ConnectPerson-shaped so it maps
 *  straight onto the shared PersonCard. `openStatus` is fixed to 'work' (the tab
 *  lists open-to-work alumni only); `degree` is absent on the logged-out read. */
export interface InstituteAlumnus {
  userId: string;
  name: string;
  headline: string | null;
  avatarUrl: string | null;
  openStatus: 'work';
  /** Optional viewer-relative connection degree (absent on the public read). */
  degree?: number;
}

/** A cursor-paginated page of institute alumni (newest-first). The explicit empty
 *  marker (`items: []`, `total: 0`, `nextCursor: null`) lets the owner see the
 *  invite CTA when the institute has no opted-in alumni yet. */
export interface InstituteAlumniResult {
  items: InstituteAlumnus[];
  total: number;
  nextCursor: string | null;
}

/** The placement-wall company ref: a CompanyPage subset (id/name/slug/logo +
 *  derived ERP-linked badge). Smaller than CompanyPageBrowseItem on purpose - the
 *  wall is "where our students work", not a directory listing, so no
 *  followers/products/jobs stats are carried (or fabricated). Mirrors the BE
 *  `CompanyPageRef`. */
export interface InstitutePlacementCompany {
  id: string;
  name: string;
  slug: string;
  logo: string;
  erpLinked: boolean;
}

/** One employer row on the institute Placement wall: a platform CompanyPage + the
 *  distinct count of this institute's confirmed, opted-in students currently
 *  working there (self-declared, display-only). Mirrors BE
 *  `InstitutePlacementEmployer`. */
export interface InstitutePlacementEmployer {
  company: InstitutePlacementCompany;
  studentCount: number;
}

/** The institute Placement-wall result. `otherEmployerCount` rolls up students
 *  whose current employer is a free-text shop (no CompanyPage) into the "and N
 *  other workplaces" line. The explicit empty marker (`employers: []`,
 *  `otherEmployerCount: 0`, `totalStudents: 0`) drives the owner invite CTA.
 *  Mirrors BE `InstitutePlacementResult`. */
export interface InstitutePlacementResult {
  employers: InstitutePlacementEmployer[];
  otherEmployerCount: number;
  totalStudents: number;
}

// ── Institute manage console (Institutes Phase 2, Feature 3) ─────────────────
// The owner-only credential-review queue + bulk student-invite flow on an
// institute CompanyPage manage console. Mirror EXACTLY the BE shapes returned by
// the credential-admin + student-invite endpoints (no extra/renamed fields).
// confirmedByUserId is NEVER exposed by the BE, so it is absent here on purpose.
// Consumed by CredentialRequestsPanel + InviteStudentsPanel; served by the
// authed page-owner actions listCredentialRequests / confirmCredential /
// declineCredential / bulkInviteStudents / getStudentInviteSummary.
// Keep in sync with the BE CredentialAdmin + StudentInvite controllers.

/** The student-training entry as it appears inside a pending credential request.
 *  A read-only view of the student's `training[]` item the page owner is asked
 *  to confirm: the BE returns the full entry, but the panel only needs id (the
 *  trainingId route param), course, completedAt, instituteName, and confirmStatus
 *  (always 'pending' here, but typed to the full union to mirror the profile
 *  read). Keep field names identical to the profile `training[]` shape. */
export interface CredentialRequestTraining {
  id: string;
  instituteName: string;
  companyPageId: string | null;
  course: string;
  completedAt: string | null;
  certificateUrl: string | null;
  confirmStatus: 'self' | 'pending' | 'confirmed' | 'declined';
  confirmedAt: string | null;
  shareWithInstitute: boolean;
}

/** One pending credential-confirmation request shown in the institute's review
 *  queue. `student` is the requester's public identity (avatar/handle may be
 *  null); `training` is the entry they asked the institute to confirm; `company`
 *  is the resolved CompanyPage ref the entry points at (null when the entry has
 *  no linked company page). Mirrors the BE `PendingCredentialRequest`. */
export interface PendingCredentialRequest {
  student: {
    userId: string;
    name: string;
    avatar: string | null;
    handle: string | null;
  };
  training: CredentialRequestTraining;
  company: { id: string; name: string; slug: string; logo: string } | null;
}

/** The result of a bulk student-invite submit: how many invites were created,
 *  skipped (already invited / already joined), or invalid (bad numbers), plus
 *  the per-created-invite `{mobile, token}` pairs used to build the WhatsApp
 *  hand-off links. Mirrors the BE `student-invites` response. */
export interface BulkInviteResult {
  created: number;
  skipped: number;
  invalid: number;
  invites: { mobile: string; token: string }[];
}

/** The institute's first-touch invite roll-up: students who joined from this
 *  institute's invites + invites still pending. Display-only (the BE already
 *  computes first-touch attribution). Mirrors the BE `student-invites/summary`. */
export interface PageInviteSummary {
  joinedCount: number;
  pendingCount: number;
}

/** The discriminated codes a "Hire our trained candidates" lead can fail with
 *  (Institutes Phase 2, Feature 4). `selfLead` is the BE
 *  `CONNECT_SELF_HIRE_LEAD_NOT_ALLOWED` guard (you cannot lead your own page);
 *  `generic` covers a 404 (not an institute / not public), a rate limit, or any
 *  other failure -> a single friendly message. Drives the HireCandidatesModal
 *  copy branch. Keep `selfLead` in sync with the BE error code constant. */
export type HireLeadErrorCode = 'selfLead' | 'generic';

/** The result of `sendHireLead`: a discriminated union so the composer modal
 *  branches on `code` (the self-lead case reads differently from a generic
 *  failure) without re-parsing the raw error. On success the BE has seeded the
 *  inbox context thread (the lead surfaces as a candidate_request card). */
export type HireLeadResult = { ok: true } | { ok: false; code: HireLeadErrorCode; error: string };

/** A Storefront (shop). */
export interface Storefront {
  _id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  logo: string;
  banner: string;
  description: string;
  categories: string[];
  location: EntityLocation;
  companyPageId: string | null;
  erpWorkspaceId: string | null;
  visibility: EntityVisibility;
  /** The owner's pinned/primary storefront (at most one per owner). */
  isPrimary?: boolean;
  /** True for a seeded sample storefront (denormalized from the owner's
   *  User.isDemo). Drives the SampleBadge on the store + the demo down-rank.
   *  Optional; absent = real store. Keep `isDemo` in sync with the BE Storefront
   *  schema + every Connect mirror. */
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Per-storefront dashboard counts (from the marketplace stats endpoint). */
export interface StorefrontStat {
  storefrontId: string;
  /** Total listings filed in this storefront (any status). */
  products: number;
  /** Listings that are active + approved (publicly live). */
  live: number;
  /** Inquiries received across this storefront's listings. */
  inquiries: number;
}

/** The public Storefront read payload (shop + derived ERP badge). */
export interface PublicStorefront {
  storefront: Storefront;
  erpLink: PublicErpLink;
}

export interface CreateStorefrontPayload {
  name: string;
  description?: string;
  logo?: string;
  banner?: string;
  categories?: string[];
  location?: Partial<EntityLocation>;
  companyPageId?: string;
  erpWorkspaceId?: string;
  visibility?: EntityVisibility;
}

export type UpdateStorefrontPayload = Partial<
  Omit<CreateStorefrontPayload, 'companyPageId' | 'erpWorkspaceId'>
> & {
  companyPageId?: string | null;
  erpWorkspaceId?: string | null;
};
