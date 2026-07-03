# Company Page Jobs Section - role-aware redesign

Date: 2026-06-06
Status: Approved (design), ready for implementation plan
Scope: Screen 1 of 3. Next: job-detail screen, then jobs board (both viewer + owner).

## Problem

The "Jobs" section on a company page is thin and not role-aware. Today:

- **In-app company page** (`/connect/company/[slug]`, `CompanyPageView`): a heading +
  `CompanyPageJobsList` (a plain list of `JobCard`s), or one line of grey text when
  empty. Read-only for everyone, including the owner. The Jobs tab only renders when
  `jobs.length > 0`, so no empty state is ever shown.
- **Manage console** (`/connect/pages/[id]`, `ManageCompanyPageScreen` jobs tab): a
  heading + hint + "Post a job" button + the same thin `CompanyPageJobsList`.

The target (prototype screenshots) is richer: an "Open positions" panel, a warm
`ConnectEmptyState` ("No open positions" + briefcase tile + "Post a job"), compact rows
with a **View & apply** action for candidates, and owner affordances (**Post a job**,
**Manage in Jobs →**, live applicant/view stats, close).

## Decisions (owner-approved)

1. **One role-aware section.** The company page jobs section is owner-aware: the owner
   on their own page sees manage affordances; everyone else (and logged-out) sees the
   candidate apply view. Same component, mirrored in the manage console.
2. **Light entry point.** On the company page the owner gets: open positions with live
   stats (applicants/views), Post a job, close per job, and **Manage in Jobs →** for the
   board. Deep applicant review (shortlist/accept/decline, messaging) stays on the
   job-detail + jobs-board screens (built next).
3. **Candidate "View & apply"** routes to the existing job-detail page (the apply flow
   already lives there); no inline apply form is duplicated here.

## Non-goals

- No inline applicant management on this screen (stays on job detail / board).
- No "edit a job" - there is **no `PATCH /connect/jobs/:id` endpoint** (BE has only
  create + close). Edit belongs on the job-detail screen (next), with the new endpoint.
- No change to the logged-out SEO page beyond keeping it the read-only candidate view.

## Architecture

### New: `CompanyJobsSection` (client component)

Replaces `CompanyPageJobsList`. Role-aware. Props:

```ts
interface Props {
  pageId: string;
  pageName: string;
  jobs: Job[]; // the page's open jobs (existing getCompanyPageJobs)
  isOwner: boolean; // owner sees manage affordances; else candidate view
}
```

Renders:

- **Panel header**: "Open positions" title; right side = `Manage in Jobs →` link
  (`/connect/jobs?tab=mine`) + a `Post a job` `DsButton` - owner only.
- **Body**:
  - empty + owner → `ConnectEmptyState` (briefcase, "No open positions", body, primary
    "Post a job").
  - empty + candidate → render nothing (the tab itself is hidden for candidates; see
    tab-visibility below).
  - populated → `<ul>` of `CompanyJobRow`.
- Owner-only: hosts the existing `JobComposer` (with `companyPageId={pageId}`) and a
  close-confirm flow. After post/close → `router.refresh()` so SSR stats re-read.

Cross-module links: posts jobs into the jobs module (board attribution by page);
reuses `JobComposer` (jobs), `closeJob`/`createJob` actions (jobs), `ConnectEmptyState`
(connect shell). Keep `companyPageId` wiring in sync with the manage console.

### New: `CompanyJobRow` (client component)

Compact row (lighter than board `JobCard`). Left role-tile (reuses `JobCard`'s
role→icon + gold/indigo tile logic; custom roles fall back to Briefcase), title +
worktype pill, one meta line: pay · location · openings · shift/onsite. Right side is
role-aware:

- candidate → **View & apply** `DsButton` → `/connect/jobs/${job._id}`. Whole row also
  links to detail for pointer/keyboard.
- owner → live `applicants · views` stats + a quiet **Close** button (confirm dialog).

A11y: row is a link with an `aria-label`; action buttons have explicit labels; the
close confirm traps focus (AntD `Modal.confirm` or `Popconfirm`).

### Retire `CompanyPageJobsList`

Both its mount points (`CompanyPageView`, `ManageCompanyPageScreen`) move to
`CompanyJobsSection`. Delete the file and its now-unused i18n (`jobsEmpty`,
`jobsListAria`) if nothing else references them.

## Data flow / isOwner

- **In-app route** `app/connect/company/[slug]/page.tsx`: add `getMyConnectProfile()` to
  the existing `Promise.all`; `isOwner = profileRes.ok && profile.userId ===
page.ownerUserId`. Pass `isOwner` + `pageId` into `CompanyPageView`, which passes them
  to `CompanyJobsSection`. (Mirrors the job-detail route's owner check.)
- **Public SEO route** `app/(connect-public)/company/[slug]/page.tsx`: `isOwner={false}`
  (logged-out). Candidate view only.
- **Manage console** `ManageCompanyPageScreen` jobs tab: replace the bespoke header +
  list with `<CompanyJobsSection isOwner pageId={page._id} pageName={page.name}
jobs={jobs} />`. The existing tab already owns `JobComposer` state; that moves into
  `CompanyJobsSection`, so the manage screen's local `jobComposerOpen` for jobs is
  removed (verify no other consumer).

## Tab visibility (CompanyPageView)

- Candidate: Jobs tab shows only when `jobs.length > 0` (unchanged - no dead empty tab
  for strangers).
- Owner: Jobs tab **always** shows (so they can post into an empty page). Requires
  threading `isOwner` into the `tabs` computation.

## i18n (all 4 locales: en, gu, gu-en, hi-en)

New keys under `connect.companyPage` (or a new `connect.companyJobs` group - pick one and
be consistent):

- `openPositions` (panel title), `manageInJobs`, `postJob`
- `emptyOwnerTitle` ("No open positions"), `emptyOwnerBody`
- `viewAndApply`
- `stat.applicants` ({count}), `stat.views` ({count})
- `close`, `closeConfirmTitle`, `closeConfirmBody`, `closeConfirmOk`, `closeSuccess`
- row `aria-label`s + list `aria-label`

No em-dashes. Plain, day-1-friendly copy. Reuse existing `connect.jobs.*` worktype/role
labels where possible (already 4-locale complete).

## Loading skeletons (binding rule)

- `app/connect/pages/[id]/loading.tsx`: mirror the new owner panel (header row +
  3 compact job rows).
- `app/connect/company/[slug]/loading.tsx` (and the public mirror if present): mirror the
  populated jobs panel.

## Testing / verification

- `tsc --noEmit` clean of new errors; eslint clean on changed files; `check:i18n` parity.
- Reuse the running dev server for live checks (PIN-gated; owner verifies the live UI).
- Manual matrix: owner empty, owner populated (close + post + manage link + stats),
  candidate populated (view & apply), candidate empty (tab hidden), logged-out SEO page
  (candidate view, no owner affordances).

## Files touched (anticipated)

- New: `features/connect/entities/CompanyJobsSection.tsx`,
  `features/connect/entities/CompanyJobRow.tsx`
- Edit: `features/connect/entities/CompanyPageView.tsx` (isOwner + tab visibility + use
  new section), `app/connect/company/[slug]/page.tsx` (+ public mirror),
  `features/connect/entities/ManageCompanyPageScreen.tsx` (jobs tab), the two
  `loading.tsx` files, 4 message catalogs.
- Delete: `features/connect/entities/CompanyPageJobsList.tsx`.
