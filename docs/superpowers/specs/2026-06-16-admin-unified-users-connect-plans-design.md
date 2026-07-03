# Unified Admin Users + Connect Plan Management (bundle-ready)

**Status:** Proposed — awaiting owner review
**Date:** 2026-06-16
**Repos:** `crewroster-backend` + `crewroster-web` (admin panel). No mobile app work.
**Owner decisions captured:** (1) Full unified plan screen — manage ERP and Connect side by side, with Connect package management alongside ERP. (2) Extra admin action: adjust boost wallet credits. (3) Forward constraint: a future **ERP + Connect bundle** product must slot in cleanly and be fully dynamic (configurable per package + per-user override), not a hard-coded combo.

---

## 1. Context & problem

The admin Users screen (`/admin/users`) lists every non-admin user, but it only understands the **business (ERP)** plan. Connect users appear in the list with no Connect indicator, no way to filter to them, and a single "Plan" column that can show the wrong product.

Connect limits today are a hidden, one-user-at-a-time override console (`/admin/connect/entitlements`). Connect has **no named packages** in practice — every Connect user falls back to one built-in default set (e.g. 1 company page, 1 storefront, 25 listings, 10 open jobs). The owner wants Connect managed the same way as ERP, unified into the Users flow, with reusable packages and per-user customization, plus a manual boost-credit control — all designed so an ERP+Connect bundle can be added later without rework.

### Why this is more than UI plumbing — findings that shape the design

1. **Plan assignment is not product-aware (linchpin + latent bug).**
   `AdminService.assignPlan` / `customAssignPlan` (`crewroster-backend/src/modules/admin/admin.service.ts:813`, `:909`) supersede **all** active/trial subscriptions for the user regardless of product, and never set `product` on the new subscription (so it defaults to `'erp'`, `subscription.schema.ts:51`). Consequences today:
   - Assigning a "Connect" plan would create an **ERP** subscription, and
   - it would **wipe the user's other-product subscription**.
     This is the single most important fix: without product-scoped supersede + `product` set from the plan, "manage ERP and Connect side by side" is impossible (each assign clobbers the other).

2. **Runtime resolution hard-codes single product values.**
   - Connect allowances resolve on `product: 'connect'` only (`connect-allowance.service.ts:144`, fallback `:161`; admin override reads `admin-connect-entitlements.service.ts:84,202`).
   - ERP/main subscription resolution (`subscriptions.service.ts:498`, `getMySubscription`) applies **no product filter** — it returns the first active/trial sub of any product (a bundle-readiness bug: it can return a Connect sub when resolving ERP).
   - Good precedent already exists: `connect-promotion.service.ts:151` and `connect-revenue.service.ts:52` already use `product: { $in: ['connect','bundle'] }`. The bundle pattern is established; these other seams must adopt it.

3. **Connect packages can't express the owner's own example caps.**
   `PlanConnectEntitlements` (`plan.schema.ts:165`) has `maxListings, leadsPerMonth, includedBoostCredits, verifiedBadge, searchPriority, storageMb, overLimitPolicy, overLimitGraceDays` — but **not** `maxCompanyPages`, `maxStorefronts`, or `maxJobs`. Those three exist only in the runtime allowance set + per-user override + hard-coded defaults. So a _package_ cannot currently say "Free = 1 company, 1 storefront, 10 jobs" — exactly the limit the owner described. These three fields must be added to the package schema.

4. **The entitlement container already supports bundles.**
   `subscription.appliedEntitlements` is the ERP entitlement object **with a `.connect` sub-block** (read at `connect-allowance.service.ts:151`). A bundle = one subscription with `product:'bundle'` whose `appliedEntitlements` carries both the ERP fields and the `.connect` block. No new container needed — bundle is dynamic by construction.

5. **Connect-user signal exists and is cheap.**
   `ConnectProfile` (`connect-profile.schema.ts`, collection `connectprofiles`, unique `userId`) is created lazily on first Connect onboarding — the best single "is a Connect user" signal. Secondary footprint signals: company pages (`ownerUserId`), storefronts (`ownerUserId`), listings (`ownerUserId`), jobs (`companyUserId`), advertiser wallet (`ownerUserId`), Connect subscription.

6. **The wallet was built anticipating admin adjustments.**
   `ad_advertiser_wallets` (`advertiser-wallet.schema.ts`, per-user `ownerUserId`, `balance` in whole rupees, separate expiring `grantBalance`, `reserved`). The ledger `ad_wallet_ledgers` already defines an `'adjustment'` type (defined, unused) and the reconcile cron already **skips** owners with adjustment rows. Clean path: add `WalletService.adjust()` writing an `adjustment` ledger row + audit (`AppModule.ADS`) + a thin admin endpoint. No raw balance writes.

---

## 2. Goals / non-goals

**Goals**

- One Users list for all users, with an **All / ERP / Connect / Both** filter, correct per-product display, and a Connect indicator.
- One per-user **Manage Plans** panel: ERP (left) and Connect (right) managed independently and side by side.
- Connect side supports: assign a **named Connect package**, **hand-tune limits** (override, incl. company/storefront/job caps), and **adjust boost credits**.
- **Connect packages** are first-class in the Plans admin, next to ERP plans, and can set all caps.
- Every seam designed so `product:'bundle'` works without rework, and a bundle's ERP + Connect entitlements are both fully editable (package) and overridable (per user).
- Platform bar: English-only admin (matches existing), AntD, responsive, keyboard-accessible, loading/empty/error states, audited writes, tests.

**Non-goals (now)**

- Building the actual bundle packages / bundle pricing content (unblocked by this work, but not created here).
- Connect "suspend" and "clear over-limit hiding now" actions (owner did not select them).
- Any mobile app change.
- Reworking the public/self-serve Connect or ERP checkout.

---

## 3. Design overview

Three pillars + one extra, on a bundle-ready spine.

```
┌──────────────────────────────────────────────────────────────────────┐
│  /admin/users   [ All | ERP | Connect | Both ]   search…   ☐ deleted   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ User            Products              ERP plan     Connect          │ │
│  │ Asha …          [ERP][Connect]        Pro          Free · 1/1 cos  │ │
│  │ Ravi …          [Connect]             —            Pro pkg · custom │ │
│  │ Meena …         [ERP]                 Starter      —                │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                   row ⋯ → Manage Plans  │
└──────────────────────────────────────────────────────────────────────┘

Manage Plans (drawer, wide)
┌───────────────────────────────┬──────────────────────────────────────┐
│  BUSINESS (ERP)               │  CONNECT                              │
│  • Assign existing plan       │  • Assign Connect package             │
│  • Custom assignment          │  • Custom limits (plan|override|      │
│    (reuses today's tabs)      │      effective|usage; incl. company/  │
│                               │      storefront/job caps)             │
│                               │  • Boost credits: balance + add/deduct│
└───────────────────────────────┴──────────────────────────────────────┘
```

Reuse-first: the ERP side reuses the existing `ExistingPlanTab` / `CustomPlanTab`; the Connect custom-limits side reuses `ConnectEntitlementsPanel`; package management reuses `/admin/plans`.

---

## 4. Key decisions (ADR-style)

### ADR-1: Make plan assignment product-aware (supersede by product group)

**Decision.** `assignPlan` / `customAssignPlan` set `subscription.product = plan.product` (default `'erp'` when a plan has none), and supersede only subscriptions in the **same product group**, where the group of `bundle` = {erp, connect, bundle} and the group of `erp`/`connect` = {self, bundle}.

- Assign ERP → supersede active ERP **and** any bundle (bundle includes ERP); leave Connect intact.
- Assign Connect → supersede active Connect **and** any bundle; leave ERP intact.
- Assign Bundle → supersede ERP + Connect + Bundle (it replaces both).
  **Why.** Required for independent side-by-side management; fixes the clobber bug; makes bundle assignment correct. **Consequence.** Behavioral change to a write path — owner sign-off required (see §7). The duplicate-key retry (`admin.service.ts:891`) stays but now keys on `(userId, product)`.

### ADR-2: Bundle-ready resolution (broaden the single-product seams)

**Decision.** Adopt the existing `$in` pattern everywhere a single product is hard-coded:

- Connect allowance + free-fallback + admin override reads: `product: { $in: ['connect','bundle'] }`.
- ERP/main resolution `getMySubscription`: add `product: { $in: ['erp','bundle'] }` (also fixes today's no-filter bug).
  **Why.** A bundle subscription must satisfy both ERP and Connect resolution. Backward-compatible: no `bundle` rows exist yet, so behavior is unchanged until bundles ship. **Consequence.** `getMySubscription` gaining a product filter is a behavior change (today it can return any product) — sign-off item.

### ADR-3: Connect-user signal = ConnectProfile (primary), footprint union (filter)

**Decision.** "Is a Connect user" = has a `ConnectProfile` **or** an active/trial Connect/bundle subscription. The list filter computes ERP-side and Connect-side flags before pagination (so counts and paging are correct). "Is an ERP user" = has any workspace membership **or** an active/trial ERP/bundle subscription.
**Why.** ConnectProfile is created on first Connect entry and is unique per user — the cheapest reliable signal; workspace membership is already computed for the list. **Consequence.** The users query becomes an aggregation with lookups (see ADR-4).

### ADR-4: Rebuild `getUsers` as one aggregation returning per-product summaries + filter

**Decision.** Replace the find-then-enrich `getUsers` with a single aggregation: `$lookup` active/trial subscriptions (split into `erpSubscription` + `connectSubscription` by product, bundle feeds both summaries), `$lookup` ConnectProfile existence, reuse the workspace-count grouping; derive `isErpUser` / `isConnectUser`; `$match` the requested `product` filter (`all|erp|connect|both`); `$facet` for page + total.
**Why.** Filtering by product must happen before pagination; one query keeps it consistent and indexable. **Consequence.** Endpoint response shape changes (per-product blocks instead of one `subscription`) and gains a `product` query param — sign-off item. Indexes: `connectprofiles.userId` (unique, exists); confirm an index supports the subscription lookup on `(userId, status)`.

### ADR-5: Boost-credit adjust via WalletService.adjust() + 'adjustment' ledger

**Decision.** Add `WalletService.adjust(ownerUserId, signedAmount, adminUserId, reason, note?)` that `$inc`s `balance`, writes an `adjustment` ledger row (with `recordedBy`, `note`, snapshots), and refuses to drive `balance` negative (schema `min:0`). Expose via a thin admin endpoint guarded like other admin Connect routes; audit with `AppModule.ADS`.
**Why.** Reuses the ledger/audit infra the wallet already anticipated; reconcile cron already tolerates `adjustment` rows. **Consequence.** New endpoint (sign-off item). Credits target the purchased `balance` bucket, not the expiring `grantBalance` (documented; grant-targeting is a later option).

---

## 5. Component breakdown (isolated, testable units)

### Backend (`crewroster-backend`)

- **BE-1 — Product-aware assignment.** Edit `assignPlan` + `customAssignPlan`: set `product` from plan; supersede by product group (ADR-1). DTOs accept an explicit `product` for the custom path (so a custom Connect assignment without a base plan still lands on the right product). Update the duplicate-key retry to scope by product. _Depends on: nothing. Unblocks: everything._
- **BE-2 — Bundle-ready resolution.** Broaden the seams in ADR-2 (`connect-allowance.service.ts` ×2, `admin-connect-entitlements.service.ts` ×2, `subscriptions.service.ts` getMySubscription). Pure query-predicate edits. _Depends on: nothing._
- **BE-3 — Admin users aggregation.** Rewrite `AdminService.getUsers` (ADR-4); extend `AdminPaginationDto` with `product?: 'all'|'erp'|'connect'|'both'`. Response per user: `{ …user, workspaceCount, isErpUser, isConnectUser, erpSubscription|null, connectSubscription|null }` where each `*Subscription` = `{ planName, planTier, status, product }`. _Depends on: BE-2 (so bundle rows classify correctly)._
- **BE-4 — Connect package caps.** Add `maxCompanyPages`, `maxStorefronts`, `maxJobs` to `PlanConnectEntitlements`; ensure `resolveConnectAllowances` already merges them from `appliedEntitlements.connect` (it does — confirm defaults flow from plan, not just the hard-coded fallback). _Depends on: nothing._
- **BE-5 — Wallet admin adjust.** `WalletService.adjust(...)` (ADR-5) + `AdsAdminService` wrapper (audit + PostHog) + `AdsAdminController` endpoint `POST admin/connect/ads/wallet/:userId/adjust` + `AdminWalletAdjustDto { amount:number (signed), reason:string, note?:string }`. Also expose a read so the panel can show balance (reuse `getWallet`). _Depends on: nothing._
- **BE-6 — Bundle package validation (forward-only).** Plan create/update accepts `product:'bundle'` and validates that a bundle plan carries both an ERP entitlement block and a `.connect` block. Minimal now; no bundle records created. _Depends on: BE-4._

### Frontend (`crewroster-web`, admin — English-only, AntD)

- **FE-1 — Users list upgrade.** Add the product filter (segmented `All/ERP/Connect/Both`, wired to the new param), replace the single Plan column with a **Products** badge cell + an **ERP plan** cell + a **Connect** cell (package/free + a glance at caps). Fix the type to the new per-product response. _Depends on: BE-3._
- **FE-2 — Unified Manage Plans drawer.** New wide drawer launched from the row. Left panel embeds the existing ERP assign tabs; right panel stacks: (a) **Assign Connect package** (Select of `product∈{connect,bundle}` active plans → reuse assign action with the plan's product), (b) **Custom limits** (embed `ConnectEntitlementsPanel`, now incl. company/storefront/job rows), (c) **Boost credits** (FE-4). Replaces the separate "Manage Plan" entry with one "Manage Plans". **Custom-limits unlock rule:** the override path requires a Connect subscription (the panel is read-only without one today). To hand-tune a user who is on the free fallback, the admin first assigns a package — and a **Free** Connect package (the seeded `connect_free`) is always available in the package Select, so "assign Free, then tune" mirrors the ERP "assign a plan, then customize" flow exactly. When no Connect sub exists, the panel shows that prompt instead of disabled inputs. _Depends on: BE-1, BE-3, BE-5; reuses existing components._
- **FE-3 — Connect packages in Plans admin.** Ensure `/admin/plans` product switcher exposes Connect (and Bundle) and renders the Connect allowance fields **including the three new caps**; bundle shows both ERP and Connect field groups. _Depends on: BE-4, BE-6._
- **FE-4 — Boost credit control.** Small card in the drawer's Connect panel: show `balance` (+ `grantBalance`/`reserved` read-only), an amount input with Add/Deduct, reason field → calls BE-5, optimistic refresh. _Depends on: BE-5._

The standalone `/admin/connect/entitlements` page stays (now reading the broadened resolution) — no need to delete a working tool; the drawer simply embeds the same panel.

---

## 6. Error handling & edge cases

- **User with both ERP + Connect subs:** list shows both badges + both plan cells; drawer manages each side independently; neither assign touches the other (ADR-1).
- **Assign bundle:** supersedes ERP + Connect + Bundle; both summaries then read from the one bundle sub.
- **Deduct more credits than balance:** reject with a friendly message; never persist a negative balance.
- **Connect-only user (no ERP sub, no workspace):** appears under Connect (not Both); ERP cell shows "—"; ERP side of the drawer offers assign as normal.
- **ConnectProfile present but zero activity:** still classified Connect (engagement signal) — acceptable and intended.
- **Custom Connect assignment without a base plan:** lands on `product:'connect'` (from DTO), reusing the existing "Custom (Admin Assigned)" placeholder-plan pattern but product-tagged.
- **Overriding a free-fallback Connect user (no Connect sub):** custom-limit edits need a subscription, so the drawer routes the admin to assign a package first — the seeded **Free** package is always offered, so no paid tier is forced just to set "1 company" (FE-2 unlock rule).
- **Idempotency:** wallet adjust writes one ledger row per call; the partial-unique `idempotencyKey` index is available if we choose to dedupe double-submits (panel disables the button while in flight).

## 7. Logical / schema / endpoint changes requiring explicit owner sign-off

1. **BE-1** — assignment supersede-by-product + sets `product` (write-path behavior change; also fixes the cross-product clobber bug).
2. **BE-2** — resolution product filters broadened; `getMySubscription` gains a product filter (fixes a latent no-filter bug).
3. **BE-3** — `admin/users` response shape changes (per-product blocks) + new `product` filter param.
4. **BE-4** — `PlanConnectEntitlements` gains 3 fields (schema addition; additive, defaults 0/1 as appropriate).
5. **BE-5** — new admin endpoint to adjust wallet credits + first real use of the `adjustment` ledger type.

All additive or backward-compatible; no destructive migration. No data migration required (no `bundle` rows exist; new plan fields default; ledger type already enumerated).

## 8. Testing strategy (verifiable success criteria)

Backend (vitest, colocated):

- Assigning Connect to a user with an active ERP sub leaves the ERP sub active, creates a `product:'connect'` sub, and vice versa. **(ADR-1)**
- Assigning a `bundle` plan supersedes both ERP and Connect; afterwards ERP resolution and Connect `getAllowances` both read the bundle sub. **(ADR-1/2)**
- `getAllowances` returns the bundle's `.connect` block for a `product:'bundle'` sub. **(ADR-2)**
- `getUsers?product=connect` returns exactly the ConnectProfile/Connect-sub users with correct totals; `both` returns the intersection; per-product summaries are correctly split. **(ADR-3/4)**
- A Connect package with `maxCompanyPages:1` enforces the 1-company cap via `assertCanCreateCompanyPage`. **(BE-4)**
- `WalletService.adjust` credits and debits `balance`, writes an `adjustment` ledger row with `recordedBy`, refuses to go negative, and the audit event fires; reconcile cron still skips the owner. **(ADR-5)**

Web (vitest + type/lint/build):

- Filter switches the query param and renders the right rows/empty state.
- Drawer renders both sides; assigning on one side does not refetch/alter the other's state; wallet add/deduct disables during flight and surfaces errors.
- New per-product response type compiles; no `any` leakage.

Platform bar: responsive at admin breakpoints, keyboard reachable (filter, drawer, forms), loading/empty/error states on list + drawer + wallet, all writes audited.

## 9. Bundle-readiness (forward-looking, not built now)

The bundle is unblocked by construction:

- **Container:** one `product:'bundle'` subscription whose `appliedEntitlements` carries the ERP block **and** the `.connect` block — both fully editable in the package editor (FE-3) and overridable per user (the override path already merges `.connect`; ERP override already exists).
- **Resolution:** ERP and Connect both read `product ∈ {self, bundle}` (ADR-2).
- **Assignment:** bundle supersedes both products (ADR-1).
- **List/filter:** a bundle user classifies as both ERP and Connect (feeds both summaries, shows under Both).
- **Packages:** plan CRUD accepts `product:'bundle'` (BE-6).
  What remains for the future bundle launch is purely **content/pricing** (creating the actual bundle packages and their prices) and any bundle-specific marketing — no structural rework.

## 10. Open items to confirm during planning (do not change the shape above)

- Exact ERP-user signal precedence (workspace membership vs ERP sub) and whether to surface "ERP but free / no sub" distinctly.
- Whether the wallet read endpoint already returns `grantBalance/reserved` in a shape the panel can show, or needs a thin view DTO.
- Confirm `resolveConnectAllowances` sources the 3 new caps from the plan block (not only the hard-coded fallback) so packages truly drive them.
- Whether to add a lightweight index for the subscription lookup in the aggregation if explain() shows a collection scan at current data size.

## 11. Out of scope

Bundle package/pricing content; Connect suspend; clear-over-limit-now; self-serve Connect checkout; mobile app; any change to ERP plan semantics beyond product-tagging.
