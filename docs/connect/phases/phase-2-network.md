# Phase 2 - Network (Connections + Follows + Suggestions + Search)

Sub-plan. Per `WORKFLOW.md`: owner reviews this, then build. Master scope:
`connect-build-plan.md` → Phase 2 row. Wireframe: `source/connect-network.jsx`.

## Goal

A Connect member builds their professional graph - sends and accepts connection
requests, follows people and workshops, discovers relevant people through
ERP-weighted suggestions, and finds anyone through unified search. This is the
distribution layer: every later phase (feed reach, candidate sourcing, company
followers) is built on the edges created here.

## Acceptance criteria (owner checks against these)

1. A member sends a connection request to another member; the recipient sees it
   in Invitations · Received and can Accept or Ignore. On Accept, each appears in
   the other's Connections - in their locale, at 380px and desktop.
2. A member follows another person (asymmetric - no approval needed); it appears in
   Following and the followee's follower count rises. Unfollow reverses it. A
   connection request is symmetric and needs consent; a follow does not. (Following a
   `CompanyPage` activates when Company Pages exist - Phase 6.)
3. The Suggestions tab shows "People you may know" ranked by ERP-linked workspace
   overlap, same area, skill match, and mutual connections - never by community or
   religion (PRD §3 anti-pattern).
4. A member searches from the global search bar and gets typo-tolerant people
   results; each result carries the ERP-linked badge and respects profile
   `visibility`.
5. The Network screen's four tabs (Invitations / Connections / Following /
   Suggestions) swap via the URL `?tab=` without remounting the Connect shell.

## Scope

**In:** `connect/network` module - `Connection`, `ConnectionRequest`, `Follow`
(Mongo adjacency, no graph DB) · connection lifecycle (send / accept / ignore /
withdraw) · follow / unfollow a person (the `Follow` edge also models `companyPage`
followees, exercised once Company Pages exist) · mutual-connection
count · ERP-weighted suggestions · `connect/search` module + Meilisearch people
index (env-gated, Mongo fallback) · `/connect/network?tab=` · `/connect/search?q=&type=`
· `ModuleTabs` (JIT) · Connect / Follow buttons + relationship state on `/u/[id]`
· connection-request count in the nav · i18n (4 locales) · tests.

**Out (later phases):** feed / posts (P3) · DM / messaging (P7) · rich company
**pages** (P6 - the follow _edge_ with a `Workspace` as followee ships here) ·
hashtag follows, saved searches with alerts, Blocked list (the wireframe left-rail
extras - deferred; saved-search alerts need the P3 digest infra, block belongs with
P7 safety) · search of products / jobs / posts (each registers its own index in
its phase).

## Backend tasks (`crewroster-backend/zari360-connect`)

- **B1** - `connect/network` module scaffold + three schemas. `ConnectionRequest`
  (`fromUserId`, `toUserId`, `status: pending|accepted|ignored|withdrawn`, `note?`,
  `createdAt`, `respondedAt`). `Connection` - the accepted edge, stored once as a
  sorted `users: [idLow, idHigh]` pair (dedup + symmetric query), `since`. `Follow`
  (`followerId`, `followeeType: 'user'|'companyPage'`, `followeeId`, `createdAt`) -
  Phase 2 creates only `user` follows; `companyPage` follows activate at Phase 6.
  Unique compound indexes on each. **Logical change - approve in this review.**
- **B2** - `NetworkService`: `sendRequest`, `respondToRequest` (accept → create
  `Connection`; ignore), `withdrawRequest`, `listInvitations` (received / sent /
  archive), `listConnections`, `removeConnection`, `follow`, `unfollow`,
  `listFollowing`, `mutualConnections(viewer, target)`, `getRelationship(viewer,
target)`, counts. Guards: no self-request, no duplicate pending, no request to an
  existing connection.
- **B3** - `NetworkController` - `/me/connect/network/*` (`JwtAuthGuard`, not
  subscription-gated): connection requests, connections, follows, counts. Plus
  relationship state folded into the public profile read. Class-validator DTOs,
  `AuditService`, PostHog events (`connect.connection_requested` /
  `_accepted` / `connect.followed`), OTel spans.
- **B4** - `SuggestionService`: ERP-weighted "people you may know" - weighted score
  over (a) shared / overlapping ERP-linked workspace, (b) same city/area from the
  workspace location, (c) `ConnectProfile.skills` overlap, (d) mutual-connection
  count. Excludes self, hidden profiles, and anyone already connected / requested.
  No community / religion input (no such field exists; documented as a guard).
- **B5** - `connect/search` module: env-gated Meilisearch client (`MEILI_HOST` /
  `MEILI_KEY` unset → safe no-op + Mongo-regex fallback, mirroring the OTel / Sentry
  empty-config pattern). A `people` index over `public`-visibility `ConnectProfile`s
  (name, headline, skills, area, ERP-linked); indexer hooks `ConnectProfileService`
  create / update; query service with typo tolerance. `GET /connect/search`.
- **B6** - wire the connection-request count into the existing nav badge source;
  the P1 Day-1 home featured list switches from curated to `SuggestionService`.
- **B7** - tests - service unit + controller integration (in-memory Mongo);
  Meilisearch wrapper tested against the no-op / fallback path.

## Frontend tasks (`crewroster-web/zari360-connect`)

- **F1** - `/connect/network` route + `ModuleTabs` (JIT, URL `?tab=`, shell does not
  remount). Four tabs. Wireframe: `source/connect-network.jsx`.
- **F2** - Invitations tab - Received / Sent / Archive; Accept / Ignore / Withdraw;
  optional request note.
- **F3** - Connections tab - list (reuse `PersonCard`), filter-within, remove.
- **F4** - Following tab - followed people; unfollow. (Followed Company Pages appear
  here once that entity exists - Phase 6.)
- **F5** - Suggestions tab - "People you may know" (filter pills: area / skills /
  mutuals). The wireframe's "Workshops & brands to follow" row activates with Company
  Pages (Phase 6).
- **F6** - `/connect/search` results page (`?q=&type=`); wire the existing
  `ConnectSearchBar`; people results with the ERP-linked badge.
- **F7** - profile integration - Connect / Follow buttons + live relationship state
  on `/u/[userId]` and the own-profile-of-others view.
- **F8** - JIT components - `ModuleTabs`, `CompanyFollowCard`; reuse `PersonCard`.
  All on `/design-system`.
- **F9** - connection-request count in `ConnectModuleNav` + `ConnectMobileTabBar`.
- **F10** - empty / loading / error states, i18n (4 locales), component tests.

## Decisions (made - research-grounded, not owner-blocking)

- **Connection = symmetric + consent; Follow = asymmetric + no approval.** LinkedIn
  "Connect" vs "Follow" split. Connect's "Invitations" are _connection requests_ -
  a distinct domain from the ERP `invitations` (workspace team-member invites); the
  two are NOT merged.
- **`Connection` stored once** as a sorted user-id pair, not two rows - dedup, and
  a single index serves the symmetric query.
- **Suggestion ranking:** weighted - ERP-linked workspace overlap (highest), then
  same area, skill overlap, mutual count. Excludes existing edges. The §3 anti-
  pattern (community / religion) is structurally impossible - no such field.
- **Search:** Meilisearch `people` index, typo-tolerant, visibility-aware (only
  `public` profiles indexed). Env-gated with a Mongo-regex fallback so Phase 2
  ships and runs before the Meilisearch service is provisioned.
- **A follow targets a `User` or (later) a `CompanyPage` - never an ERP `Workspace`.**
  A "workshop" in Connect is a `CompanyPage` (a standalone entity, Phase 6). Phase 2
  ships person follows; the `Follow` schema reserves the `companyPage` followee type
  so Phase 6 needs no migration.

## Open - flag for owner

- **New schemas (B1)** - `Connection`, `ConnectionRequest`, `Follow` + their
  indexes. Logical change - **approve in this sub-plan review.** No data migration
  (all new collections).
- **Meilisearch - new infrastructure.** A self-hosted search service (Docker
  container, like Redis). **Free / open-source - NOT a paid dependency.** The
  `connect/search` code ships complete and env-gated: with `MEILI_HOST` unset it
  falls back to Mongo-regex search, so Phase 2 is shippable before provisioning.
  **Ops task to flag:** provision Meilisearch before the search wave goes to GA.
- **`Workspace` as a followable entity** - needs a lightweight public read (name,
  area). Minor extension to the workspaces module - flag.

## Verification

Per-phase: backend scoped `tsc` + `vitest` green · web `tsc` / eslint / `next build`
· `check:i18n` connect-keys parity (+ the #18 em-dash gate) · all 5 acceptance
criteria demonstrably met · screens at 380 / 768 / 1280px · `/design-system` renders
new components · Playwright E2E for request→accept→connections and search · per-phase
hardening sub-checklist (analytics, WCAG-AA, i18n, perf, seed data, demo note).

## Execution order (waves)

1. **B1–B3** - network module: schemas, connection + follow service, endpoints.
2. **F1 + F8** (shell + `ModuleTabs`) → **F2 + F3 + F4** (Invitations / Connections
   / Following tabs).
3. **B4 + F5** - suggestion service + Suggestions tab.
4. **B5 + F6** - `connect/search` + Meilisearch + the search results page.
5. **F7 + F9** - profile Connect / Follow integration + nav counts.
6. **B6 + F10 + B7** - count wiring, states / i18n / tests folded in → verify →
   owner review checkpoint.
