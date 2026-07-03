# Marketplace ads + Boosts module - design

Date: 2026-06-02
Status: proposed (awaiting owner review)
Author: assistant (open-design + brainstorming)

## Context

Ads are Zari360 Connect's main revenue. The owner pointed at the canonical prototype's marketplace and asked to (a) implement the feasible parts of that design and (b) make the marketplace and the ad system first-class, across both first-party (own) ads and a Google ad section.

Research finding: the ad infrastructure is already built, so this is mostly wiring and UI, not a new engine.

- First-party engine (backend, production-ready): `src/modules/connect/ads/` has campaigns, creatives, ad-sets (targeting), seeded placements (`feed_promoted_post`, `marketplace_rail`), a prepaid `advertiser-wallet` (1 credit = INR 1 ex-GST), impression/click tracking, frequency capping, pacing, CPM/CPC billing, and a hot-path decision service (`ad-decision.service.ts#decide`). Boosting a listing works end to end; a job boost path exists.
- First-party surfacing (web): `lib/connect/ads.ts` (placement enum + `resolveAd`), `features/connect/ads/` (`promoted-rail.ts#resolvePromotedRailListing`, `use-ad-beacons.ts`, `BoostComposer.tsx`, `WalletPanel.tsx`, `AdCard.tsx`), `components/connect/{AdSlot,GoogleAdUnit,ConnectRightRail,EntityAdRail}.tsx`, `features/connect/marketplace/PromotedListingAdCard.tsx`.
- Google ads (web): config-ready, not absent. AdSense loader is env-gated in `app/connect/layout.tsx`; `GoogleAdUnit` exists; `AdSlot` resolves first-party then Google then nothing; `lib/env.ts` holds `adSenseClientId` + a per-placement `adSenseSlots` map. To switch on: supply the AdSense client + slot IDs. CMP/consent for DPDP is a separate owner config.
- Owner is mid-flight on the exact pattern to reuse: the uncommitted `CompanyDirectoryAdCell.tsx` + `2026-06-02-company-directory-refine-and-ads-design.md` add an in-grid ad cell (first-party promoted then Google then nothing, no-gap, cadence) to the company directory.

## Decisions (owner-confirmed)

- Scope: marketplace ad placements AND the full Boosts module (manager + configurator).
- Google ads: unified fallback (first-party promoted then Google then nothing), the same seam as the company-directory cell.
- Boost targets: Product (listing) + Job only, the two shipped boost kinds. Storefront and Post boosts are surfaced as not-yet-available (net-new, deferred).
- Reach estimate: build a real one. Audience size = real count; reach = derived from budget vs floor price; inquiries = clearly-labeled estimate from a documented assumed rate (no conversion history yet).

## Locked reconciliations (prior decisions, not matching the prototype)

- Checkout is the prepaid wallet, not the prototype's per-boost GST invoice. The GST invoice is issued at wallet top-up (Razorpay). The configurator shows the cost, spends grant credits first then purchased credits, and prompts a top-up when the balance is short.
- Honest data: no fabricated audience, reach, or conversion numbers unless backed by a real query (see the estimate honesty note).
- Post-boost was retired and storefront-boost is unbuilt; the marketplace promotes listings, which is correct for this surface.

## Architecture

Reuse the existing engine and primitives. New code is thin glue plus three small backend endpoints.

Web primitives to reuse (verify exact APIs at build time): `AdSlot`, `GoogleAdUnit`, `PromotedListingAdCard`, `use-ad-beacons.ts`, `promoted-rail.ts`, `BoostComposer.tsx`, `WalletPanel.tsx`, `KpiStrip.tsx`, `ConnectPage`, `Rail`, the `Ds*` atoms.

Backend to reuse: the ads module's schemas, `ad-decision.service`, boost create/pause/resume endpoints, wallet endpoints, daily rollups.

## Slices

### Slice 1 - Marketplace in-grid ad cell

Mirror the in-flight `CompanyDirectoryAdCell` for the marketplace grid.

- New placement `marketplace_grid` (surface: grid): seed in the backend `ad_placements`; add `connect.marketplace.grid` to the web `AdPlacement` enum in `lib/connect/ads.ts` (edit additively - the owner has this file uncommitted for `connect.directory.grid`); add env slot `NEXT_PUBLIC_ADSENSE_SLOT_MARKETPLACE_GRID` to `lib/env.ts` `adSenseSlots`.
- The marketplace Server Component (`app/connect/marketplace/page.tsx`) resolves a promoted listing for `marketplace_grid` (via `resolvePromotedRailListing('marketplace_grid')` or the listing decide action) alongside the existing `marketplace_rail` resolve, and passes it down.
- A `MarketplaceAdCell` (new, mirrors `CompanyDirectoryAdCell`) resolves first-party promoted listing then Google `AdSlot` then nothing. Injected into the results grid at a cadence (after the 4th card, then every 8th), grid-view only, no-gap (only injected when it will fill). Beacons via `use-ad-beacons`, "Promoted"/"Sponsored" labels, `rel="sponsored"`, "why am I seeing this".
- Keep the existing right-rail promoted ad untouched.
- Do not refactor the owner's `CompanyDirectoryAdCell` now; note a future shared `ConnectGridAdCell` extraction as a DRY follow-up.

### Slice 2 - Boost configurator

Enhance the existing `BoostComposer` to the prototype's wizard (`connect-boost.html`), Product + Job targets only.

- Steps: target (Product or Job, with a target preview) -> goal (views / inquiries / followers / applicants, constrained to what the target supports) -> audience (district + trade/category chips, role segment, verified-only toggle) -> budget (per-day presets + custom) and duration (3/7/14/30) -> live estimate -> checkout.
- Estimate: call the new estimate endpoint on targeting/budget/duration change; show real audience size + reach range; show the inquiries range labeled as an estimate.
- Checkout: wallet. Show cost (ex-GST credits), current wallet balance, and a top-up affordance (reuse `WalletPanel`) when short. Submit via the existing `/connect/ads/boosts/listing` or `/job` endpoints. Right-rail live preview of the promoted card.
- Entry points: a Boost action on a listing (My listings) and on a posted Job. Route or modal: a modal opened from those entry points, or `app/connect/boosts/new`; decide at build to match the shipped `BoostComposer` form factor.

### Slice 3 - Boosts manager

New dashboard at `app/connect/boosts` matching `connect-boosts.html`.

- KPI strip (reuse `KpiStrip`): active boosts, reach (30 days), inquiries from boosts, spend this month vs budget.
- Tabs: Active / Scheduled / Completed / Drafts.
- Per-boost row: target summary, status pill, spend vs budget bar, reach, conversions (inquiries/applicants), cost-per-unit, days left.
- Actions: pause/resume (existing endpoints), view report, boost again, finish-setup for drafts.
- Honest data: render only real campaign metrics from the rollups; no placeholder rows.

### Slice 4 - Glue

- Routes: `app/connect/boosts/page.tsx` (manager) and the configurator route/modal.
- Sidebar nav: a Boosts item under "Your business" (the prototype shows it there).
- i18n x4 (en/gu/gu-en/hi-en) for all new copy.
- Entry points wired from listings and jobs.

## Backend additions (small, in `src/modules/connect/ads/`)

1. Seed the `marketplace_grid` placement (surface: grid, a floor CPM consistent with `marketplace_rail`).
2. Estimate endpoint, e.g. `POST /connect/ads/estimate` taking a targeting spec + budget + duration, returning `{ audienceSize, reachLow, reachHigh, inquiriesLow, inquiriesHigh }`.
   - `audienceSize`: real count of ad profiles matching the targeting (roles, sectors/trade, districts, verified-only).
   - reach range: derived from budget x duration vs the placement floor CPM and the frequency cap (real-ish, based on price, not invented).
   - inquiries range: reach x a documented assumed inquiry rate (a single named constant), returned with an `isEstimate` marker and surfaced in the UI as an estimate. Flagged to replace with a measured rate once boost conversions accrue.
   - Put the math in a pure, unit-tested helper (mirror the jobs `board-query.helpers.ts` pattern). TDD, RED first.
3. List-my-boosts + stats for the manager, e.g. `GET /connect/ads/boosts` (the caller's campaigns with rollup metrics + status, paginated/grouped by status) and `GET /connect/ads/boosts/stats` (the KPI aggregates). Reuse `ad-daily-rollup`.

## Estimate honesty note (explicit assumption)

Audience size and reach are grounded in real data (a count query and price-derived math). The inquiries figure is the one heuristic: with no boost conversion history, it is `reach x ASSUMED_INQUIRY_RATE` where `ASSUMED_INQUIRY_RATE` is a single documented constant, and the UI labels it an estimate. If the owner prefers, we omit the inquiries figure entirely (audience + reach only). This is the one place the design is not fully data-backed; everything else is.

## Conflicts surfaced (not silently matched)

- Per-boost GST invoice (prototype) -> prepaid wallet (ours).
- Boost a Post / Storefront (prototype) -> Product + Job only; Post/Storefront shown as not-yet-available.
- Fabricated audience/reach/inquiry numbers (prototype) -> real audience + reach, labeled inquiries estimate.

## Risks and coordination

- `lib/connect/ads.ts` and the ad-cell pattern are owner-uncommitted WIP (company directory). Edit `ads.ts` additively; do not touch `CompanyDirectoryAdCell`. The commit will entangle with the owner's ad WIP; owner commits, explicit-path staging.
- Google fill needs the owner's AdSense client + slot IDs and a CMP for DPDP before it serves real Google ads; the first-party path and the no-gap rule work without it.
- Wallet top-up needs Razorpay creds in the environment to complete a real payment.

## Verification

Per slice, scoped to touched files (the repo OOMs on whole-project tooling on the backend):

- Backend: `nest build` (SWC) + module-only vitest (`--no-file-parallelism`) for the new pure helpers, RED first.
- Web: `tsc --noEmit`, `eslint` on changed files, `check:i18n`, `detect:hardcoded-i18n`, the banned-AntD `rg` self-check.
- Browser smoke (owner, Tier B): marketplace in-grid ad cell renders/falls back/leaves no gap; configurator steps + real estimate + wallet checkout; manager KPIs + tabs + actions.
- Zero git operations (owner commits). No em-dashes. i18n across all four locales (gu/gu-en/hi-en best-effort, owe native review).

## Out of scope (flagged for later)

- Storefront boost and re-enabled post boost (net-new boost kinds).
- A measured inquiry-conversion rate (replace the assumed constant once data exists).
- A shared `ConnectGridAdCell` extraction unifying the marketplace and directory ad cells.
- The prototype's per-boost GST-invoice checkout (superseded by the wallet).
