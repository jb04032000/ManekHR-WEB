# zari360 Connect - Ad and Monetization Platform: Design Spec

- Status: DRAFT for owner review (brainstorming output, pre-implementation)
- Date: 2026-05-26
- Scope of THIS spec: the Foundation sub-project only (the "Boost Post" vertical slice on a first-party ad engine). The wider platform and later slices are described as roadmap context.
- Research basis: `docs/connect/research/ad-monetization/01-market-product-strategy.md`, `02-ad-serving-architecture.md`, `03-thirdparty-integration-compliance.md`.

---

## 1. Plain-language summary (for the owner)

We are adding a second income stream to zari360: ads. Businesses already on the platform pay us to get more attention. The first and most important product is **Boost Post**, exactly like the Boost button on Facebook or Instagram: a business writes a post, taps Boost, picks who should see it, sets a budget, pays from a prepaid wallet, and we show that post to more of the right people. It carries a small "Promoted" tag and looks like a normal post, not a flashing banner.

The reason a textile SMB would pay us instead of Facebook: zari360 already knows each person's real trade and role (owner, manager, karigar, buyer; weaving, yarn, dyeing, garments), so the business can target precisely, for example "garment buyers in Surat." Facebook cannot do that.

We build our own ad system first because the money is paid by our own users and stays with us, and because it needs no legal waiting period. Google's outside ads are a separate later step (they only fill leftover empty space, and they require a 2-3 week legal and content-safety setup first). Meta or Facebook ads are not possible on a website at all, so that idea is off the table.

---

## 2. Goals and non-goals

### Goals (foundation)

1. Ship Boost Post end to end: compose, target, pay, serve, measure.
2. Stand up a reusable first-party ad delivery engine that every future ad product plugs into.
3. Introduce an advertiser prepaid ad-wallet and an append-only ad-spend ledger with correct, idempotent billing and GST invoicing.
4. Use ERP-verified occupational targeting as the headline differentiator.
5. Keep ad density tasteful and the professional-network feel intact.
6. Give the platform owner an admin surface to set prices, approve or reject ads, and watch revenue.

### Non-goals (explicitly deferred to later slices)

- Third-party demand (Google Ad Manager remnant) and the full DPDP consent or cookie-consent stack.
- Lead-gen / cost-per-inquiry ads, Sponsored Job, Promoted Marketplace listing, Sponsored Message.
- Header bidding, SSPs, Prebid.js.
- Audience lookalike modeling and retargeting lists beyond a simple first version.
- A full self-serve advertiser analytics suite (foundation ships a basic results view only).

---

## 3. The platform is 7 subsystems (context, not all built now)

| #   | Subsystem                          | Role                                                                                           | When                             |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Ad delivery engine                 | Single-slot decisioning, placement seam, serve-time                                            | Foundation                       |
| 2   | Advertiser and campaign management | Boost composer, campaign / ad-set / creative, audience builder                                 | Foundation (Boost slice)         |
| 3   | Ad billing and credit              | Advertiser prepaid wallet + ad ledger, reserve / debit, GST invoice                            | Foundation                       |
| 4   | Targeting and audience             | ERP-verified segments, per-user ad profile, frequency cap                                      | Foundation (core subset)         |
| 5   | Measurement and reporting          | Impression / click logs, viewability, rollups, advertiser dashboard, anti-fraud                | Foundation (basic) then expand   |
| 6   | Third-party demand                 | GAM remnant + DPDP consent + Consent Mode v2 + ads.txt + moderation prereqs                    | Slice 3                          |
| 7   | Admin and policy                   | Ad review / approval queue, pricing / floors, placement config, house-promo mgmt, brand safety | Foundation (minimal) then expand |

### Build order

1. Foundation: subsystem 1 plus the thin vertical of 2, 3, 4, 5, 7 needed to ship Boost Post end to end.
2. Slice 2: full reporting (5) plus admin and policy console (7).
3. Slice 3: third-party demand (6) with the DPDP consent stack and content-moderation prerequisites.
4. Slice 4 onward: more ad products (Promoted Supplier rail slot, Sponsored Job, Lead-Gen / CPL, Promoted Marketplace listing) reusing the engine.

---

## 4. Foundation scope: the Boost Post vertical slice

### In scope

- Inline Boost entry point on an eligible feed post (author or page admin only).
- Boost composer: objective, ERP-verified audience filter with a live reach estimate, budget and duration, live impressions estimate, pay from wallet.
- Advertiser prepaid wallet: top up, balance, GST invoice, append-only ledger.
- First-party ad delivery engine: decision endpoint, placement seam, impression and click logging, even pacing, frequency capping.
- Render path: a boosted post appears in the feed as a normal post card with a "Promoted" tag, targeted to the chosen audience, on all viewports.
- Basic advertiser results view: spend, views, clicks, inquiries (mapped from existing post engagement), reach.
- Minimal admin: price and floor settings, a manual ad-review approve / reject gate, a revenue summary.
- House-promo fallback continues to fill any unsold feed slot (already built).

### Out of scope (foundation)

- Right-rail Promoted Suppliers slot (it reuses the same engine; ships in a later slice unless promoted in).
- Google or any third-party demand and the consent stack.
- All other ad products listed in subsystem 6 and the roadmap.

---

## 5. Architecture overview

A new backend module `src/modules/connect/ads/*` (NestJS) owns first-party ad serving. A new frontend feature area `features/connect/ads/*` (Next.js App Router) owns the advertiser-facing UI, and the existing feed and rail render seams are extended to display an ad decision.

Decisioning is a single fast call. First-party campaigns compete for each slot; if none qualifies, the slot falls back to a house promo (already built); a third-party remnant tag is the eventual final fallback (slice 3, not now).

Data lives in MongoDB (durable: campaigns, creatives, logs, ledger) and Redis (hot path: per-user ad profile cache, frequency-cap counters, pacing throttle flags). Redis is already in the stack and auto-instrumented.

### Why build, not rent

Advertisers pay from a prepaid wallet that is already inside the platform. Routing that spend through a rented ad server (GAM, Kevel) would hand a third party a revenue cut on our own money and add an external network call on the serve-time hot path. The first-party decision service is small (about 300-400 lines).

---

## 6. Data model

### MongoDB collections (new, under the ads module)

| Collection              | Purpose                                                  | Key fields                                                                                                                                                                                                                                                                                                                                                         | Indexes                                                            |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ad_advertiser_wallets` | One prepaid balance per workspace (advertiser)           | `workspaceId` (unique), `balance` (credits, INR 1 = 1 credit ex-GST, min 0), `reserved` (held by live campaigns), `lastTopUpAt`                                                                                                                                                                                                                                    | `{ workspaceId: 1 }` unique                                        |
| `ad_wallet_ledgers`     | Append-only money trail (mirrors `PlatformCreditLedger`) | `workspaceId`, `type` (`topup` / `reserve` / `debit` / `release` / `refund` / `adjustment`), `amount` (signed), `balanceAfter`, `reservedAfter`, `campaignId?`, `ref?` (invoice or gateway ref), `note?`, `recordedBy?`                                                                                                                                            | `{ workspaceId: 1, createdAt: -1 }`                                |
| `ad_campaigns`          | One per boost (and per future campaign)                  | `workspaceId`, `ownerUserId`, `kind` (`boost_post`), `sourcePostId`, `objective` (`reach` / `inquiries` / `profile_visits`), `status` (`draft` / `pending_review` / `active` / `paused` / `completed` / `rejected`), `dailyBudget` or `totalBudget`, `budgetSpent`, `startAt`, `endAt`, `pacing` (`even` default), `billingEvent` (`cpm` / `cpc`), `bid` (derived) | `{ workspaceId: 1, status: 1 }`, `{ status: 1, endAt: 1 }`         |
| `ad_sets`               | Targeting + placement binding for a campaign             | `campaignId`, `targeting` (embedded TargetingSpec), `placements` (array of placement keys), `frequencyCap` (per user per window)                                                                                                                                                                                                                                   | `{ campaignId: 1 }`                                                |
| `ad_creatives`          | What renders                                             | `campaignId`, `kind` (`promoted_post` for boost), `postRef` (for promoted post) or native fields, `reviewStatus` (`pending` / `approved` / `rejected`), `reviewedBy?`, `rejectionReason?`                                                                                                                                                                          | `{ campaignId: 1 }`, `{ reviewStatus: 1 }`                         |
| `ad_placements`         | Seeded named slots                                       | `key` (`feed_promoted_post`, later `rail_right_top`, etc.), `surface` (`feed` / `rail`), `floorCpm`, `enabled`                                                                                                                                                                                                                                                     | `{ key: 1 }` unique                                                |
| `ad_impressions`        | One doc per served impression                            | `campaignId`, `adSetId`, `creativeId`, `userId`, `placementKey`, `impressionToken` (unique), `servedAt`, `viewable` (bool, set by beacon), `charged` (bool), `chargeAmount`                                                                                                                                                                                        | `{ impressionToken: 1 }` unique, `{ campaignId: 1, servedAt: -1 }` |
| `ad_clicks`             | One doc per click                                        | `impressionToken` (unique), `campaignId`, `userId`, `clickedAt`, `valid` (IVT check), `chargeAmount`                                                                                                                                                                                                                                                               | `{ impressionToken: 1 }` unique                                    |
| `ad_daily_rollups`      | Nightly aggregates for dashboards                        | `campaignId`, `date`, `impressions`, `viewableImpressions`, `clicks`, `validClicks`, `spend`, `ctr`, `viewabilityRate`                                                                                                                                                                                                                                             | `{ campaignId: 1, date: -1 }`                                      |

### Redis (hot path)

- `adprofile:{userId}` - precomputed targeting attributes (role, sector, district, company size, connection-degree buckets), JSON, 15-minute TTL, rebuilt from ERP + Connect profile.
- `freqcap:{userId}:{adSetId}:{window}` - INCR counter with TTL = window.
- `pacing:{campaignId}` - throttle flag set by the pacing daemon for 60 seconds.

### Reuse, not duplication

- The wallet ledger copies the proven `PlatformCreditLedger` shape (append-only, `balanceAfter`, atomic `$inc`, `{ scope, createdAt: -1 }` index). It is a NEW advertiser-facing construct; it does not reuse the platform marketing pool (that is owner-funded, not customer-funded).
- Per-workspace balance has precedent in `Subscription.appliedEntitlements`.

---

## 7. The ad decision engine

`POST /connect/ads/decide` resolves one slot. Target latency under 30 ms P95. All targeting is evaluated in memory against the cached `adprofile`. The only blocking IO is one Mongo candidate read plus a Redis pipeline.

### Single-slot algorithm

1. Look up the placement (Redis, 5-minute cache). If disabled, return null.
2. Fetch candidates from Mongo: `{ placementKey in adSet.placements, campaign.status = active, within budget and dates }`, top 50 by `bid` descending.
3. Targeting filter: evaluate each ad set's TargetingSpec against the cached `adprofile` in memory. Drop non-matches. Drop the post's own author so nobody is shown their own boost. Dedupe against organic (do not show a promoted post the user already has organically in this feed page).
4. Frequency cap: Redis INCR per `{userId, adSetId, window}`; drop over-cap candidates.
5. Pacing: drop candidates whose `pacing:{campaignId}` throttle flag is set.
6. Score: normalize to eCPM. `cpm: bid`; `cpc: predictedCtr * bid * 1000`. Final score = `eCPM * (0.85 + 0.15 * relevanceScore)`. Sort descending. Winner is the top candidate.
7. Floor: if the winner is below `placement.floorCpm`, fall through to a house promo (feed) or null.
8. Issue an impression token: write `ad_impressions` (pending), increment the Redis frequency and pacing counters in one pipeline.
9. Return the decision payload: creative reference, `impressionToken`, viewability beacon URL, click URL.

For the foundation, the only billing events are `cpm` (default for the `reach` objective) and `cpc` (for `inquiries` and `profile_visits`, where a click or profile visit is the action). `predictedCtr` starts as a simple per-objective constant and is refined from rollups later. Relevance score starts as a connection-degree and same-sector heuristic.

### Placement seam integration

- Feed: extend the existing `buildFeedRows` interleaver so an ad slot can be filled by a promoted POST (rendered as a normal post card with a "Promoted" tag), not only a house-promo card. Today the interleaver is mobile-only (`md:hidden`) and serves house promos; boosted posts must render on all viewports because a boosted post is a feed post. Keep the cadence guards (first slot after 4 posts, one per 6, never adjacent, under the 30 percent density ceiling). The slot still accepts the existing `HousePromo` shape as the fallback, so nothing else changes.
- The decision call runs in a Server Component during SSR so the promoted post is in the initial HTML with no layout shift. The client component mounts only an IntersectionObserver for the viewability beacon and the click-redirect link.

---

## 8. Boost Post flow

### Frontend journey

1. Eligible post (the viewer is the author or a page admin) shows a Boost button on the post card. Hidden otherwise via the existing `<Can>` RBAC atom.
2. Boost composer (modal or dedicated route `app/connect/boost/[postId]`):
   - Objective: more people see it (reach), more inquiries (cpc), more profile visits (cpc).
   - Audience: role, trade or sector, district or city, optional company size and connection-degree. A live "about N matching people" estimate updates as filters change (server action queries an audience-size estimator).
   - Budget and duration: budget (min default INR 99, owner-tunable) and days (3 / 7 / 14 / 30). A live "estimated views" range updates from budget, duration, and the audience size.
   - Pay: shows wallet balance and a one-tap "Boost now - INR X" button. If the balance is short, an inline top-up step appears first.
3. On submit: create campaign + ad set + creative in `pending_review` (or `active` if auto-approve is on for trusted advertisers), reserve the budget against the wallet (ledger `reserve`), and return the live status.
4. Live status and results: spend, views, clicks, inquiries (mapped from existing post comment or inquiry actions), reach. A pause control releases the unspent reserve back to the wallet.

### API (NestJS, all `JwtAuthGuard` + tenant scope + DTO + throttler)

- `POST /connect/ads/boosts` - create a boost from a post.
- `GET /connect/ads/boosts/:id` - status and results.
- `POST /connect/ads/boosts/:id/pause` and `/resume`.
- `POST /connect/ads/audience/estimate` - reach estimate from a TargetingSpec.
- `POST /connect/ads/wallet/topup` and `GET /connect/ads/wallet`.
- `POST /connect/ads/decide` - serve-time decision (internal, called by the web server during SSR; rate-limited and lightweight auth).
- `POST /connect/ads/events/impression` and `/click` - beacons (idempotent on `impressionToken`).
- Admin: `GET /admin/connect/ads/review`, `POST /admin/connect/ads/review/:id/(approve|reject)`, `GET/PUT /admin/connect/ads/placements`, `GET /admin/connect/ads/revenue`.

---

## 9. Billing

Prepaid, wallet-based, India-correct.

- Top up: advertiser adds credits (1 credit = INR 1 ex-GST). 18 percent GST, SAC 998361, on the invoice. Payment via the existing gateway path.
- Reserve at launch: when a boost goes active, reserve its budget (move from `balance` to `reserved`, ledger `reserve`). This prevents a campaign from running on money that is not there.
- Two-phase charge:
  - Phase A, at win time: atomic `findOneAndUpdate` increments `campaign.budgetSpent` with a guard that aborts if the remaining budget cannot cover the slot. This is the race-safe gate.
  - Phase B, on confirmation: on the viewability beacon (for cpm) or a validated click (for cpc), write the wallet ledger `debit` keyed by `impressionToken` (unique index prevents double-charge on retry), reduce `reserved`.
- Pacing daemon: a 1-minute cron computes target impressions per minute from the remaining daily budget and average eCPM; if the prior minute exceeded 120 percent of target, it sets the Redis throttle flag (step 5 honors it). Even pacing is the default.
- Nightly reconcile: reverse Phase-A reserves for impressions that never received a Phase-B confirmation, so the ledger stays accurate across crashes.
- On pause or completion: release any unspent reserve back to `balance` (ledger `release`).

---

## 10. Targeting

ERP-verified occupational targeting is the differentiator. Foundation dimensions:

- Role: owner, manager, karigar, buyer, supplier.
- Trade or sector: weaving, yarn, dyeing, garments, and the existing designation or industry taxonomy.
- Location: district or city (existing workspace and profile location data).
- Company size: bucketed from team size.
- Connection-degree: 1st, 2nd, 3rd or beyond (from the Connect graph).

The `adprofile:{userId}` cache holds these so targeting is evaluated in memory at serve time. The audience-size estimator runs the same filter against an aggregate count, never returning a number small enough to identify individuals (a minimum-audience floor, for privacy and for ad quality).

---

## 11. Measurement, results, anti-fraud

- Impression counting follows the IAB or MRC viewability standard (a beacon fires when the ad is sufficiently in view for the minimum time). Only viewable impressions are charged for cpm.
- Click validation: basic invalid-traffic checks (per-user rate limits, dedupe on `impressionToken`, bot-signal heuristics). Only valid clicks are charged for cpc.
- Rollups: a nightly cron aggregates impressions and clicks into `ad_daily_rollups` for fast dashboards.
- Advertiser results view (basic in foundation): spend, reach, views, clicks, inquiries, CTR.
- All read endpoints emit OpenTelemetry spans only. Writes emit PostHog events using the `<module>.<verb>_<noun>` convention (for example `ads.boost_created`, `ads.wallet_topped_up`, `ads.campaign_completed`).

---

## 12. Admin and policy (minimal in foundation)

- Ad review queue: every creative defaults to `pending_review`. An admin approves or rejects with a reason before it serves. Trusted advertisers can be flagged for auto-approve later.
- Placement and pricing config: floor CPMs, enable or disable placements, default minimum spend, all owner-tunable, no code change.
- Revenue summary: spend, by product and by day, reconciled against the ledger.
- Audit: every admin write goes through `AuditService.logEvent` with a new `AppModule.ADS` enum entry.

---

## 13. Frontend integration and standards

- Extend `features/connect/feed/feed-ads.ts` and `FeedAdCard` or the post-card renderer so an ad slot can render a promoted post (post card + "Promoted" tag) or the existing house promo, driven by the decision payload. Keep the module pure and tested.
- The rail seam is prepared for a later Promoted Suppliers slot but not built in the foundation.
- Server-side decisioning in App Router Server Components, axios `serverHttp` + `unwrapServer`, server actions for the composer.
- UI on AntD v6 + Tailwind, matching the Connect design language. Every surface ships responsive, accessible (WCAG AA), with empty, loading, and error states, and keyboard navigation.
- i18n complete across all four locales (en, gu, gu-en, hi-en), parity-checked with `npm run check:i18n`. No em-dashes in any copy.
- Boost nudges reuse the notifications engine: when a post performs well organically, the owner can be nudged to boost it (a later refinement, the hook is noted here).

---

## 14. Security, RBAC, privacy

- Boost entry and campaign management are gated by the `<Can>` atom and per-endpoint scope. Only a post author or a page admin can boost a post.
- All endpoints: `JwtAuthGuard` (or `@Public()` only where unavoidable), tenant scope, class-validator DTOs, throttler tiers. Wallet and billing endpoints get a strict throttler tier.
- First-party ads to logged-in members on our own platform do not need ad-network consent plumbing. The DPDP and cookie-consent stack is a slice-3 prerequisite that gates third-party demand only. Targeting respects a minimum-audience floor and never exposes individual-level data to advertisers.
- No raw PII in spans or events (district and role only, never names or contact data).

---

## 15. Reuse map (what we extend, not rebuild)

| Existing                                                          | How the ad system uses it                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `features/connect/feed/feed-ads.ts` interleaver                   | Extend so a slot can hold a promoted post; keep cadence and density guards; house promo stays the fallback |
| "Promoted" vs "Sponsored" label convention                        | "Promoted" for first-party boosts; "Sponsored" reserved for future third-party                             |
| `PlatformCreditLedger` pattern                                    | Template for the new append-only `ad_wallet_ledgers` (balanceAfter, atomic inc, idempotent)                |
| `Subscription.appliedEntitlements` precedent                      | Per-workspace balance pattern for the ad wallet                                                            |
| Notifications engine                                              | Boost nudges and campaign-status alerts                                                                    |
| Audit, Sentry, OTel, PostHog, throttler, env loader, RBAC `<Can>` | All the standard module wiring                                                                             |
| Redis (auto-instrumented)                                         | Ad profile cache, frequency cap, pacing flags                                                              |

---

## 16. Testing strategy

- Pure logic (interleaver extension, eCPM scoring, pacing math, targeting match) gets unit tests colocated as `*.vitest.ts`, following the decorator-mock pattern where Mongoose schemas trip reflect-metadata.
- Billing correctness: tests for reserve, two-phase charge idempotency on `impressionToken`, reconcile reversal, release on pause. This is the highest-risk area and gets the most coverage.
- Decision engine: tests for eligibility filtering, frequency cap, floor fallback to house promo, self-author exclusion.
- Frontend: composer flow states (empty, loading, error), reach and views estimators, wallet-short top-up path, a11y and keyboard navigation, i18n parity.
- Cap test runs to the module's files; typecheck via `nest build` (SWC), not whole-project tsc, per the resource-caution memory.

---

## 17. Roadmap beyond the foundation

1. Slice 2: full advertiser reporting and the complete admin and policy console (subsystems 5 and 7).
2. Slice 3: third-party demand (subsystem 6). Google Ad Manager Free tier as the ad server for remnant, AdSense and AdX linked as demand, no header bidding yet. Prerequisites: privacy policy, content-moderation queue, age attestation at registration, a first-party consent banner with Google Consent Mode v2 default-deny, a `consent_records` store with 7-year retention, ads.txt, and the GAM domain review (1-14 days). Day-one third-party posture is contextual (non-personalized) ads only; personalized ads serve only to confirmed-18-plus users who opt in. Under-18 users never receive personalized ads (no workaround). IAB TCF is not required for India. Meta Audience Network is not available on web and is excluded. Add Prebid.js plus SSPs (PubMatic OpenWrap, Index Exchange, OpenX) once traffic clears their roughly 500k-1M monthly pageview thresholds.
3. Slice 4 onward: more first-party products on the same engine, in this order of revenue density and dependency: Promoted Supplier rail slot, Sponsored Job listing, Lead-Gen / cost-per-inquiry ad, Promoted Marketplace listing. Sponsored Message is deferred until anti-spam is solid.

---

## 18. Owner-tunable defaults (not blockers)

These ship as editable admin settings, seeded with sensible India-market defaults from the market research. The owner can change them without code:

- Boost minimum spend: INR 99.
- Suggested boost budgets: INR 99 / 299 / 500 / 1000.
- Durations: 3 / 7 / 14 / 30 days.
- Floor CPMs per placement: seeded conservative, tuned with data.
- Auto-approve threshold for trusted advertisers: off at launch (manual review for everyone first).

---

## 19. Open items to confirm during planning

- Whether the right-rail Promoted Suppliers slot is pulled into the foundation or kept for slice 4 (default: kept for later; the engine supports it either way).
- The exact mapping of the "inquiries" objective to a measurable action (post comment, profile contact, or a dedicated inquiry action) given the marketplace is not live yet.
- Payment-gateway specifics for wallet top-up (reuse the existing subscription gateway path).

---

## 20. Sources

- Market and product strategy: `docs/connect/research/ad-monetization/01-market-product-strategy.md`
- Ad-serving architecture: `docs/connect/research/ad-monetization/02-ad-serving-architecture.md`
- Third-party integration and India compliance: `docs/connect/research/ad-monetization/03-thirdparty-integration-compliance.md`
