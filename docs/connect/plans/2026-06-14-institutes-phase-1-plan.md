# Institutes - Phase 1 Implementation Plan

**Date:** 2026-06-14
**Status:** Ready to execute after owner sign-off. Logical change (new entity field, new listing category, new profile field) per `ENGINEERING-STANDARDS.md` #13 - this plan is the approval artifact.
**Scope doc:** `docs/connect/segment-institutes-and-adjacent-users.md` (sections 3, 4, 7).
**Repos:** `crewroster-backend` (Connect) + `crewroster-web` (Connect). Work on the **current branch**; the **owner stages and commits** - the executing session runs no git mutations.

> For an agentic worker: steps use `- [ ]`. Build backend first, then web. A phase does not close until its tests are green (`TESTING-STRATEGY.md`). No em-dashes in any copy. i18n parity across en / gu / gu-en / hi-en is a gate (`node scripts/check-i18n.js`).

---

## 1. Goal (what ships in Phase 1)

The parts an institute / student can see and use immediately - enough to support the marketing claim and onboard launch-partner institutes:

1. **Institute identity** - a Company Page can be created as an "Institute / Academy", discoverable as a training provider (not a manufacturer).
2. **Course listings** - an institute lists courses with an "Enquire to enrol" action, reusing the existing marketplace listing + inquiry pipeline.
3. **"Trained at [Institute]" credential** - a student adds a training entry on their profile linked to the institute's page.

**Deferred to Phase 2 (do NOT build now):** placement wall, "Certified by" confirmed badge, alumni/talent-pool tab, hiring-leads-to-inbox, bulk student onboarding, and their empty-state "Invite your students" CTAs (see scope doc section 5A).

## 2. Decisions locked for this phase (so the build does not stall)

- **Institute = a `CompanyPage` with a new `kind` field**, not a new collection. `CompanyPage` today has no type field; add `kind: 'business' | 'institute'` (default `'business'`, so every existing page is unchanged). Institutes reuse the whole page pipeline (slug, logo, banner, about, posts, jobs, location, ERP link).
- **Courses reuse the marketplace `Listing` pipeline**, not a new collection. Add a `course` value to `LISTING_CATEGORIES` and a small `courseDetails` sub-object; this inherits discovery, the inquiry/lead flow, the unified inbox, moderation, and boost for free. (A dedicated `Course` collection is cleaner long-term but is a Phase 2+ refactor only if course-specific needs outgrow a listing. Noted, not done now.)
- **Credential = a new `training[]` array on `ConnectProfile`**, mirroring `ConnectExperienceItem` (which already carries an optional `companyPageId`). Phase 1 is **self-declared** (the student types it, optionally links the institute page). The institute **confirm** step + "Certified by" badge is Phase 2.
- **Honesty:** a self-declared training entry shows plainly (no "verified/certified" wording) until Phase 2 confirmation exists. No fabricated badges.

## 3. Backend tasks (`crewroster-backend`)

### 3a. Company Page - institute kind

- [ ] Add `kind: 'business' | 'institute'` to `connect/entities/schemas/company-page.schema.ts` (enum const + `@Prop` with `default: 'business'`). Additive; no migration needed (existing docs default to `business`).
- [ ] Add an optional `institutePanel` sub-schema (parallel to `CompanyIndustryPanel`): `coursesOffered: string[]`, `modes: ('online'|'offline')[]`, `languages: string[]` (or reuse `industryPanel.languages`). All optional.
- [ ] DTO: extend `company-page.dto.ts` create/update to accept `kind` + `institutePanel` (class-validator, `@IsEnum`, `@IsOptional`).
- [ ] Service: `company-page.service.ts` set/echo `kind` + panel on create/update; no auth change (still owner-scoped).
- [ ] Discovery: include `kind` in the browse projection + add a `kind=institute` filter to the company-page browse query + facets (`company-page-browse.helpers.ts`, `*-browse-counts.helpers.ts`).
- [ ] Tests (vitest): create/update institute page; default kind is `business`; browse filter returns only institutes; counts correct.

### 3b. Course listings

- [ ] Add `'course'` to `LISTING_CATEGORIES` in `marketplace/schemas/listing.schema.ts`.
- [ ] Add an optional `courseDetails` sub-schema: `durationLabel: string`, `batchStart?: Date`, `mode: 'online'|'offline'|'hybrid'`, `feeType: 'fixed'|'range'|'free'`, `seats?: number`, `certificate: boolean`, `skillsTaught: string[]`. All optional except where a course is the category.
- [ ] DTO validation: when `category === 'course'`, require the course-relevant fields; reuse existing price fields for fee (or `courseDetails.feeType`).
- [ ] Inquiry flow: reuse the existing listing inquiry endpoint; only the **CTA label** changes on the web ("Enquire to enrol"). No backend inquiry change required - confirm the inquiry context card still renders for a course listing.
- [ ] Search/index: ensure `course` listings flow into the existing Meilisearch `connect_listings` index with the new category facet.
- [ ] Tests: create a course listing (validation on/off by category); it appears in browse with the `course` facet; an inquiry on a course listing lands in the inbox.

### 3c. Profile training credential

- [ ] Add `ConnectTrainingItem` sub-schema to `connect-profile.schema.ts`: `instituteName: string` (required), `companyPageId?: ObjectId ref CompanyPage` (optional link), `course?: string`, `completedAt?: Date`, `certificateUrl?: string`. Add `training: ConnectTrainingItem[]` (default `[]`) to `ConnectProfile`.
- [ ] DTO: extend the profile update schema/DTO to accept `training[]` (mirror the `experience[]` validation; cap array size).
- [ ] Read: include `training` in the public + own profile projection; when `companyPageId` is set, resolve the institute name/logo/slug for the link (mirror how `experience` resolves `companyPageId`).
- [ ] Tests: add/edit/remove a training entry; entry with a `companyPageId` resolves and preserves the link; self-declared entry carries no "verified" flag.

## 4. Web tasks (`crewroster-web`)

### 4a. Institute page

- [ ] Create-page wizard: add an "Institute / Academy" choice that sets `kind` and shows the institute fields (courses offered, modes, languages). Reuse the existing company-page create/edit components.
- [ ] Public company page (`/company/[slug]`): when `kind === 'institute'`, show an "Institute" label and the institute panel; keep Posts/Jobs tabs.
- [ ] Directory/browse: add an "Institutes" filter to the company-page browse UI (reads the new facet).

### 4b. Course listings

- [ ] Listing create/edit: when category is "Course", show the course fields (duration, batch start, mode, fee, seats, certificate, skills) and swap the buyer CTA to "Enquire to enrol".
- [ ] Marketplace browse: add a "Courses" category filter; course cards show duration/mode/fee instead of MOQ/unit.
- [ ] Course detail page: render course fields + the "Enquire to enrol" inquiry action (reuse the listing inquiry modal).

### 4c. Profile credential

- [ ] Profile edit: add a "Training / Education" section mirroring the Experience editor, with an optional "link an institute page" picker (reuse the `AttachStorePicker`/company-picker pattern).
- [ ] Profile view (`/u/[slug]` + own): render the training section; linked entries show the institute logo + `/company/[slug]` link; self-declared entries show plainly (no verified styling).

### 4d. i18n + a11y (gate)

- [ ] All new copy added to **all four** locales (`app/messages/en.json`, `gu.json`, `gu-en.json`, `hi-en.json`); `node scripts/check-i18n.js` clean; no em-dashes. (gu / gu-en / hi-en need an owner native-speaker review pass - flag, do not block the typecheck on it.)
- [ ] WCAG AA, keyboard nav, empty/loading/error states for every new surface.

## 5. Marketing (small, ships alongside)

- [ ] Add "Institutes" and "Students" to the landing audience strip + the positioning doc (`connect-positioning-and-messaging.md`) so the page speaks to them. (Phase 0 item; can land first as a quick win.)

## 6. Verification gate (phase does not close until all green)

- [ ] Backend: `tsc`/SWC build clean + lint clean + new vitest suites green.
- [ ] Web: typecheck clean + lint clean + new vitest green + `check-i18n` parity.
- [ ] Manual smoke: create an institute page, list a course, send a course enquiry (lands in inbox), add a "Trained at" entry linked to that institute, view it on the public profile - in at least `en` and one Indic locale, mobile + desktop.
- [ ] Confirm no existing company-page / listing / profile behaviour regressed (default `kind`, non-course listings, profiles with no training entry all unchanged).

## 7. Out of scope (Phase 2+, do not build)

Placement wall, confirmed "Certified by" badge + institute verification, alumni/talent-pool tab, hiring-leads-to-inbox, bulk student onboarding + referral attribution, featured-course boosts, placement dashboard, and all the section-5A empty-state "Invite your students" CTAs. Plan these when the Phase 2 trigger fires (scope doc section 7).

---

## Ready-to-paste kickoff prompt

```
Execute docs/connect/plans/2026-06-14-institutes-phase-1-plan.md, Phase 1 only.
Build backend (crewroster-backend) first, then web (crewroster-web), on the current
branch. Owner stages + commits - run no git mutations.

Scope: (1) CompanyPage gains kind: 'business'|'institute' (default business) +
optional institutePanel + an "Institutes" browse filter; (2) marketplace Listing
gains a 'course' category + courseDetails, reusing the existing inquiry/inbox/
moderation/boost pipeline, with an "Enquire to enrol" CTA; (3) ConnectProfile gains
a training[] array (self-declared, optional companyPageId link to the institute
page) shown on the profile.

Hard rules: TypeScript strict, zero any; tests per feature (vitest) green before
close; i18n added to all four locales with check-i18n parity and no em-dashes;
WCAG AA + empty/loading/error states. Do NOT build any Phase 2 item (placement wall,
Certified-by badge, alumni tab, bulk invite, empty-state invite CTAs). Finish with
the section 6 verification gate and a smoke test in en + one Indic locale.
```
