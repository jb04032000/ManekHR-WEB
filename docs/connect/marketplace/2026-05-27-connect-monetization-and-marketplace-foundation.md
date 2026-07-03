# Connect Monetization + Marketplace Foundation - Design & Decision Record

- Date: 2026-05-27
- Status: DESIGN - pending owner approval (no code yet)
- Scope: the monetization core for zari360 Connect, and the Road A (mediator) marketplace that sits on top of it.
- Grounding: two read-only ECC architecture investigations on 2026-05-27 (core-readiness + billing-engine extensibility). Findings cited inline.

---

## 1. TL;DR (the decisions)

1. The Connect marketplace is a **mediator / directory** (Road A): sellers list, buyers discover and contact them, the two parties transact OFF platform. We do NOT hold or move their money. (Owner decision.)
2. Because we are a mediator, we **skip the entire money-movement spine** a transactional marketplace would need (seller payouts, escrow, payout-KYC, commission accounting, refund/dispute fund-handling, RBI payment-aggregator licensing). This removes the hardest, slowest, most regulated half of the work.
3. Revenue = **ads (Boost, already shipped) + dynamic subscription plans + pay-as-you-go credits + paid leads**, all admin-managed.
4. **Launch mostly free** (generous limits) to win sellers; the paid machinery ships built-but-dormant so we can turn it on later by changing settings, never by rewriting code.
5. Technical approach is **EXTEND the existing ERP billing engine**, not build a parallel one. The engine is already person-based, already has a real feature-by-feature entitlements layer, already has admin-managed plans/tiers/coupons, and the ads wallet is the right base for pay-as-you-go credits.

---

## 2. Strategic context

- zari360 = textile-SMB ERP (India / Gujarat). "Connect" = a person-centric, LinkedIn-style network/jobs/marketplace layer on top, branch `zari360-connect`.
- First Connect revenue stream already shipped: the ads / "Boost Post" module (first-party ad engine + person-centric ads wallet + Razorpay top-up). This is reused heavily below.
- Owner's revenue philosophy for Connect: onboard free, monetize visibility and leads (the IndiaMART / Justdial / Instagram-boost pattern), keep buyers free, keep it simple for the seller.

## 3. As-built core (what we already have)

From the core-readiness investigation. For a MEDIATOR model, the "missing" money primitives are not needed; the reusable assets are what matter.

Reusable, already built:

- `RazorpayPlatformService` - order + signature-verify + refund + payment-link + subscription primitives (`subscriptions/billing/services/razorpay-platform.service.ts`).
- Person-centric ads wallet with idempotent ledger (`connect/ads/schemas/advertiser-wallet.schema.ts`, `ad-wallet-ledger.schema.ts`, `services/wallet.service.ts`).
- Dynamic, admin-managed plans + tiers + coupons (see Section 8).
- A true entitlements layer (see Section 8).
- Person-centric identity (`User` + `ConnectProfile`) with marketplace-intent fields already present (`openTo.deals`, `rateCard`).
- A genuinely differentiating, hard-to-fake **ERP-linked trust badge** (`connect/profile/erp-link.service.ts`) - we can prove a seller really runs payroll/invoices in our ERP.
- Meilisearch client for discovery (`connect/search/meili.client.ts`).
- Admin review/moderation screen pattern (the ads review console shipped 2026-05-27, web T10).

Not needed for Road A (would only be needed for a transactional marketplace): seller payouts, escrow, double-entry settlement ledger, commission engine, payout-KYC, dispute fund-handling, RBI PA / Razorpay Route.

## 4. Monetization model (decided)

Two mechanisms, both already proven in our codebase:

### 4a. Recurring plan allowances (entitlements)

What a plan lets you do, reset each billing cycle. The app checks the _allowance_, never the plan name (this is what lets us tighten free limits later without code changes). Connect allowance keys:

- `maxListings` - how many active listings.
- `leadsPerMonth` - buyer inquiries / contact unlocks per cycle.
- `includedBoostCredits` - boost credits granted each cycle.
- `verifiedBadge` - eligibility for a "verified" marker (gated additionally on real verification).
- `searchPriority` - ranking weight in marketplace search.

### 4b. Pay-as-you-go credits (the wallet)

One-off spend via the person-centric ads wallet. Available to EVERYONE, including free accounts:

- **Boost any post/listing a la carte** (Instagram-style) - no subscription required.
- Buy extra boosts/leads beyond a plan allowance.

Plan allowances top the wallet up with `includedBoostCredits` each cycle (granted credits, marked distinct from purchased credits so unused grants expire and do not roll over).

### 4c. Plan audiences

- **Connect-only** (a person with no ERP workspace - a karigar/workshop).
- **ERP-only** (existing workspace billing - unchanged).
- **ERP + Connect bundle** (one person/owner gets both, at a combined price).

### 4d. Launch posture

- A configurable **Free plan** with generous allowances ships day 1.
- Boost stays paid from day 1 (a la carte; already built).
- Monetizing later = lower the Free plan's numbers + sell higher plans + run promos. No rewrite.

Illustrative numbers (final values are admin-config, NOT hardcoded):

| Allowance            | Free (launch)  | Free (later)  | Premium        |
| -------------------- | -------------- | ------------- | -------------- |
| maxListings          | 25             | 3             | unlimited      |
| leadsPerMonth        | high/unlimited | 10            | high/unlimited |
| includedBoostCredits | 0              | 0             | e.g. 500/cycle |
| verifiedBadge        | if ERP-linked  | if ERP-linked | yes            |
| searchPriority       | normal         | normal        | boosted        |
| a la carte boost     | yes            | yes           | yes            |

## 5. Admin console for Connect (decided)

A dedicated Connect area in the existing admin panel, reusing proven patterns:

- **Plan + feature builder** - define each Connect feature/allowance, compose plans/tiers, set prices. Reuses the existing dynamic plan/tier admin (`app/admin/plans`, `app/admin/tiers`).
- **Listing moderation** - approve/reject listings. Reuses the ads review console pattern (web T10).
- **Ad placements** - manage feed-promoted, rail, and marketplace-boost slots (floors, enabled). Reuses the placement admin shipped with ads.
- **Promotions / sales** - discounts, intro offers, free-credit drops, seasonal sales. Reuses the coupon engine + `WalletService.topup` campaign drops + the `Msg91CostTable` versioned-pricing pattern + `BillingPolicy` singleton toggles.
- **Revenue dashboards** - subscriptions + boosts + leads.

## 6. Edge cases (decided / on the radar)

1. **Entitlements layer, never hardcoded plan checks** - flipping free->paid is a config change. (Already how the engine works.)
2. **Grandfathering** - early free sellers keep their generous limits when paid turns on; supported via per-user entitlement overrides + add-ons.
3. **Free-tier abuse / spam** - listing caps even on free + moderation (reuse ad review) + favor ERP-verified sellers.
4. **Pay-to-win density cap** - cap boosted/featured share of results so buyers keep trusting the directory (reuse the ads <30% density principle).
5. **Only sellers pay; buyers stay free** - never tax demand.
6. **Define "a lead"** - a billable lead = a buyer contact-unlock or inquiry; metered safely via the wallet/ledger idempotency pattern; spam/bad leads refundable.
7. **Credits: grants reset, purchases persist** - monthly included credits expire; bought credits roll over.
8. **Boost only moderated content** - "can boost" gated on listing/post = approved.
9. **Refund a boost** if the listing later fails moderation or under-delivers (ads refund/release logic exists).
10. **Soft paywall UX** - never block a free user from boosting; show upgrade prompts only at a real limit.
11. **GST invoices for a la carte boosts** by non-GST persons (B2C) - reuse person-level billing profile snapshot.
12. **Cold-start** - free onboarding brings sellers; seed buyer demand from the ERP user base + the Connect feed, or sellers churn.

## 7. Competitor references (what informed this)

- **Instagram/Facebook Boost** - any free user boosts a la carte (budget + duration). -> our PAYG wallet boost.
- **LinkedIn** - feature-gated tiers + consumable InMail credits + a la carte job posts. -> our entitlements + included/extra boost credits.
- **IndiaMART** - free-but-limited listings + paid seller plans + buy-leads credits + "TrustSEAL" verified badge. -> our listing caps + plans + lead credits + ERP-linked badge.
- **Justdial** - free listing + paid ranking + paid leads. -> our searchPriority + paid leads.
- **Meesho / Amazon** - sponsored placements (ads) on a marketplace rail. -> our ad rail.

## 8. Technical approach: EXTEND the billing engine

Verdict from the billing-extensibility investigation: **EXTEND, do not build parallel.** Evidence:

- `Plan` and `Tier` are DB documents with admin CRUD (`subscriptions/schemas/plan.schema.ts`, `tier.schema.ts`, `billing/services/admin-plan.service.ts`). Pricing is config-driven (`monthlyPrice`, GST config, trial config).
- True entitlements layer: `PlanEntitlements.moduleAccess: [{ module, enabled, subFeatures: [{ key, access: locked|limited|full }] }]`, snapshotted per-subscription as `appliedEntitlements`, enforced by a generic `SubscriptionGuard` + `@RequireSubscription({ module, subFeature, minimumAccess })` (`common/guards/subscription.guard.ts`, `common/utils/entitlement-resolve.util.ts`). No `plan === 'pro'` in the hot path.
- **Person-first already**: `Subscription.userId` is required, `workspaceId` is optional/nullable (`subscription.schema.ts`). A Connect-only plan is a subscription with `workspaceId: null`.
- Add-ons + entitlement-merge already exist and are person-bound (`add-ons/...`, `mergeEntitlements()`), stackable - the base for bundles/extras.
- The ads wallet is the right PAYG base (per-user balance + ledger + idempotency + Razorpay), NOT the platform credit pool (that is the vendor-cost pool) and NOT the comms credit blob (no ledger).
- Coupons engine exists (`billing/schemas/coupon.schema.ts` + `CouponService`): percentage/fixed/fixed-price, validity windows, global + per-user caps, first-time-only, stackable, `applicablePlanIds`, `autoApplyCampaignKey`.

### Extension points (additive)

1. **Plan/audience axis** (`plan.schema.ts`): add a `product` discriminator (`erp | connect | bundle`) + a `connect` sub-block on `PlanEntitlements` (`maxListings`, `leadsPerMonth`, `includedBoostCredits`, `verifiedBadge`, `searchPriority`) - mirrors how `storage`/`communications` sub-blocks were added. Add Connect `Tier` rows.
2. **Entitlement vocabulary + enforcement**: reuse `AppModule.CONNECT` / `AppModule.ADS` as `moduleAccess` entries (e.g. `marketplace.listings`, `marketplace.leads`, `profile.verified_badge`, `search.priority`); gate Connect endpoints with the existing `@RequireSubscription` + `SubscriptionGuard`. Add a small `ConnectAllowanceService` for the numeric allowances (reads `appliedEntitlements.connect.*`).
3. **PAYG credits**: reuse `AdvertiserWallet`/`AdWalletLedger`/`WalletService` for boosts AND leads. Add a cycle-reset grant cron (modeled on `billing/crons/renewal-notice.cron.ts`) that calls `WalletService.topup(userId, includedBoostCredits, { idempotencyKey: 'grant-<sub>-<cycle>' })`; mark granted vs purchased so grants expire.
4. **Checkout/Razorpay**: reuse `RazorpayPlatformService` + `subscription-checkout.service.ts` (Connect plan checkout) and `wallet-topup-checkout.service.ts` (PAYG top-ups, already built).
5. **Promotions**: reuse `Coupon`/`CouponService` (widen `applicablePlanIds` to Connect plans); free-credit drops via `WalletService.topup` with a campaign idempotency key.

### The 3 riskiest couplings (must handle)

1. **`userId`-unique active-subscription index** (`subscription.schema.ts`) + workspace-owner inheritance in `getMySubscription`/`SubscriptionGuard.getEntitlements`. Today a person cannot hold an active ERP sub AND an active Connect sub. Fix: add `product` to the partial unique index (`{ userId, product }` unique while active/trial) and ensure Connect requests resolve purely by `userId` (never inherit the workspace branch).
2. **Entitlement normalize/repair is ERP-only** (`normalizeEntitlementsForTier`, `buildModuleAccess(tierKey)` from the ERP module registry). A Connect sub passing through these could be "repaired" to ERP free-tier defaults and lose its Connect features. Fix: make `buildModuleAccess`/normalization Connect-aware (branch by `product`).
3. **New sub-feature keys read as LOCKED on existing subs** unless back-filled. Fix: a repair-migration (existing pattern) to add Connect keys to active subscriptions.

## 9. Phased build plan (the epic)

**Phase M0 - Connect Monetization Engine (the foundation / "the core we were missing").** Ships dormant + free.

- Plan `product` discriminator + `connect` entitlements sub-block; index fix; Connect-aware normalization; back-fill migration.
- Seed Connect `Tier` rows (Free generous + Premium); `ConnectAllowanceService`; included-credits grant cron (grant vs purchased).
- Admin: Connect fields in the plan/tier builder.

**Phase M1 - Marketplace core.**

- Listing/catalog schema (person-centric seller; textile attributes: price range, MOQ, lead time, work-type, location, photos).
- Marketplace search (reuse Meilisearch, new index) + discovery distinct from the social feed.
- Inquiry/lead mechanism (reuse connections/messaging) + lead metering against `leadsPerMonth`.
- Listing create gated by `maxListings` + soft upgrade prompt; listing moderation (reuse ad review).

**Phase M2 - Monetization surfaces on the marketplace.**

- Boost a listing (reuse ad engine; a la carte for free + included credits for premium; gated on moderation).
- Ad rail inside marketplace (reuse ad placements).
- Apply `verifiedBadge` + `searchPriority`; paid-leads / contact-unlock metering.

**Phase M3 - Admin & sales.**

- Connect admin console consolidation (feature/plan builder, listing moderation, placements, promotions/sales, revenue dashboards).
- Promo/sale mechanics (coupons + free-credit drops + intro offers).

Cross-cutting (every phase): person-centric (no workspaceId in Connect), i18n across en/gu/gu-en/hi-en, WCAG AA, no em-dashes, RED-first tests, reuse over rebuild.

## 10. Open / deferred

- Exact pricing numbers and free-tier limits -> admin config + a launch-tuning pass (not hardcoded; owner sets via panel).
- Light seller verification (GST display via the existing SurePass provider) for the "verified" badge - design in M1/M2; NOT payout-KYC.
- Embedded credit / logistics / VAS revenue - deferred (future, only if we ever go transactional).
- Buyer-side premium - out of scope (buyers stay free).

## 11. Irreducible choices that remain the owner's call

- Which revenue levers turn on at launch vs later (currently: all built, only Boost active at launch).
- Final price points + free limits (admin-set).
- Whether/when to ever add a transactional (escrow) layer later (separate, heavy, RBI-bound effort).
