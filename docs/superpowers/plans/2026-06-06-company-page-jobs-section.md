# Company Page Jobs Section Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. This is frontend work in
> a codebase that does NOT practice strict TDD for React components; verification is
> `tsc --noEmit` + `eslint` (changed files) + `check:i18n` + live review, plus one
> focused unit test for the pure role logic. Owner stages + commits (assistant runs no
> git). Spec: `docs/superpowers/specs/2026-06-06-company-page-jobs-section-design.md`.

**Goal:** Make the company page jobs section role-aware - candidates get a compact
"View & apply" list, owners get Post a job + live stats + close + "Manage in Jobs →" -
reusing `ConnectEmptyState`, `JobComposer`, and the existing job actions.

**Architecture:** One new `CompanyJobsSection` (role-aware) replaces `CompanyPageJobsList`,
mounted in `CompanyPageView` (in-app, isOwner derived), the public SEO mirror
(isOwner=false), and `ManageCompanyPageScreen` (isOwner=true). A new `CompanyJobRow` is the
compact row. The in-app route derives `isOwner` via `getMyConnectProfile()`.

**Tech Stack:** Next.js (App Router) RSC + client components, AntD v6, lucide-react,
next-intl (en/gu/gu-en/hi-en), cr- design tokens.

i18n group: **`connect.companyPage`** (locked).

---

## File Structure

- Create `features/connect/entities/CompanyJobRow.tsx` - compact role-aware job row.
- Create `features/connect/entities/CompanyJobsSection.tsx` - panel + states + owner flows.
- Create `features/connect/entities/__tests__/companyJobs.logic.test.ts` - pure role logic.
- Modify `features/connect/entities/CompanyPageView.tsx` - isOwner, tab visibility, use section.
- Modify `app/connect/company/[slug]/page.tsx` - derive isOwner, pass through.
- Modify `app/(connect-public)/company/[slug]/page.tsx` - pass isOwner={false}.
- Modify `features/connect/entities/ManageCompanyPageScreen.tsx` - jobs tab uses section.
- Modify `app/connect/pages/[id]/loading.tsx`, `app/connect/company/[slug]/loading.tsx`
  (+ public mirror if present) - skeleton mirrors the panel.
- Modify `app/messages/{en,gu,gu-en,hi-en}.json` - new keys.
- Delete `features/connect/entities/CompanyPageJobsList.tsx`.

---

## Task 1: i18n keys (4 locales)

**Files:** Modify `app/messages/{en,gu,gu-en,hi-en}.json` under `connect.companyPage`.

- [ ] **Step 1:** Add these keys (en shown; translate per locale, no em-dashes):

```jsonc
"jobsOpenPositions": "Open positions",
"jobsManageInJobs": "Manage in Jobs",
"jobsPostCta": "Post a job",
"jobsEmptyOwnerTitle": "No open positions",
"jobsEmptyOwnerBody": "Post a role and it shows on your page and in the Jobs board. Applicants come straight to your inbox.",
"jobsViewAndApply": "View & apply",
"jobsStatApplicants": "{count, plural, one {# applicant} other {# applicants}}",
"jobsStatViews": "{count, plural, one {# view} other {# views}}",
"jobsClose": "Close",
"jobsCloseConfirmTitle": "Close this job?",
"jobsCloseConfirmBody": "It will stop showing on your page and the Jobs board. You cannot reopen it.",
"jobsCloseConfirmOk": "Close job",
"jobsCloseSuccess": "Job closed",
"jobsListAriaOwner": "Open positions at {name} (manage)",
"jobsListAriaViewer": "Open positions at {name}",
"jobsRowAria": "{title} - view and apply"
```

gu / gu-en / hi-en: mirror the existing `connect.jobs` tone already in each catalog.

- [ ] **Step 2:** Verify parity. Run: `npm run check:i18n` → Expected: `OK - N keys ...`.

---

## Task 2: `CompanyJobRow`

**Files:** Create `features/connect/entities/CompanyJobRow.tsx`.

- [ ] **Step 1:** Write the component. Reuse `JobCard`'s role-tile logic inline (custom
      roles → Briefcase). Title is the link (no nested interactives); right side role-aware.

```tsx
'use client';

/**
 * CompanyJobRow - one compact open-position row in a company page's jobs section
 * (CompanyJobsSection). Lighter than the board's JobCard: role tile + title +
 * worktype pill + one meta line. Right side is role-aware - candidates get a
 * "View & apply" link to the job detail (where the apply flow lives); the owner
 * gets live applicants/views stats + a Close action. Keep role->icon in sync
 * with JobCard.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Popconfirm } from 'antd';
import {
  type LucideIcon,
  Brush,
  Briefcase,
  Cog,
  Eye,
  MapPin,
  PenTool,
  Scissors,
  Send,
  Users,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { categoryLabel } from '../search.types';
import type { Job, JobRole } from '../jobs/jobs.types';

const ROLE_ICON: Record<JobRole, LucideIcon> = {
  karigar: Brush,
  helper: Scissors,
  operator: Cog,
  designer: PenTool,
  supervisor: Users,
};
const GOLD_ROLES: JobRole[] = ['karigar', 'helper'];

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function CompanyJobRow({
  job,
  isOwner,
  onClose,
  closing,
}: {
  job: Job;
  isOwner: boolean;
  onClose?: (jobId: string) => void;
  closing?: boolean;
}) {
  const t = useTranslations('connect.jobs');
  const tPage = useTranslations('connect.companyPage');
  const tCat = useTranslations('connect.search.listing.category');

  const Icon: LucideIcon = (job.role && ROLE_ICON[job.role as JobRole]) || Briefcase;
  const goldTile = job.role ? GOLD_ROLES.includes(job.role as JobRole) : false;
  const wage =
    job.wageMin != null && job.wageMax != null
      ? `${rupees(job.wageMin)} - ${rupees(job.wageMax)}`
      : job.wageMin != null
        ? rupees(job.wageMin)
        : null;
  const location = [job.location?.district, job.location?.state].filter(Boolean).join(', ');
  const meta = [
    wage ? `${wage}${job.wageType ? ` / ${t(`wageType.${job.wageType}`)}` : ''}` : null,
    location || null,
    job.openings > 1 ? t('openingsCount', { count: job.openings }) : null,
  ].filter(Boolean);

  return (
    <div
      className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center"
        style={{
          borderRadius: 'var(--cr-radius-md)',
          background: goldTile ? 'var(--cr-accent-light)' : 'var(--cr-primary-light)',
          color: goldTile ? 'var(--cr-gold-700)' : 'var(--cr-primary)',
        }}
      >
        <Icon size={20} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/connect/jobs/${job._id}`}
            className="text-[15px] font-semibold no-underline"
            style={{ color: 'var(--cr-text)' }}
          >
            {job.title}
          </Link>
          {job.wageType && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: 'var(--cr-accent-light)', color: 'var(--cr-gold-700)' }}
            >
              {t(`workType.${job.wageType}`)}
            </span>
          )}
        </div>
        <div
          className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {meta.map((m, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i === 1 && location ? <MapPin size={12} aria-hidden /> : null}
              {m}
              {i < meta.length - 1 ? <span aria-hidden>·</span> : null}
            </span>
          ))}
          {meta.length === 0 && <span>{categoryLabel(job.category, tCat)}</span>}
        </div>
        {isOwner && (
          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11.5px]"
            style={{ color: 'var(--cr-text-4)' }}
          >
            <span
              className="inline-flex items-center gap-1"
              style={{ color: 'var(--cr-primary)', fontWeight: 600 }}
            >
              <Send size={12} aria-hidden />{' '}
              {tPage('jobsStatApplicants', { count: job.applicationsCount })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye size={12} aria-hidden /> {tPage('jobsStatViews', { count: job.views })}
            </span>
          </div>
        )}
      </div>

      <div className="shrink-0">
        {isOwner ? (
          <Popconfirm
            title={tPage('jobsCloseConfirmTitle')}
            description={tPage('jobsCloseConfirmBody')}
            okText={tPage('jobsCloseConfirmOk')}
            okButtonProps={{ danger: true, loading: closing }}
            onConfirm={() => onClose?.(job._id)}
          >
            <DsButton dsVariant="ghost" dsSize="sm">
              {tPage('jobsClose')}
            </DsButton>
          </Popconfirm>
        ) : (
          <DsButton dsVariant="primary" dsSize="sm" href={`/connect/jobs/${job._id}`}>
            {tPage('jobsViewAndApply')}
          </DsButton>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Verify. Run: `npx tsc --noEmit` (expect no NEW errors referencing
      CompanyJobRow) and `npx eslint features/connect/entities/CompanyJobRow.tsx` (clean).
      Confirm `DsButton` supports `href`, `dsSize`, `dsVariant` (it does - see ConnectEmptyState

* ManageCompanyPageScreen). Confirm `Job.views`/`applicationsCount` exist (they do).

---

## Task 3: `CompanyJobsSection`

**Files:** Create `features/connect/entities/CompanyJobsSection.tsx`.

- [ ] **Step 1:** Write the panel. Empty+owner → `ConnectEmptyState`; empty+viewer →
      `null` (parent hides the tab); populated → header + rows. Owner hosts `JobComposer` +
      close flow; `router.refresh()` after mutations.

```tsx
'use client';

/**
 * CompanyJobsSection - the role-aware Jobs section on a company page. Owner sees
 * Post a job + "Manage in Jobs ->" + per-row stats/close; everyone else sees a
 * compact "View & apply" list. Used in CompanyPageView (in-app, isOwner derived),
 * the public SEO mirror (isOwner=false), and ManageCompanyPageScreen (isOwner).
 * Posting reuses JobComposer with companyPageId; closing reuses closeJob. After a
 * mutation we router.refresh() so the SSR job list + stats re-read. Cross-module:
 * jobs posted here appear on the Connect jobs board attributed to this page.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { message } from 'antd';
import { ArrowRight, Briefcase } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
import { parseApiError } from '@/lib/utils';
import JobComposer from '../jobs/JobComposer';
import CompanyJobRow from './CompanyJobRow';
import { createJob, closeJob } from '../jobs/jobs.actions';
import type { Job, CreateJobPayload } from '../jobs/jobs.types';

export default function CompanyJobsSection({
  pageId,
  pageName,
  jobs,
  isOwner,
}: {
  pageId: string;
  pageName: string;
  jobs: Job[];
  isOwner: boolean;
}) {
  const t = useTranslations('connect.companyPage');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const handlePost = async (payload: CreateJobPayload) => {
    setPosting(true);
    try {
      const res = await createJob(payload);
      if (!res.ok) {
        msgApi.error(res.error);
        return;
      }
      void msgApi.success(t('jobsPostCta'));
      setComposerOpen(false);
      router.refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setPosting(false);
    }
  };

  const handleClose = async (jobId: string) => {
    setClosingId(jobId);
    try {
      const res = await closeJob(jobId);
      if (!res.ok) {
        msgApi.error(res.error);
        return;
      }
      void msgApi.success(t('jobsCloseSuccess'));
      router.refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setClosingId(null);
    }
  };

  // Viewer with no open jobs: render nothing (the parent also hides the tab).
  if (!isOwner && jobs.length === 0) return null;

  return (
    <section>
      {ctx}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t('jobsOpenPositions')}
        </h2>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Link
              href="/connect/jobs?tab=mine"
              className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline"
              style={{ color: 'var(--cr-primary)' }}
            >
              {t('jobsManageInJobs')} <ArrowRight size={14} aria-hidden />
            </Link>
            {jobs.length > 0 && (
              <DsButton
                dsVariant="primary"
                dsSize="sm"
                icon={<Briefcase size={15} aria-hidden />}
                onClick={() => setComposerOpen(true)}
              >
                {t('jobsPostCta')}
              </DsButton>
            )}
          </div>
        )}
      </div>

      {jobs.length === 0 ? (
        <ConnectEmptyState
          variant="inline"
          icon={<Briefcase size={24} aria-hidden />}
          title={t('jobsEmptyOwnerTitle')}
          description={t('jobsEmptyOwnerBody')}
          primaryAction={{ label: t('jobsPostCta'), onClick: () => setComposerOpen(true) }}
        />
      ) : (
        <ul
          className="m-0 grid list-none gap-3 p-0"
          aria-label={t(isOwner ? 'jobsListAriaOwner' : 'jobsListAriaViewer', { name: pageName })}
        >
          {jobs.map((job) => (
            <li key={job._id}>
              <CompanyJobRow
                job={job}
                isOwner={isOwner}
                onClose={handleClose}
                closing={closingId === job._id}
              />
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <JobComposer
          open={composerOpen}
          submitting={posting}
          companyPageId={pageId}
          onClose={() => setComposerOpen(false)}
          onSubmit={handlePost}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2:** Verify. Run: `npx tsc --noEmit` (no new errors) +
      `npx eslint features/connect/entities/CompanyJobsSection.tsx` (clean). Confirm
      `createJob`, `closeJob` exist in `jobs.actions.ts` (they do) and `JobComposer` accepts
      `companyPageId` (it does).

---

## Task 4: Wire into `CompanyPageView`

**Files:** Modify `features/connect/entities/CompanyPageView.tsx`.

- [ ] **Step 1:** Add `isOwner` prop (default false) to `Props` and the signature.

```tsx
  /** True when the signed-in viewer owns this page (in-app only). */
  isOwner?: boolean;
```

```tsx
export default function CompanyPageView({
  page,
  erpLinked,
  followerCount,
  initialFollowing = false,
  postsPage,
  jobs = [],
  products = [],
  rating,
  isOwner = false,
}: Props) {
```

- [ ] **Step 2:** Owner always sees the Jobs tab; viewer only when jobs exist. Replace the
      `jobs` entry in the `tabs` array:

```tsx
    ...(jobs.length > 0 || isOwner ? (['jobs'] as const) : []),
```

- [ ] **Step 3:** Replace the Jobs `<section>` (the `shows('jobs') && jobs.length > 0`
      block) with the role-aware section (drop the `jobs.length > 0` guard so the owner empty
      state renders; keep the `shows('jobs')` guard):

```tsx
{
  /* Jobs (role-aware: owner manages, viewer applies) */
}
{
  shows('jobs') && (
    <section className="mt-6 px-4">
      <CompanyJobsSection pageId={page._id} pageName={page.name} jobs={jobs} isOwner={isOwner} />
    </section>
  );
}
```

- [ ] **Step 4:** Swap the import `CompanyPageJobsList` → `CompanyJobsSection`.

```tsx
import CompanyJobsSection from './CompanyJobsSection';
```

- [ ] **Step 5:** Verify. Run: `npx tsc --noEmit` + `npx eslint features/connect/entities/CompanyPageView.tsx`.

---

## Task 5: Derive `isOwner` in the routes

**Files:** Modify `app/connect/company/[slug]/page.tsx` and
`app/(connect-public)/company/[slug]/page.tsx`.

- [ ] **Step 1 (in-app):** Import the profile action and add it to the `Promise.all`,
      then compute and pass `isOwner`.

```tsx
import { getMyConnectProfile } from '@/features/connect/profile.actions';
```

```tsx
const [postsRes, jobsRes, productsRes, followRes, promoted, meRes] = await Promise.all([
  getCompanyPagePosts(page._id),
  getCompanyPageJobs(page._id),
  getCompanyPageListings(page._id),
  getCompanyPageFollowState(page._id),
  resolvePromotedRailListing('company_page'),
  getMyConnectProfile(),
]);
const isOwner = meRes.ok && meRes.data.userId === page.ownerUserId;
```

Add `isOwner={isOwner}` to the `<CompanyPageView .../>` props.

- [ ] **Step 2 (public SEO):** Open `app/(connect-public)/company/[slug]/page.tsx`. It is
      logged-out; pass `isOwner={false}` explicitly to `<CompanyPageView>` (or rely on the
      default - but pass it for clarity). Do NOT add the profile call here.

- [ ] **Step 3:** Verify. Run: `npx tsc --noEmit`. Confirm `ConnectProfile.userId` exists
      (used by the job-detail route) and `CompanyPage.ownerUserId` exists (it does - used by
      SellerReviews).

---

## Task 6: Wire into `ManageCompanyPageScreen` jobs tab

**Files:** Modify `features/connect/entities/ManageCompanyPageScreen.tsx`.

- [ ] **Step 1:** Replace the entire `{tab === 'jobs' && (...)}` block (the bespoke header

* Post button + `CompanyPageJobsList`) with:

```tsx
{
  tab === 'jobs' && (
    <CompanyJobsSection pageId={page._id} pageName={page.name} jobs={jobs} isOwner />
  );
}
```

- [ ] **Step 2:** Add the import and remove the now-unused `CompanyPageJobsList` import.
      If `jobComposerOpen`/`setJobComposerOpen` state and the JobComposer render in this file
      were ONLY for the jobs tab, remove them (the section now owns the composer). Grep first:
      `rg "jobComposerOpen|JobComposer|CompanyPageJobsList" features/connect/entities/ManageCompanyPageScreen.tsx` - remove only what is exclusively the jobs-tab composer; leave anything shared.

```tsx
import CompanyJobsSection from './CompanyJobsSection';
```

- [ ] **Step 3:** Verify. Run: `npx tsc --noEmit` +
      `npx eslint features/connect/entities/ManageCompanyPageScreen.tsx`. Watch for unused
      imports/vars (Briefcase icon, DsButton if no longer used in this file, etc.) - remove
      orphans your change created.

---

## Task 7: Retire `CompanyPageJobsList`

**Files:** Delete `features/connect/entities/CompanyPageJobsList.tsx`; clean its i18n.

- [ ] **Step 1:** Confirm no remaining importers:
      `rg "CompanyPageJobsList" --type ts --type tsx` → expect zero. Delete the file.

- [ ] **Step 2:** Its old keys `connect.companyPage.jobsEmpty` and `jobsListAria` - grep
      for remaining uses: `rg "jobsEmpty|jobsListAria" app/ features/`. If unused, remove from
      all 4 catalogs (keep parity). If still used elsewhere, leave them.

- [ ] **Step 3:** Verify. Run: `npx tsc --noEmit` + `npm run check:i18n`.

---

## Task 8: Loading skeletons (binding rule)

**Files:** Modify `app/connect/pages/[id]/loading.tsx`,
`app/connect/company/[slug]/loading.tsx`, and the public mirror loading file if it exists.

- [ ] **Step 1:** In each, where the jobs panel renders, mirror the new anatomy: a header
      row (title bar + a button block) + 2-3 compact rows (a `SkeletonCircle`-ish tile + two
      `SkeletonLine`s + a right `SkeletonButton`). Use the existing primitives from
      `components/connect/Skeleton.tsx` (server-only, `aria-hidden` root already in place).
      Match spacing (`gap-3`, `p-3/p-4`, `radius-lg`).

- [ ] **Step 2:** Verify. Run: `npx tsc --noEmit`. Visually confirm via the running dev
      server that the swap is shift-free (owner verifies live).

---

## Task 9: Pure role-logic unit test + final sweep

**Files:** Create `features/connect/entities/__tests__/companyJobs.logic.test.ts`.

- [ ] **Step 1:** Extract the two pure decisions into tiny exported helpers in
      `CompanyJobsSection.tsx` (or a sibling `companyJobs.logic.ts`) so they are unit-testable
      without rendering:

```ts
export const showJobsTab = (jobCount: number, isOwner: boolean) => isOwner || jobCount > 0;
export const showOwnerEmpty = (jobCount: number, isOwner: boolean) => isOwner && jobCount === 0;
```

Use `showJobsTab` in `CompanyPageView`'s tab array and `showOwnerEmpty`-style branching in
the section (keep the render logic equivalent).

- [ ] **Step 2:** Write the test:

```ts
import { describe, it, expect } from 'vitest';
import { showJobsTab, showOwnerEmpty } from '../companyJobs.logic';

describe('company jobs visibility', () => {
  it('owner always sees the tab; viewer only with jobs', () => {
    expect(showJobsTab(0, true)).toBe(true);
    expect(showJobsTab(0, false)).toBe(false);
    expect(showJobsTab(2, false)).toBe(true);
  });
  it('only the owner sees the empty state', () => {
    expect(showOwnerEmpty(0, true)).toBe(true);
    expect(showOwnerEmpty(0, false)).toBe(false);
    expect(showOwnerEmpty(2, true)).toBe(false);
  });
});
```

- [ ] **Step 3:** Run: `npx vitest run features/connect/entities/__tests__/companyJobs.logic.test.ts`
      → Expected: PASS.

- [ ] **Step 4:** Final sweep:
  - `npx tsc --noEmit` → no new errors (pre-existing `app/connect/companies/page.tsx`
    errors are unrelated WIP and may remain).
  - `npx eslint` on every changed/created file → clean.
  - `npm run check:i18n` → parity OK.
  - Banned-AntD self-check (CLAUDE.md): `rg -n "<Modal[^>]*visible=|destroyOnClose|overlayStyle="`
    on changed files → zero.

---

## Self-Review (done)

- **Spec coverage:** role-aware section (T3/T4/T5/T6), compact row + View&apply (T2),
  owner empty/populated + Post + Close + Manage link + stats (T2/T3), candidate
  populated + hidden-when-empty (T3/T4), isOwner threading (T5), manage console mirror
  (T6), retire list (T7), skeletons (T8), i18n 4-locale (T1), unit test (T9). All mapped.
- **Deferred (spec non-goal):** edit-job (no BE endpoint) - belongs to the next
  (job-detail) screen.
- **Type consistency:** `CompanyJobsSection` props `{pageId, pageName, jobs, isOwner}`
  used identically in T3/T4/T6; `CompanyJobRow` `{job, isOwner, onClose, closing}` matches
  its call site in T3.

## Handoff

Owner stages + commits. After build: one consolidated verification report (per the
"implement full scope, owner tests at end" preference).
