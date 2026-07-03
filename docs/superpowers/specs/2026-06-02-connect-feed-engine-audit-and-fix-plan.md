# Connect Feed Engine - audit, research, and fix plan

Date: 2026-06-02
Scope: backend `src/modules/connect/feed/*` + web `features/connect/feed/*` + `app/connect/feed`.
Inputs: two read-only code audits (backend + web) + a cited deep-research pass on
feed/timeline engine best practice. Status: findings + proposed fix plan for owner
approval. NO code changed yet. (Feed behavior + visibility are logical/security
changes -> explicit approval required before implementing.)

## Verdict (did we build it the right way?)

**Yes, the architecture is sound - we did not under-build.** Our feed is a hybrid
fan-out-on-write (materialized follower timeline) + read-time discovery + a
pluggable ranking strategy, with diversity caps, "why am I seeing this" origin
chips, and seen-post suppression. Research backs the core choices:

- **Read-time ranking is the right call.** LinkedIn's FollowFeed chose pull +
  read-time scoring partly because a write-materialized ranked feed inflated
  storage ~62x and made relevance iteration hard (re-materializing feeds). We get
  the read-time-ranking benefit while keeping write-fanout simplicity. (primary:
  LinkedIn Eng blog, verified 3-0.)
- **For-You already does cold-start the right way** - discovery (trending / topic /
  geo / 2nd-degree) backfills page 1 so a zero-network user is not blank. Research:
  cold-start is THE risk for a new vertical network (chicken-and-egg "ghost town";
  Google+'s newcomer first session "didn't feel like walking into a lively room").
- **We correctly did NOT over-build the "celebrity" hybrid pull split.** Research
  (verified, and the verifier explicitly flagged it): at our SMB / sparse-graph
  scale, write-amplification is NOT the dominant problem - cold-start is. So the
  unbounded fan-out (audit M3) is a deferred scaling note, not a near-term fix.

So the work now is **specific bugs + gaps**, not a re-architecture.

## What we missed / got wrong (the empty-feed causes + correctness)

The "entirely empty for some users" symptom has TWO independent causes, both verified
in code:

1. **[HIGH · web] A transient `/me` failure blanks the whole feed page.**
   `app/connect/feed/page.tsx:57` puts `getMe()` (which _throws_, unlike the other
   `ActionResult`-safe calls) in the page `Promise.all`, then uses `me._id`
   unguarded (`:94`). Any `/me` blip rejects the load -> route error boundary ->
   truly blank/error screen even though the feed data is healthy. **Most likely the
   intermittent "empty for some users".**

2. **[HIGH · backend] The "Following" tab has no cold-start fallback.**
   `feed.service.ts:873` returns the in-network window with nothing else; a
   zero/low-network user (or one whose followees never posted) gets
   `{ posts: [], caughtUp: true }` (`:962`). The web _does_ show a friendly "Your
   feed is quiet" empty card (not a blank), but a user defaulted/stranded on
   Following sees no content. Research: a pure-chronological tab going blank for
   zero-network users is the canonical empty-feed trap.

**Correctness / privacy (research-validated):**

3. **[CRITICAL · privacy] `connections`-only posts leak to one-way followers.**
   Fan-out targets followers (one-way, no mutual connection), and
   `hydrateEntries` (`:933`) never re-checks `visibility`. This is exactly the
   Zanzibar "new enemy" failure class - visibility must be evaluated against the
   _current_ relationship, never bypassed. (primary: Zanzibar/USENIX, verified 3-0.)

4. **[HIGH] Stale/orphaned `FeedEntry` on unfollow/delete = the same "new enemy"
   problem.** Unfollow deletes only the Follow edge; the ex-followee's already-fanned
   posts linger in the viewer's feed until a 180-day TTL. An unfollowed user keeps
   seeing new-to-them content - the textbook causal-ACL violation.

**Performance / pagination:**

5. **[HIGH] No Mongo index for the trending/geo discovery scan** (`trending.source.ts`
   filters `visibility + createdAt`, no supporting index) - runs on every For-You
   page-1 load; latency cliff as `connectposts` grows.

6. **[HIGH] Pagination thinning** - `nextCursor`/`caughtUp` are computed from the raw
   20-entry window (`:864`) _before_ deleted posts + muted authors are dropped
   (`:870`,`:938`), so a "full" page can render far fewer than 20 (or empty) and
   the 20-per-page contract breaks. Compounds the empty-feed symptom.

7. **[MED] Discovery enriches For-You page 1 only**; deeper pages collapse to
   in-network. Low-network users get a rich page 1 then an abrupt end.

## Vision gaps (cold-start depth for a textile-trade newcomer)

Research's strongest cold-start lever is **seeding an "atomic network" - saturate one
dense local trade cluster + suggested-follows that actually seed the timeline.** That
maps directly to our Surat/Gujarat textile vision. Today:

- **Suggestions are people-only** - no company/storefront follow suggestions, even
  though Company Pages shipped and `browseCompanyPages` + page-follow exist. A
  buyer's first follow is often a mill/brand. (buildable-now)
- **"Trending / Industry pulse" rails are hardcoded "Coming soon"** - a newcomer gets
  zero topical discovery in the rails (only the in-stream mix). We already have a
  `TrendingSource` that could power a real rail. (buildable-now)
- **No evergreen popular fallback** - cold-start dies if no public post exists in the
  14-day trending window (fresh deployment / quiet period). (research open question
  on the right window for a low-velocity B2B feed - needs a product call.)
- **Empty state is single-CTA** ("Follow people") and not differentiated for a
  first-run vs filtered-empty user; `ConnectEmptyState` already supports a secondary
  action (e.g. "Write your first post" / "Explore the marketplace").

## Proposed fix plan (prioritized, surgical)

### Tier 0 - empty-feed + correctness hot-fixes (small, high-impact)

- **F1 [web]** Guard `getMe()` in the feed-page `Promise.all` so a `/me` blip
  degrades gracefully (the feed renders; the viewer chrome falls back) instead of
  blanking the page. ~surgical.
- **F2 [web/UX]** Never strand a low-network user on a blank-feeling Following:
  improve the empty state (differentiate first-run, add a secondary CTA + a "see
  what's trending" nudge that switches to For-You). Keep Following _semantically
  pure_ (only people you follow) - fix it at the empty-state layer, not by polluting
  the contract.
- **F3 [backend]** Enforce `visibility` in `hydrateEntries`: gate `connections`-only
  posts to actual connections (or stop fanning them to non-connection followers).
  Closes the privacy leak.
- **F4 [backend]** Add the missing `Post` index for the trending/geo scan
  (`{ visibility, createdAt }` or equivalent). One-line schema change.

### Tier 1 - pagination + data hygiene (medium)

- **F5 [backend]** Fix pagination thinning: over-fetch + top-up to `FEED_PAGE_SIZE`
  after dropping deleted/muted, and drive the cursor off surviving items.
- **F6 [backend]** GC `FeedEntry` on unfollow + on post-delete (the "new enemy"
  cleanup), instead of relying on the 180-day TTL.

### Tier 2 - cold-start depth + vision (larger; net value for newcomers)

- **F7 [backend]** Paginate discovery (deeper For-You pages keep getting fresh
  discovery), not page-1-only.
- **F8 [backend]** Evergreen popular fallback when the 14-day trending window is
  empty (needs a product call on window/threshold).
- **F9 [web/backend]** Company/storefront follow suggestions in PYMK + feed seeding
  (atomic-network) - reuse `browseCompanyPages` + page-follow.
- **F10 [web]** Replace the "Coming soon" Trending/Industry rails with a real
  trending rail powered by the existing `TrendingSource`.
- **F11 [web]** Empty-state polish (first-run differentiation + secondary CTA).

### Deferred (research says not needed yet)

- Celebrity/hybrid pull split (audit M3) - irrelevant at our scale; revisit only at
  a real follower-count crossover.
- EdgeRank-style directional affinity from interaction history - cold-start users
  have ~zero affinity anyway; add once interaction data accrues.

## Recommended sequencing

Tier 0 first (it kills the actual empty-feed reports + the privacy leak with small,
surgical diffs), then Tier 1 (pagination correctness), then Tier 2 (the
newcomer-experience depth that matches the textile-cluster vision). Each item ships
with tests + i18n where relevant. No fabricated data.

## Open product questions (for the owner)

- Evergreen-popular window for a low-velocity B2B feed (24h / 7d / 14d / all-time)?
- Should Following stay strictly pure (recommended), with the fix purely in the
  empty-state UX? Or should Following ever borrow trending when empty?
