# Connect new boost types — Open to work / Hiring / Quotation request

**Date:** 2026-06-18
**Status:** Approved in shape (owner confirmed "build all three"; Hiring = profile/intent-level)
**Scope:** Backend (crewroster-backend) + Web (crewroster-web) + i18n (en/gu/gu-en/hi-en) + tests. No mobile.

---

## 1. Goal

Add three new promotion ("boost") types to Zari360 Connect, **reusing the existing
wallet / budget / audience-targeting / delivery-tracking engine** unchanged at its core:

1. **Open to work** — a worker promotes their availability → reaches employers.
2. **Hiring** — a business promotes its hiring status → reaches workers (profile/intent
   level, _no specific job post required_ — owner decision).
3. **Quotation request (RFQ)** — a buyer promotes their request-for-quotes → reaches suppliers.

**Hard non-goal:** normal feed posts (Photo/Video/Voice from the feed composer) stay
**NOT boostable**. The existing `boost_post` machinery is left untouched; no new feed-composer
boost entry point is added.

---

## 2. Research summary

### Existing engine (kind-agnostic, reused as-is)

- `AdvertiserWallet` + `WalletService` (reserve/debit/release/grant) — kind-agnostic.
- `AudienceService.estimate` + `ConnectAudienceCounter` + `matchesTargeting` (roles/sectors/districts) — kind-agnostic.
- `AdDecisionService.decide` (auction) + `ad-repos` (`CandidateRepoMongo`, `ImpressionOpenerMongo`) + `/events/impression` + `/events/click` (CPM/CPC billing) — kind-agnostic except for the `creativeKind` union + ref carried.
- `connect-pricing-config` (admin-tunable bid/min/durations) — kind-agnostic.
- Admin creative review (`pending → approved`) gate — kind-agnostic.
- Composer (`BoostComposer`) is target-discriminated (listing/job/post) with a global
  checkout kill-switch (`BOOST_CHECKOUT_ENABLED`, currently `false`).

**Conclusion:** the only kind-specific seams are (a) the campaign/creative `kind` enums +
source refs, (b) the create gates, (c) the `creativeKind` union in the decision path +
the surface that renders each creative kind, (d) the placement rows. Everything else is reused.

### Competitor patterns (validate placement + objective)

- **Naukri Resume Display / Profile Highlighter** — job-seekers pay to be a "featured"
  candidate in recruiter search, refreshed to the top, marked as actively looking. →
  validates the **Open to work** boost reaching employers; objective = visibility / profile views.
- **Indeed Sponsored Jobs / LinkedIn Promote Job** — pay-per-click, priority placement,
  ~3× applicants; Indeed is the blue-collar leader. → validates **Hiring** reaching workers;
  CPM/CPC model.
- **IndiaMART Buy Leads / RFQ** — buyers post RFQs; suppliers pay to access/respond
  ("send a quotation"). → validates the **RFQ** boost reaching suppliers; objective = quotes received.

---

## 3. The three boosts (canonical contract)

| New boost         | Campaign kind        | Creative kind           | Source ref                      | Placement (surface)            | Objectives                            | Default audience                                     | Create endpoint                         |
| ----------------- | -------------------- | ----------------------- | ------------------------------- | ------------------------------ | ------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| Open to work      | `boost_open_to_work` | `promoted_open_to_work` | `sourceProfileUserId` (= owner) | `feed_promoted_profile` (feed) | `reach` (cpm), `profile_visits` (cpc) | employer roles `['workshop_owner','buyer']`          | `POST /connect/ads/boosts/open-to-work` |
| Hiring            | `boost_hiring`       | `promoted_hiring`       | `sourceProfileUserId` (= owner) | `feed_promoted_profile` (feed) | `reach` (cpm), `profile_visits` (cpc) | worker roles `['karigar']`                           | `POST /connect/ads/boosts/hiring`       |
| Quotation request | `boost_rfq`          | `promoted_rfq`          | `sourceRfqId`                   | `rfq_promoted` (rail)          | `reach` (cpm), `quotes` (cpc)         | suppliers by RFQ category (`sectors=[rfq.category]`) | `POST /connect/ads/boosts/rfq`          |

Notes:

- **Audience routing** is what makes "reach employers/workers/suppliers" work: `decide`
  matches the ad-set targeting against the _viewer's_ AdProfile (role from
  `onboardingIntent`, skills, district). The two profile boosts share ONE feed placement;
  the targeting (employer vs worker roles) routes each to the correct side, so they never
  cross. The self-impression guard (`authorUserId === viewer`) already prevents showing a
  user their own boost.
- **Server-side audience default:** when the composer sends empty `targeting.roles`/`sectors`,
  the create service fills the default audience above, so "reach the right side" is guaranteed
  even on the broadest setting. The advertiser can still refine district/trade (and roles for RFQ).
- **New objective `quotes`** is added to the campaign `objective` enum; billing is CPC
  (same rule as `applications`/`inquiries`: `reach → cpm`, else `cpc`).
- **profileRef = ownerUserId**: the profile creative renders the advertiser's own public
  profile; no extra source doc.

---

## 4. Backend changes

### 4.1 Schemas

- `ad-campaign.schema.ts`:
  - `kind` enum += `boost_open_to_work`, `boost_hiring`, `boost_rfq`.
  - `objective` enum += `quotes`.
  - new nullable source refs: `sourceProfileUserId` (ref User), `sourceRfqId` (ref Rfq).
- `ad-creative.schema.ts`:
  - `kind` enum += `promoted_open_to_work`, `promoted_hiring`, `promoted_rfq`.
  - new nullable refs: `profileRef` (ref User), `rfqRef` (ref Rfq).
- `rfq.schema.ts`: add `boostCampaignId?: ObjectId | null` (mirror Listing/Job; powers the
  in-flight gate + "boost again").
- Placements: seed two rows via the migration ledger (convergent seed, mirroring how
  `feed_promoted_post` / `marketplace_rail` / `jobs_rail` are seeded): `feed_promoted_profile`
  (surface `feed`) and `rfq_promoted` (surface `rail`).

### 4.2 DTOs (`dto/`)

- `create-open-to-work-boost.dto.ts` — objectives `['reach','profile_visits']`, no id field
  (target is the caller's own profile), budget/days/targeting (reuse guardrail constants + `TargetingDto`).
- `create-hiring-boost.dto.ts` — same shape as open-to-work.
- `create-rfq-boost.dto.ts` — `rfqId` + objectives `['reach','quotes']` + budget/days/targeting.

### 4.3 `boost.service.ts`

- `createOpenToWorkBoost({ownerUserId, objective, totalBudget, days, targeting})`:
  - gate: caller's `ConnectProfile.openTo.work === true` (else 400 "Turn on Open to work first").
  - gate: no in-flight `boost_open_to_work` campaign for this owner (one at a time).
  - default `targeting.roles` to employer set if empty.
  - `buildBundleAndReserve` with campaignKind `boost_open_to_work`, creativeKind
    `promoted_open_to_work`, placements `['feed_promoted_profile']`, sourceProfileUserId =
    profileRef = ownerUserId. PostHog `ads.boost_created` (target `open_to_work`).
- `createHiringBoost(...)`: identical with `openTo.hiring`, worker default roles, `boost_hiring`/`promoted_hiring`.
- `createRfqBoost({ownerUserId, rfqId, ...})`:
  - gate: rfq exists + `buyerUserId.equals(owner)` (404 otherwise) + `status === 'open'`.
  - gate: no in-flight boost via `rfq.boostCampaignId`.
  - default `targeting.sectors` to `[rfq.category]` if empty.
  - `buildBundleAndReserve` with `boost_rfq`/`promoted_rfq`, placements `['rfq_promoted']`,
    sourceRfqId = rfqRef = rfqId; link `rfq.boostCampaignId` after reserve. PostHog (target `rfq`).
- Extend `buildBundleAndReserve` `BoostBundleSpec` with the new kind unions + the new
  source/ref fields (`sourceProfileUserId`, `sourceRfqId`, `profileRef`, `rfqRef`).
- Extend `boostable()` + `BoostableSummary`:
  - add `rfqs: BoostableItem[]` + `counts.rfqs` (caller's `status:'open'` RFQs, no in-flight boost).
  - `BoostableItem.kind` union += `boost_rfq`.
  - intents `work`/`hiring` already returned — the web uses them to surface the two profile-boost CTAs.
- `list()` `BoostListItem`: add `sourceRfqId` + `sourceProfileUserId` to the row mapper so
  the manager can label + deep-link the new kinds.

### 4.4 Controller (`boost.controller.ts`)

- `POST open-to-work`, `POST hiring`, `POST rfq` — same throttle tier + JWT-derived owner as the others.

### 4.5 Delivery (decision path)

- `ad-decision.service.ts` + `ad-repos.ts`: widen the `creativeKind` union (`Candidate`,
  `DecisionResult`) to include `promoted_open_to_work | promoted_hiring | promoted_rfq`,
  and carry `profileRef` / `rfqRef`. `CandidateRepoMongo.top` maps the new creative kinds
  and carries the right ref. No change to scoring/floor/block/freqcap/pacing.
- `rfq-boost-resolver.service.ts` (optional, mirrors `JobBoostResolverService`): NOT used for
  v1 — the RFQ board renders the billed `rfq_promoted` decide card (so budget actually spends).
  (Read-only pinned block is a future enhancement; documented, not built.)

### 4.6 Tests (BE, colocated `*.vitest.ts`)

- `boost.service.openToWork.vitest.ts`, `boost.service.hiring.vitest.ts`,
  `boost.service.rfq.vitest.ts`: happy path + every gate (intent off, wrong owner, wrong
  status, in-flight, short wallet rollback, default-audience fill).
- extend `boost.service.boostable.vitest.ts` for RFQs.
- extend `ad-decision`/`ad-repos` specs for the new creative kinds carrying refs.
- DTO specs for the three new DTOs.

---

## 5. Web changes

### 5.1 Types + actions (`features/connect/ads/`)

- `ads.types.ts`: add `OpenToWorkBoostInput`, `HiringBoostInput`, `RfqBoostInput`,
  `ProfileBoostTarget`, `RfqBoostTarget`, `ProfileAdDecision`, `RfqAdDecision`; extend
  `BoostKind`, `BoostListItem` (+ `sourceRfqId`), `BoostableItem.kind`, `BoostableSummary` (+ `rfqs`).
- `ads.actions.ts`: `createOpenToWorkBoost`, `createHiringBoost`, `createRfqBoost`;
  `decideProfileAd(placementKey)` (filters to `promoted_open_to_work|promoted_hiring` + profileRef),
  `decideRfqAd(placementKey)` (filters to `promoted_rfq` + rfqRef). Mirror `decideListingAd`.

### 5.2 Composer (`BoostComposer.tsx` + `boost-composer-logic.ts` + `boost-targeting.ts`)

- Add target props `openToWork?`, `hiring?`, `rfq?` (discriminated like listing/job/post).
- Objective options per new kind (table §3). Preview chrome: profile-card preview for the
  two intent boosts; RFQ-card preview for RFQ.
- Default audience presets per kind (employer/worker roles; RFQ category sector).
- `buildOpenToWorkBoostInput` / `buildHiringBoostInput` / `buildRfqBoostInput`.
- Inherits the `BOOST_CHECKOUT_ENABLED` kill-switch unchanged (gated notice, no calls).

### 5.3 Routes (`app/connect/boost/`)

- `open-to-work/page.tsx` — loads caller profile; if `openTo.work` off, render an enable nudge;
  else render composer with the profile preview. + `loading.tsx`.
- `hiring/page.tsx` — same for `openTo.hiring`. + `loading.tsx`.
- `rfq/[rfqId]/page.tsx` — owner+open gate (mirror job route); composer with RFQ preview. + `loading.tsx`.

### 5.4 Delivery rendering

- **Profile boosts (feed):** feed `page.tsx` resolves a second slot
  `resolvePromotedProfile('feed_promoted_profile')` (parallel, `.catch`-guarded like the
  promoted post), hydrates the advertiser's public profile, and passes `promotedProfile` to
  `FeedScreen`, which inserts a new in-feed `PromotedProfileAdCard` (main column → mobile +
  desktop reach). Card shows "Promoted" disclosure + Open-to-work / Hiring framing + CTA
  (View profile / Message) and fires `useAdBeacons` (CPM/CPC billing). Existing promoted-post
  slot untouched.
- **RFQ boost (RFQ board):** `app/connect/rfq/page.tsx` resolves
  `resolvePromotedRailRfq('rfq_promoted')`, hydrates the RFQ via a public getter, renders
  `PromotedRfqAdCard` at the top of the board with beacons. Mirrors the marketplace rail.

### 5.5 Quick-start (`BoostQuickStart.tsx` + Boosts hub)

- New "Promote your Open to work" + "Promote that you're hiring" cards shown when
  `intents.work` / `intents.hiring` are on (deep-link to the two new routes).
- New RFQ rail (caller's open RFQs) + "See all" + an empty-state nudge to post an RFQ.

### 5.6 Admin review (`AdminAdReview.tsx`)

- List + approve/reject the new creative kinds; show kind + a link to the target
  (profile / RFQ). Minimal but functional context (no rich preview required for v1).

### 5.7 i18n (en/gu/gu-en/hi-en)

- New keys under `connect.boosts.cfg.goal.*` (quotes objective), composer preview/target
  copy, the two intent quick-start cards + RFQ rail, the profile/RFQ promoted cards
  (`connect.ads.*`), and manager `kind.*` labels for the three new kinds. Native-quality
  Gujarati/Hindi-English; keep key parity (check:i18n must stay green).

### 5.8 Tests (web)

- `boost-composer-logic` input builders; `ads.actions` decide filters; card render smoke
  (profile + rfq); quick-start render with the new intents/rfqs.

---

## 6. Invariants / security (must hold)

1. **Posts stay non-boostable** — no new feed-composer boost entry; `boost_post` untouched.
2. **Owner-derived advertiser** — `ownerUserId` always from JWT, never the body (mirror existing).
3. **Create gates** — intent-on (profile boosts), owner+open (RFQ); 404 on non-owned ids (no leak).
4. **Wallet atomicity** — reuse `buildBundleAndReserve` rollback on short wallet (no orphan campaign).
5. **Delivery respects** the existing block / suppression / freq-cap / pacing / floor / self-impression filters (no new bypass).
6. **Audience floor (≥50)** + public-only counting reused unchanged for the estimate.
7. **Checkout gate** — the new flows surface the gated notice and make NO payment/boost call
   while `BOOST_CHECKOUT_ENABLED` is false (consistent with all boosts today).
8. **One in-flight boost** per profile-intent (per owner+kind) and per RFQ.

---

## 7. Out of scope (v1)

- Mobile app (never touched per standing rule).
- RFQ read-only pinned promoted block (the billed rail card is built instead).
- Rich admin creative previews for the new kinds (functional approve/reject + link only).
- Supplier→buyer capability promotion (already covered by product/listing boosts).
- Turning the checkout kill-switch on (owner decision; built behind it like the rest).

## 8. Rollout

- Two new placement rows seeded via migration ledger (idempotent convergent seed).
- RFQ schema gains `boostCampaignId` (additive, no data migration).
- Built behind the existing checkout kill-switch; owner flips it when ready.
- Gates to stay green: BE vitest + web vitest + `check:i18n` parity + tsc + eslint.
