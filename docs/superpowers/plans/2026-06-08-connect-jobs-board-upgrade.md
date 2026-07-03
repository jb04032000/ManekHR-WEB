# Connect Jobs Board Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/connect/jobs` into a server-driven faceted job board with a counts-rich filter rail, employer identity + inline Save/Apply cards (list + grid), and first-party promoted jobs - audience-tuned for low-literacy mobile users.

**Architecture:** The Open tab becomes server-driven: results from `GET /connect/jobs/board` (paginated) + counts from a new `GET /connect/jobs/board/facets` ($facet aggregation). Filters live in the URL via `window.history.replaceState` (App Router has no shallow `router.replace`); the client board fetches via server actions with an AbortController/request-id stale guard. Cards are `<div>` + stretched-link title + layered Save/Apply buttons. Promoted jobs come from a read-only, non-billing ads resolver.

**Tech Stack:** NestJS + Mongoose (backend), Next.js App Router + AntD v6 + cr- tokens + next-intl (web).

**Spec:** `docs/superpowers/specs/2026-06-08-connect-jobs-board-upgrade-design.md` (v2, verification-passed).

**Binding constraints:**

- Commit on `main` in each repo; explicit `git add <paths>`; end commit bodies with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Pre-commit hooks run (prettier/eslint/i18n) - let them; fix causes, never `--no-verify`.
- BE: typecheck via `npx nest build`; run ONLY the touched test file with `npx vitest run <file> --no-file-parallelism`. Never whole-project tsc/vitest (OOM).
- Web: `npx eslint <file>` per changed file; `node scripts/check-i18n.js` for i18n; never whole-project tsc.
- No em-dashes anywhere. AntD v6 only (`open`/`destroyOnHidden`, no deprecated props). Leave a code comment (what / cross-module link / gotcha) on each new non-trivial piece.
- **Interaction & Cursor Contract** (spec lines 39-46) is binding for every interactive element in every web task.

**Phasing:** 6 phases, a verify gate between each. Phases 1-2 + 5 touch the backend; 1-6 touch web.

---

## Phase 1 - Server-driven foundation (backend filters/facets + web data layer + loading)

### Task 1.1: Multi-select board filters (DTO + helper)

**Files:**

- Modify: `crewroster-backend/src/modules/connect/jobs/dto/job.dto.ts` (`BoardQueryDto`)
- Modify: `crewroster-backend/src/modules/connect/jobs/board-query.helpers.ts` (`buildBoardFilter`)
- Test: `crewroster-backend/src/modules/connect/jobs/__tests__/board-query.vitest.ts` (create)

- [ ] **Step 1: Write failing tests for plural filters + precedence**

```ts
import { describe, it, expect } from 'vitest';
import { buildBoardFilter } from '../board-query.helpers';

describe('buildBoardFilter multi-select', () => {
  const now = new Date('2026-06-08T00:00:00Z');
  it('ORs within a facet: districts -> $in (case-insensitive)', () => {
    const f = buildBoardFilter({ districts: 'Varachha,Ring Road' }, now) as any;
    // district matches either, case-insensitive
    expect(f['location.district']).toBeDefined();
  });
  it('ANDs across facets: roles + employmentTypes both present', () => {
    const f = buildBoardFilter(
      { roles: 'karigar,operator', employmentTypes: 'full_time' },
      now,
    ) as any;
    expect(f.role).toEqual({ $in: ['karigar', 'operator'] });
    expect(f.employmentType).toEqual({ $in: ['full_time'] });
  });
  it('plural supersedes singular when both present', () => {
    const f = buildBoardFilter({ role: 'designer', roles: 'karigar,operator' }, now) as any;
    expect(f.role).toEqual({ $in: ['karigar', 'operator'] });
  });
  it('skills remain $in', () => {
    const f = buildBoardFilter({ skills: 'Aari,Zardozi' }, now) as any;
    expect(f.skills).toEqual({ $in: ['Aari', 'Zardozi'] });
  });
});
```

- [ ] **Step 2: Run, verify fail** - `cd crewroster-backend && npx vitest run src/modules/connect/jobs/__tests__/board-query.vitest.ts --no-file-parallelism` -> FAIL.

- [ ] **Step 3: Add plural params to `BoardQueryDto`** (after the singular ones), each optional csv string, max length 400, trimmed:

```ts
/** Comma-separated multi-select. Plural supersedes the singular field when both
 *  are sent (see buildBoardFilter). Keeps singular params working (back-compat
 *  for the job-detail "Similar jobs" deep link). */
@IsOptional() @IsString() @MaxLength(400) districts?: string;
@IsOptional() @IsString() @MaxLength(400) roles?: string;
@IsOptional() @IsString() @MaxLength(400) employmentTypes?: string;
@IsOptional() @IsString() @MaxLength(400) machineTypes?: string;
```

- [ ] **Step 4: Implement plural handling in `buildBoardFilter`.** Add a `csv` helper and, for each field, prefer plural over singular. District/machineType use case-insensitive regex `$in` via `$or`; role/employmentType use plain `$in`:

```ts
const csv = (s?: string) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const ci = (v: string) => new RegExp(`^${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
// role
const roles = csv(query.roles);
if (roles.length) filter.role = { $in: roles };
else if (query.role) filter.role = query.role;
// employmentType
const ets = csv(query.employmentTypes);
if (ets.length) filter.employmentType = { $in: ets };
else if (query.employmentType) filter.employmentType = query.employmentType;
// districts (case-insensitive OR)
const districts = csv(query.districts);
if (districts.length) filter['location.district'] = { $in: districts.map(ci) };
else if (query.district) filter['location.district'] = { $regex: new RegExp(query.district, 'i') };
// machineTypes (free-text, case-insensitive OR)
const machines = csv(query.machineTypes);
if (machines.length) filter.machineType = { $in: machines.map(ci) };
```

- [ ] **Step 5: Run tests -> PASS.** Then `npx nest build` -> compiles.

- [ ] **Step 6: Commit**

```bash
git add src/modules/connect/jobs/dto/job.dto.ts src/modules/connect/jobs/board-query.helpers.ts src/modules/connect/jobs/__tests__/board-query.vitest.ts
git commit -m "feat(connect/jobs): multi-select board filters (plural supersedes singular)"
```

### Task 1.2: Facet aggregation service + endpoint + indexes

**Files:**

- Modify: `crewroster-backend/src/modules/connect/jobs/jobs.service.ts` (add `boardFacets`)
- Modify: `crewroster-backend/src/modules/connect/jobs/jobs.controller.ts` (add `GET board/facets`)
- Modify: `crewroster-backend/src/modules/connect/jobs/dto/job.dto.ts` (add `BoardFacetsQueryDto`)
- Modify: `crewroster-backend/src/modules/connect/jobs/schemas/job.schema.ts` (indexes)
- Test: `crewroster-backend/src/modules/connect/jobs/__tests__/board-facets.vitest.ts` (create)

- [ ] **Step 1: Add indexes** to `job.schema.ts` (additive; comment them):

```ts
// Facet/filter support for the board (Phase 1). machineType stays unindexed
// (free-text, uncontrolled vocabulary - accepted scan cost).
JobSchema.index({ status: 1, 'location.district': 1 });
JobSchema.index({ status: 1, employmentType: 1 });
JobSchema.index({ status: 1, skills: 1 });
```

- [ ] **Step 2: `BoardFacetsQueryDto`** = the same filter fields as `BoardQueryDto` minus `sort`/`limit`/`skip` (extract a shared base or duplicate the filter fields; duplication is fine here for clarity).

- [ ] **Step 3: Write a failing test for the facet shape** (decorator-mock pattern; mock `jobModel.aggregate`):

```ts
// Asserts boardFacets returns { total, facets: { district, role, employmentType, machineType, skill, wageType } }
// and that each facet sub-pipeline excludes its own field from the match.
// Mock jobModel.aggregate to capture the pipeline; assert the $facet keys exist.
```

- [ ] **Step 4: Implement `boardFacets(query)`** in `jobs.service.ts`. Build the base filter from `buildBoardFilter`, then a `$facet` where each branch re-applies the base filter MINUS that branch's field (recompute via `buildBoardFilter` on a query copy with that field cleared), `$unwind` for array fields (skills), `$sortByCount`, `$limit 50`. Union-in selected values after the aggregation (so a selected value never drops off). Return `{ total, facets }`. Comment the "minus own field" + "union selected" logic.

```ts
async boardFacets(query: BoardFacetsQueryDto): Promise<JobBoardFacets> {
  const now = new Date();
  const omit = (field: keyof BoardFacetsQueryDto) => {
    const q = { ...query }; delete (q as any)[field]; return buildBoardFilter(q, now);
  };
  const countStage = (path: string) => [{ $sortByCount: `$${path}` }, { $limit: 50 }];
  const [res] = await this.jobModel.aggregate([
    { $facet: {
      total: [{ $match: buildBoardFilter(query, now) }, { $count: 'n' }],
      district: [{ $match: omit('districts') }, ...countStage('location.district')],
      role: [{ $match: omit('roles') }, ...countStage('role')],
      employmentType: [{ $match: omit('employmentTypes') }, ...countStage('employmentType')],
      machineType: [{ $match: omit('machineTypes') }, ...countStage('machineType')],
      skill: [{ $match: omit('skills') }, { $unwind: '$skills' }, ...countStage('skills')],
      wageType: [{ $match: omit('wageType') }, ...countStage('wageType')],
    } },
  ]);
  // _id/count -> {value,count}; drop null _id; union-in selected values at count 0 if absent.
  return this.shapeFacets(res, query);
}
```

(Define `JobBoardFacets` type + `shapeFacets` helper; `shapeFacets` maps `{_id,count}` -> `{value,count}`, filters null, and appends any selected value missing from a facet with its real count via a follow-up `countDocuments` OR count 0 - use 0 to avoid N extra queries; document that selected-but-out-of-top-50 shows its live count only if present, else 0.)

- [ ] **Step 5: Add the endpoint** to `jobs.controller.ts` (literal route, BEFORE `:id`; same guard as `board` = the class `JwtAuthGuard`; add a throttle tier heavier than board):

```ts
@Get('board/facets')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
boardFacets(@Query() query: BoardFacetsQueryDto) {
  return this.jobs.boardFacets(query);
}
```

- [ ] **Step 6:** tests PASS; `npx nest build` clean.

- [ ] **Step 7: Commit**

```bash
git add src/modules/connect/jobs/jobs.service.ts src/modules/connect/jobs/jobs.controller.ts src/modules/connect/jobs/dto/job.dto.ts src/modules/connect/jobs/schemas/job.schema.ts src/modules/connect/jobs/__tests__/board-facets.vitest.ts
git commit -m "feat(connect/jobs): board facets aggregation endpoint + filter indexes"
```

### Task 1.3: Web data layer (types + actions)

**Files:**

- Modify: `crewroster-web/features/connect/jobs/jobs.types.ts` (`BoardFilters` plural + `view`; `BoardFacets`)
- Modify: `crewroster-web/features/connect/jobs/jobs.actions.ts` (`getJobBoardFacets`)

- [ ] **Step 1:** Extend `BoardFilters` with `districts?: string[]; roles?: string[]; employmentTypes?: string[]; machineTypes?: string[]; view?: 'list' | 'grid'`. Add:

```ts
export interface FacetEntry {
  value: string;
  count: number;
}
export interface BoardFacets {
  total: number;
  district: FacetEntry[];
  role: FacetEntry[];
  employmentType: FacetEntry[];
  machineType: FacetEntry[];
  skill: FacetEntry[];
  wageType: FacetEntry[];
}
```

- [ ] **Step 2:** Add `getJobBoardFacets(filters: BoardFilters): Promise<ActionResult<BoardFacets>>` mirroring `listJobBoard` (GET `/connect/jobs/board/facets`, serialize arrays as csv). Reuse the existing query-string builder; arrays join with `,`.

- [ ] **Step 3:** `npx eslint` the two files -> clean. Commit:

```bash
git add features/connect/jobs/jobs.types.ts features/connect/jobs/jobs.actions.ts
git commit -m "feat(connect/jobs): web facets action + multi-select filter types"
```

### Task 1.4: URL filter hook + server-driven Open tab + loading.tsx

**Files:**

- Create: `crewroster-web/features/connect/jobs/useBoardFilters.ts` (URL <-> state, history.replaceState, debounce, abort)
- Modify: `crewroster-web/app/connect/jobs/page.tsx` (read searchParams; SSR page 1 + facets; default limit 20)
- Modify: `crewroster-web/features/connect/jobs/JobBoard.tsx` (server-driven Open tab; remove client useState filtering; Load more; role-strip counts from facets)
- Create: `crewroster-web/app/connect/jobs/loading.tsx`

- [ ] **Step 1: `useBoardFilters`** - a client hook owning filter state seeded from `searchParams`. On change: writes the URL via `window.history.replaceState` (no `router.replace`), debounces 250ms, then calls `listJobBoard` + `getJobBoardFacets` through an `AbortController` with a monotonic request-id; ignores stale responses. Exposes `{ filters, facets, results, total, loading, error, setFilter, clearAll, loadMore, retry }`. Comment the App-Router-no-shallow-routing rationale + the stale-guard.

- [ ] **Step 2:** `page.tsx` reads `searchParams`, parses filters, fetches page-1 `listJobBoard(filters, {limit:20})` + `getJobBoardFacets(filters)` server-side, passes `initialResults`, `initialFacets`, `filters` to `JobBoard` (keeps mine/myApplications/saved/viewerSkills fetches).

- [ ] **Step 3:** `JobBoard.tsx` Open tab uses `useBoardFilters` (seeded from SSR), renders results + Load more; **delete the client `useState` filtering** of the Open tab; role-strip counts read `facets.role`. Keep KPIs/tabs/how-it-works/search/sort/active-chips wired to the hook. Search box updates `filters.q` (debounced).

- [ ] **Step 4:** `loading.tsx` (server-only, root `aria-hidden`, Skeleton primitives imported DIRECTLY from `components/connect/Skeleton`) mirroring KPIs + tabs + rail + ~5 list rows.

- [ ] **Step 5:** `npx eslint` all four files -> clean. Manual: load `/connect/jobs`, toggle a filter, confirm URL updates without full reload, back/forward restores, Load more appends.

- [ ] **Step 6: Commit**

```bash
git add features/connect/jobs/useBoardFilters.ts app/connect/jobs/page.tsx features/connect/jobs/JobBoard.tsx app/connect/jobs/loading.tsx
git commit -m "feat(connect/jobs): server-driven Open tab (URL filters + facets + load more + loading)"
```

**Phase 1 gate:** BE build + 2 vitest files green; web eslint clean; manual board smoke (filter -> URL -> results + counts, no full reload, back/forward, load more, 0-results empty state).

---

## Phase 2 - Filter rail (counts, audience-tuned, mobile)

### Task 2.1: Rail rebuild (primary facets + More filters)

**Files:**

- Modify: `crewroster-web/features/connect/jobs/JobFilterRail.tsx`
- Create: `crewroster-web/features/connect/jobs/FacetGroup.tsx` (a reusable counted multi-check group)

- [ ] **Step 1: `FacetGroup`** - props `{ title, options: FacetEntry[], selected: string[], onToggle, labelFor, max=8 }`. Renders a checklist: each row a `<label cursor-pointer>` with checkbox + humanized label + count; 0-count rows `disabled` unless selected (selected always shown); "Show more" past `max`. Long labels wrap (no truncation). All keyboard-operable, `focus-visible` ring, 44px rows. Comment the "selected always visible" rule.

- [ ] **Step 2: Rebuild `JobFilterRail`** to consume `facets` + `filters` + setters from the hook:
  - **Primary:** Location (`FacetGroup` district + search-within when >8), Pay type (chips: hourly/daily/piece/monthly), Posted date (radios any/24h/week/month).
  - **More filters (collapsed `<details>` or a toggle):** Employment type (`FacetGroup`), Machine type (`FacetGroup`, demoted), Skills (`FacetGroup`).
  - Open-positions-only toggle; Clear all (only when active).
  - Remove role from the rail (role lives in the strip).

- [ ] **Step 3:** eslint clean. Manual: counts render, toggles update results, selected-0-count stays, "More filters" expands.

- [ ] **Step 4: Commit**

```bash
git add features/connect/jobs/JobFilterRail.tsx features/connect/jobs/FacetGroup.tsx
git commit -m "feat(connect/jobs): counts-rich, audience-tuned filter rail"
```

### Task 2.2: Mobile rail drawer + staged "Show N jobs"

**Files:**

- Modify: `crewroster-web/features/connect/jobs/JobBoard.tsx` (mobile drawer wrapper + staged filters)
- Modify: `crewroster-web/features/connect/jobs/JobFilterRail.tsx` (staged mode)

- [ ] **Step 1:** Below the `md` breakpoint, render a "Filters (N)" button that opens an AntD `Drawer` (`open`, `destroyOnHidden`) holding the rail. In drawer mode, filter changes **stage locally** (no fetch); a sticky footer "Show N jobs" button applies them in one go (`N` from a lightweight facets-preview total, or the current total until applied). Desktop keeps apply-on-change (debounced). Comment the staged-vs-live rationale (slow-3G).

- [ ] **Step 2:** eslint clean. Manual on a narrow viewport: drawer opens, staged toggles, "Show N jobs" applies once.

- [ ] **Step 3: Commit**

```bash
git add features/connect/jobs/JobBoard.tsx features/connect/jobs/JobFilterRail.tsx
git commit -m "feat(connect/jobs): mobile filter drawer with staged Show-N-jobs apply"
```

**Phase 2 gate:** eslint clean; manual desktop (live counts + filtering) + mobile (drawer + staged apply) smoke; selected-0-count persistence verified.

---

## Phase 3 - Job cards (employer identity + ERP badge + Save/Apply + list/grid)

### Task 3.1: ERP-linked in company-page refs (backend, additive)

**Files:**

- Modify: `crewroster-backend/src/modules/connect/entities/services/company-page.service.ts` (`getRefs` + `CompanyPageRef`)
- Test: extend `crewroster-backend/src/modules/connect/entities/__tests__/*` or add a focused test

- [ ] **Step 1:** Add `erpLinked: boolean` to the `CompanyPageRef` type; in `getRefs`, add `erpWorkspaceId` to `.select` and map `erpLinked: !!p.erpWorkspaceId`. Comment "feeds the jobs board ERP-verified badge (batch)".
- [ ] **Step 2:** `npx nest build` clean; add/extend a targeted test asserting `getRefs` returns `erpLinked`. Run it `--no-file-parallelism`.
- [ ] **Step 3: Commit**

```bash
git add src/modules/connect/entities/services/company-page.service.ts src/modules/connect/entities/__tests__/
git commit -m "feat(connect/entities): expose erpLinked in company-page refs (batch)"
```

### Task 3.2: Board employer resolution (web)

**Files:**

- Modify: `crewroster-web/app/connect/jobs/page.tsx` + `JobBoard.tsx` (resolve employer map)
- Modify: `crewroster-web/features/connect/entities/company-page.actions.ts` (ensure `getCompanyPageRefs` returns `erpLinked`) + `jobs.types.ts` (`JobEmployerRef`)

- [ ] **Step 1:** Define `JobEmployerRef { name; logo?; slug?; erpLinked?; isPerson?: boolean }`. After fetching results, collect `companyPageId`s + person `companyUserId`s for jobs without a page, call `getCompanyPageRefs(pageIds)` + `getPeople(personIds)` (ONE batch each), build `Record<jobId, JobEmployerRef>`, pass to cards. On Load more, resolve only the new page's ids and merge.
- [ ] **Step 2:** eslint clean; commit.

```bash
git add app/connect/jobs/page.tsx features/connect/jobs/JobBoard.tsx features/connect/entities/company-page.actions.ts features/connect/jobs/jobs.types.ts
git commit -m "feat(connect/jobs): batch employer identity for board cards"
```

### Task 3.3: JobCard rebuild - stretched-link + Save/Apply + list/grid

**Files:**

- Modify: `crewroster-web/features/connect/jobs/JobCard.tsx`
- Create: `crewroster-web/features/connect/jobs/JobApplyConfirm.tsx` (confirm sheet)
- Create: `crewroster-web/features/connect/jobs/JobCard.test.tsx` (or extend existing) - interaction tests

- [ ] **Step 1: Write failing interaction tests** (RTL): (a) clicking Save does NOT navigate (calls onSave), (b) clicking the card body navigates to the job, (c) Apply opens the confirm and only applies after confirm, (d) owner-on-own-job shows neither Save nor Apply, (e) applied state renders "Applied" disabled.

- [ ] **Step 2: Rebuild `JobCard`** per the Interaction Contract:
  - Root `<div>` (relative, hover lift on the div). Title is `<Link className="... after:absolute after:inset-0">` (stretched). `aria-label` on the title link.
  - Employer row: logo/initial + name + quiet ERP-verified badge when `employer.erpLinked` (never for `isPerson`).
  - Save button + Apply button: `className="relative z-[2] cursor-pointer ..."` (above the stretched pseudo-element + AntD wave). Save = optimistic toggle (filled bookmark when saved). Apply = opens `JobApplyConfirm`.
  - Wage `/unit`, skill tags, openings or "Bulk · N needed" (>=10), posted, skill-match ribbon, closing-soon.
  - `variant: 'list' | 'grid'` prop switching layout (shared inner subcomponents).
  - Owner-on-own-job (`isOwner`): no Save/Apply; show views on My jobs.
  - Disabled Apply (closed/filled/applied): `cursor-not-allowed` + `aria-disabled` + in-locale reason.

- [ ] **Step 3: `JobApplyConfirm`** - AntD `Modal`/bottom-sheet (`open`, `destroyOnHidden`): job title + the "your number stays private until they shortlist you" line + one primary Confirm + Cancel. On confirm -> `applyToJob` then success state. Comment the trust-model rationale.

- [ ] **Step 4:** tests PASS; eslint clean; commit.

```bash
git add features/connect/jobs/JobCard.tsx features/connect/jobs/JobApplyConfirm.tsx features/connect/jobs/JobCard.test.tsx
git commit -m "feat(connect/jobs): card identity + inline Save + Apply-with-confirm + list/grid"
```

**Phase 3 gate:** BE build + entities test green; web JobCard tests green; eslint clean; manual: Save/Apply click independence (no nav), apply confirm, owner hides actions, ERP badge only when linked.

---

## Phase 4 - View toggle + result header

**Files:**

- Modify: `crewroster-web/features/connect/jobs/JobBoard.tsx` (List/Grid segmented + result header + persistence)

- [ ] **Step 1:** Segmented List/Grid control (cursor-correct, `aria-pressed`), list default, **hidden below the `md` breakpoint**. Resolution order: `?view=` wins; absent -> SSR list; on mount reconcile from `localStorage` and rewrite via `history.replaceState`. Pass `variant` to `JobCard`; grid uses a responsive grid wrapper (single column on phones regardless).
- [ ] **Step 2:** Result header "N jobs match your filters · {city}" from `facets.total` (city from the active district filter or the viewer's area; omit when unknown).
- [ ] **Step 3:** eslint clean; manual: toggle persists across reload (desktop), phone never shows broken grid. Commit:

```bash
git add features/connect/jobs/JobBoard.tsx
git commit -m "feat(connect/jobs): list/grid view toggle + result header"
```

**Phase 4 gate:** eslint clean; manual toggle + persistence + mobile-safety smoke.

---

## Phase 5 - Promoted (boosted) jobs (first-party; NO AdSense)

### Task 5.1: Read-only job-boost resolver (backend)

**Files:**

- Modify: `crewroster-backend/src/modules/connect/ads/*` (add `resolveActiveJobBoosts` + export)
- Modify: `crewroster-backend/src/modules/connect/jobs/jobs.module.ts` (import AdsModule) + `jobs.service.ts` (use resolver) + `jobs.controller.ts` (endpoint)
- Test: `crewroster-backend/src/modules/connect/jobs/__tests__/promoted-jobs.vitest.ts`

- [ ] **Step 1:** In the ads module add `resolveActiveJobBoosts(limit): Promise<{ jobId: string }[]>` - query `AdCampaign{ kind:'boost_job', status:'active', startAt<=now<endAt, budget ok }` -> join `AdCreative{ promoted_job, jobRef }`; return jobRefs. Read-only, NO impression billing, NO `decide`. Export it from `AdsModule` (add to exports; do not widen beyond this).
- [ ] **Step 2:** `JobsModule` imports `AdsModule`. `jobs.service.listPromotedForBoard(filters, limit=K)`: call resolver, load those jobs, **drop any `status !== 'open'`** and any not matching `buildBoardFilter(filters)`, cap K. Endpoint `GET /connect/jobs/board/promoted` (same guard + throttle).
- [ ] **Step 3:** Test: resolver excludes closed jobs + non-matching filters; returns <=K. Run `--no-file-parallelism`; `nest build` clean.
- [ ] **Step 4: Commit**

```bash
git add src/modules/connect/ads/ src/modules/connect/jobs/jobs.module.ts src/modules/connect/jobs/jobs.service.ts src/modules/connect/jobs/jobs.controller.ts src/modules/connect/jobs/__tests__/promoted-jobs.vitest.ts
git commit -m "feat(connect/jobs): read-only promoted-jobs resolver (excludes closed, non-billing)"
```

### Task 5.2: Promoted block (web)

**Files:**

- Modify: `crewroster-web/features/connect/jobs/jobs.actions.ts` (`listPromotedJobs`)
- Modify: `crewroster-web/app/connect/jobs/page.tsx` + `JobBoard.tsx` (render block)
- Create: `crewroster-web/features/connect/jobs/PromotedJobs.tsx`

- [ ] **Step 1:** `listPromotedJobs(filters)` action. `PromotedJobs` renders a visually separated block ABOVE the organic list (only on the Open tab, page 1, no active text search), each a `JobCard` with a clear in-locale "Promoted" tag + icon; de-dupe promoted ids from the organic list. K low (1-2 mobile, up to 3 desktop). Empty -> render nothing.
- [ ] **Step 2:** eslint clean; manual: promoted block shows, deduped, hidden when none/filtered out. Commit:

```bash
git add features/connect/jobs/jobs.actions.ts features/connect/jobs/PromotedJobs.tsx app/connect/jobs/page.tsx features/connect/jobs/JobBoard.tsx
git commit -m "feat(connect/jobs): labelled promoted-jobs block (de-duped, first-party)"
```

**Phase 5 gate:** BE build + resolver test green; web eslint clean; manual: promoted appears/labelled/deduped, closed boost excluded, none -> no block.

---

## Phase 6 - i18n + a11y + cursor sweep + analytics + verification

**Files:**

- Modify: `crewroster-web/app/messages/{en,gu,gu-en,hi-en}.json`
- Modify: the new web components (analytics calls + a11y polish)

- [ ] **Step 1: i18n** - add every new `connect.jobs.*` key (facet group titles, employment/machine labels, "More filters", "Show N jobs", "Filters (N)", promoted label, apply-confirm copy incl. the private-phone line, applied/saved labels, view toggle, result header, bulk hint, closed-reason) to all 4 locales via a throwaway CRLF-preserving injector (delete after). `node scripts/check-i18n.js` -> OK. No em-dashes.
- [ ] **Step 2: Analytics (FE PostHog)** - emit `filter_applied`, `facet_toggled`, `save_from_card`, `apply_confirmed`, `view_toggled`, `promoted_impression`, `promoted_click` at their call sites.
- [ ] **Step 3: a11y + cursor sweep** - verify every new interactive element against the Interaction Contract: `cursor-pointer`/`cursor-not-allowed`, focus-visible, 44px targets, count/secondary contrast >=4.5:1, aria on rail/cards/toggle/promoted/drawer, keyboard operability. Fix gaps.
- [ ] **Step 4: Verification** - BE `nest build` + each new vitest file (`--no-file-parallelism`); web eslint on every changed file; `check-i18n` OK. Commit.

```bash
git add app/messages/en.json app/messages/gu.json app/messages/gu-en.json app/messages/hi-en.json features/connect/jobs/
git commit -m "feat(connect/jobs): i18n (4 locales) + analytics + a11y/cursor sweep"
```

**Phase 6 gate (final):** all builds/tests/lint/i18n green; a full manual smoke of the board on desktop + a narrow viewport against the spec's edge-case list.

---

## Self-review (plan vs spec)

- Spec coverage: server-driven (1.4), facets+indexes (1.2), multi-select DTO (1.1), rail+counts+mobile (2.1/2.2), employer+ERP badge (3.1/3.2), card stretched-link + Save/Apply-confirm + list/grid (3.3), view toggle (4), promoted resolver+block (5.1/5.2), i18n/a11y/analytics/cursor (6). All mapped.
- Interaction/Cursor Contract enforced in 2.1, 3.3, 4, 6.
- Open confirmations to resolve at implementation by reading the file first: exact `BoardFilters` query-string builder in jobs.actions.ts, the ads module's campaign/creative model names + how a boost is created (boost.service), `getPeople`/`getCompanyPageRefs` return shapes, AntD Drawer/Modal props in v6, the Skeleton primitive names.
- Edge cases live in each phase gate + the spec's per-phase "Edge cases" lines.
