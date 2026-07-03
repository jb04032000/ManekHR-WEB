# Companies directory refinement - design

Date: 2026-06-02
Status: proposed (awaiting owner review)
Author: assistant (open-design + brainstorming + karpathy-guidelines)

## Context

Owner reviewed the live `/connect/companies` against the canonical prototype (`connect-companies.html`) and raised three things: the search bar looks too big, the page seems to miss content versus the reference, and the ad placement (should the right rail be ads?). Honest-data refinement, no fabricated values.

Findings (grounded in code):

- The search band is not over-padded but renders tall and full-width on a sparse page, so it dominates. A slim is warranted.
- The page looks empty mostly because there are only 2 real companies (the reference's 96 are mock). The one real polish gap is that category chips show raw slugs (`embroidery-zari`) instead of labels. The reference's richer card stats (Products, Rating) and extra filters (Company Size, Min Rating, Replies) were dropped as having no data; of those, Products count and Rating are real-able with new backend aggregations.
- Ads exist in-grid today (`CompanyDirectoryAdCell`, cadence after the 4th card then every 8th). There is no right rail. The marketplace has one.

## Decisions (owner-confirmed)

- Add a dedicated right ad rail (wide screens only) and keep the in-grid ads.
- Enrich the cards with real Products count + Rating (accept the net-new backend work).

## Fixes applied regardless (no decision)

- Slim the search bar to a sleeker height matching the reference.
- Humanize the category-strip labels (reuse the listing-category label helper; humanize unknown slugs as dash-to-space, capitalized).

## Slices

### Slice A - backend: real Products + Rating on the browse list

`CompanyPageBrowseItem` gains `productCount: number` and `rating?: { ratingAvg: number; ratingCount: number }`. The public browse path computes both per browsed page using batch aggregations (mirror the existing `CompanyPageStatsService.countsForPages` pattern, merged in `CompanyPagePublicController.browse`, NOT inside `CompanyPageService` to avoid the known circular dep):

- Products: storefronts where `companyPageId in [ids]` (map page -> storefront ids), then count active listings grouped by `storefrontId`, summed back per page. Two indexed aggregations.
- Rating: one aggregation over the ratings collection grouped by `subjectUserId` for the browsed pages' owner ids, returning `{ ratingAvg, ratingCount }` per owner, mapped onto the pages. No N+1.
  Defaults: `productCount: 0`, `rating` omitted when `ratingCount` is 0 (unrated companies show no rating). Put the merge/derivation in pure, unit-tested helpers. Perf: a handful of indexed aggregations over <=24 ids per page load, acceptable.

### Slice B - web data layer

`entities.types.ts`: add `productCount` + `rating` to `CompanyPageBrowseItem` (and the `BrowseFacet`/result types stay as-is). `company-page.actions.ts` `browse` already returns the backend shape; just widen the type. Update the directory test fixtures.

### Slice C - card enrichment (`CompanyCard.tsx`)

Add a real Products stat and a Rating to the card stat row, matching the reference's stat-row feel: a compact row of Products / Rating / Open jobs (Rating shown only when `rating.ratingCount > 0`; a star + the average + the count). Keep Followers as a lighter line. Do NOT add Replies (no response-time data). Honest: real numbers only, rating hidden when absent.

### Slice D - search bar slim + category labels

`CompanyDirectorySearchBand.tsx`: reduce the band height (tighter padding, smaller button/icon) to the reference's sleeker bar. `CompanyDirectoryScreen.tsx` category strip: render humanized labels.

### Slice E - right ad rail

Wrap the directory content so a right rail mounts as a third column on `xl+` (mirror the marketplace `ConnectPage flex` + `Rail side="right"` pattern). Use `ConnectRightRail` (its `connect.right.top` / `connect.right.mid` AdSlots resolve first-party -> Google -> nothing, no empty box) plus a small contextual panel (a "Promote your company" CTA linking to the boosts/create flow, or a tips panel). Keep the in-grid `CompanyDirectoryAdCell`. The rail is hidden below `xl`, so the grid is never squeezed on smaller screens. No new placement is strictly required (the connect.right.\* slots already exist); a first-party promoted card can reuse `resolvePromotedRailListing` if desired.

## Reuse

`ConnectRightRail`, `AdSlot`, `resolvePromotedRailListing`, the `countsForPages` aggregation pattern, the listing-category label helper, `CompanyCard`, and the marketplace right-rail layout.

## i18n

New card labels (`statProducts`, `statRating` / rating aria) and any rail-panel copy under the existing `connect.companies.*` namespace, across all four locales (gu/gu-en/hi-en best-effort).

## Verification

Backend: `nest build` + module-only vitest for the new pure helpers (RED first). Web: `tsc --noEmit`, `eslint` on changed files, `check:i18n`, `detect:hardcoded-i18n`, the banned-AntD `rg` self-check. No em-dashes. Zero git unless the owner asks.

## Out of scope (no data)

Replies-within-2h / response-time, Company Size and Minimum Rating filters (the reference shows them but we have no data), and the mock category counts. The category strip and grid fill in naturally as real companies join.
