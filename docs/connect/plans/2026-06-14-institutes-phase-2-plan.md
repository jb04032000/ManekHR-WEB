# Institutes - Phase 2 Implementation Plan

**Date:** 2026-06-14
**Status:** Draft for owner sign-off. **Do NOT start until the Phase 2 trigger fires** (Phase 1 live + real early usage: an institute page set up, a few students with the "Trained at" link, at least one hire). Re-confirm the data assumptions below against live data before building. Logical change per `ENGINEERING-STANDARDS.md` #13.
**Builds on:** `2026-06-14-institutes-phase-1-plan.md` (institute page `kind`, course listings, profile `training[]`) and `segment-institutes-and-adjacent-users.md` sections 5A + 7.
**Repos:** `crewroster-backend` + `crewroster-web` (Connect). Current branch; **owner stages and commits** - executing session runs no git mutations.

> Agentic worker: steps use `- [ ]`. Backend first, then web. Tests per feature green before close. i18n parity across en / gu / gu-en / hi-en (`node scripts/check-i18n.js`). No em-dashes. NOTE: a reliable local build/test loop is required - the cloud sandbox mount cannot build this repo.

---

## 1. Goal (what Phase 2 ships)

The institute **reputation + growth** layer - the hooks that make an institute actively recruit its students (segment doc section 5A). Every surface ships **with its empty-state "Invite your students" CTA**, because on day one these are empty and the empty state is the acquisition mechanic, not a cosmetic afterthought.

Five capabilities:

1. **Institute-confirmed credential** - turn Phase 1's self-declared "Trained at" into a confirmed "Certified by [Institute]" marker.
2. **Placement wall** - "where our students work" on the institute page.
3. **Alumni / talent-pool tab** - the institute's students who are open to work, browsable by employers.
4. **Hiring-leads-to-inbox** - a business can approach the institute for trained candidates.
5. **Bulk student onboarding + referral attribution** - invite a batch in one flow, attributed to the institute.

## 2. Decisions to lock before building (business calls, confirm with owner)

- **Credential trust bar:** does a confirmed badge require the institute itself to be verified (GST/Udyam) first, or is institute-owner confirmation alone enough? (Open decision #2 in the segment doc. Recommendation: confirmation alone shows a neutral "Confirmed by [Institute]" marker; the stronger "Verified institute" tier is Phase 3.)
- **Student consent for placement wall / alumni tab:** placing a student on a public institute wall is personal data - **opt-in only** (DPDP). A student must allow "show me on my institute's page / alumni list". Default off.
- **Referral attribution model:** simple first-touch (the invite link's institute gets the credit) is enough for Phase 2; no multi-touch.

## 3. Backend tasks (`crewroster-backend`)

### 3a. Confirmed credential (institute -> student)

- [ ] Extend `ConnectTrainingItem` (added in Phase 1, `connect-profile.schema.ts`) with confirmation state: `confirmStatus: 'self' | 'pending' | 'confirmed' | 'declined'` (default `'self'`), `confirmedAt?: Date`, `confirmedByUserId?: ObjectId`. Self-declared stays the default; nothing implicit becomes "confirmed".
- [ ] New endpoints on the company-page (institute) admin side: list incoming credential requests for a page (students who linked this `companyPageId` with `confirmStatus: 'pending'`), and confirm / decline one. Authorize: only the institute page owner/admin. A request is created when a student links a training entry to an institute page and opts to "ask the institute to confirm".
- [ ] Derived read: the public profile read returns the training entry's `confirmStatus`; only `confirmed` renders the "Confirmed by [Institute]" marker. Never fabricate; honesty rule from Phase 1 carries.
- [ ] Tests: request -> confirm flips to `confirmed`; decline path; only page admin can confirm; self entries unaffected; a confirmed entry exposes the institute link.

### 3b. Placement wall + alumni/talent-pool (institute page surfaces)

- [ ] Add a student opt-in flag (profile-level, e.g. `showOnInstitutePage: boolean` default `false`, or per-training-entry `shareWithInstitute: boolean`). Confirm the exact shape against the Phase 1 `training[]`.
- [ ] Institute page read: a **placement** projection - students with a confirmed training entry for this page who are employed (derive "employed" from an existing signal: a confirmed `experience[]` entry, or `openTo.work === false` after being open; pick the cleanest existing signal - re-confirm against live data, do not invent a new employment store).
- [ ] Institute page read: an **alumni/talent** projection - students with a confirmed (or linked) training entry for this page AND `openTo.work === true` AND opted-in; reuse the existing candidate-card shape from Jobs.
- [ ] Both are paginated, opt-in-gated, and return an explicit empty marker so the web can render the invite CTA. Tests: opt-in gating, only-this-institute scoping, pagination, empty marker.

### 3c. Hiring-leads-to-inbox (business -> institute)

- [ ] Reuse the existing inquiry/inbox pipeline: allow an inquiry whose target is an institute Company Page (a "looking for trained candidates" context), landing in the institute's unified inbox with a clear context card. No new messaging system - extend the inbox context-card types added in `2026-06-14-connect-inbox-context-cards-*`.
- [ ] Tests: an institute receives a candidate-request inquiry in its inbox with the right context card; non-institute pages unaffected.

### 3d. Bulk onboarding + referral attribution

- [ ] Extend the existing invite/claim plumbing (the consolidated invite endpoints + `linkedUserId` claim flow) with a **batch invite** for a page: accept a list of phone numbers, generate invite links/messages, and stamp a referral source (`invitedByCompanyPageId`) on the resulting signups.
- [ ] Referral attribution: persist `invitedByCompanyPageId` on the new `User`/profile (first-touch); expose a simple count to the institute ("N students joined from your invites"). No multi-touch.
- [ ] Tests: batch invite creates the right number of pending invites; a claimed invite stamps attribution; counts are correct; no PII leaks across institutes.

## 4. Web tasks (`crewroster-web`)

### 4a. Credential confirm

- [ ] Student profile edit (training section, Phase 1): add an "Ask [institute] to confirm" toggle when an entry is linked to an institute page.
- [ ] Institute manage console: a "Credential requests" panel - list pending, Confirm / Decline per row (reuse the inbox/applicant row patterns).
- [ ] Profile view: render the "Confirmed by [Institute]" marker only for `confirmed` entries; self/pending render plainly (no verified styling).

### 4b. Placement wall + alumni tab (institute page)

- [ ] Add two tabs to the institute Company Page (`kind === 'institute'`): **Placements** ("where our students work") and **Alumni / Open to work**. Reuse the candidate-card and company-card components.
- [ ] **Empty-state CTAs (required, section 5A):** when a tab has no entries, render the invite prompt, not a blank: Placements -> "No placements yet. Invite your students - when they get hired it shows here." + "Invite students"; Alumni -> "Add your students so employers can find them." + "Invite students". Each wired to the bulk-invite flow (4d).
- [ ] Student-facing opt-in control (profile settings): "Show me on my institute's page / alumni list" (default off).

### 4c. Hiring-leads-to-inbox

- [ ] On an institute page, a "Hire our trained candidates" action that opens the existing inquiry modal with the institute as target; the lead lands in the institute inbox with the new context card.

### 4d. Bulk onboarding + referral

- [ ] Institute manage console: an "Invite students" flow - paste/enter phone numbers, generate share links / WhatsApp messages, show invite + joined counts. Reuse existing invite UI patterns.
- [ ] The empty-state CTAs (4b) and any "grow your wall" nudges link here.

### 4e. i18n + a11y (gate)

- [ ] All new copy in all four locales; `check-i18n` parity clean; no em-dashes; gu/gu-en/hi-en flagged for owner native review.
- [ ] WCAG AA, keyboard nav, empty/loading/error states on every new surface (the empty states are first-class here).

## 5. Verification gate (phase does not close until green)

- [ ] Backend: build clean + lint clean + new vitest green.
- [ ] Web: typecheck + lint + new vitest + `check-i18n` parity.
- [ ] Privacy review: no student appears on a public institute surface without opt-in; no cross-institute PII leakage; confirmed badge only from a real confirm action.
- [ ] Manual smoke (en + one Indic locale, mobile + desktop): student links + requests confirm -> institute confirms -> badge shows; student opts in -> appears on alumni tab; empty tabs show the invite CTA; batch invite creates invites and attributes a claimed signup; a hire shows on the placement wall.
- [ ] Regression: Phase 1 self-declared training, course listings, and institute pages all unchanged for non-opted-in / non-confirmed cases.

## 6. Out of scope (Phase 3)

Featured-course boosts; institute placement analytics dashboard; the stronger **Verified Institute** badge (GST/Udyam) and any paid placement-partner tier. Plan these separately when Phase 2 shows traction.

---

## Ready-to-paste kickoff prompt (use only after the Phase 2 trigger fires)

```
Execute docs/connect/plans/2026-06-14-institutes-phase-2-plan.md, Phase 2 only, in a
local environment with a working build/test loop (the cloud sandbox cannot build this
repo). Backend (crewroster-backend) first, then web (crewroster-web), current branch.
Owner stages + commits - run no git mutations.

First re-confirm section 2 decisions with the owner and re-check the section 3b
"employed" / opt-in data assumptions against live data. Then build: (1) institute-
confirmed credential (training confirmStatus + confirm/decline endpoints + "Confirmed
by [Institute]" marker), (2) placement wall + alumni/talent tab on the institute page
(opt-in gated), (3) hiring-leads-to-inbox via the existing inquiry/context-card
pipeline, (4) bulk student invite + first-touch referral attribution on the existing
invite plumbing. Every empty institute surface MUST render the "Invite your students"
CTA wired to the bulk-invite flow.

Hard rules: TypeScript strict zero any; opt-in before any student shows on a public
surface (DPDP); confirmed badge only from a real confirm action (no fabrication);
tests per feature green; i18n across all four locales with check-i18n parity and no
em-dashes; WCAG AA + first-class empty/loading/error states. Finish with the section 5
verification + privacy gate and a smoke test in en + one Indic locale.
```
