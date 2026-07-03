# Boost Eligibility Policy + Boost-Post Retirement

> Status: APPROVED (owner, 2026-05-30). Folds into the M2/M3 marketplace work before M3 closes.
> Decision basis: brainstorm 2026-05-30. Confirms and finally enforces the
> owner-locked 2026-05-27 boost-eligibility rule, which was never actually built.

## Context

"Boost" lets a seller spend wallet credits to push one of their items higher into
other members' feeds / the marketplace rail. The question this spec settles: **what
is a member allowed to boost?**

Current reality (before this spec):

- **Listing boost (M2.1) is gated correctly.** `BoostService.createListingBoost`
  requires the listing to be owned by the caller and `moderationStatus === 'approved'`,
  and serves in the `marketplace_rail` placement.
- **Post boost is wide open and not yet live.** `BoostService.create()` +
  `POST /connect/ads/boosts` boost ANY post id with no type / owner / moderation
  check. A web "Boost Post" flow exists (`app/connect/boost/[postId]`, a post mode in
  `BoostComposer`, a CTA on `PostCard`). None of it has shipped to members.

So this is a policy decision on a clean slate, not a reversal of shipped behaviour.

## Decision

**A member may boost only a structured commercial object. A regular feed post is
never boostable.**

- **Boostable today:** a marketplace **listing** (owned + approved).
- **Boostable later (when those modules exist):** a hiring / job post, and an
  "open to work" / availability card. They are commercial intent and join the set
  with the same own-it + approved gate. Out of scope here (jobs is Phase 5; open-to-work
  is a profile flag today, not a boostable entity).
- **Never boostable:** a regular social post (text, photo, video, document, voice),
  and therefore any repost.

## Why (360 review)

1. **Repost-farming is structurally impossible.** Listings cannot be reposted, so no
   one can ride someone else's content and boost it. The main reason the rule existed
   is satisfied for free, with no extra guard.
2. **Better-converting ads.** A listing carries price, MOQ, category, and an "Inquire"
   CTA, so a boost actually drives leads. A boosted casual photo has no call to action.
   The restriction improves ad ROI, it is not only a cleanliness rule.
3. **No new moderation to build.** Listings already pass moderation before they can be
   boosted. Posts have no review pipeline; allowing post boosts would force us to build
   a whole post-ad-review system. We avoid that entirely.
4. **Feed trust.** The only paid units a member sees are boosted listings (marketplace
   rail) and our own first-party house promos (e.g. "complete your profile"). No seller
   can buy a personal post into the social feed. Strong trust signal for a B2B textile
   network.
5. **Clean monetization story.** Promotions (M3.2) become "free credits to boost your
   listings", with one unambiguous use.

Cost: fewer boostable objects. Accepted: for a textile marketplace, listings are the
inventory that matters, and the "I want to advertise the photo I posted" need is met by
turning it into a listing (a better ad anyway).

## Scope: retire the member-facing Boost-Post path

Owner decision: **remove the member-facing path** (not hide-dormant, not admin-only),
and **fold it into the M2/M3 work** before M3 closes. Keep first-party house promos and
the listing-boost path intact.

### Backend (`src/modules/connect/ads`)

- **Remove** the post-boost route `@Post()` on `BoostController` (`connect/ads/boosts`).
  Keep `@Post('listing')`, `@Get(':id')`, pause, resume.
- **Remove** `BoostService.create()` (the post path). Keep the shared private
  `buildBundleAndReserve` and `createListingBoost`.
- **Remove** the now-unused post `CreateBoostDto` (confirm no other importer; the
  listing path uses `CreateListingBoostDto`).
- **Keep** the ad-decision / serving engine, the `feed_promoted_post` placement, and the
  `promoted_post` creative kind. They remain valid for first-party / house inventory;
  this spec only removes the member entry point that mints a `promoted_post` boost. No
  member route can create `promoted_post` creatives after this change.

### Web (`features/connect/ads`, `app/connect/boost`, `components/connect`)

- **Remove** the route `app/connect/boost/[postId]/page.tsx`. Keep
  `app/connect/boost/listing/[listingId]/page.tsx`.
- **Collapse `BoostComposer`** to listing-only: drop the `target.kind === 'post'` branch
  and the discriminated post type in `ads.types.ts` / `boost-composer-logic.ts`. The
  composer becomes a single listing-boost surface (simpler than the M2.1 generalization).
- **Remove the "Boost" CTA on `PostCard`** (the entry that opened the post boost). The
  Boost CTA on a listing (MyListings) stays.
- **Remove** the post-boost create server action; keep listing-boost + the feed
  `decideAd` serving action (house promos / first-party feed ads are unaffected).
- **Keep** the mobile in-feed house promos (`feed-ads.ts`, `FeedList`, `FeedScreen`,
  `HOUSE_PROMOS`). These are first-party cross-promotion, not member post boosts.

### Not in scope / deferred

- Jobs and open-to-work boostability (arrive with their modules).
- Any change to listing boost, the marketplace rail, house promos, or the ad-decision
  auction.
- A "convert this post into a listing" helper. Nice future friction-reducer; not built
  here. Sellers create a listing the normal way.

## Verification

- Backend: `npx nest build` clean; scoped vitest on the ads boost/controller specs
  (drop/adjust the post-boost cases, keep listing-boost green). No whole-project tsc.
- Web: `npx tsc --noEmit` on touched files; `npx eslint` changed files;
  `node scripts/check-i18n.js` parity (removing strings keeps parity, no new keys);
  scoped `npx vitest` on the composer / ads / feed tests (the post-boost cases are
  removed, listing + house-promo cases stay green).
- A member has no UI path to boost a post; the post-boost endpoint returns 404 (route
  removed). Listing boost and house promos work unchanged.

## Sequencing

Tracked as **M2.6 (boost-post retirement)** within the marketplace epic. Order: it is
independent of M3.2/M3.3, so it can land alongside them; it must be done before M3 is
declared complete so the shipped surface matches the policy.
