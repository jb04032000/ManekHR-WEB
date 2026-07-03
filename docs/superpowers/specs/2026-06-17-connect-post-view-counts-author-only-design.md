# Connect post view counts — author-only + honest count

**Date:** 2026-06-17
**Status:** Design approved (owner), pre-implementation
**Scope:** crewroster-web + crewroster-backend (NO mobile — standing rule)
**Architecture decision:** see
[ADR-0002](../../../../crewroster-backend/docs/architecture/adr/0002-connect-post-view-count-semantics.md)
for the counting-semantics + storage decision.

## Problem

The Connect feed shows "N views" on each post. The owner saw a post reading
16-20 views with "only 2 members" and asked: should we show view counts at all,
and if so, why is the number wrong?

## Investigation result (it was not a bug)

- A view is counted only for an **authenticated** viewer who dwells on the post.
  The author's own views never count. Logged-out / anonymous visitors never
  count (the public permalink is read-only).
- Dedup is enforced by a unique index; the post's `viewCount` goes up only when a
  brand-new `(viewer, post)` view record is created. There is one increment site.
- The test network seeds **18 demo personas**. Each demo account that browses the
  feed is a real distinct viewer, so 16-20 unique views is the correct number for
  that network. "2 members" meant ERP workspace members — a different population
  from Connect viewers.

Two real gaps did surface (both addressed below):

1. **Slow upward drift.** View records auto-expire after 90 days, so the same
   person re-viewing an old post can be counted twice over long periods.
2. **Demo views baked into real posts.** Deleting demo accounts does not remove
   the views (or reactions/comments) they left on real posts.

## Decision (product)

View counts move to the **author-only** (LinkedIn) model:

- Only the post's author sees "N views," on their own posts.
- Everyone else — and the logged-out public link — sees no view count.

Rationale: on a small/young network, tiny public counts read as weak and cause
the exact "why is this number odd?" confusion the owner hit. Author-only keeps a
useful signal for the poster without exposing it publicly.

## Design

### Part 1 — Author-only display (web)

- `components/connect/PostCard.tsx` — the view-count chip (the `<Eye>` + count in
  the footer right group) renders today whenever `post.viewCount > 0`. Gate it on
  authorship: only render when the viewer is the author. The component already
  computes `isOwnPost` (`viewerId === post.authorId`); reuse it →
  `isOwnPost && post.viewCount > 0`.
- `components/connect/PublicPostView.tsx` — remove the "View count" block
  entirely. This component renders (a) the logged-out public permalink `/p/[id]`
  (no signed-in viewer → must never show) and (b) the repost embed nested inside
  another person's repost (not the author's own primary card). In both cases the
  count should not appear. The author always sees their own count on the post's
  primary `PostCard` in their feed/profile.
- i18n: the `connect.feed.post.views` key stays (still used by `PostCard` for the
  author). No new copy needed. No locale churn expected.

**Out of scope / flagged:** the mobile app is untouched (standing rule). If it
shows a view count it keeps doing so until separately addressed — a temporary
web-vs-mobile mismatch the owner has accepted.

### Part 2 — Honest counting (backend; logical change — see ADR-0002)

Locked definition: **`viewCount` = lifetime unique viewers.** Each authenticated
non-author person counts once per post, for the life of the post, never
re-counted.

The counting **flow** (unchanged where already correct):

1. A signed-in member scrolls the feed. A post that stays ≥ half-visible for ~1s
   is marked "seen" by the browser, once per session
   (`PostCard` IntersectionObserver → `useFeedImpressions`).
2. The browser batches seen ids and posts them (debounced, fire-and-forget) to
   `POST /me/connect/feed/views`.
3. The server, per post in the batch (`FeedService.recordViews`):
   - skips it if the viewer is the author (no self-views);
   - upserts a permanent `view` record for `(viewer, post)` — idempotent;
   - increments `viewCount` by 1 **only** on first creation of that record;
   - upserts a temporary `SeenPost` row (still TTL'd — used only to stop For-You
     resurfacing the post; not the count dedup).
4. `viewCount` is therefore the count of distinct authenticated non-author people
   who have ever seen the post.
5. Display: shown only to the author (Part 1).

Changes that make the stored number match this definition (per ADR-0002):

- **Remove the 90-day partial TTL** on `view` `EngagementEdge` rows
  (`engagement-edge.schema.ts`) so the dedup marker is permanent; drop the
  `engagement_view_ttl` index on the live DB.
- **Add a recency window** (`createdAt >= now - 90d`) to the network-out feed
  discovery query that scans `view` edges, preserving the discovery behavior the
  TTL used to give implicitly.
- **Cascade-delete** a post's `view` edges + `SeenPost` rows when the post is
  deleted, so storage is bounded by live content rather than a clock.

### Part 3 — Clean demo views out of real counts (backend)

`AdminConnectDemoService.purge` must become count-honest:

- Delete `connectengagementedges` and `connectseenposts` where `actorId`/
  `viewerId` ∈ demo users OR `authorId` ∈ demo users.
- For each **real** (non-demo) post that demo accounts had engaged with,
  recompute the denormalized tallies from the surviving rows:
  `viewCount = count(view edges)`, `reactionCount = count(reactions)`,
  `commentCount = count(comments)`. (Reaction/comment recompute closes the same
  class of leftover as views, since the purge already deletes demo reactions/
  comments but never re-derived the counts on real posts.)
- One-off reconciliation for data already polluted before this ships: the same
  recompute, run once over real posts (the cleanup path covers it when demo
  accounts are purged; a standalone reconcile is acceptable if demo accounts were
  already removed).

## Testing

Backend (`*.vitest.ts`):

- self-view never increments; anonymous path is unreachable (auth-guarded).
- a `(viewer, post)` view counts exactly once even when re-sent after the old
  90-day window (regression for the drift fix).
- post delete removes its `view` edges + `SeenPost` rows.
- discovery query still excludes `view` edges older than the recency window.
- demo purge: a real post viewed/reacted/commented by demo accounts has its
  `viewCount`/`reactionCount`/`commentCount` recomputed to exclude them.

Web:

- `PostCard` shows the count when `isOwnPost`, hides it otherwise (unit/RTL).
- `PublicPostView` never renders a view count.
- existing `PostCard` / feed tests stay green; `check:i18n` green.

## Out of scope

- Mobile app (standing rule).
- A public/aggregate analytics surface, view-count threshold ("10+ rule"), or
  per-viewer "who viewed" list — not requested.
- HyperLogLog migration (ADR-0002 Option C) — future, only when `view` edge
  storage becomes a pressure.

## File touchpoints (for the plan phase to confirm)

- web: `components/connect/PostCard.tsx`, `components/connect/PublicPostView.tsx`
- backend: `modules/connect/feed/schemas/engagement-edge.schema.ts`,
  `modules/connect/feed/feed.service.ts` (recordViews already correct; discovery
  query recency guard; post-delete cascade),
  `modules/admin/admin-connect-demo.service.ts` (purge recompute),
  a migration/ledger entry to drop the `engagement_view_ttl` index.
