'use server';

/**
 * Server actions for Connect Company Pages (Phase 6, on the W1 entity
 * foundation). Wraps the BE `connect/company-pages` endpoints (JwtAuthGuard;
 * owner = req.user.sub, never the body) + the `@Public` read-by-slug. Returns
 * the discriminated `ActionResult<T>` used across Connect server actions.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
// Detects the typed CONNECT_LIMIT_REACHED 403 so a blocked create shows the
// upgrade prompt (LimitReachedDialog) instead of a generic toast.
import { extractConnectLimit } from '../connect-limit';
// Reads the BE error envelope's app-level `code` so the hire-lead action can
// detect the self-lead guard (CONNECT_SELF_HIRE_LEAD_NOT_ALLOWED).
import { extractConnectError } from '../marketplace/connect-error';
import type { ActionResult } from '../profile.types';
import type { CompanyPageRef } from '../feed.types';
import type {
  CompanyPage,
  PublicCompanyPage,
  CreateCompanyPagePayload,
  UpdateCompanyPagePayload,
  BrowseCompanyPagesInput,
  CompanyPageBrowseResult,
  CompanyPageStatsResult,
  LocationSuggestion,
  Storefront,
  InstituteAlumniResult,
  InstitutePlacementResult,
  PendingCredentialRequest,
  BulkInviteResult,
  PageInviteSummary,
  HireLeadResult,
} from './entities.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

const BASE = '/connect/company-pages';

/** Follow a company page (the page owner is notified). */
export async function followCompanyPage(id: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${id}/follow`);
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Unfollow a company page. */
export async function unfollowCompanyPage(id: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${id}/follow`);
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Whether the caller follows a page (drives the Follow button's initial state).
 * Authed; a logged-out caller gets `{ following: false }` so the public page
 * still renders without a session.
 */
/**
 * The company-page ids the caller follows -- seeds the directory's per-card
 * Follow state in one round trip (avoids an N+1 follow-state check per card).
 * A logged-out / no-session caller gets an empty list, not an error.
 */
// `opts.timeout` overrides the shared 15s client timeout for THIS call only.
// The feed right-rail awaits this inside the feed page's blocking Promise.all
// (app/connect/feed/page.tsx), so it passes a short fail-fast timeout (5s) -- a
// slow/cold-start backend on this best-effort seed must not hold the feed render
// for the full 15s (a miss just leaves every rail company reading "Follow").
// Other callers omit it and keep the default. Keep in sync with the feed page's
// best-effort rail timeouts.
export async function getMyFollowedCompanyPageIds(opts?: {
  timeout?: number;
}): Promise<ActionResult<string[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/following/ids`, {
      ...(opts?.timeout ? { timeout: opts.timeout } : {}),
    });
    return { ok: true, data: unwrapServer<{ ids: string[] }>(res).ids };
  } catch {
    return { ok: true, data: [] };
  }
}

export async function getCompanyPageFollowState(
  id: string,
): Promise<ActionResult<{ following: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${id}/follow-state`);
    return { ok: true, data: unwrapServer<{ following: boolean }>(res) };
  } catch {
    // Logged-out / no session - not an error for the public page.
    return { ok: true, data: { following: false } };
  }
}

/**
 * Public company directory: a paginated, filterable list of public company
 * pages. Powers `/connect/companies`. Empty input returns the first page of all
 * public pages (newest first).
 */
// `opts.timeout` overrides the shared 15s client timeout for THIS call only.
// The feed right-rail awaits this inside the feed page's blocking Promise.all
// (app/connect/feed/page.tsx) to seed "Companies to follow", so it passes a
// short fail-fast timeout (5s): a slow/cold-start backend on this best-effort
// panel must not hold the whole feed render for the full 15s (a miss just hides
// the panel). The directory's own browse omits it and keeps the default. Keep
// in sync with the feed page's best-effort rail timeouts.
export async function browseCompanyPages(
  input: BrowseCompanyPagesInput = {},
  opts?: { timeout?: number },
): Promise<ActionResult<CompanyPageBrowseResult>> {
  try {
    const http = await serverHttp();
    const params: Record<string, string | number> = {};
    if (input.q) params.q = input.q;
    if (input.district) params.district = input.district;
    if (input.specialization) params.specialization = input.specialization;
    if (input.erpVerified) params.erpVerified = '1';
    if (input.minRating) params.minRating = input.minRating;
    if (input.sort && input.sort !== 'recent') params.sort = input.sort;
    if (input.page) params.page = input.page;
    if (input.pageSize) params.pageSize = input.pageSize;
    const res = await http.get(`${BASE}/public/browse`, {
      params,
      ...(opts?.timeout ? { timeout: opts.timeout } : {}),
    });
    return { ok: true, data: unwrapServer<CompanyPageBrowseResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Distinct district / city values across public pages - powers the directory's
 * location search and the create/edit autocomplete. Empty `q` returns the most
 * common values; a `q` filters case-insensitively.
 */
export async function browseCompanyLocations(
  field: 'district' | 'city',
  q?: string,
): Promise<ActionResult<LocationSuggestion[]>> {
  try {
    const http = await serverHttp();
    const params: Record<string, string | number> = { field, limit: 10 };
    if (q?.trim()) params.q = q.trim();
    const res = await http.get(`${BASE}/public/locations`, { params });
    return { ok: true, data: unwrapServer<LocationSuggestion[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Batch-resolve minimal page identity for a list of page ids - the feed uses
 * this to hydrate the author block of page posts (mirrors `getPeople`).
 */
export async function getCompanyPageRefs(ids: string[]): Promise<ActionResult<CompanyPageRef[]>> {
  if (ids.length === 0) return { ok: true, data: [] };
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/public/refs`, { params: { ids: ids.join(',') } });
    return { ok: true, data: unwrapServer<CompanyPageRef[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Create a Company Page. */
export async function createCompanyPage(
  payload: CreateCompanyPagePayload,
): Promise<ActionResult<CompanyPage>> {
  try {
    const http = await serverHttp();
    const res = await http.post(BASE, payload);
    return { ok: true, data: unwrapServer<CompanyPage>(res) };
  } catch (e) {
    const limitReached = extractConnectLimit(e);
    if (limitReached) return { ok: false, error: toError(e), limitReached };
    return { ok: false, error: toError(e) };
  }
}

/** The signed-in owner's company pages. */
export async function listMyCompanyPages(): Promise<ActionResult<CompanyPage[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(BASE);
    return { ok: true, data: unwrapServer<CompanyPage[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Per-page followers + 30-day posts + open-jobs + KPI totals for the hub. */
export async function getMyCompanyPageStats(): Promise<ActionResult<CompanyPageStatsResult>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/stats`);
    return { ok: true, data: unwrapServer<CompanyPageStatsResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Load one of the owner's company pages (404 if not owned). */
export async function getMyCompanyPage(id: string): Promise<ActionResult<CompanyPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${id}`);
    return { ok: true, data: unwrapServer<CompanyPage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function updateCompanyPage(
  id: string,
  payload: UpdateCompanyPagePayload,
): Promise<ActionResult<CompanyPage>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(`${BASE}/${id}`, payload);
    return { ok: true, data: unwrapServer<CompanyPage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function deleteCompanyPage(id: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${id}`);
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Public read by slug -- powers the SEO page `/company/[slug]`. */
export async function getPublicCompanyPage(slug: string): Promise<ActionResult<PublicCompanyPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/public/${slug}`);
    return { ok: true, data: unwrapServer<PublicCompanyPage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── ERP link (consent + ownership-verified, ADR-0004) ────────────────────────
// Replaces the old raw `erpWorkspaceId` create/update field. The BE verifies the
// caller owns BOTH the page and the workspace; a non-owner workspace returns a
// 403 ("You must own that workspace to link it"), which we surface as the typed
// `notOwner` code so the editor renders the friendly inline message instead of a
// raw error. Consumed by CompanyPageForm's "Link this page to my ERP workspace"
// action (via ERPConsentModal in entity mode). Keep route shapes in sync with
// CompanyPageController.linkErp / unlinkErp.

/** The result of `linkPageErp`: discriminated so the editor can branch on the
 *  403 not-owner-of-workspace case (`code: 'notOwner'`) distinctly from a
 *  generic failure. On success the BE returns the updated page (now ERP-linked). */
export type ErpLinkResult =
  | { ok: true; data: CompanyPage }
  | { ok: false; code: 'notOwner' | 'generic'; error: string };

/** Link a company page to an ERP workspace the caller owns (earns the ERP badge). */
export async function linkPageErp(pageId: string, workspaceId: string): Promise<ErpLinkResult> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${encodeURIComponent(pageId)}/erp-link`, { workspaceId });
    return { ok: true, data: unwrapServer<CompanyPage>(res) };
  } catch (e) {
    const { status, message } = extractConnectError(e);
    return { ok: false, code: status === 403 ? 'notOwner' : 'generic', error: message };
  }
}

/** Unlink a company page's ERP workspace (badge drops immediately). */
export async function unlinkPageErp(pageId: string): Promise<ActionResult<CompanyPage>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${encodeURIComponent(pageId)}/erp-link`);
    return { ok: true, data: unwrapServer<CompanyPage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── Attached store (one storefront per page) ─────────────────────────────────
// Source of truth = Storefront.companyPageId (BE entities module). These wrap the
// owner GET/PUT/DELETE :pageId/store endpoints + the @Public read; consumed by
// the manage console Store tab (CompanyPageStoreTab) + the public CompanyPageView.

/** The storefront attached to a page the caller owns (owner view: any visibility). */
export async function getCompanyPageStore(
  pageId: string,
): Promise<ActionResult<Storefront | null>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${pageId}/store`);
    return { ok: true, data: unwrapServer<Storefront | null>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * The PUBLIC storefront attached to a page (public visibility only, or null).
 * Logged-out OK - drives the public company page's Store section. Mirrors the BE
 * @Public() `public/:pageId/store`.
 */
export async function getPublicCompanyPageStore(
  pageId: string,
): Promise<ActionResult<Storefront | null>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/public/${encodeURIComponent(pageId)}/store`);
    return { ok: true, data: unwrapServer<Storefront | null>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Attach (or swap) an existing storefront the caller owns to the page. */
export async function attachStoreToPage(
  pageId: string,
  storefrontId: string,
): Promise<ActionResult<{ linked: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.put(`${BASE}/${pageId}/store`, { storefrontId });
    return { ok: true, data: unwrapServer<{ linked: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Unlink the page's attached store. Tolerates a page with none. */
export async function unlinkStoreFromPage(
  pageId: string,
): Promise<ActionResult<{ linked: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${pageId}/store`);
    return { ok: true, data: unwrapServer<{ linked: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── Institute public reads (Institutes Phase 2, Feature 2) ───────────────────
// The logged-out Alumni / Open-to-work tab + the "where our students work"
// Placement wall on an institute CompanyPage. Both wrap the BE @Public()
// `connect/company-pages/public/:pageId/{alumni,placements}` reads served by
// InstitutePublicController. The BE 404s a page that is not an institute /
// not public AND DPDP-trims the rows (only opted-in, public, open-to-work
// students), so the FE just renders. Consumed by the in-app + public company
// `[slug]/page.tsx` (SSR seed) and the client AlumniList (Show-more paging).
// Keep route shapes in sync with InstitutePublicController.

/** The institute's Alumni / Open-to-work tab, cursor-paginated. */
export async function getInstituteAlumni(
  pageId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<ActionResult<InstituteAlumniResult>> {
  try {
    const http = await serverHttp();
    const params: Record<string, string | number> = {};
    if (opts.cursor) params.cursor = opts.cursor;
    if (opts.limit) params.limit = opts.limit;
    const res = await http.get(`${BASE}/public/${encodeURIComponent(pageId)}/alumni`, { params });
    return { ok: true, data: unwrapServer<InstituteAlumniResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The institute's Placement wall ("where our students work"). */
export async function getInstitutePlacements(
  pageId: string,
  opts: { limit?: number } = {},
): Promise<ActionResult<InstitutePlacementResult>> {
  try {
    const http = await serverHttp();
    const params: Record<string, string | number> = {};
    if (opts.limit) params.limit = opts.limit;
    const res = await http.get(`${BASE}/public/${encodeURIComponent(pageId)}/placements`, {
      params,
    });
    return { ok: true, data: unwrapServer<InstitutePlacementResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── Institute manage console (Institutes Phase 2, Feature 3) ─────────────────
// Owner-only (authed page-owner) credential-review queue + bulk student-invite
// flow. These wrap the BE credential-admin + student-invite endpoints; the BE
// 404s a non-owner / non-institute page (no existence leak), so the FE adds no
// extra auth. Consumed by CredentialRequestsPanel + InviteStudentsPanel (both
// rendered by ManageCompanyPageScreen) and SSR-seeded by the `[id]/page.tsx`
// route loader. Keep route shapes in sync with the BE CredentialAdmin +
// StudentInvite controllers.

/** The pending credential-confirmation requests for an institute page (owner). */
export async function listCredentialRequests(
  pageId: string,
): Promise<ActionResult<PendingCredentialRequest[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${encodeURIComponent(pageId)}/credential-requests`);
    return { ok: true, data: unwrapServer<PendingCredentialRequest[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Confirm a student's training entry ("Confirmed by [Institute]" badge). The BE
 *  flips the entry's confirmStatus to 'confirmed' + stamps confirmedAt; the FE
 *  never sends those. */
export async function confirmCredential(
  pageId: string,
  studentUserId: string,
  trainingId: string,
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(
      `${BASE}/${encodeURIComponent(pageId)}/credentials/${encodeURIComponent(
        studentUserId,
      )}/${encodeURIComponent(trainingId)}/confirm`,
    );
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Decline a student's credential request (BE flips confirmStatus to 'declined'). */
export async function declineCredential(
  pageId: string,
  studentUserId: string,
  trainingId: string,
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(
      `${BASE}/${encodeURIComponent(pageId)}/credentials/${encodeURIComponent(
        studentUserId,
      )}/${encodeURIComponent(trainingId)}/decline`,
    );
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Bulk-invite students by phone (<=200). The BE de-dupes + validates and returns
 *  created/skipped/invalid counts + the created invites' `{mobile, token}` pairs
 *  (used to build the per-invite WhatsApp hand-off links). */
export async function bulkInviteStudents(
  pageId: string,
  phones: string[],
): Promise<ActionResult<BulkInviteResult>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${encodeURIComponent(pageId)}/student-invites`, {
      phones,
    });
    return { ok: true, data: unwrapServer<BulkInviteResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The institute's first-touch invite roll-up (joined + pending counts). */
export async function getStudentInviteSummary(
  pageId: string,
): Promise<ActionResult<PageInviteSummary>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${encodeURIComponent(pageId)}/student-invites/summary`);
    return { ok: true, data: unwrapServer<PageInviteSummary>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── Hire leads (Institutes Phase 2, Feature 4) ───────────────────────────────
// A business sends an institute a "Hire our trained candidates" lead, which the
// BE turns into an inbox context thread (channel 'candidate_request') visible to
// both parties. Wraps the authed POST `:pageId/hire-leads`; the BE 404s a
// non-institute / non-public page and blocks a self-lead
// (CONNECT_SELF_HIRE_LEAD_NOT_ALLOWED). Consumed by HireCandidatesModal (opened
// from CompanyPageView). The lead seeds the thread the CandidateRequestCard
// renders. Keep the self-lead code in sync with the BE error constant.

/** Send a hire lead to an institute page (optional capped message). Returns the
 *  discriminated `HireLeadResult` so the modal renders the self-lead case
 *  distinctly from a generic failure. */
export async function sendHireLead(pageId: string, message?: string): Promise<HireLeadResult> {
  try {
    const http = await serverHttp();
    await http.post(`${BASE}/${encodeURIComponent(pageId)}/hire-leads`, {
      message: message?.trim() ? message.trim() : undefined,
    });
    return { ok: true };
  } catch (e) {
    const { code, message: errMessage } = extractConnectError(e);
    if (code === 'CONNECT_SELF_HIRE_LEAD_NOT_ALLOWED') {
      return { ok: false, code: 'selfLead', error: errMessage };
    }
    return { ok: false, code: 'generic', error: errMessage };
  }
}
