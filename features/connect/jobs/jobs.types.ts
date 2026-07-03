/** Connect Jobs types (Phase 5). Mirrors the BE jobs schemas. */

import type { ListingCategory } from '../search.types';

export type JobStatus = 'open' | 'closed' | 'filled';
// Mirror BE JOB_WAGE_TYPES (job.schema.ts). `hourly` = per-hour pay.
export type JobWageType = 'hourly' | 'daily' | 'piece' | 'monthly';

// Mirror BE JOB_EMPLOYMENT_TYPES / JOB_SHIFTS (job.schema.ts). Labels via i18n
// connect.jobs.employmentTypeOpt.* / shiftOpt.*.
export const JOB_EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'temporary',
  'apprenticeship',
] as const;
export type JobEmploymentType = (typeof JOB_EMPLOYMENT_TYPES)[number];
export const JOB_SHIFTS = ['day', 'night', 'rotational', 'flexible'] as const;
export type JobShift = (typeof JOB_SHIFTS)[number];
// Common benefit presets for the composer (custom values allowed too). Labels
// via i18n connect.jobs.benefitOpt.*; stored as these slugs or custom strings.
export const JOB_BENEFIT_PRESETS = [
  'pf_esi',
  'meals',
  'accommodation',
  'transport',
  'overtime_pay',
  'weekly_off',
  'bonus',
  'health_insurance',
] as const;

/**
 * The known/canonical role presets. The stored `role` is an OPEN string now
 * (a company may pick a preset OR type its own term, which self-registers into
 * the shared ConnectTag pool, same as a custom category). These seed the
 * composer's role combobox and the board's role strip; `JobRole` is the preset
 * union, not the full set of possible stored values. Mirrors LISTING_CATEGORIES.
 */
export const JOB_ROLE_PRESETS = [
  'karigar',
  'operator',
  'designer',
  'supervisor',
  'helper',
] as const;
export type JobRole = (typeof JOB_ROLE_PRESETS)[number];
export type ApplicationStatus = 'applied' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn';

/**
 * Display label for a (possibly custom) role. A known preset renders its
 * localized `roleName.<slug>` label; a custom slug renders humanized (dashes to
 * spaces, first letter capitalized). Mirrors `categoryLabel` in search.types.
 */
export function roleLabel(value: string, label: (key: string) => string): string {
  return (JOB_ROLE_PRESETS as readonly string[]).includes(value)
    ? label(`roleName.${value}`)
    : value.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Display label for a (possibly custom) benefit. A known preset slug renders its
 * localized `benefitOpt.<slug>` label; a custom value renders humanized. Mirrors
 * `roleLabel`. Used by the job detail benefits chips.
 */
export function benefitLabel(value: string, label: (key: string) => string): string {
  return (JOB_BENEFIT_PRESETS as readonly string[]).includes(value)
    ? label(`benefitOpt.${value}`)
    : value.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export interface JobLocation {
  district: string;
  city: string;
  state: string;
}

/**
 * One job video. Mirrors the BE Job `videos` sub-schema (and the same media shape
 * the marketplace ListingVideo / feed video use): `url` is the clip, `posterUrl`
 * an optional client-captured still (poster-first render), `durationSec` the
 * server-derived length. A job carries at most one (the composer + BE cap it at
 * one). Cross-module: same pipeline as marketplace.types ListingVideo, uploaded
 * via MediaUploadGrid video mode + the `connect-job-video` upload policy. */
export interface JobVideo {
  url: string;
  posterUrl?: string;
  durationSec?: number;
}

export interface Job {
  _id: string;
  companyUserId: string;
  companyPageId: string | null;
  title: string;
  description: string;
  /** Structured "What you'll do" lines -- the detail checklist. Empty = none.
   *  Mirrors BE Job.responsibilities. */
  responsibilities: string[];
  /** A known LISTING_CATEGORIES slug OR a custom term (see categoryLabel). */
  category: string;
  /** A JOB_ROLE_PRESETS slug OR a custom term (see roleLabel). */
  role: string | null;
  wageType: JobWageType | null;
  wageMin: number | null;
  wageMax: number | null;
  openings: number;
  location: JobLocation;
  skills: string[];
  machineType: string;
  employmentType: JobEmploymentType | null;
  /** Minimum experience in years. null = unspecified, 0 = freshers welcome. */
  experienceMin: number | null;
  shift: JobShift | null;
  workingDays: string;
  languages: string[];
  /** Benefit slugs (JOB_BENEFIT_PRESETS) or custom strings. */
  benefits: string[];
  /** Job video(s) - at most one (BE caps it). Poster-first player on the detail
   *  page. First media a job ever had; mirrors marketplace listing videos. */
  videos?: JobVideo[];
  closesAt: string | null;
  status: JobStatus;
  applicationsCount: number;
  views: number;
  boostCampaignId: string | null;
  /** True for a seeded sample job (denormalized from the poster's User.isDemo).
   *  Drives the SampleBadge on the job card/detail + the demo down-rank. Optional;
   *  absent = real job. Keep `isDemo` in sync with the BE Job schema + every mirror. */
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobApplication {
  _id: string;
  jobId: string;
  applicantUserId: string;
  message: string;
  voiceNoteUrl: string | null;
  /** Optional resume/CV file URL + its original filename. */
  resumeUrl: string | null;
  resumeName: string;
  status: ApplicationStatus;
  /** When the EMPLOYER first opened this application (BE: stamped on the employer's
   *  applicant-list view). null = not yet seen. Drives the seeker "Viewed" badge:
   *  status 'applied' + viewedAt => "Viewed". Real signal only. */
  viewedAt?: string | null;
  /** True for a seeded sample application (denormalized from the applicant's
   *  User.isDemo). Drives the SampleBadge on an applicant row. Optional; absent =
   *  real applicant. Keep `isDemo` in sync with the BE + every Connect mirror. */
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A worker's own application enriched for the My applications list. Mirrors the BE
 * JobsService.MyApplicationView (listMyApplications): the application + a small job
 * snapshot (title, role for the icon, location) + the employer display name, so the
 * card renders job-centric without an extra fetch. `job` is null only if the job
 * was hard-deleted. Cross-module: features/connect/jobs/MyApplicationCard.tsx.
 */
export interface MyApplicationView extends JobApplication {
  job: {
    id: string;
    title: string;
    role: string | null;
    location: { district?: string; state?: string } | null;
  } | null;
  employer: { name: string };
}

export interface CreateJobPayload {
  title: string;
  description?: string;
  /** Structured "What you'll do" lines. */
  responsibilities?: string[];
  /** Known slug or a custom term; the BE folds it into the shared tag pool. */
  category: string;
  /** Known preset or a custom term; folded into the shared tag pool. */
  role?: string;
  wageType?: JobWageType;
  wageMin?: number;
  wageMax?: number;
  openings?: number;
  skills?: string[];
  machineType?: string;
  employmentType?: JobEmploymentType;
  experienceMin?: number;
  shift?: JobShift;
  workingDays?: string;
  languages?: string[];
  benefits?: string[];
  /** Job video(s), at most one (BE caps it). Each clip carries its poster so an
   *  edit that touches other fields never strips an existing poster. */
  videos?: JobVideo[];
  closesAt?: string;
  location?: Partial<JobLocation>;
  companyPageId?: string;
}

/**
 * Edit an open job (owner only). PATCH semantics: every field optional, only the
 * provided ones change. No `companyPageId` - a job cannot move pages via edit.
 * Mirrors the BE UpdateJobDto. Sent by jobs.actions.updateJob.
 */
export type UpdateJobPayload = Partial<Omit<CreateJobPayload, 'companyPageId'>>;

/**
 * The hiring identity shown on the job detail (trust context for a candidate).
 * Resolved in the route: a page-posted job -> the CompanyPage (logo + link); a
 * personal post -> the poster person (avatar, no link - PersonRef carries no
 * profile slug). `href` absent means render the name/avatar without a link.
 */
export interface JobEmployer {
  name: string;
  avatar: string | null;
  href?: string;
  /** Rich trust context (page-posted jobs only; resolved from the public company
   *  page). All optional so a person-posted job still renders the minimal block.
   *  Trust signals are REAL only -- ERP-linked, seller rating, followers, member
   *  since. `gstVerified` is the FORWARD HOOK for a future real GST-verification
   *  feature: the badge render is already wired (gated on this flag), but the BE
   *  does not populate it yet, so it stays off until that verification ships -- we
   *  never claim GST verification we have not actually performed. */
  about?: string;
  location?: string;
  followerCount?: number;
  erpLinked?: boolean;
  gstVerified?: boolean;
  ratingAvg?: number;
  ratingCount?: number;
  memberSince?: string;
}

/**
 * Batch-resolved employer identity for a board card (Phase 3.2). Built in
 * JobBoard from getCompanyPageRefs (page-posted jobs) + getPeople (person-posted
 * jobs) and passed to JobCard as a `Record<jobId, JobEmployerRef>` map. Neutral
 * identity for everyone (name + logo/initial); `erpLinked` drives a QUIET
 * positive badge and is NEVER set for a person (`isPerson` true). Cross-module:
 * company-page.actions.getCompanyPageRefs + network.actions.getPeople feed this;
 * JobCard renders it. Gotcha: keep `erpLinked` page-only - never badge a person.
 */
export interface JobEmployerRef {
  name: string;
  logo?: string;
  slug?: string;
  erpLinked?: boolean;
  /** Forward hook for a future real GST-verification feature. The card badge is
   *  wired (gated on this), but nothing sets it yet -> stays off (page-only, never
   *  a person) until that verification ships. Mirror: feed.types CompanyPageRef. */
  gstVerified?: boolean;
  isPerson?: boolean;
}

export interface CreateApplicationPayload {
  message?: string;
  voiceNoteUrl?: string;
  resumeUrl?: string;
  resumeName?: string;
}

/** Board filter-rail + sort + search + paging params (all optional). */
export interface BoardFilters {
  category?: ListingCategory;
  wageType?: JobWageType;
  district?: string;
  role?: JobRole;
  /** Comma-separated skill names (from the filter-rail checkboxes). */
  skills?: string;
  /**
   * Multi-select arrays (Phase 1 board upgrade). The BE accepts these as csv
   * (`districts=a,b`) and a plural value SUPERSEDES the matching singular field
   * (`district`/`role`/`employmentType`/`machineType`). Kept as string[] on the
   * web so the rail/strip toggles are clean; jobs.actions serializes them to csv
   * before the GET. Singular fields stay for back-compat (job-detail "Similar
   * jobs" deep link). OR within a facet, AND across facets (BE buildBoardFilter).
   */
  districts?: string[];
  roles?: string[];
  employmentTypes?: string[];
  machineTypes?: string[];
  payMin?: number;
  payMax?: number;
  postedWithinDays?: number;
  includeFilled?: boolean;
  sort?: 'recent' | 'openings' | 'closing';
  limit?: number;
  skip?: number;
  q?: string;
  /** List vs grid layout for the Open tab (Phase 4 owns the toggle UI; carried
   *  here so it round-trips through the URL/hook from Phase 1). */
  view?: 'list' | 'grid';
}

/** One facet bucket: a filterable value + how many open jobs would match it
 *  given the OTHER active filters (BE board/facets aggregation). */
export interface FacetEntry {
  value: string;
  count: number;
}

/**
 * Counts for the whole facet rail (BE `GET /connect/jobs/board/facets`). `total`
 * is the count for the full active filter set; each array is that facet's buckets
 * with all active filters applied EXCEPT its own field (so a user sees "how many
 * you'd get if you also picked this"). Feeds JobFilterRail + the role strip.
 */
export interface BoardFacets {
  total: number;
  district: FacetEntry[];
  role: FacetEntry[];
  employmentType: FacetEntry[];
  machineType: FacetEntry[];
  skill: FacetEntry[];
  wageType: FacetEntry[];
}

/** Headline counts for the board KPI strip. */
export interface BoardStats {
  openTotal: number;
  newToday: number;
}
