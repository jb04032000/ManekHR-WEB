# ERP Dashboard Enrichment — design & build plan

Date: 2026-06-25
Owner decision: **Full widget set + tiny backend calc** (approved before build).
Scope: enrich `app/dashboard/page.tsx` (the aggregate dashboard) with rich, real
team / salary / attendance data. The dashboard is already wired to live data; this
adds widgets + lights up the dead trend arrows. The self-scoped worker path
(`MySelfDashboard`) is untouched.

## Guardrails (binding)

- Every widget reuses the existing `canSee(module, action)` gate in `page.tsx`.
  Org-aggregate widgets need scope `all`. Never break the `MySelfDashboard` route.
- Salary widgets stay behind `salary.view@all`. No statutory PII (PAN/Aadhaar/PF/
  ESI/TDS) on the dashboard. Money figures from salary overview/loans = **rupees**
  (use `formatCurrency*`), never paise.
- Match the existing card style (radius 16, `1px var(--cr-border)`, icon-chip,
  `font-display` headings, soft shadow). Brand tokens only.
- AntD v6 only (no banned deprecated props). Charts via `recharts` (existing dep).
- Every new string via `next-intl` across en/gu/gu-en/hi-en. Run `check:i18n`.
- Refresh `app/dashboard/loading.tsx` to mirror the new sections.
- Each new component carries the binding what / cross-links / watch header comment.
- Responsive at 375px, WCAG AA. subFeature-gated analytics (not used here) would
  need graceful empty states — the chosen widgets are all core endpoints.

## Backend (crewroster-backend) — extend `statistics.service.getDashboardStats` ONLY

Additive fields on the existing dashboard response (no new endpoint/DTO). Same
`AppModule.TEAM/VIEW` gate. Inject the `Shift` model into `StatisticsModule`.

1. `teamView.previousTotalMembers` — active members who joined before the 1st of
   this month (missing DOJ counts as "before"). Lights the staff trend arrow.
2. `attendance.previousPresent` — present count on the most recent prior day
   (look back ≤7 days) that has any attendance record. Avoids weekend zeros.
3. `salary.previousTotalPaid`, `salary.previousTotalRemaining` — last month's
   figures (same calc, previous month, year rollover handled).
4. `workforce` — `{ byDesignation[], byEmploymentType[], byShift[] }`, each
   `{ label, count }`, active non-deleted members only.
5. `peopleRadar` — `{ newJoiners[], birthdays[], anniversaries[] }` derived from
   active members' DOJ / DOB (windowed to this month / next 30 days).
   Implemented as private helpers so the orchestrator stays readable + unit-testable.
   TDD: `statistics.service.vitest.ts` (in-memory Mongo, decorator-mock + inline
   schemas) seeds a known dataset and asserts each new block.

## Frontend (crewroster-web)

Type: extend `DashboardStats` with the optional fields above.
New components (each self-fetches unless noted), wired into `page.tsx` under the
existing `canSee` gates:

- `AttendanceTrendCard` — `getAttendanceOverview` → recharts area of daily
  present/late/absent (this month). Gate `attendance`.
- `PayrollTrendCard` — consumes a payroll-overview fetched once in `page.tsx`
  (shared with money-movement) → recharts bar of 6-month payable vs paid. Gate
  `salary`. Rupees.
- `MoneyMovementCard` — `summary.advancesLoansBonus` tiles (advances / active
  loans + principal / bonus+commission+incentive). Gate `salary`. Rupees.
- `WorkforceBreakdownCard` — reads `stats.workforce`. Gate `team`.
- `PeopleRadarCard` — reads `stats.peopleRadar`. Gate `team`.
- `UpcomingLeaveCard` — `listUpcomingLeaves(ws, today, +7d)`. Gate `attendance`.
- `WhosInNowCard` — `attendanceApi.livePresence`. Gate `attendance`.
  Payroll overview is fetched once in `page.tsx` (only when `canSee('salary')`) and
  passed to the two salary cards to avoid a duplicate call. Single-consumer fetches
  (attendance overview, live presence, upcoming leaves) self-fetch in their cards.
  Loading skeleton updated section-for-section.

## Verify

`crewroster-web`: `npx tsc --noEmit` && eslint changed files && `npm run check:i18n`
&& `npx vitest run` (new/affected). `crewroster-backend`: build + vitest the new
service test. Owner handles all git.
