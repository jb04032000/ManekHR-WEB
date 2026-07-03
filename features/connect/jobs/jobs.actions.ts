'use server';

/**
 * Server actions for the Connect Jobs board + applications (Phase 5). Wraps the
 * BE `connect/jobs` endpoints (JwtAuthGuard; actor = req.user.sub). Hiring funnel
 * (the company is notified of applications). ActionResult shape throughout.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
// Detects the typed CONNECT_LIMIT_REACHED 403 so a blocked job post shows the
// upgrade prompt (LimitReachedDialog) instead of a generic toast.
import { extractConnectLimit } from '../connect-limit';
import type { ActionResult } from '../profile.types';
import type {
  Job,
  JobApplication,
  MyApplicationView,
  CreateJobPayload,
  UpdateJobPayload,
  CreateApplicationPayload,
  BoardFilters,
  BoardFacets,
  BoardStats,
} from './jobs.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

/** Drop empty values so we never send blank query params (BE rejects unknowns). */
function pruneParams(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

/**
 * Flatten the board filter set into a plain query object the BE understands.
 * The plural fields (districts/roles/employmentTypes/machineTypes) are string[]
 * on the web but the BE wants comma-separated values, so we join here (NOT via
 * axios array serialization, which would emit `districts[]=`). `view` is a
 * client-only concern (layout) and is dropped before the GET. Empty arrays prune
 * away in pruneParams. Used by both listJobBoard and getJobBoardFacets so they
 * stay in lock-step. Gotcha: keep the joined keys in sync with BE BoardQueryDto.
 */
function toBoardParams(filters: BoardFilters): Record<string, unknown> {
  const csv = (arr?: string[]) => (arr && arr.length ? arr.join(',') : undefined);
  const { districts, roles, employmentTypes, machineTypes } = filters;
  const rest: Record<string, unknown> = { ...filters };
  // `view` is layout-only (client concern), strip it before the GET.
  delete rest.view;
  delete rest.districts;
  delete rest.roles;
  delete rest.employmentTypes;
  delete rest.machineTypes;
  return pruneParams({
    ...rest,
    districts: csv(districts),
    roles: csv(roles),
    employmentTypes: csv(employmentTypes),
    machineTypes: csv(machineTypes),
  });
}

const BASE = '/connect/jobs';

/**
 * Public single-job read for the logged-out `/jobs/[id]` SEO page. Hits the
 * `@Public` `GET /connect/jobs/public/:id`, which returns a job ONLY when its
 * status is 'open' (closed/filled 404, so crawlers never index a dead listing -
 * mirrors the suppressed-listing 404 on the marketplace). Returns not-ok on 404
 * / network error so the page calls notFound(). Cross-module: backend
 * JobsService.getPublicJob; consumed by app/(connect-public)/jobs/[id]/page.tsx.
 */
export async function getPublicJob(id: string): Promise<ActionResult<Job>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/public/${encodeURIComponent(id)}`);
    return { ok: true, data: unwrapServer<Job>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function createJob(payload: CreateJobPayload): Promise<ActionResult<Job>> {
  try {
    const http = await serverHttp();
    const res = await http.post(BASE, payload);
    return { ok: true, data: unwrapServer<Job>(res) };
  } catch (e) {
    const limitReached = extractConnectLimit(e);
    if (limitReached) return { ok: false, error: toError(e), limitReached };
    return { ok: false, error: toError(e) };
  }
}

/** The open-jobs board with the optional filter rail / sort / search / paging.
 *  Plural multi-select fields are serialized to csv via toBoardParams. */
export async function listJobBoard(filters: BoardFilters = {}): Promise<ActionResult<Job[]>> {
  try {
    const http = await serverHttp();
    const params = toBoardParams(filters);
    const res = await http.get(
      `${BASE}/board`,
      Object.keys(params).length ? { params } : undefined,
    );
    return { ok: true, data: unwrapServer<Job[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Counts for the filter rail + role strip (BE `GET /connect/jobs/board/facets`,
 * one $facet aggregation). Mirrors listJobBoard's param serialization so the same
 * filter set drives both results and counts. Each facet is computed with all
 * active filters EXCEPT its own field (see BE boardFacets). Refetched on filter
 * change only, never on Load more. Drives JobFilterRail/JobBoard via useBoardFilters.
 */
export async function getJobBoardFacets(
  filters: BoardFilters = {},
): Promise<ActionResult<BoardFacets>> {
  try {
    const http = await serverHttp();
    // Facets are sort/paging-independent, and BoardFacetsQueryDto whitelists
    // only filter fields (forbidNonWhitelisted -> a stray `sort`/`limit`/`skip`
    // 400s the whole call). Strip them so counts always load. Keep in sync with
    // BE BoardFacetsQueryDto.
    const facetFilters: BoardFilters = { ...filters };
    delete facetFilters.sort;
    delete facetFilters.limit;
    delete facetFilters.skip;
    const params = toBoardParams(facetFilters);
    const res = await http.get(
      `${BASE}/board/facets`,
      Object.keys(params).length ? { params } : undefined,
    );
    return { ok: true, data: unwrapServer<BoardFacets>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Promoted (boosted) jobs for the board's "Promoted" block (BE
 * `GET /connect/jobs/board/promoted`). First-party, READ-ONLY: the BE resolves
 * up to K open, filter-matching boosted jobs (default 3) - NO impression billing
 * here, just discovery. We send the SAME facet-safe param set as getJobBoardFacets
 * (sort/limit/skip stripped, plural arrays joined to csv) so the promoted set
 * always matches the active filter view. Drives features/connect/jobs/PromotedJobs.
 * Gotcha: never pass sort/limit/skip - BoardFacetsQueryDto whitelists only filter
 * fields, so a stray param 400s the whole call (same contract as facets).
 */
export async function listPromotedJobs(filters: BoardFilters = {}): Promise<ActionResult<Job[]>> {
  try {
    const http = await serverHttp();
    const promotedFilters: BoardFilters = { ...filters };
    delete promotedFilters.sort;
    delete promotedFilters.limit;
    delete promotedFilters.skip;
    const params = toBoardParams(promotedFilters);
    const res = await http.get(
      `${BASE}/board/promoted`,
      Object.keys(params).length ? { params } : undefined,
    );
    return { ok: true, data: unwrapServer<Job[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Headline counts for the board KPI strip (real numbers, never faked). */
export async function getJobBoardStats(): Promise<ActionResult<BoardStats>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/board/stats`);
    return { ok: true, data: unwrapServer<BoardStats>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** A company page's public open jobs (the page Jobs tab; logged-out OK). */
export async function getCompanyPageJobs(pageId: string): Promise<ActionResult<Job[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/by-page/${encodeURIComponent(pageId)}`);
    return { ok: true, data: unwrapServer<Job[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * The owner's full job history for one company page - ALL statuses (open / filled
 * / closed), newest first. Owner-only (BE getMine 404s a non-owner). Powers the
 * manage console Jobs tab; the public getCompanyPageJobs above stays open-only.
 */
export async function getCompanyPageJobsForOwner(pageId: string): Promise<ActionResult<Job[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/by-page/${encodeURIComponent(pageId)}/manage`);
    return { ok: true, data: unwrapServer<Job[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's own posted jobs. */
export async function listMyJobs(): Promise<ActionResult<Job[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/mine`);
    return { ok: true, data: unwrapServer<Job[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's own applications. */
export async function listMyApplications(): Promise<ActionResult<MyApplicationView[]>> {
  try {
    const http = await serverHttp();
    // Enriched shape (job snapshot + employer name + viewedAt) so the My
    // applications cards render job-centric without a per-row fetch. See BE
    // JobsService.listMyApplications / MyApplicationView.
    const res = await http.get(`${BASE}/my-applications`);
    return { ok: true, data: unwrapServer<MyApplicationView[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function getJob(id: string): Promise<ActionResult<Job>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${id}`);
    return { ok: true, data: unwrapServer<Job>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Edit an open job the caller owns (BE: PATCH /connect/jobs/:id, owner + open only). */
export async function updateJob(id: string, payload: UpdateJobPayload): Promise<ActionResult<Job>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(`${BASE}/${id}`, payload);
    return { ok: true, data: unwrapServer<Job>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Close a job, capturing the hire outcome: `filled` true -> the role was filled
 * (status 'filled'), else just closed (status 'closed'). Mirrors the BE close DTO.
 */
export async function closeJob(id: string, filled = false): Promise<ActionResult<Job>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${id}/close`, { filled });
    return { ok: true, data: unwrapServer<Job>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Submit (or update) the caller's application to a job. */
export async function applyToJob(
  jobId: string,
  payload: CreateApplicationPayload,
): Promise<ActionResult<JobApplication>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${jobId}/apply`, payload);
    return { ok: true, data: unwrapServer<JobApplication>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** All applications on one of the caller's jobs (company-only). */
export async function listApplicationsForMyJob(
  jobId: string,
): Promise<ActionResult<JobApplication[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${jobId}/applications`);
    return { ok: true, data: unwrapServer<JobApplication[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Company shortlists or declines an application. */
export async function setApplicationStatus(
  applicationId: string,
  status: 'shortlisted' | 'declined',
): Promise<ActionResult<JobApplication>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/applications/${applicationId}/status`, { status });
    return { ok: true, data: unwrapServer<JobApplication>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Company accepts an application (fills the job). */
export async function acceptApplication(
  applicationId: string,
): Promise<ActionResult<JobApplication>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/applications/${applicationId}/accept`);
    return { ok: true, data: unwrapServer<JobApplication>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Applicant withdraws their own application. */
export async function withdrawApplication(
  applicationId: string,
): Promise<ActionResult<JobApplication>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/applications/${applicationId}/withdraw`);
    return { ok: true, data: unwrapServer<JobApplication>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── Saved (bookmarked) jobs ───────────────────────────────────────────────
// BE: SavedJob collection (mirrors SavedPost). Powers the bookmark control on
// the job detail hero + the board's "Saved" filter.

/** Save (bookmark) a job for the caller. Idempotent on the BE. */
export async function saveJob(id: string): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${id}/save`);
    return { ok: true, data: unwrapServer<{ saved: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Un-save a job for the caller. Tolerates a missing bookmark on the BE. */
export async function unsaveJob(id: string): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${id}/save`);
    return { ok: true, data: unwrapServer<{ saved: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's saved jobs, newest-saved first (the board's "Saved" filter). */
export async function listSavedJobs(): Promise<ActionResult<Job[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/saved`);
    return { ok: true, data: unwrapServer<Job[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
