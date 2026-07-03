# Marketplace facet counts (category + location) - design

Date: 2026-06-05
Surface: `/connect/marketplace` (Connect, `zari360-connect` branch)
Repos: `crewroster-web` (frontend) + `crewroster-backend` (backend)

## Why

A reference prototype showed a richer marketplace: counted category and location
filters, MOQ/rating/response-time filters, seller stats, save, tabs, a richer
quotation form, review gating, etc. Research (3 read-only agents, 2026-06-05)
established that **most of those are not backed by real data** and building them
would be fabrication. The owner approved a bounded, honest pass:

- **Do now (real data):** counts on the category filter; a real counted Location
  filter (top-N by count + free-text), via a small backend facet addition.
- **Not faked:** seller count header, MOQ/rating/response-time/ERP-active filters,
  grade badge, save/bookmark, seller name + GST/ERP badges on cards, tabs, seller
  stats trio, HSN/stock/color spec rows, richer quotation form, review gating.
  These need new schema/data/aggregation and are logged as a future backlog.

## Hard constraints (owner)

1. No static / fabricated filter data. Counts must be real aggregations.
2. No 20-30 item filter lists. Category is the fixed 8 slugs; Location shows
   **top-N by count** + the existing free-text input for the rest.
3. Preserve the boost engine + Google ad injection in the grid. The grid stays a
   flat `<ul>` with position-based ad-cell cadence (after 4th card, then every
   8th; first-party-once then Google fallback; no empty holes). This change does
   not touch the grid `<ul>` or `gridChildren`.

## What exists today (research)

- Backend already computes `categoryCounts` (Meili facet distribution) and
  returns it from federated search; the frontend `SearchResponse` type drops it
  (`search.service.ts:711,720`; `federated-search.service.ts:82-84,219-242`).
- `districtCounts` is NOT computed (only `['category','tags']` are faceted).
- Bare landing uses `GET /connect/search/listings/recent` ->
  `SearchService.browseRecentListings` which is a **Mongo** find (no counts),
  consumed only by the marketplace page.
- Mongo search fallback returns empty count maps (honest-degradation pattern).

## Design

### Backend (`crewroster-backend`)

1. `search.service.ts`
   - `searchListingsViaMeili`: add `'district'` to the `facets` array; extract and
     return `districtCounts` alongside `tagCounts`/`categoryCounts`.
   - `searchListings` (public method): thread `districtCounts` through (Meili: from
     result; Mongo fallback: `{}`).
   - `browseRecentListings`: in addition to the recent listings, run a Mongo
     `$facet` aggregation over `{ status:'active', moderationStatus:'approved' }`
     grouping by `category` and `district`; return
     `{ listings, categoryCounts, districtCounts }`. Corpus-wide counts (no
     filters) for the bare landing.
2. `federated-search.service.ts`: add `districtCounts` to the listing-search
   result type + thread into the response envelope (mirror `categoryCounts`).
3. `search.controller.ts`: `listings/recent` returns the new richer shape (the
   service return change flows through; no signature edits needed beyond the type).

Honest degradation: when Meili is down (Mongo search fallback) `districtCounts`
is `{}` and the UI hides counts rather than showing 0.

### Frontend (`crewroster-web`)

1. `search.types.ts`: `SearchResponse` gains `categoryCounts?: Record<string,number>`
   and `districtCounts?: Record<string,number>`.
2. `search.actions.ts`:
   - `fetchSearchEnvelope` normalizer: include `categoryCounts` + `districtCounts`
     with `{}` defaults (mirror `tagCounts`).
   - `browseRecentListings`: return `{ listings, categoryCounts, districtCounts }`
     (was `ConnectListingRef[]`). Single consumer (the page) updated.
3. `app/connect/marketplace/page.tsx`: read counts from the recent result (bare
   landing) or the search result (filtered), and pass `categoryCounts` +
   `districtCounts` to `MarketplaceBrowseScreen`. Ad resolutions unchanged.
4. `MarketplaceBrowseScreen.tsx`: accept the two count props; pass
   `categoryCounts` to `CategoryStrip` and `districtCounts` to `ListingFacetPanel`.
5. `CategoryStrip.tsx`: accept `categoryCounts`; render the real count on each of
   the 8 pills (omit when absent/zero-map). Single-select unchanged.
6. `ListingFacetPanel.tsx`: accept `districtCounts`; add a "Location" group =
   **top-N (6) districts by count** as single-select chips that set the existing
   `?district=` param (no backend filter change), with the existing free-text
   district input kept below for anything outside the top-N. Group hidden when no
   counts.

### Data flow

`page.tsx` (server) -> facet counts (recent aggregation OR search facets) ->
`MarketplaceBrowseScreen` -> `CategoryStrip` (category counts) + `ListingFacetPanel`
(district counts). Counts reflect the active filter set on the search path and the
full corpus on the bare landing. Re-fetch on every URL change (existing behavior).

### Edge cases

- No counts (Meili down / empty corpus): pills and the Location group render
  without counts; the Location group hides entirely if the district map is empty.
- A `?district=` value outside the top-N: the free-text input shows it; the chip
  group still shows the top-N. Selecting a chip toggles the single `district` param.
- Location chips are single-select (the backend `district` param is a single
  string). Multi-district is explicitly out of scope (would need a backend filter
  change).

### Tests

- Backend (vitest, scoped per BE caution): `browseRecentListings` returns category
  - district counts; the Meili listing search returns `districtCounts`.
- Frontend (vitest): `CategoryStrip` renders counts; `ListingFacetPanel` renders
  the Location top-N chips and toggles `?district=`; `MarketplaceBrowseScreen`
  threads the count props; `browseRecentListings` new shape.

## Out of scope (backlog for a future epic)

Seller-count header, MOQ/rating/response-time/ERP-active filters, grade badge,
save/bookmark, seller name + GST/ERP badges on cards, Browse/My-Leads/RFQ tabs,
seller stats trio, HSN/stock/color spec rows, richer quotation form (quantity /
target price / delivery timeline / contact preference), review-gating copy. Each
needs new listing/seller schema or aggregation; revisit as a phased epic.
