# Boosts in the feed — Phase 1 (unified in-feed sponsored slot)

**Date:** 2026-06-18
**Status:** Approved in shape (owner: one "Promote" flow, Spotlight optional add-on, phase feed-first)
**Scope:** Backend + Web + i18n (en/gu/gu-en/hi-en) + tests. No mobile app.

---

## 1. Goal

Today a boosted thing only shows in its own section (a boosted product → marketplace
rail, a boosted quote → RFQ board, a boosted job → jobs-board promoted block). **Make
every boost also appear in the main feed**, the highest-traffic surface — so "boost"
means "shows in its section AND the feed, to the right people."

This is **Phase 1** of the agreed model:

- **Boost** (base) = feed + its own section. ← this phase.
- **Boost + Spotlight** (optional upgrade) = the above + the premium right-rail spot, more
  credits. ← Phase 2 (NOT in this spec).

Spotlight is an opt-in add-on; there is no Spotlight-only.

---

## 2. Key design decision (internal, decided)

**One unified in-feed sponsored slot, one auction across all kinds.** Instead of a
per-kind feed slot, the feed has a single sponsored placement `feed_sponsored` that EVERY
boost kind is eligible for. Each sponsored slot the feed shows runs the existing auction
and renders the single best-matching boosted item for that viewer — could be a post,
profile (open-to-work / hiring), product, job, or quote. This:

- keeps ad density controlled (one shared slot, not one-per-type),
- gives correct economics (best/highest-value ad wins, not a fixed priority),
- reuses the existing auction's targeting / frequency-cap / fairness / pacing / dedup
  untouched (this is what makes "hundreds of advertisers, who sees whose ad" safe),
- consolidates the two feed slots I shipped today (`feed_promoted_post` +
  `feed_promoted_profile`, post-then-profile priority queue) into one clean system.

Up to **2 sponsored cards per feed page** at the existing cadence (first after post #4,
then every 6 posts); per-page dedup keeps them different campaigns.

---

## 3. Backend changes (crewroster-backend)

- **New placement** `feed_sponsored` (surface `feed`), seeded via the migration ledger
  (add to `seed-connect-ad-placements.ts`, bump the `adPlacements` checksum). The old
  `feed_promoted_post` / `feed_promoted_profile` rows stay seeded (harmless) but no new
  boost binds to them.
- **`boost.service.ts` — every create method gains `feed_sponsored` in its placements** (in
  addition to its section placement so the boost shows in BOTH):
  - listing: `['marketplace_rail', 'feed_sponsored']`
  - rfq: `['rfq_promoted', 'feed_sponsored']`
  - job: `['feed_sponsored']` (the jobs-board promoted block is a separate read-path
    resolver keyed on `kind: 'boost_job'`, unaffected; this adds billed feed delivery)
  - post: `['feed_sponsored']` (was `feed_promoted_post`)
  - open_to_work / hiring: `['feed_sponsored']` (was `feed_promoted_profile`)
- **Decision/candidate path: NO change** — `CandidateRepoMongo` + `AdDecisionService`
  already return any `creativeKind` + the right ref; pulling candidates for `feed_sponsored`
  returns all eligible kinds and the auction picks the winner.
- Update BE boost create tests for the new placements arrays.

## 4. Web changes (crewroster-web)

- **`ads.actions.ts`**: `decideSponsoredAd(placementKey, pageRequestId)` — returns the raw
  winning decision (any `creativeKind` + the matching ref: postRef / listingRef / jobRef /
  profileRef / rfqRef), or null. (The existing per-kind `decideAd`/`decideListingAd`/
  `decideProfileAd`/`decideRfqAd` stay for the section rails.)
- **`feed-ads.ts`**: generalize the feed-row ad model. Replace the `{promotedPost,
promotedProfile}` options + the post/profile priority queue with a single
  `sponsoredCards: FeedSponsoredCard[]` input, where `FeedSponsoredCard` is a discriminated
  union (post / profile / listing / job / rfq) carrying the hydrated entity + impression
  tokens. `buildFeedRows` places these cards at the existing cadence slots (one per slot,
  in order). A new `FeedRow` variant `sponsored` carries one `FeedSponsoredCard`.
- **Feed page (`app/connect/feed/page.tsx`)**: resolve up to 2 sponsored cards — loop
  `decideSponsoredAd('feed_sponsored', pageRequestId)` (same pageRequestId so dedup gives
  distinct campaigns), hydrate each by kind (post→getPublicPost, profile→hydratePeople,
  listing→getPublicListing, job→getPublicJob, rfq→getRfq), collect the resolved cards,
  pass to `FeedScreen`. All `.catch`-guarded so ads never error the feed.
- **New native feed cards** (full-width, "Promoted" label, MRC beacons via `useAdBeacons`):
  `PromotedListingFeedCard`, `PromotedJobFeedCard`, `PromotedRfqFeedCard`. Reuse the
  shipped `PromotedProfileAdCard` (profiles) and `AdCard` promoted branch (posts).
- **`FeedList.tsx` / `FeedScreen.tsx`**: take the `sponsoredCards` list (replacing
  `promotedPost`/`promotedProfile` props) and render each `sponsored` row by kind.
- **i18n** (en/gu/gu-en/hi-en): CTA/label strings for the three new feed cards (e.g. listing
  "View product", job "View job", rfq "Send a quote"); reuse `connect.ads.promotedLabel`.
- **Hydration helper**: confirm/add a public job getter (`getPublicJob`) if absent.

## 5. Invariants

1. Normal feed posts (composer Photo/Video/Voice) stay NOT boostable (unchanged).
2. Density: ≤2 sponsored cards per feed page, existing cadence; per-page dedup → distinct
   campaigns; frequency caps + fairness + pacing reused unchanged.
3. A boost still shows in its own section (listing rail / rfq board / jobs board block) AND
   now the feed — both, not either.
4. Billing reused unchanged (MRC viewability impression + click beacons; CPM/CPC).
5. Self-impression guard: a user never sees their own boost in the feed.
6. Built behind the existing checkout off-switch (not chargeable until flipped).

## 6. Out of scope (Phase 2)

The premium right-rail "Spotlight" spot, its higher pricing, and the boost-page wording
that presents Boost vs Spotlight.

## 7. Gates

BE vitest + web vitest + tsc + eslint + check:i18n parity, and a production build.
