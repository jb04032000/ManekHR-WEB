# Company Directory: refine to reference + in-grid ads

Date: 2026-06-02
Status: design (awaiting owner go)
Surface: `/connect/companies` (`CompanyDirectoryScreen` + `CompanyDirectoryFacetPanel` + `CompanyCard`) and backend `connect/company-pages` browse.

## Context

The directory shipped (surface 1 of the Company Pages polish) is functionally complete but visually flat versus the canonical prototype `connect-companies.html`. Owner feedback (2026-06-02):

1. The keyword search must NOT fire per keystroke (debounced live search = heavy FE+BE load). It needs an explicit **Search button** (submit on click / Enter).
2. Refine the page to the reference: prominent search band, left **filter rail**, result **toolbar + grid/list toggle**, richer cards, a **"List your company"** tile.
3. Add **in-grid ad** placements (first-party engine + Google AdSense) with native UI/UX.
4. UX polish: deliberate **hover effects**, **cursor/pointer** affordances, and smooth transitions everywhere interactive.

## Honest-data reconciliation (locked rule: no fabrication)

The reference cards carry data we do not have. What ships vs what is dropped:

| Reference element                         | Decision             | Reason                                                                   |
| ----------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| Search band + Search button               | BUILD (submit-based) | The load fix                                                             |
| Left rail: District facet + counts        | BUILD (real)         | New `location.district` `$group` facet, mirrors the specialization facet |
| Left rail: "Verified only" toggle         | BUILD (real)         | = the shipped ERP-verified filter                                        |
| Toolbar: count + sort + grid/list view    | BUILD                | Presentation + real sorts                                                |
| Sort: ERP-verified first / Newest / Name  | BUILD (real, 3)      | `erpVerified` sort = `erpWorkspaceId` presence                           |
| "List your company" tile                  | BUILD                | Links to create                                                          |
| Hover / pointer / transitions             | BUILD                | Owner UX ask                                                             |
| Rating per card                           | DEFER                | Real (reviews exist) but needs owner-id plumbing; not one of the 3 asks  |
| GST badge                                 | DROP                 | Needs GST API creds (owner item)                                         |
| "~2h replies", company size, min rating   | DROP                 | No data                                                                  |
| "Products" card stat                      | DROP                 | Products belong to storefronts, not company pages                        |
| Sort: most-followed / top-rated / fastest | DEFER                | Cross-collection sort or no data                                         |

Card stat row stays **Followers + Open jobs** (both real).

## A. Search on submit (the load fix)

- The keyword input moves into a prominent **search band** (full-width, leading search icon) with a trailing **Search button**.
- Submit only on **button click** or **Enter** -> sets `?q=`. No debounce, no per-keystroke request.
- District and ERP-verified still apply immediately on click (cheap, discrete actions), but the free-text keyword (the expensive one) is gated behind submit.
- `CompanyDirectoryFacetPanel` is replaced by:
  - `CompanyDirectorySearchBand` (keyword + Search button, local draft, submit-on-enter/click).
  - `CompanyDirectoryRail` (the left filter rail; see B).

## B. Reference refine (layout + chrome)

Two-column layout inside `ConnectPage`: sticky left **rail** + results column.

- **Rail** (`CompanyDirectoryRail`): "Filters" head + "Clear all"; **District / area** block = real district facets (value + count) as single-select rows (click to set `?district=`, click active to clear); **Trust** block = "Verified only" toggle (`?erpVerified=1`). Sticky on >=1080px; collapses behind a "Filters" button under it.
- **Specialization strip** stays (real facet counts), above the results, horizontally scrollable.
- **Result toolbar**: "N companies" count · **Sort** select (ERP-verified first / Newest / Name) · **grid/list view toggle** (persisted to `localStorage`).
- **Active-filter chips**: q / district / specialization / erpVerified, each removable.
- **Card grid** (existing rich `CompanyCard`) + a trailing **"List your company"** dashed tile linking to `/connect/pages`.
- **List view**: a compact row variant of the company card (logo, name + ERP badge, location, specialization, followers/open-jobs, View page). Same data, denser layout.

Backend: extend the browse response `facets` with `district: { value, count }[]` via a `$group` on `location.district` over the base filter (excludes the active district so siblings stay switchable), capped + shaped by a pure helper (mirrors `toSpecializationFacets`). The `sort` DTO gains `erpVerified` (sort ERP-linked first, then newest).

## C. In-grid ads (first-party + Google)

One reusable cell, injected into the grid at a fixed cadence (**after the 4th card, then every 8th**).

- `CompanyDirectoryAdCell` resolution order (mirrors `AdSlot`):
  1. **First-party promoted listing** - resolved server-side in `page.tsx` via `resolvePromotedRailListing('company_directory')`; rendered as the existing `PromotedListingAdCard` (its "Promoted" label + `useAdBeacons` MRC view/click beacons), sized to the grid cell.
  2. else **Google AdSense** - `AdSlot placement="company_directory"` (fills from AdSense when configured, else house creative, else null).
  3. else **nothing**.
- **No-gap rule**: an ad cell is only injected into the grid when it will fill - the first-party slot only when the server resolved a promoted listing; Google slots only when `env.adSenseClientId` is set. A grid never shows a hole.
- Every ad is clearly labeled ("Promoted" / "Advertisement"), `rel="sponsored"` on outbound links, and carries the "why am I seeing this" affordance already used by the feed ad card.
- Ads render in **grid view only** for v1 (list view stays ad-free; revisit if wanted).

New placement key `company_directory` (a seed + an `env.adSenseSlots` entry). Until configured, both arms no-fill gracefully.

## D. UX treatment (hover / pointer / transitions)

Mirror the prototype's interaction polish, via the `--cr-duration-fast` / `--cr-ease` tokens:

- **Cards**: lift + shadow on hover (already present); border-strength shift. `cursor: pointer` on the whole card where the body is a link.
- **Rail district rows, spec pills, view-toggle, sort, chips, "List your company" tile, Search button, Follow**: `:hover` background / border / color transitions; `cursor: pointer` on every clickable; `:focus-visible` ring for keyboard users.
- **Ad cells**: same hover lift as cards (they sit in the same grid rhythm) + pointer on the clickable area.
- No pointer cursor on non-interactive text; transitions kept to `~150ms` (token) so nothing feels sluggish.

## Components

- New: `CompanyDirectorySearchBand`, `CompanyDirectoryRail`, `CompanyDirectoryAdCell`, `CompanyCardRow` (list view).
- Changed: `CompanyDirectoryScreen` (two-column + toolbar + chips + ad injection + view state), `app/connect/companies/page.tsx` (parse view? no - localStorage; resolve first-party ad; pass district facets through), `CompanyCard` (hover/pointer pass).
- Removed: `CompanyDirectoryFacetPanel` (superseded by search band + rail).
- Backend: `company-page-browse.helpers.ts` (+ `toDistrictFacets`, `pickBrowseSort` += `erpVerified`), `company-page.service.ts` (district facet aggregation + erpVerified sort), DTO (`sort` enum += `erpVerified`).

## Verification

- Backend: `nest build` (SWC); facet/sort helper vitest (district facet shaping, erpVerified sort).
- Web: touched-file `tsc --noEmit`; scoped vitest - search submits only on click/Enter (no request on type), rail district facet click sets `?district=`, ad cell resolves first-party -> Google -> null (no-gap), view toggle persists; `check:i18n` x4; `eslint`; banned-AntD grep.
- Manual (owner Tier-B): hover/pointer affordances on every interactive element; search button submits; ads appear at cadence and no-fill leaves no gap.

## Owner config (non-blocking)

- Seed the `company_directory` ad placement (surface: grid).
- Set `NEXT_PUBLIC_ADSENSE_SLOTS.company_directory` to the AdSense slot id.
- Commit (incl. the 4 `app/messages/*.json`); restart backend (new facet path).
