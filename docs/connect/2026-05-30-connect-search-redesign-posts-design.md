# Connect Search: Redesign + Posts Vertical (Design Doc)

**Date:** 2026-05-30
**Status:** DRAFT for owner review. No code written yet.
**Author:** assistant (system-design pass, owner-requested)

---

## 0. Why this doc

The dedicated search page (`/connect/search`) started as a people-only Phase-2
search and grew federated tabs (S1.6). Three loose ends were never closed, and
the owner caught all of them while testing:

1. A redundant in-page search bar duplicates the global header bar (LinkedIn has one bar).
2. The empty / prompt copy is people-specific even on the federated "All" tab.
3. Posts (feed) are not searchable at all: no posts index, no posts vertical, no Posts tab.

Evidence (confirmed in code, read-only):

- Duplicate bar: `features/connect/search/SearchResultsScreen.tsx:195` renders a
  second `ConnectSearchBar` inside the page, on top of the header bar.
- People-specific copy: `app/messages/en.json:1102-1107`
  (`subtitleEmpty` "No people found for X", `emptyTitle` "No people found",
  `noQueryBody` "to find people in the embroidery trade") is used for the `all`
  and `people` branches in `SearchResultsScreen.tsx:127-130, 351-360`.
- No posts vertical: `federated-search.service.ts:37-39` defines
  `SearchGroup = people | listings` only; jobs is "coming soon", posts absent.
- Mobile divergence is by design: `ConnectMobileSearch.tsx:227` (mobile entry
  overlay) navigates to the same `/connect/search` page on submit. Its live
  typeahead is people-only.

---

## 1. Requirements

### Functional

- One persistent search bar (the global header bar). Remove the in-page duplicate.
- Federated results page with verticals: **All** (blended preview), **People**,
  **Posts** (new), **Listings**, **Jobs** (coming soon), Companies (later, P6).
- Each vertical: its own filters and its own correct empty state.
- Posts searchable by free text + hashtags; ranked; **public posts only**.
- Mobile entry and results stay consistent with desktop and never lose the ability to refine.

### Non-functional

- Meili-first with a Mongo-regex fallback (the existing pattern, so search works
  before Meilisearch is provisioned).
- Person-centric. No workspace concept anywhere.
- **Privacy is the hard constraint:** only `visibility: 'public'` and not
  soft-deleted posts may ever surface. Connections-only / hidden posts must be
  structurally unreachable, with a re-pin at hydration so a stale index row
  cannot leak.
- i18n across all 4 locales (en / gu / gu-en / hi-en). This is a member surface.
- Reuse over rebuild: the federation registry, `multiSearch`, the
  `connect.post.changed` event, and a static post card.

### Constraints (existing building blocks)

- `FederatedSearchService` + `search-index.registry.ts` + `MeiliClient.multiSearch` (S1.5).
- `connect.post.changed` is already emitted on post create / edit / delete
  (Wave 6 pre-land). The indexer listener was deliberately deferred. This design
  finally adds it (the long-planned "Wave 5 posts-in-search").
- `Post` schema: 5 kinds (text / photo / video / document / voice), `media[]`,
  `audio`, `hashtags`, soft-delete (`deletedAt`), `visibility`, denormalized
  `authorErpLinked` / `authorSkills` ranking signals.
- ENGINEERING-STANDARDS: env loader, guards, audit, OTel spans on reads, PostHog
  on writes only, colocated `*.vitest.ts`, the `@nestjs/mongoose` decorator-mock
  pattern, no em-dash.

---

## 2. High-level design

```
                        Global header ConnectSearchBar (the ONLY bar)
                                     |
                         submit -> /connect/search?q=&type=
                                     |
                       page.tsx (Server Component)
                                     |
                       searchConnectAll(input)  ->  GET /connect/search
                                     |
                          FederatedSearchService.search
                 (query-understanding -> alias->slug -> fan out per vertical)
                       /              |               |              \
                  people          posts(NEW)       listings         jobs
              SearchService     SearchService     SearchService    (coming soon)
              .searchPeople     .searchPosts      .searchListings
                   |                |                 |
              connect_people   connect_posts     connect_listings   (Meili indexes)
                                (NEW)
                                     |
                       envelope { results, listings, posts(NEW), groups[], type, query }
                                     |
                       SearchResultsScreen (tabs: All/People/Posts/Listings/Jobs)
```

### Components touched

- **Backend (new):** `connect_posts` index def in the registry; `buildPostDocument`
  - `toPostRef` helpers; `SearchService.indexPost` / `reindexAllPosts` /
    `searchPosts`; an `@OnEvent('connect.post.changed')` indexer; a posts arm in
    `FederatedSearchService`; `SearchGroup` gains `posts`.
- **Web (new):** a `Posts` tab; a static `PostResultCard`; a posts section in the
  "All" view; posts empty / prompt copy.
- **Web (fix):** remove the in-page `ConnectSearchBar`; genericize the All-tab copy.

---

## 3. Deep dive

### 3.1 Data model: `connect_posts` Meili document

Mirror `connect_listings` (the established pattern). One document per public,
non-deleted post.

```
ConnectPostDocument {
  id: string            // Post._id
  authorId: string
  text: string          // the post body (searchable); '' for media-only posts
  hashtags: string[]    // canonical slugs (filterable)
  kind: 'text'|'photo'|'video'|'document'|'voice'  // filterable
  authorErpLinked: boolean   // ranking signal, mirrors people/listings
  engagementScore: number    // reactions + comments tally, numeric ranking signal
  createdAt: number          // unix ms, sortable + ranking tiebreak
}
```

- **searchableAttributes:** `['text', 'hashtags']` (text first).
- **filterableAttributes:** `['hashtags', 'kind', 'authorId', 'createdAt']`.
- **sortableAttributes:** `['createdAt', 'engagementScore']`.
- **rankingRules:** defaults + `engagementScore:desc` + `createdAt:desc` (a
  popular recent post outranks an old quiet one once relevance ties). Mirrors the
  listings `searchPriority:desc` + `createdAt:desc` shape.
- **synonyms:** the shared textile synonym map (same as people / listings).

**Privacy:** only posts with `visibility: 'public'` and `deletedAt: null` are
indexed. The indexer purges anything else (mirrors `indexListing`). The Mongo
hydration re-pins `visibility: 'public', deletedAt: null` so a stale index row
between an edit and a reindex cannot leak a now-private post. **comments and
reactions are never indexed or searchable.**

### 3.2 Hydration shape (`PostResult`)

Search returns post ids; hydrate live from Mongo (re-pinned public) into a slim,
render-ready card shape (mirror `toListingRef` / the profile `ActivityCard`):

```
PostResult {
  postId, authorId,
  author: { name, avatar, handle } | null,   // batch $in lookup, never N+1
  snippet: string,         // first ~160 chars of text
  kind, mediaPreview: {...}|null,
  reactionCount, commentCount,
  createdAt
}
```

### 3.3 Indexer (closes the deferred Wave 5)

```
@OnEvent('connect.post.changed')
async onPostChanged({ postId }) { await this.indexPost(postId) }   // fire-and-forget

indexPost(postId):  load post; if public && !deleted -> upsert buildPostDocument; else delete from index
reindexAllPosts():  ensureIndex(settings) then page public posts, bulk upsert   // provisioning
```

The event already fires on create / edit / delete, so no producer change is needed.

### 3.4 Federated arm + API

- `SearchGroup` gains `{ type: 'posts'; results: PostResult[] }`.
- `FederatedSearchResult` gains a top-level `posts: PostResult[]` primary (mirrors
  `listings`), and `ConnectSearchType` gains `'posts'`.
- `GET /connect/search?q=&type=posts` (+ optional `kind` facet) returns the posts
  group. `type=all` blends people + posts + listings, weight-ordered.
- Back-compat: `results` (people) stays top-level, so existing Phase-2 consumers
  (the header typeahead) are unchanged.

### 3.5 Web UI

- **Tabs:** All / People / Posts / Listings / Jobs. `?type=` URL-synced (existing `ModuleTabs`).
- **PostResultCard:** static (no realtime socket per row), links to
  `/connect/posts/[id]`; shows author, snippet, a per-kind media preview, and
  reaction / comment tallies. Adapt the existing static `ActivityCard` rather than
  the heavy interactive `PostCard` (which mounts a socket per card).
- **All view:** People section, then Posts section, then Listings section, each
  labelled, each with "see all" linking to its tab (LinkedIn blended pattern).
- **Filters:** Posts facet panel (content kind, optionally date posted). People
  and listings facet panels already exist.

### 3.6 The two quick fixes (independent, low-risk)

- **Remove the in-page bar:** delete the `ConnectSearchBar` block at
  `SearchResultsScreen.tsx:194-196`. The global header bar is the single bar.
  Mobile: the header search icon opens the `ConnectMobileSearch` overlay to
  refine, so no in-page bar is needed. (If usability testing shows mobile needs
  an always-visible field on the results page, add a slim `md:hidden` refine
  field as a follow-up. Flag, do not pre-build.)
- **Genericize the All-tab copy:** add `subtitleEmptyAll`, `emptyAllTitle`,
  `emptyAllBody`, and a generic `noQueryBody` (drop "people"); the screen picks
  per-`type` copy (people / posts / listings / all). i18n x4.

---

## 4. Scale + reliability

- Posts are higher volume than people / listings. Bound every search to the
  existing result cap; index only public posts (a subset); page the reindex.
  Revisit if the index grows: prune very old / zero-engagement posts, or add a
  periodic engagement-refresh reindex (the `engagementScore` denormalization goes
  stale between post writes, same accepted trade-off as the people `erpLinked`
  signal).
- Meili-disabled fallback: `searchPosts` runs a Mongo `$text` / regex query over
  public posts, mirroring `searchListingsViaMongo`, so search degrades, never breaks.
- Failure isolation: a posts-arm failure returns an empty posts group, never
  crashes the federated response (mirror the listings arm).

---

## 5. Trade-offs (explicit)

| Decision      | Chosen                                                | Alternative                        | Why                                                                                                         |
| ------------- | ----------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Post card     | Static `PostResultCard` (adapt `ActivityCard`)        | Reuse interactive `PostCard`       | Avoids a realtime socket per search row; search results do not need live like/comment                       |
| Ranking       | Denormalized `engagementScore` + recency in the index | Compute at read time               | Meili can only rank on indexed fields; accept staleness (self-heals on edit / reindex), same as `erpLinked` |
| Mobile refine | Header icon -> overlay; no in-page bar                | Keep an in-page bar on mobile only | Start simpler and LinkedIn-consistent; add a slim mobile field only if testing demands it                   |
| Privacy       | Index public-only + re-pin at hydration               | Index all, filter at query         | Defense in depth; a stale index row can never leak a now-private post                                       |

---

## 6. Phasing (recommended)

- **Phase A (surgical, low-risk, ~hours):** remove the duplicate bar + genericize
  the All-tab copy. Immediate UX correctness. No backend.
- **Phase B (backend, RED-first):** `connect_posts` index def + `buildPostDocument`
  / `toPostRef` + `searchPosts` (Meili + Mongo fallback) + `indexPost` /
  `reindexAllPosts` + `@OnEvent` indexer + the federated posts arm + `SearchGroup`
  / `type` widening. `nest build` + scoped vitest.
- **Phase C (web):** Posts tab + `PostResultCard` + All-view posts section + posts
  facet panel + posts empty / prompt copy + i18n x4 + tests.
- **Phase D (optional):** mobile overlay parity (blended typeahead), saved
  searches / alerts (currently deferred), Companies vertical (P6).

Phase A is independently shippable today. Phases B + C are the real "posts search"
feature and are best done as one focused backend-then-web pass.

## 7. What to revisit as it grows

- Saved searches + alerts (the §13.4 feature, its own backend).
- Companies vertical (P6) and jobs vertical (P5) when those modules land.
- Vector / semantic search and LLM rerank (deferred by the S1 karpathy scope).
- Index size management (pruning, engagement-refresh cron).

## 8. Out of scope

- Buyer-to-seller messaging / DM search.
- Any change to the mediator model or monetization.
- Mobile-app (React Native) search (this is web only).
