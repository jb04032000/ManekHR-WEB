# Company Directory Location Filter v2 (Approach B)

Date: 2026-06-04
Status: Design - awaiting owner review
Surface: `/connect/companies` directory filter + company-page create/edit form
Type: Logical change (new behavior + new endpoint) - owner-approved direction (Approach B)

## Problem

The directory's "District / area" filter is built from a server aggregation over
`location.district` of public company pages, capped at the top 12 by count, with
no "show more" and no search. Two problems:

1. **Free-text fragmentation.** District/city are plain text inputs, so "Surat",
   "surat", "Surat City" become separate facets with split counts. As data grows
   the top list fills with near-duplicates.
2. **No reach beyond the top list.** A locality outside the top 12 is unreachable
   from the UI (only via a hand-edited `?district=` URL).

Context: this is an India-first textile-trade directory; "District / area" is used
for **trade-cluster localities** (Varachha, Ring Road, Sachin ... inside Surat),
a set that grows city-by-city. A fixed checkbox list does not scale.

## Goals

- Stop free-text fragmentation at the source (write path).
- Make every locality reachable from the filter UI (search), not just the top N.
- Keep custom place entry (owners in small towns must be able to add their place).
- No upfront geo dataset (defer the full normalized State→District→City model).

## Non-goals (YAGNI / deferred)

- Full normalized geo dataset + cascading hierarchical filters (Approach C) -
  the eventual destination, not this step.
- Multi-select districts (stays single-select via `?district=`).
- A separate city/area facet (filter stays keyed on `district`).
- A bulk migration to clean historical free-text. Snap-on-save converges new
  writes; a one-off cleanup script can follow later if the data warrants it.

## Design

### 1. Location normalization (write path) - backend

In `CompanyPageService`:

- `normalizePlace(value)`: `trim` + collapse internal whitespace. Pure helper.
- On `create` and `update`, for `location.district` and `location.city`:
  normalize, then **snap to an existing canonical spelling** when a
  case-insensitive match already exists among public pages (so a freshly typed
  "surat" is stored as the existing "Surat"). A brand-new place is stored as the
  normalized typed value and becomes the canonical spelling for the next writer.
- Normalization never blocks a save; on any lookup failure it falls back to the
  normalized typed value.

### 2. Distinct-locations read (suggestions + filter search) - backend

New `@Public()` endpoint on the public company-pages controller:

`GET /connect/company-pages/public/locations?field=district|city&q=<prefix>&limit=N`

- Service method `distinctLocations(field, q, limit)`: aggregate distinct
  `location.<field>` over public pages, case-insensitive match on `q`, sorted by
  count desc then name, capped at `limit` (default 10, max ~20).
- Returns `{ value: string; count: number }[]`.
- DTO validates `field` (`district` | `city`), `q` (optional, maxlen), `limit`.

### 3. Filter rail UX - web (`CompanyDirectoryRail`)

District section becomes:

- A **"Search area" input** (debounced typeahead) that calls the locations
  endpoint; results render as a small clickable list; choosing one sets
  `?district=`. Reaches the long tail.
- The **top 8 popular** districts as checkboxes (from the existing facet data).
- A **"Show more / Show less"** toggle revealing up to 20 (the server returns up
  to 20; the rail shows 8 and reveals the rest client-side).
- Single-select + live counts unchanged.

Server: bump the district facet aggregation `.limit(12)` → `20`.

### 4. Create/edit form - web (`CompanyPageForm`)

- District and City fields become AntD v6 **AutoComplete** backed by the
  locations endpoint (debounced; `field=district` / `field=city`).
- Suggestions are existing canonical values; free typing is allowed so a new
  town can always be entered (the custom-place answer).

### 5. i18n

New keys (all four locales): search-area placeholder, "Show more" / "Show less",
"No matching areas". District/city field placeholders reuse existing keys.

## Data flow

- Form: AutoComplete → `GET .../locations` (debounced) for suggestions; submit →
  service normalizes + snaps district/city on save.
- Directory: rail shows popular facets (from `browse`) + calls `.../locations`
  for the search typeahead. All reads are public.

## Error / edge handling

- Locations endpoint failure → AutoComplete / search degrade to a plain text
  input (no crash). Empty results → "No matching areas".
- Normalization failure → store the normalized typed value; never block a save.

## Testing

- BE vitest: `normalizePlace` (trim/collapse), snap-to-canonical behavior, and
  `distinctLocations` (match + sort + cap). Test only the touched module files.
- Filter/search/autocomplete UX is presentation (no new unit tests required
  beyond existing directory tests, which must still pass).

## Files (anticipated)

- BE: `services/company-page.service.ts` (normalize + snap + `distinctLocations`
  - facet limit), `controllers/company-page-public.controller.ts` (endpoint),
    `dto/company-page.dto.ts` (locations DTO), service vitest.
- Web: `company-page.actions.ts` (locations action), `entities.types.ts`
  (location-suggestion type), `CompanyDirectoryRail.tsx` (search + popular +
  show-more), `CompanyPageForm.tsx` (district/city AutoComplete),
  `app/messages/{en,gu,gu-en,hi-en}.json`.

## Notes

- Per the owner's standing rule, the assistant runs no git. This spec is written,
  not committed; the owner stages/commits.
