# Connect mobile search parity (blended typeahead)

Date: 2026-05-30
Status: Approved (owner), implementation gated on the concurrent search-session all-clear.
Scope: Search Phase D, piece 1 of 3 (mobile parity). The other two Phase D pieces
(saved searches and alerts, Companies vertical) are out of scope here and get their
own specs later.

## 1. Problem

The desktop Connect search shows blended results: people, posts, and listings, both as
tabs and as grouped sections on the "All" view (`SearchResultsScreen.tsx`). The mobile
experience diverges. On mobile the global search bar is hidden and tapping the header
search icon opens a full-screen overlay (`ConnectMobileSearch.tsx`). That overlay's
live typeahead calls `searchConnect(q)`, which returns the people vertical only. So a
member typing on mobile sees only people inline, and must tap "See all results" to reach
posts and listings on the full page.

Phase D, piece 1 closes that gap: the mobile overlay typeahead shows a short blended
preview (people, posts, listings) in grouped sections, consistent with the desktop "All"
view.

## 2. Goals and non-goals

Goals:

- The mobile overlay typeahead returns blended results from the federated search.
- Results render as grouped sections (People, Posts, Listings) in the desktop order.
- Each result routes to its correct destination (profile, post, listing detail).
- Reuse the existing federated action and the existing desktop i18n. No backend change.

Non-goals (explicitly out of scope):

- No backend, schema, or endpoint change. The data already exists via `searchConnectAll`.
- No saved searches or alerts (Phase D piece 2, separate spec).
- No Companies vertical (Phase D piece 3, blocked on the Companies module not existing).
- No change to the desktop `ConnectSearchBar` typeahead (it stays people-only for now;
  widening it is a separate, optional follow-up).
- No mobile-app (React Native) change. This is web only.

## 3. Data layer (reuse, no new code)

`features/connect/search.actions.ts` already exports `searchConnectAll(input)`, which
hits `GET /connect/search` and returns the full `SearchResponse` envelope:

```
SearchResponse {
  results: PersonResult[];      // people vertical
  posts: PostResult[];          // posts vertical
  listings: ConnectListingRef[];// listings vertical
  type, query, groups;          // not needed by the overlay preview
}
```

Calling `searchConnectAll({ q })` with no `type` and no filters returns all three
verticals. The action already short-circuits a blank query and normalizes a partial
envelope to safe empty arrays. The overlay consumes `results`, `posts`, and `listings`
and ignores the rest.

Change in `ConnectMobileSearch.tsx`:

- `runSearch` switches from `searchConnect(q)` (people only) to `searchConnectAll({ q })`.
- The `results: PersonResult[]` state becomes a blended `preview` holding the three
  capped arrays: `{ people: PersonResult[]; posts: PostResult[]; listings: ConnectListingRef[] }`.
- The stale-response guard (`reqIdRef`) and the 250ms debounce are preserved unchanged.

Per-section caps (keep the overlay light and scannable):

- People: 3
- Posts: 2
- Listings: 3

## 4. Rendering

When `query.trim().length >= MIN_CHARS` (2), the body shows:

1. The "See all results" row, pinned on top, unchanged. It is the Enter target and routes
   to `/connect/search?q=<query>`.
2. Up to three grouped sections, in the desktop order People, Posts, Listings. A section
   renders only when it has at least one hit.
   - People row (unchanged): `DsAvatar` + name + optional headline. Tap routes to
     `/connect/u/{userId}` (the existing `selectPerson`).
   - Post row (new): author name + a one-line snippet (`PostResult.snippet`, truncated).
     Tap routes to `/connect/posts/{postId}` (new `selectPost`).
   - Listing row (new): a small cover thumbnail (or an `ImageOff` placeholder when
     `coverImage` is null) + title + category label. Tap routes to
     `/connect/marketplace/listing/{listingId}` (new `selectListing`). Price is not shown
     in the preview row; it appears on the listing detail page after tap-through.

States:

- Loading and no results yet: the existing spinner row.
- All three sections empty and not loading: the existing
  `connect.shell.mobileSearch.noResults` copy.

Unchanged: recent searches, suggested categories, voice search, autofocus, scroll lock,
Escape-to-close, and the `submit` / recents persistence.

## 5. Accessibility

Today the results area is a single `role="listbox"` with the see-all button and person
buttons as implicit options. That does not fit a multi-section layout. Replace it with the
desktop pattern from `SearchResultsScreen.tsx`:

- The results area is a plain container.
- The "See all results" row stays a native `<button>` on top.
- Each group is a `<section aria-labelledby="...">` with a heading (h2) and native
  `<button>` rows inside. Buttons are keyboard-reachable with the correct tab order.

This removes the loose listbox semantics and aligns the overlay with the desktop a11y
structure. Decorative icons keep `aria-hidden`. The voice "listening" status row keeps its
`role="status"`.

## 6. i18n

Reuse existing keys, no new strings expected for the common path:

- Section headings: `connect.search.allSectionPeople`, `connect.search.allSectionPosts`,
  `connect.search.allSectionListings`.
- Listing subtitle: `connect.search.listing.category.<category>`.
- Per-section result aria labels where useful: `connect.search.resultsAriaPosts`,
  `connect.search.resultsAriaListings`. If a people aria label is missing, add
  `connect.search.resultsAriaPeople` (or reuse the overlay title) in all four locales
  (en, gu, gu-en, hi-en), assistant-authored, native review pending. The overlay already
  uses a second namespace pattern (`connect.shell`); it gains a `connect.search` hook to
  read these. No em-dash in any new string.

The `check:i18n` prebuild gate must stay green (4-locale parity).

## 7. Testing (RED-first)

Extend `ConnectMobileSearch` tests (mock `searchConnectAll`):

- Typing renders all three sections when the envelope has people, posts, and listings.
- A section is omitted when its vertical is empty.
- Tapping a listing row routes to `/connect/marketplace/listing/{id}`.
- Tapping a post row routes to `/connect/posts/{id}`.
- Tapping a person row still routes to `/connect/u/{id}`.
- "See all results" still routes to `/connect/search?q=`.
- All-empty envelope shows the no-results copy.

Verify: changed-file `eslint`, `tsc --noEmit` (touched files clean), `node scripts/check-i18n.js`,
and the scoped `ConnectMobileSearch` vitest.

## 8. Files

- `components/connect/ConnectMobileSearch.tsx` (the only source change).
- `components/connect/ConnectMobileSearch.test.tsx` (extend or create).
- `app/messages/{en,gu,gu-en,hi-en}.json` only if a missing aria key must be added.

## 9. Risks and coordination

- Collision: `ConnectMobileSearch.tsx` is in the shared search lane where a second session
  is currently open. Implementation must not start until that session is confirmed done or
  confirmed not to be in the search/mobile files. Stage only the explicit file paths above
  and check `git status` before committing.
- Performance: the typeahead now runs the federated multi-vertical search per debounced
  keystroke instead of people-only. It remains a single `/connect/search` call (the backend
  batches via `multiSearch`); the 250ms debounce is unchanged. Acceptable.
- Back-compat: `searchConnect` stays exported and used by the desktop `ConnectSearchBar`.
  This change touches only the mobile overlay.
