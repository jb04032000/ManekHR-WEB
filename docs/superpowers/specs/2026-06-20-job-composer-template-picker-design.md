# Post-a-job composer: "Start from a past job" template picker

Date: 2026-06-20
Scope: crewroster-web only (no backend change)

## Problem

A company page's owner job list (`/connect/pages/[id]?tab=jobs`) already offers a
per-row **"Use as template"** action: it opens the Post-a-job composer pre-filled
from that job and posts a brand-new job. There is no equivalent inside the
"Post a job" box itself, so a poster opening the composer from the main Jobs page
(or the company page Jobs section) always starts from a blank form.

Owner request: surface the same pre-fill capability **inside** the Post-a-job box
as a picker, so any poster can start from one of their earlier jobs. "It just
pre-fills the details, nothing much complex."

## Key finding

`JobComposer` already supports prefill-from-a-job in CREATE mode via the existing
`initial` prop + `toFormValues()` (that is exactly what the row "Use as template"
uses). The only missing piece is an **in-modal control to choose which past job**
to start from. Both job lists that feed the composer already return full job
documents (`listMine` and `listByCompanyPageForOwner` both `lean<Job[]>()`), so the
copied job carries every field (skills, responsibilities, benefits, video, etc.).
No backend or data change is required.

## Design (UX approved: dropdown at the top)

Add an optional template picker to `JobComposer`, shown only in CREATE mode when a
list of past jobs is provided.

### `JobComposer` changes (`features/connect/jobs/JobComposer.tsx`)

- New optional prop `templates?: Job[]` — the poster's past jobs offered as
  fill-from sources. Hidden in edit mode and when empty.
- A "Start from a past job" `Select` (searchable, clearable) rendered at the top of
  the form, above the existing prefill hint banner. Option label = job title +
  posted date (to disambiguate near-identical titles).
- Internal `pickedId` state, seeded from `initial?._id` so a caller that opens the
  composer with a preselected template (the existing row "Use as template") shows
  it selected and the picker stays the single source of truth while the modal is
  open.
- A derived `seed` job (the picked template, else the caller's `initial`) replaces
  `initial` everywhere the composer seeds the create form: the prefill hint,
  `initialValues`, the video seed URLs/posters, and the submit poster fallback.
  Edit mode keeps using `initial` verbatim (unchanged behaviour).
- Picking a template imperatively re-seeds the form (`form.setFieldsValue(
toFormValues(job, /*dropClosesAt*/ true))`) and the video state; clearing the
  picker blanks the form. The video grid (which only reads `initialUrls` at mount)
  is remounted via a `key` tied to the active selection so the clip re-seeds too.

### Callers (pass their available jobs as templates)

- `JobBoard.tsx` — pass `templates={mine}` (the "Jobs I posted" array already
  fetched for the page; no new request).
- `CompanyJobsManager.tsx` — pass `templates={jobs}`; the existing per-row "Use as
  template" still works and now seeds the in-modal picker.
- `CompanyJobsSection.tsx` — pass `templates={jobs}` (owner-only render).

### i18n

Two new keys under `connect.jobs` in all four locales (en, gu, gu-en, hi-en):
`templatePickerLabel`, `templatePickerPlaceholder`. No em-dashes (check:i18n rule).

## Non-goals

- No backend/schema/endpoint change.
- No change to edit mode or to the existing row "Use as template" shortcut.
- No mobile app work.

## Verification

- New vitest: picking a template fills the form and the built payload carries the
  copied fields; the existing composer video tests stay green.
- `npm run check:i18n` parity, `tsc`, `eslint` clean on touched files.
