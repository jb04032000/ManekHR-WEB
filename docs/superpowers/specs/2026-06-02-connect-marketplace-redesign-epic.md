# Marketplace redesign epic (UI + missing data features)

Date: 2026-06-02
Status: Design for review (owner chose full scope: redesign + the missing data features)
Repos: `crewroster-backend` (Connect), `crewroster-web` (Connect), branch `zari360-connect`
Reference: `connect-marketplace-redesign.html` (owner-provided mockup)

## Goal

Bring `/connect/marketplace` to the reference mockup's bar: a category icon strip,
a left filter rail, a product-card grid with seller trust signals, ratings,
response time, MOQ, save, sort + grid/list view. Build the redesign AND the
net-new data features behind it, with NO fabricated data and the ad rail
preserved (it is the income surface).

## Audit: reference element -> our data (the why behind the phasing)

| Reference element                                                     | Have it?                    | Action                                    |
| --------------------------------------------------------------------- | --------------------------- | ----------------------------------------- |
| Category strip + counts                                               | category facet counts exist | Phase A (UI)                              |
| Filter rail (type / district / price / negotiable)                    | facets exist                | Phase A (UI)                              |
| Result bar + sort + grid/list toggle + active chips                   | partial                     | Phase A (UI)                              |
| Product-grid card (icon header, eyebrow, title, price, MOQ, location) | mostly                      | Phase A (+ A0 ref)                        |
| Get quotation + WhatsApp footer                                       | inquiry + WhatsApp exist    | Phase A                                   |
| Seller / shop name on card                                            | NOT on search ref           | Phase A0 (index join)                     |
| MOQ on card                                                           | on listing, NOT on ref      | Phase A0 (add to ref)                     |
| ERP-verified badge                                                    | storefront erpLink exists   | Phase B                                   |
| GST-verified badge                                                    | NO GST DATA ANYWHERE        | Phase B (net-new: GSTIN capture + verify) |
| Star rating + "Top rated" sort + min-rating filter                    | NO rating model             | Phase C (net-new)                         |
| Response time + "replies within 2h" + "Fastest response"              | derivable from inbox        | Phase D (compute)                         |
| Save / bookmark + Saved view                                          | NO bookmark model           | Phase E (net-new)                         |
| "Grade A / Used" condition pill                                       | NO condition field          | Phase F (schema field)                    |
| Per-district counts                                                   | facet missing               | Phase G (facet)                           |

## Phase A0 - browse-ref data (backend, cheap, enables the card)

Add to the search listing index + `ConnectListingRef`:

- `moq: number | null` (already on the Listing; stamp into the index + ref).
- `sellerName: string | null` (the owning Storefront's name; resolved at index
  time via the `storefrontId` join, stamped on the indexed doc; re-indexed on a
  storefront rename via the existing listing-changed signal + a storefront-rename
  fan-out). The card shows the shop, never the raw user.
- (ERP badge data rides Phase B; rating/response ride C/D.)

## Phase A - the redesign (web, real data only)

`/connect/marketplace` becomes the reference layout, reusing the existing
`MarketplaceBrowseScreen` state machine (browse / recent / results / error) and
the existing facet inputs (`url-params`, `ListingFacetPanel` logic) - restyled,
not rebuilt:

- **Category icon strip**: the 8 known categories with textile glyphs + facet
  counts + an "All" pill; horizontally scrollable; active = indigo. Drives the
  `category` URL facet.
- **Left filter rail** (sticky): Listing type (product vs job-work), District
  (with Phase G counts), Price (min/max + include-negotiable), and the trust
  toggles that ride later phases (verified-only -> Phase B, replies-in-2h ->
  Phase D, min-rating -> Phase C) - each rendered only once its data lands.
- **Result bar**: count + sort (Phase A ships Price low/high + Recently listed;
  Top-rated / Fastest-response appear with C / D) + grid|list view toggle +
  active-filter chips.
- **Product grid card** (replaces today's single-column rows): cover image OR a
  category-colored icon header, category eyebrow, 2-line title, seller name +
  trust badges (Phase B), price / Negotiable, MOQ + district meta, rating
  (Phase C), response (Phase D), and a **Get quotation + WhatsApp** footer
  (quotation opens the inquiry flow; WhatsApp uses the seller's number when
  present). Whole card links to the listing detail.
- **Add-listing tile** closing the grid; **list view** alternative; empty state.
- **Ad rail PRESERVED**: the promoted-listing card folds into the grid as a
  sponsored tile and the existing right-rail ad slots stay (the reference's
  no-ads layout is rejected). The grid is `auto-fill, minmax(232px, 1fr)` inside
  `main`; the rail keeps its column. On < lg the rail drops, grid goes full width.

A `ListingCard` grid variant is added (the current row card stays for the
storefront / search surfaces, or both converge - decided in the plan).

## Phase B - seller verification badges (GST + ERP)

- **ERP-active**: derive from the storefront's `erpWorkspaceId` link (exists).
- **GST**: NET-NEW. Add `gstin` + `gstStatus` ('unverified' | 'verified') to the
  Storefront (or a seller-verification record); a capture field in the storefront
  settings; verification via the chosen GSTIN check (manual-admin in v1, API
  later). Surface both as the card's GST / ERP badges + the "Verified sellers
  only" filter + "ERP-verified first" sort. Stamp the seller's badge bits on the
  index for sort/filter.

## Phase C - ratings & reviews (net-new)

- `Review` model: a buyer rates a seller (1-5 + optional text) after an inquiry /
  deal; one review per buyer-seller (editable); abuse guard (only buyers who
  inquired; rate-limited). Aggregate `ratingAvg` + `ratingCount` per seller,
  stamped on listings' index for the star, the "4.0+/4.5+" filter, and the
  "Top rated" sort. Review submission UI on the seller / listing surface +
  moderation hook.

## Phase D - seller response time (compute from the inbox)

- For each seller, compute the median time from an inquiry's first buyer message
  to the seller's first reply, over a trailing window, from the inbox thread
  timestamps (we own those now). Bucket to "~Nh / same day / replies fast";
  stamp on the index for the "replies within 2 hours" filter + "Fastest response"
  sort + the card chip. A periodic job recomputes; no per-request cost.

## Phase E - save / bookmark (net-new)

- `SavedListing` model (userId + listingId, unique); a save toggle on the card +
  detail; a "Saved" view. Person-centric.

## Phase F - condition / grade tag (small)

- Add an optional `condition` enum to the Listing ('new' | 'grade-a' | 'used' |
  ...) shown as the card's top-left pill; a select in the product form; indexed
  for an optional filter. Textile-relevant values, researched.

## Phase G - district facet counts (small)

- Add `districtCounts` to the listings search response (mirrors
  `categoryCounts` / `tagCounts`), so the rail shows per-district tallies.

## Sequencing (recommended)

1. **A0 + A** - the visible redesign on real data (foundation; sets the card +
   filter slots the rest fill). Ad rail preserved.
2. **D** - response time (derivable from data we already own; high value, no new
   collection).
3. **G** - district counts (tiny).
4. **F** - condition tag (small schema + form + pill).
5. **B** - GST + ERP badges (GST is net-new capture + verify).
6. **E** - bookmarks (net-new collection).
7. **C** - ratings & reviews (largest; needs anti-abuse + moderation).

Each phase ships complete (BE + web + i18n x4 + tests) and is independently
committable. The card + filter rail are built in A with graceful "slot" gaps so
B-G drop in without re-layout.

## Non-negotiables

- No fabricated ratings / response / badges - a signal renders only once its data
  exists (graceful absence until its phase lands).
- Ad inventory preserved (promoted tile in-grid + right-rail slots).
- Reuse the existing browse state machine + facet plumbing; restyle, don't rebuild.
- i18n across en / gu / gu-en / hi-en; gu / gu-en / hi-en owe native review.

## v1 decisions (owner, 2026-06-02) - structure + UI now, real verification later

- **GST (Phase B)**: build the STRUCTURE + UI only. The seller enters their GSTIN
  in storefront settings and the GST badge shows as SELF-DECLARED (no admin step,
  no complex process). A `gstStatus` field exists ('declared' now; 'verified'
  reserved) so a future third-party GSTIN verification API drops in without a
  reshape. TODO marker in code: `// TODO(gst-verify): integrate GSTIN verification
API; until then gstStatus stays 'declared'`.
- **Reviews (Phase C)**: for the initial phase ALLOW any signed-in member to rate
  a seller (do NOT gate on a real transaction - we cannot yet prove one happened).
  Build it carefully for the edge cases (one review per buyer-seller, editable,
  self-review blocked, reportable) but open. A `verifiedPurchase` flag is reserved
  on the review (false now) so a later transaction-gating / weighting can use it
  without a migration. TODO marker: `// TODO(review-trust): gate / weight by a
real inquiry or transaction signal once available`.
- Everything else (response-time, condition, district counts, bookmarks) stays as
  specced - all use real data, no process needed.
