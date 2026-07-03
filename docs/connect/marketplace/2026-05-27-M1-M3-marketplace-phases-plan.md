# Connect Marketplace - Phases M1-M3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`. Build M0 (the monetization engine) FIRST - these phases consume its entitlements.
>
> **Decision basis:** `2026-05-27-connect-monetization-and-marketplace-foundation.md` (design) + `2026-05-27-M0-connect-monetization-engine-plan.md` (M0). Read both first.
>
> **Model:** Road A MEDIATOR. Listings + discovery + leads; buyers and sellers transact OFF platform. NO payments/escrow/payouts. Revenue = ads (Boost) + Connect plans + PAYG credits + paid leads.

**Goal:** Ship the seller-facing marketplace on top of the M0 monetization engine: listings, discovery, buyer leads (M1); boost-a-listing + ad rail + verified badge + paid leads (M2); the consolidated Connect admin console + sales/promotions (M3).

**Cross-cutting invariants (every task):** person-centric (Connect identity, NEVER workspaceId or `<Can>`); i18n across en/gu/gu-en/hi-en (web); WCAG AA; NO em-dashes; reuse over rebuild; RED-first vitest for services/logic; `npx nest build` to verify schemas (repo vitest cannot import metadata-decorated schemas); web verify = vitest + eslint + tsc(touched) + `npm run check:i18n`.

**Worktrees:** backend `…/crewroster-backend/zari360-connect`, web `…/crewroster-web/zari360-connect`, branch `zari360-connect`.

---

## PHASE M1 - Marketplace Core (listings, discovery, leads)

### Task M1.1: Listing schema + module (backend)

**Files:** Create `src/modules/connect/marketplace/schemas/listing.schema.ts` + `marketplace.module.ts`.

- [ ] Discovery: read `connect/feed/schemas/post.schema.ts` (mirror its conventions) + the `connect` module layout + `connect/ads/schemas/*` (ownerUserId person-centric pattern).
- [ ] Define `Listing` (collection `connect_listings`): `ownerUserId` (ref User, indexed), `title`, `description`, `category`/`tradeType` (enum from a textile taxonomy: weaving, dyeing, printing, embroidery/zari, job-work, raw-material, machinery, finished-goods, ...), `priceType` (`fixed|range|negotiable`), `priceMin`/`priceMax` (rupees), `unit` (per-meter/piece/kg/order), `moq` (min order qty), `leadTimeDays`, `location` ({ district, city }), `images: string[]`, `status` (`draft|pending_review|active|paused|rejected|expired`), `moderationStatus` + `rejectionReason?`, `boostCampaignId?` (link when boosted), timestamps. Indexes: `{ownerUserId, status}`, `{status, category}`, text/geo as needed.
- [ ] Verify: `npx nest build`. No standalone schema vitest (toolchain).

### Task M1.2: Listing CRUD service + controller (backend, TDD)

**Files:** Create `marketplace/services/listing.service.ts`, `controllers/listing.controller.ts`, DTOs; Test `__tests__/listing.service.vitest.ts` (decorator-mock).

- [ ] Discovery: read an existing Connect controller+service (e.g. ads or feed) for JwtAuthGuard + DTO + throttler + person-centric (`req.user.sub`) conventions.
- [ ] RED: tests for create (gated by `ConnectAllowanceService.assertCanCreateListing` from M0.5 - throws at the cap), update/publish/pause/delete (owner-only), listMine, getPublic.
- [ ] GREEN: implement. Create sets `status` per launch policy (config flag: auto-`active` at launch, or `pending_review` when moderation is on). Inject `ConnectAllowanceService`. AuditService + PostHog on writes; OTel spans on reads.
- [ ] Verify: vitest + `npx nest build`. Commit.

### Task M1.3: Listing moderation (backend + web admin)

**Files:** Backend admin endpoints under `admin/connect/marketplace/review`; web `app/admin/connect/marketplace/review/page.tsx` + a client island.

- [ ] Reuse the ads review pattern wholesale: backend list-pending/approve/reject (reason) guarded by JwtAuthGuard + IsAdminGuard + audit; web reuse the `AdminAdReview` structure (approve/reject + optimistic removal). English-only admin (matches `app/admin/*`).
- [ ] Verify: backend build + vitest; web eslint/tsc. Commit.

### Task M1.4: Marketplace search + discovery (backend)

**Files:** Modify `connect/search/*` (add a listings index) + a `marketplace/services/listing-search.service.ts`.

- [ ] Discovery: read `connect/search/meili.client.ts` + `search.service.ts` (mirror the people/profile index pattern).
- [ ] Add a `connect_listings` Meili index; index active listings on create/update/status-change; expose search with filters (category, district, priceMin/Max, verified) + sort that boosts by the `searchPriority` entitlement (M0) and boosted listings (M2). Keep this index distinct from the social/people index.
- [ ] Verify: build + a search.service vitest (mock the Meili client). Commit.

### Task M1.5: Inquiry / lead flow (backend, TDD)

**Files:** Create `marketplace/schemas/listing-inquiry.schema.ts` + `services/inquiry.service.ts` + controller.

- [ ] Discovery: read the Connect connections + messaging/notifications modules (reuse for delivering an inquiry to the seller).
- [ ] Define `ListingInquiry` (buyerUserId, listingId, sellerUserId, message, contactUnlocked, createdAt). Flow: buyer sends inquiry / unlocks seller contact -> notify seller (reuse Connect notifications). Define a "lead" = a contact-unlock or first inquiry on a listing by a buyer.
- [ ] Meter against `ConnectAllowanceService` (consume a lead; at the cap -> soft block + upgrade prompt in M2 wiring). RED-first on the metering + dedupe (same buyer+listing = one lead).
- [ ] Verify: vitest + build. Commit.

### Task M1.6: Web marketplace UI

**Files:** `app/connect/marketplace/page.tsx` (browse/search), `app/connect/marketplace/[listingId]/page.tsx` (detail + inquiry), `app/connect/marketplace/new/page.tsx` (create), `app/connect/marketplace/mine/page.tsx`; `features/connect/marketplace/*` (server actions + components).

- [ ] Server actions wrap the BE via `serverHttp`/`unwrapServer` -> `ActionResult` (mirror `features/connect/ads/ads.actions.ts`).
- [ ] Browse/search with filter chips (cr-\* tokens, reuse the feed/ads visual language); listing detail with the inquiry/contact-unlock button; create-listing form gated by the listing allowance (soft upgrade prompt at the cap, never a hard wall); my-listings with pause/boost entry.
- [ ] Empty/loading/error states; i18n 4 locales; WCAG AA; no em-dash. RTL tests on the interactive seams.
- [ ] Verify: vitest + eslint + tsc(touched) + check:i18n. Commit.

### Task M1.7: M1 i18n + a11y + states sweep

- [ ] Add all `connect.marketplace.*` keys across en/gu/gu-en/hi-en; `npm run check:i18n` parity; em-dash grep; final states pass. Commit.

---

## PHASE M2 - Money surfaces on the marketplace

### Task M2.1: Boost a listing (reuse the ad engine)

**Files:** Extend `connect/ads/*` to accept a listing as boostable + web boost entry on a listing.

- [ ] Discovery: read the ads boost create flow (`createBoost` + the campaign/creative schemas).
- [ ] A listing boost = an ad campaign whose creative/target is the listing. a la carte for FREE users (charge the person wallet, Instagram-style, no subscription) + consume `includedBoostCredits` for premium. Gate on listing `moderationStatus === approved`. Link `Listing.boostCampaignId`.
- [ ] Verify: vitest + build; web eslint/tsc. Commit.

### Task M2.2: Marketplace ad rail

**Files:** Add a marketplace placement key to the ad decision engine + render a rail slot in the marketplace UI.

- [ ] Discovery: read the ads placement/decision config (the placement keys + admin placement CRUD shipped in ads T10).
- [ ] Add a `marketplace_rail` placement; serve a promoted listing/ad in the marketplace rail via the existing decision + beacon flow (reuse `AdCard`). Respect the paid-density cap. Commit.

### Task M2.3: Verified badge + search priority

- [ ] Wire the `verifiedBadge` entitlement to a display marker on listings/profile; optionally gate it on light GST verification (reuse the existing SurePass GSTIN provider - display only, NOT payout-KYC). Wire `searchPriority` (M0) into the M1.4 ranking. Verify + commit.

### Task M2.4: Paid leads / contact-unlock PAYG

- [ ] Beyond the plan's `leadsPerMonth`, allow unlocking more via wallet credits (reuse the wallet debit + idempotency). Soft upgrade prompt at the free cap. RED-first on the charge/idempotency. Verify + commit.

### Task M2.5: M2 i18n + a11y sweep. Commit.

---

## PHASE M3 - Connect admin console + sales/promotions

### Task M3.1: Connect admin section

**Files:** `app/admin/connect/*` landing + nav grouping.

- [ ] Consolidate under one Connect admin area: plans/tiers (M0.7), listing moderation (M1.3), ad placements, revenue. English-only + AntD, consistent with `app/admin/*`. Commit.

### Task M3.2: Promotions / sales (admin)

**Files:** reuse `subscriptions/billing` coupon engine + `WalletService.topup` campaign drops + `BillingPolicy` toggles.

- [ ] Admin UI to: create plan discounts (coupons), free-credit drops (campaign topups), intro offers, and scheduled sales windows. Reuse the `Msg91CostTable` versioned-pricing admin pattern + the coupon primitives. Eligibility/expiry/per-user caps handled by the coupon engine. Verify + commit.

### Task M3.3: Revenue dashboards

- [ ] Admin tiles/tables for subscription revenue + boost spend + paid-lead revenue (reuse the ads revenue endpoint + add Connect-plan revenue). Commit.

### Task M3.4: Plan/feature builder polish

- [ ] In `app/admin/plans` + `tiers`, surface the Connect feature catalog so admins compose Connect plans from feature toggles + numeric allowances (the values already pass through per M0.7). Commit.

---

## Self-Review (coverage)

- Listings -> M1.1/M1.2/M1.6. Discovery/search -> M1.4. Leads -> M1.5 (metered via M0.5). Moderation -> M1.3. Boost-a-listing -> M2.1 (reuses ads). Ad rail -> M2.2. Verified badge + search priority -> M2.3. Paid leads PAYG -> M2.4. Admin console -> M3.1. Sales/promos -> M3.2 (reuses coupons + credit drops). Revenue -> M3.3. Feature/plan builder -> M3.4 (+ M0.7).
- Everything monetization-related consumes the M0 entitlements/wallet; nothing here introduces buyer->seller money movement (mediator model preserved).
- Dependencies: M1 needs M0 (allowances + wallet). M2 needs M1 (listings) + the ads engine (shipped) + M0 (credits). M3 needs M0/M1/M2 surfaces to manage.

## Execution Handoff

Plan the per-task code at execution time (TDD against the compiler/tests). Discovery steps name the repo-specific lookups. Build M0 first, then M1 -> M2 -> M3. Subagent-driven OR inline; given this session's subagent stream-truncation, inline-with-battery may be more reliable.
