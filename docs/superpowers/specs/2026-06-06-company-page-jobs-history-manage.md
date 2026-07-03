# Company page job history + page-scoped management

Date: 2026-06-06
Status: Approved (design), ready for plan
Context: Follow-up to the company page jobs section (screen 1) + job detail (screen 2).
Fixes the "closed jobs vanish, no history" gap + repoints "Manage in Jobs".

## Problem

1. The company page "Open positions" section and the manage console Jobs tab both load
   **open-only** jobs (`getCompanyPageJobs` -> BE `listByCompanyPage` filters
   `status:'open'`). Closing a job removes it from view with **no history anywhere**.
2. "Manage in Jobs ->" points at the **global** board (`/connect/jobs?tab=mine`), which
   shows every job the owner posted across all pages + personal posts - not this page's.

## Decisions (owner-approved)

- The **manage console Jobs tab** (`/connect/pages/[id]`) becomes the page-scoped job
  history + management surface (Open / Filled / Closed, status filter, per-job details,
  rows link into the job-detail page where edit/close/applicant-review live).
- **"Manage in Jobs ->"** on the public company page repoints to
  `/connect/pages/[id]?tab=jobs` (page-scoped), not the global board.
- The public "Open positions" section stays **open-only** (visitors only see jobs they
  can apply to). History is owner-private -> lives in the console.
- New **owner-only backend endpoint** for the all-status, page-scoped list.

## Non-goals

- No change to the public `by-page/:pageId` endpoint (stays `@Public()` + open-only).
- No deep management actions duplicated in the manager: edit/close/applicant-review stay
  on the job-detail page (screen 2). The manager is the page-scoped index/history; rows
  link to detail. (Convenience exception: an OPEN row keeps a quick Close, reusing the
  existing CompanyJobRow close flow.)

## Architecture

### Backend

- `jobs.service.ts`: `listByCompanyPageForOwner(userId, pageId)` - asserts page ownership
  via `companyPages.getMine(userId, pageId)` (404s if not owner), returns ALL statuses for
  that page, newest first, lean, capped 200.
- `jobs.controller.ts`: `@Get('by-page/:pageId/manage')` (authed; JwtAuthGuard already on
  controller) -> `listByCompanyPageForOwner(req.user.sub, pageId)`. Distinct path depth
  from the public `by-page/:pageId`, no route collision.
- Test (`jobs.service.vitest.ts`): asserts ownership check (getMine called) + returns the
  model's list (all statuses).

### Web

- `jobs.actions.ts`: `getCompanyPageJobsForOwner(pageId)` -> GET `by-page/:pageId/manage`.
- New `features/connect/entities/CompanyJobsManager.tsx` (manage console Jobs tab):
  - Props: `{ pageId, pageName, jobs: Job[] }` (all statuses).
  - Header: "Open positions"/"Jobs" title + "Post a job" (reuses JobComposer +
    companyPageId, router.refresh on post).
  - Status filter chips: All / Open / Filled / Closed, each with a live count
    (derived from `jobs`). Default All.
  - List of `CompanyJobRow` (made status-aware, see below). Empty -> ConnectEmptyState.
- `CompanyJobRow.tsx` made status-aware (used by BOTH the public section and the manager):
  - Right side: visitor -> View & apply; owner + open -> Close (Popconfirm); owner +
    non-open -> no action (the status chip conveys state; the title links to detail).
  - Status chip: extend to also show `closed` (currently filled / closing-soon only).
- `app/connect/pages/[id]/page.tsx`: fetch `getCompanyPageJobsForOwner(id)` (full history)
  instead of `getCompanyPageJobs(id)`; pass to `ManageCompanyPageScreen`.
- `ManageCompanyPageScreen.tsx`:
  - Honor `?tab=` deep-link (read `useSearchParams`, init the tab; mirrors
    `CompanyPageView`). So `?tab=jobs` lands on the Jobs tab.
  - Jobs tab renders `<CompanyJobsManager>` (not `<CompanyJobsSection isOwner>`).
  - Fix the `openJobs` KPI count: now `jobs` holds all statuses, so count open only
    (`jobs.filter(j => j.status === 'open').length`), falling back to `stat?.openJobs`.
- `CompanyJobsSection.tsx` (public company page): repoint "Manage in Jobs ->" from
  `/connect/jobs?tab=mine` to `/connect/pages/${pageId}?tab=jobs`.

### i18n (4 locales)

- New `connect.companyPage` keys: `jobsFilterAll`, `jobsFilterOpen`, `jobsFilterFilled`,
  `jobsFilterClosed` (or reuse `connect.jobs.status.*` for Open/Filled/Closed + add only
  `jobsFilterAll`). Reuse existing `jobsOpenPositions`, `jobsManageInJobs`, `jobsPostCta`,
  `jobsStatApplicants/Views`, `jobsEmptyOwner*`, close-confirm keys.

## Data flow

```
Public company page (/connect/company/[slug], owner)
  -> CompanyJobsSection (open-only) + "Manage in Jobs ->" -> /connect/pages/[id]?tab=jobs

Manage console (/connect/pages/[id]?tab=jobs)
  -> route: getCompanyPageJobsForOwner(id)  [GET by-page/:id/manage, owner, all statuses]
  -> ManageCompanyPageScreen (Jobs tab) -> CompanyJobsManager
       -> status filter + counts + CompanyJobRow list (rows -> /connect/jobs/[id])
       -> Post a job (JobComposer)
```

## Testing / verification

- BE: `nest build` clean, eslint clean, jobs.service.vitest green (+ new test).
- Web: tsc clean of new errors, eslint clean on changed files, check:i18n parity.
- Routes compile (200). Live UI = owner (PIN-gated).
- Manual matrix: console Jobs tab shows open+closed+filled with working filter + counts;
  closing a job (from detail) keeps it visible under Closed; "Manage in Jobs" deep-links
  to the Jobs tab; public section still open-only.

## Files

- Create: `features/connect/entities/CompanyJobsManager.tsx`.
- Modify: `jobs.service.ts`, `jobs.controller.ts`, `jobs.service.vitest.ts` (BE);
  `jobs.actions.ts`, `CompanyJobRow.tsx`, `CompanyJobsSection.tsx`,
  `ManageCompanyPageScreen.tsx`, `app/connect/pages/[id]/page.tsx`, 4 message catalogs.
