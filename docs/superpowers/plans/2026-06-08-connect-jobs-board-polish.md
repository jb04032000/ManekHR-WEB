# Connect Jobs Board - Phase 7 Polish Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Close the post-test feedback on `/connect/jobs`: remove the applicant-count leak, make every card's action consistent (owner gets Manage), de-duplicate counts, make the stat strip seeker-focused, persist the onboarding dismiss, add real empty states, and tighten card density/visual hierarchy.

**Scope:** crewroster-web ONLY (no backend). Commit on `main`; Co-Authored-By trailer; explicit `git add` (the 4 locale json files carry the owner's unrelated finance WIP - stage ONLY jobs hunks). eslint per file; `node scripts/check-i18n.js`. No em-dashes. AntD v6. Interaction & Cursor Contract still binding.

**Decisions (locked):** keep the role chips (no filter re-home); owner-on-own-job board card shows a "Your job" tag + "Manage" link (not Apply); applicant count is owner-only; role becomes a required field in the Post-a-job composer (client-side) so future jobs map to a facet (BE stays optional for back-compat).

---

## Task 1: Card action consistency + drop applicant-count leak (JobCard)

**File:** `features/connect/jobs/JobCard.tsx`

- [ ] **Step 1:** Remove the seeker-facing applicant count. The footer `applicationsCount` (with the Send icon) and the aria `count` must render ONLY when `showOwnerStats` (owner/My-jobs view). On the seeker board card, drop it entirely. Keep "N openings" and "Posted Xd ago".
- [ ] **Step 2:** Owner-on-own-job affordance. When `isOwnJob` (viewerId === job.companyUserId) on the board, instead of rendering NOTHING in the action area, render a quiet "Your job" tag + a "Manage" link (to `/connect/jobs/{id}`) styled as a secondary control (relative z-[2], cursor-pointer, focus-visible). So every card has a consistent action zone.
- [ ] **Step 3:** Density + hierarchy. Tighten card padding + the meta row so list rows are more compact (target 4-5 above the fold). Give the wage clear primacy (largest/boldest in the card body); collapse location + posted + openings into ONE muted meta line beneath it.
- [ ] **Step 4:** "Open" status. Keep the status pill ONLY when it carries signal: render "Closing soon" (warning) and "Filled"/"Closed" as before, but on a plain open job on the Open board drop the redundant green "Open" (every board job is open). Still show "Open"/status on the My-jobs owner tab.
- [ ] **Step 5:** eslint clean; update `JobCard.test.tsx` so the existing interaction tests still pass (owner now shows "Manage" not nothing; applicant count not on seeker card). Run `npx vitest run features/connect/jobs/JobCard.test.tsx --no-file-parallelism`.
- [ ] **Step 6:** Commit `fix(connect/jobs): consistent card actions (owner Manage), drop seeker applicant-count, denser rows`.

## Task 2: Seeker stat strip + de-dupe counts (JobBoard)

**File:** `features/connect/jobs/JobBoard.tsx`

- [ ] **Step 1:** Stat strip becomes seeker-focused: **Open jobs**, **New today**, **Your applications** (myApplications.length), **Saved** (saved.length). REMOVE the "Jobs you posted" tile (it is an employer metric and duplicates the "My jobs" tab count). The My-jobs tab keeps its own count.
- [ ] **Step 2:** Result-count de-dupe. Keep ONE line: "N jobs match your filters · {city}" (from facet total). Remove the secondary "N jobs" line above the list.
- [ ] **Step 3:** Grid toggle - hide the List/Grid segmented control when `total < 6` (grid adds nothing at low counts); show it at >=6. List stays default.
- [ ] **Step 4:** eslint clean. Commit `fix(connect/jobs): seeker-focused stat strip + de-duped result count + grid gate`.

## Task 3: Persist onboarding dismiss (JobBoard)

**File:** `features/connect/jobs/JobBoard.tsx`

- [ ] **Step 1:** The "how hiring works" band dismiss (`hiwOpen`) must persist. Seed initial state from `localStorage` key `cr.connect.jobs.hiwDismissed` (guard for SSR: default open on the server, reconcile on mount via an effect that reads localStorage - mind set-state-in-effect lint, use the accepted mount-once pattern). On dismiss, write the key. Returning users don't see it again.
- [ ] **Step 2:** eslint clean. Commit `fix(connect/jobs): persist how-hiring-works dismissal`.

## Task 4: Real empty states (JobBoard tabs)

**Files:** `features/connect/jobs/JobBoard.tsx` (+ reuse `components/connect/ConnectEmptyState`)

- [ ] **Step 1:** My applications (0) -> `ConnectEmptyState` (icon + one line "You have not applied to any jobs yet." + a primary CTA "Browse open jobs" that switches to the Open tab).
- [ ] **Step 2:** Saved (0) -> `ConnectEmptyState` (icon + "No saved jobs yet." + "Browse open jobs" CTA). Confirm the Open tab 0-results empty state already offers a primary "Clear all filters" (it does - keep it).
- [ ] **Step 2b:** i18n: add the empty-state strings to all 4 locales; `node scripts/check-i18n.js` OK.
- [ ] **Step 3:** eslint clean. Commit `fix(connect/jobs): real empty states for My applications + Saved tabs`.

## Task 5: Require role in the Post-a-job composer (JobComposer)

**File:** `features/connect/jobs/JobComposer.tsx`

- [ ] **Step 1:** Make the role field required at the form level (AntD Form rule / validation) so a posted job always carries a role that maps to a facet/chip. Keep the preset picker + custom-role entry (custom still allowed - it just must be non-empty). BE DTO stays optional (back-compat); this is a client-side requirement only. Add an in-locale validation message.
- [ ] **Step 2:** eslint clean; i18n key for the validation message in 4 locales; check-i18n OK. Commit `fix(connect/jobs): require a role when posting so jobs map to the role facet`.

## Task 6: Verify + review

- [ ] eslint clean on every changed file; check-i18n OK; JobCard tests green.
- [ ] Dispatch a spec+quality review (focus: Interaction/Cursor Contract on the new owner Manage control + density changes; no applicant count on seeker card; staged-finance-WIP untouched). Fix findings. Gate.

## Out of scope (explained to owner)

- #4 placeholder data = owner's test data, not code.
- #5 badge = already "ERP verified" + consistent across screens (GST verification is a separate future feature).
- #6 filter re-home = deliberately kept (role chips stay).
