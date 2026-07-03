# Phase 7c / Wave 6 - Feed at Scale (decision doc)

> **Status:** decision doc - **no runtime code in this wave.** It records the
> scaling model the live feed already assumes, the thresholds at which we change
> strategy, the retention numbers in force today, and a ship/defer matrix for the
> remaining LinkedIn-style feature surface. Owner signs off on the numbers +
> the ship/defer column; the code lands in a later, separately-planned wave when
> a real scale signal (or product priority) calls for it.

Master scope: `connect-build-plan.md` → Phase 3 / Phase 7c. Builds on
`phase-3-feed.md` (fan-out-on-write + read-time ranker) and the Phase 7c
candidate-source + impressions work.

---

## 1. Where we are (the architecture this doc scales)

The feed is **fan-out-on-write for follows + a read-time candidate pipeline for
everything else**:

- **Write path.** A new post writes the author's own `FeedEntry` inline (instant
  self-visibility), then a BullMQ job (`connect-feed-fanout`) writes one
  `FeedEntry` per follower in `bulkWrite({ ordered: false })` batches of
  `FANOUT_BATCH = 1000`, at `FANOUT_CONCURRENCY = 5`. The `{ ownerId, postId }`
  unique index makes the fan-out idempotent (inline + worker never double-count;
  a retry is a no-op). Backfill-on-accept reuses the same queue.
- **Read path.** `getFeed` pulls a `postedAt`-windowed `FeedEntry` set
  (`FEED_PAGE_SIZE = 20`), then:
  - **Following** = pure in-network, reverse-chronological. Zero injection.
  - **For You** page 1 = `interleaveFeed(diversify(rankedIn), diversify(rankedDiscovery))`
    at ~70/30, where `rankedDiscovery` comes from the `CandidateSource`
    orchestrator (Trending / TopicMatch / NetworkOut / GeoLocal), ranked by the
    pluggable `FeedRankingStrategy` (W2 seam - no stored score), then filtered by
    negative-signals + seen-suppression. Deeper pages are pure in-network.

The follow graph is **one candidate source, not the feed.** This is the property
that lets us change the _fan-out_ strategy without touching discovery, ranking,
or the read contract.

---

## 2. The scaling problem - write amplification

Fan-out-on-write is the right default for a B2B textile network: low fan-out
(a workshop follows dozens, not millions), instant reads, cheap merges. It has
exactly one failure mode: **a single author with very many followers.** One post
by an author with _N_ followers writes _N_ `FeedEntry` rows. At N = 50 that is
free; at N = 50,000 it is a 50k-row write storm per post, and a prolific
high-follower author can saturate the queue.

For our market this is years away (no Connect author has thousands of followers
yet), which is why we **ship the simple push model now** and pre-decide the
switch so it is a config flip, not a rewrite, when it matters.

---

## 3. Decision - hybrid fan-out (push + pull) above a threshold

**Decision:** keep push (fan-out-on-write) for normal authors; switch a
high-follower author to **pull (merge-at-read)** above a follower threshold.
Their posts are NOT fanned out; instead a viewer's read merges in recent posts
from the high-follower authors they follow.

- **Threshold:** `FANOUT_CELEBRITY_THRESHOLD` - proposed **10,000 followers.**
  Below it, nothing changes. (Rationale: at 10k the per-post write is still only
  10 batches; the threshold is the point where write-amp + queue pressure start
  to dominate, not where it first appears. LinkedIn/X sit far higher; 10k is a
  conservative early guard for our scale.)
- **Read merge:** implemented as a new `CandidateSource`
  (`CelebrityMergeSource`) OR a `MergeAtReadStrategy` behind the existing W2
  ranker seam - it fetches recent posts (windowed, same `FEED_PAGE_SIZE` budget)
  from the viewer's followed high-follower authors and feeds them into the same
  merge → dedup → diversify → rank pipeline the discovery sources already use.
  **No read-contract change, no new pipeline** - it is one more source.
- **Boundary bookkeeping:** an author crossing the threshold stops being fanned
  out; their already-materialized rows age out via TTL (§4). An author dropping
  back below it resumes push. No migration - the read merge covers the gap.

**This is the only fan-out change.** Everything downstream (ranking, discovery,
negative/seen filters, impressions) is already source-agnostic.

---

## 4. Decision - retention / TTL (in force today)

Bounding storage is a standing memory/resource contract. Numbers currently
shipped:

| Collection       | Mechanism                                         | Value                             | Rationale                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FeedEntry`      | Mongo TTL index on `createdAt` (`feed_entry_ttl`) | `FEED_ENTRY_TTL_DAYS = 180`       | The feed is a rolling window; the source `Post` is untouched (Profile Activity reads Posts directly), so trimming the materialization is safe. Keyed on materialization time, not post time, so a backfilled OLD post still lives its full window. |
| `SeenPost`       | Mongo TTL index on `seenAt`                       | `SEEN_RETENTION_SECONDS = 7 days` | Suppresses a discovery post from re-surfacing for a week, then lets it return. Bounds the seen-set with zero cron.                                                                                                                                 |
| `EngagementEdge` | none (kept)                                       | -                                 | The cross-cutting signal layer (network-out discovery, view/repost/share counts, analytics). Not a rolling window - do not TTL without a separate decision.                                                                                        |
| BullMQ jobs      | `removeOnComplete: true`, `removeOnFail: 200`     | -                                 | Queue self-trims; failures retained for triage (`attempts: 3`, exp backoff 5s).                                                                                                                                                                    |

**Decision:** these values stand. `FEED_ENTRY_TTL_DAYS = 180` is the one most
likely to want tuning under real load (shorter = less storage, but a dormant
user returning after >180d sees an empty in-network feed until discovery +
re-engagement repopulate it - acceptable, and discovery never lets For-You be
empty). Owner may revise the 180 with no code change beyond the constant.

---

## 5. Decision - idempotent feed repair (`reindexFeed`)

Any materialized feed can drift (a dropped fan-out job, a TTL'd row for a still-
relevant post, a follow-edge backfill gap). **Decision:** ship (when needed) an
idempotent `reindexFeed(ownerId)` maintenance op that rebuilds a member's
`FeedEntry` set from the source of truth (their follow edges → recent author
posts), using the same `{ ownerId, postId }` upsert the fan-out worker uses - so
running it twice is a no-op and running it never duplicates. This is the repair
counterpart to the W1.5 follow-backfill migration. Not built now; specified so it
is a known, safe tool when an incident calls for it.

---

## 6. Ship / defer matrix - remaining LinkedIn-isms

What is left of the classic feed feature surface, and the call on each:

| Feature                                                           | Call                | Notes                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hashtags                                                          | **DONE**            | Parsed on create, indexed `{hashtags,createdAt}`, searchable (W5 search).                                                                                                             |
| Reactions · comments · views                                      | **DONE**            | Phase 3 + Wave D (impressions).                                                                                                                                                       |
| Discovery · ranking · negative/seen · cold-start · ERP-graph PYMK | **DONE**            | Wave D.                                                                                                                                                                               |
| External share + public permalink                                 | **DONE**            | Wave S1.                                                                                                                                                                              |
| Repost + quote-repost                                             | **DONE**            | Wave S2.                                                                                                                                                                              |
| **Saved / bookmarked posts**                                      | **SHIP (small v1)** | `SavedPost { userId, postId }` + unique index + a "Saved" tab reading it. No fan-out, no ranking - a private list. ~1 schema + 2 endpoints + 1 tab. Recommend into this epic.         |
| **Edit post**                                                     | **SHIP (small v1)** | `Post.editedAt` + re-emit the search-index event + an "edited" label. No fan-out change (FeedEntry points at the same post). ~1 field + 1 endpoint + label. Recommend into this epic. |
| @mentions                                                         | **DEFER**           | Needs a mention parser + people-autocomplete in the composer + a `connect.post_mentioned` notification. Own small wave.                                                               |
| Follow-hashtag / follow-topic                                     | **DEFER**           | A new follow target + a candidate source. Folds onto the orchestrator cleanly later.                                                                                                  |
| Post analytics dashboard (author-facing)                          | **DEFER**           | The data exists (`viewCount`, `EngagementEdge`); the dashboard UI is its own surface.                                                                                                 |
| Multi-reaction (beyond `like`)                                    | **DEFER**           | Reaction schema already has a `type`; widening is a UI + aggregation change, low priority for this market.                                                                            |
| Internal share-to-chat (DM)                                       | **DEFER (blocked)** | Reserved post-reference contract exists; the send lands with the future messaging epic.                                                                                               |

---

## 7. Numbers needing owner sign-off

The only genuinely owner-owned calls in this doc:

1. **`FANOUT_CELEBRITY_THRESHOLD`** - proposed **10,000**. (Assistant's
   recommendation; revise freely - it is a config constant, no code shape
   depends on the exact value.)
2. **`FEED_ENTRY_TTL_DAYS`** - currently **180**. Keep or revise.
3. **Do Saved posts + Edit post enter THIS epic, or a follow-up?** Both are
   small, self-contained, and high-value; the recommendation is to ship them
   as the next Wave-6 implementation slice. Everything else in §6 is deferred.

No code changes ship from this doc. The hybrid-fan-out source, `reindexFeed`,
and the ship-column features are each separately planned + built when sequenced.
