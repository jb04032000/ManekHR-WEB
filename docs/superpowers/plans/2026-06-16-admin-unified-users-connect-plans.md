# Unified Admin Users + Connect Plan Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Git:** The owner stages + commits. Do NOT run git. "Commit" steps are checkpoints — stop, report, let the owner commit.
> **Admin is English-only + AntD** — no i18n keys in any admin file.
> **Spec:** `crewroster-web/docs/superpowers/specs/2026-06-16-admin-unified-users-connect-plans-design.md`

**Goal:** Manage ERP and Connect plans for every user from one admin Users screen — filterable by product, with per-user Connect packages, custom limits, and boost-credit adjustment — built so a future ERP+Connect bundle drops in without rework.

**Architecture:** Make subscription assignment product-aware (the linchpin), broaden runtime resolution to accept `bundle`, rebuild the admin users query as one product-filterable aggregation returning per-product summaries, add the missing Connect package caps, add a ledgered wallet-adjust path, then a unified web Users list + side-by-side Manage Plans drawer that reuses existing ERP tabs and the Connect entitlements panel.

**Tech Stack:** NestJS + Mongoose (backend), Next.js App Router + AntD v6 (web admin), vitest (both).

---

## File structure map

### Backend (`crewroster-backend`)

- Modify `src/modules/admin/admin.service.ts` — product-aware `assignPlan`/`customAssignPlan`; aggregation `getUsers`.
- Modify `src/modules/admin/dto/*` — `AdminPaginationDto` (+`product`), `AdminAssignPlanDto`/`AdminCustomAssignDto` (+`product`).
- Modify `src/modules/subscriptions/schemas/plan.schema.ts` — `PlanConnectEntitlements` +3 caps.
- Modify `src/modules/connect/monetization/connect-allowance.service.ts` — bundle-in resolution + read 3 caps from plan block.
- Modify `src/modules/subscriptions/subscriptions.service.ts` — `getMySubscription` product filter.
- Modify `src/modules/admin/admin-connect-entitlements.service.ts` — bundle-in reads.
- Modify `src/modules/connect/ads/services/wallet.service.ts` — `adjust()`.
- Modify `src/modules/connect/ads/services/ads-admin.service.ts` — `adjustWallet()` wrapper (audit + PostHog).
- Modify `src/modules/connect/ads/controllers/ads-admin.controller.ts` — adjust + wallet-read endpoints.
- Create `src/modules/connect/ads/dto/admin-wallet-adjust.dto.ts`.
- Tests colocated under each module's `__tests__/*.vitest.ts`.

### Web (`crewroster-web`)

- Modify `lib/api/endpoints.ts` — `adminWalletAdjust`, `adminWalletRead` (+ confirm assign endpoints).
- Modify `lib/actions/admin.actions.ts` — `getAdminUsers` (param/type), wallet actions; product on assign payloads.
- Modify `app/admin/users/page.tsx` — product filter + per-product columns + launch unified drawer.
- Create `features/admin/users/ManagePlansDrawer.tsx` — side-by-side ERP | Connect.
- Create `features/admin/users/ConnectWalletCard.tsx` — balance + adjust.
- Reuse `features/connect/admin/entitlements/ConnectEntitlementsPanel.tsx` (embed) + add 3 cap rows.
- Modify `app/admin/plans/page.tsx` — expose 3 new Connect caps (+ bundle field groups).
- Modify types in `types/index.ts` / admin action types — per-product user shape, 3 caps.

---

## Phase A — Backend foundation (must land first)

### Task A1: Product-aware `assignPlan`

**Files:**

- Modify: `src/modules/admin/admin.service.ts:813-907`
- Test: `src/modules/admin/__tests__/admin.assign-product.vitest.ts`

**Product-group helper (add near top of admin.service.ts):**

```ts
// A plan's product determines which existing subscriptions it replaces.
// Assigning erp/connect supersedes that product AND any bundle (bundle covers it);
// assigning bundle supersedes erp + connect + bundle (it replaces both).
function supersededProducts(product: string): string[] {
  return product === 'bundle' ? ['erp', 'connect', 'bundle'] : [product, 'bundle'];
}
```

- [ ] **Step 1 — Failing test.** Assigning a Connect plan to a user who has an active ERP sub: ERP stays active, a new `product:'connect'` active sub exists.

```ts
// arrange: user U; active ERP sub (product 'erp'); a Plan with product 'connect'
// act: await service.assignPlan({ userId, planId: connectPlan._id, billingCycle:'monthly', entitlements }, admin)
// assert:
expect(await subModel.findOne({ userId, product: 'erp', status: 'active' })).toBeTruthy();
const c = await subModel.findOne({ userId, product: 'connect', status: 'active' });
expect(c).toBeTruthy();
```

- [ ] **Step 2 — Run, expect FAIL** (`npx vitest run admin.assign-product` → ERP sub superseded / new sub product 'erp').
- [ ] **Step 3 — Implement.** In `assignPlan`: (a) compute `const product = plan.product ?? 'erp';` (b) replace both `updateMany({ userId, status…})` supersede calls with `{ userId, product: { $in: supersededProducts(product) }, status:{…} }`; (c) set `product` on the `new this.subscriptionModel({ …, product })`; (d) in the E11000 retry, scope the re-supersede to `product: { $in: supersededProducts(product) }`.
- [ ] **Step 4 — Run, expect PASS.**
- [ ] **Step 5 — Add test:** assigning ERP leaves an existing Connect sub intact (mirror). Run, PASS.
- [ ] **Step 6 — Commit checkpoint** (owner): `feat(admin): product-scoped plan assignment`.

### Task A2: Product-aware `customAssignPlan` (+ DTO `product`)

**Files:**

- Modify: `src/modules/admin/admin.service.ts:909-1015`
- Modify: `src/modules/admin/dto/` — `AdminCustomAssignDto` add `@IsOptional() @IsIn(['erp','connect','bundle']) product?: string;`
- Test: same vitest file.

- [ ] **Step 1 — Failing test.** `customAssignPlan({ userId, product:'connect', entitlements:{ connect:{ maxCompanyPages:1 } }, … })` with an active ERP sub: ERP stays; new `product:'connect'` sub created with the custom connect block.
- [ ] **Step 2 — Run, FAIL.**
- [ ] **Step 3 — Implement.** Derive `const product = dto.product ?? (plan?.product ?? 'erp');` (prefer explicit DTO, else base-plan product, else erp). Scope both supersede `updateMany` to `product: { $in: supersededProducts(product) }`. Set `product` on the new sub. When `product!=='erp'` and no base plan, reuse the "Custom (Admin Assigned)" placeholder-plan pattern but ensure the placeholder is product-agnostic (don't force erp entitlements onto a connect sub — store the connect block under `appliedEntitlements.connect`).
- [ ] **Step 4 — Run, PASS.**
- [ ] **Step 5 — Commit checkpoint:** `feat(admin): product on custom assignment`.

### Task A3: Bundle-ready Connect resolution + read 3 caps from plan

**Files:**

- Modify: `src/modules/connect/monetization/connect-allowance.service.ts:140-171`
- Test: `src/modules/connect/monetization/__tests__/connect-allowance.bundle.vitest.ts`

- [ ] **Step 1 — Failing test.** A `product:'bundle'` active sub whose `appliedEntitlements.connect = { maxCompanyPages: 3 }` → `getAllowances(userId)` returns `maxCompanyPages: 3`.
- [ ] **Step 2 — Run, FAIL** (today filters `product:'connect'` only).
- [ ] **Step 3 — Implement.** Change the sub query to `product: { $in: ['connect','bundle'] }`; change the free-plan fallback query to `product: { $in: ['connect','bundle'] }, tier:'connect_free'`. (`resolveConnectAllowances` already emits all 11 fields incl. the 3 caps; this task only broadens the product predicate.)
- [ ] **Step 4 — Run, PASS.**
- [ ] **Step 5 — Add test:** plain `product:'connect'` sub still resolves (no regression). PASS.
- [ ] **Step 6 — Commit checkpoint:** `fix(connect): resolve allowances for connect+bundle`.

### Task A4: Bundle-ready ERP resolution

**Files:**

- Modify: `src/modules/subscriptions/subscriptions.service.ts:498` (`getMySubscription`)
- Modify: `src/modules/admin/admin-connect-entitlements.service.ts:84,202`
- Test: `src/modules/subscriptions/__tests__/get-my-subscription.product.vitest.ts`

- [ ] **Step 1 — Failing test.** User with BOTH active ERP and active Connect subs → `getMySubscription` returns the **ERP** one (today returns whichever sorts first).
- [ ] **Step 2 — Run, FAIL.**
- [ ] **Step 3 — Implement.** Add `product: { $in: ['erp','bundle'] }` to the `findOne` in `getMySubscription`. In `admin-connect-entitlements.service.ts`, broaden its two `product:'connect'` reads to `{ $in: ['connect','bundle'] }`.
- [ ] **Step 4 — Run, PASS.**
- [ ] **Step 5 — Commit checkpoint:** `fix(subscriptions): product-scope ERP resolution`.

---

## Phase B — Connect package caps + admin users data

### Task B1: Add 3 caps to `PlanConnectEntitlements`

**Files:**

- Modify: `src/modules/subscriptions/schemas/plan.schema.ts:165-206`
- Test: `src/modules/connect/monetization/__tests__/connect-allowance.bundle.vitest.ts` (extend)

- [ ] **Step 1 — Failing test.** A `product:'connect'` sub whose `appliedEntitlements.connect = { maxStorefronts: 5 }` → `getAllowances` returns `maxStorefronts: 5` (proves the plan block, not just override, drives it).
- [ ] **Step 2 — Run, FAIL** if `resolveConnectAllowances` doesn't read it (confirm during run).
- [ ] **Step 3 — Implement.** Add to `PlanConnectEntitlements`: `@Prop({ default: 1 }) maxCompanyPages: number; @Prop({ default: 1 }) maxStorefronts: number; @Prop({ default: 10 }) maxJobs: number;`. Verify `resolveConnectAllowances` reads `connect?.maxCompanyPages ?? default` etc. (add the three keys to its merge if missing).
- [ ] **Step 4 — Run, PASS.**
- [ ] **Step 5 — Commit checkpoint:** `feat(plans): connect package company/storefront/job caps`.

### Task B2: `getUsers` aggregation with product filter + per-product summaries

**Files:**

- Modify: `src/modules/admin/admin.service.ts:383-493`
- Modify: `src/modules/admin/dto/` — `AdminPaginationDto` add `@IsOptional() @IsIn(['all','erp','connect','both']) product?: string;`
- Test: `src/modules/admin/__tests__/admin.get-users-product.vitest.ts`

Per-user shape returned:

```ts
{ ...user, workspaceCount, isErpUser, isConnectUser,
  erpSubscription: { planName, planTier, status } | null,
  connectSubscription: { planName, planTier, status } | null }
```

- [ ] **Step 1 — Failing tests.** Seed: U1 ERP-only (workspace), U2 Connect-only (ConnectProfile), U3 both, U4 bundle sub. Assert: `product='connect'` → {U2,U3,U4}; `'erp'` → {U1,U3,U4}; `'both'` → {U3,U4}; `'all'` → all; per-product summaries split correctly (U3 shows both, bundle U4 shows in both summaries).
- [ ] **Step 2 — Run, FAIL.**
- [ ] **Step 3 — Implement.** Rewrite `getUsers` as an aggregation: `$match` base user filter (non-admin, deleted) → `$lookup` active/trial subscriptions → derive `erpSub` (`product∈{erp,bundle}`) + `connectSub` (`product∈{connect,bundle}`) via `$filter`/`$arrayElemAt` → `$lookup` ConnectProfile by userId (existence) → `$lookup`+`$size` distinct workspace ids (reuse existing logic) → `$addFields isErpUser = (workspaceCount>0) || erpSub!=null`, `isConnectUser = connectProfileExists || connectSub!=null` → `$match` on the `product` filter when not `all` → `$facet { rows: [$sort,$skip,$limit, $project the shape], total: [$count] }`. Populate plan name/tier via `$lookup` on plans for each summary.
- [ ] **Step 4 — Run, PASS.**
- [ ] **Step 5 — Perf check.** `explain()` the pipeline at current size; if collection scan on the subscription/profile lookups, note an index task (see B3).
- [ ] **Step 6 — Commit checkpoint:** `feat(admin): product-filterable users with per-product plans`.

### Task B3: Indexes (only if B2 perf check flags)

- [ ] Confirm `connectprofiles.userId` unique index exists (it does). If subscription lookup scans, add/confirm `{ userId:1, status:1 }` on subscriptions. Commit checkpoint if changed.

---

## Phase C — Boost wallet adjust

### Task C1: `WalletService.adjust()`

**Files:**

- Modify: `src/modules/connect/ads/services/wallet.service.ts`
- Test: `src/modules/connect/ads/services/__tests__/wallet.adjust.vitest.ts`

```ts
/** Admin manual credit (+) / debit (−) to spendable balance. Ledger 'adjustment'.
 *  Refuses to drive balance below 0. Never touches grantBalance/reserved. */
async adjust(ownerUserId: string, amount: number, adminUserId: string, reason: string, note?: string)
  : Promise<AdvertiserWalletDocument> {
  if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('amount must be non-zero');
  const wallet = await this.getWallet(ownerUserId);            // upserts
  const next = (wallet.balance ?? 0) + amount;
  if (next < 0) throw new BadRequestException('insufficient balance for this deduction');
  const updated = await this.walletModel.findOneAndUpdate(
    { ownerUserId: new Types.ObjectId(ownerUserId), balance: wallet.balance }, // optimistic guard
    { $inc: { balance: amount } }, { new: true },
  );
  if (!updated) throw new ConflictException('wallet changed, retry');
  await this.writeLedger(ownerUserId, 'adjustment', amount, updated.balance, updated.reserved,
    { note: `${reason}${note ? ': ' + note : ''}`, recordedBy: adminUserId });
  return updated;
}
```

- [ ] **Step 1 — Failing tests.** credit +100 → balance+100 + one `adjustment` ledger row w/ `recordedBy`; debit beyond balance → throws, no row; amount 0 → throws.
- [ ] **Step 2 — Run, FAIL.**
- [ ] **Step 3 — Implement** (above). Confirm `writeLedger` accepts `recordedBy` in its opts (it does).
- [ ] **Step 4 — Run, PASS.**
- [ ] **Step 5 — Commit checkpoint:** `feat(ads): ledgered admin wallet adjustment`.

### Task C2: Admin service wrapper + endpoint + DTO

**Files:**

- Modify: `src/modules/connect/ads/services/ads-admin.service.ts` — `adjustWallet(userId, dto, adminUserId)` calls `wallet.adjust`, then `audit.logEvent({ module: AppModule.ADS, entityType:'AdvertiserWallet', entityId:userId, action:'wallet_admin_adjustment', actorId:adminUserId, meta:{ amount, reason } })` + PostHog `ads.wallet_admin_adjustment`.
- Modify: `src/modules/connect/ads/controllers/ads-admin.controller.ts` — `@Get('wallet/:userId')` (returns balance/grant/reserved view) + `@Post('wallet/:userId/adjust')` (guarded identically to existing admin ads routes).
- Create: `src/modules/connect/ads/dto/admin-wallet-adjust.dto.ts` — `{ @IsInt() @IsNotEqual(0)-ish amount; @IsString()@Length reason; @IsOptional()@IsString() note }` (use `@IsInt()` + custom non-zero check; whole-rupee).
- Test: `src/modules/connect/ads/__tests__/ads-admin.wallet.vitest.ts`

- [ ] **Step 1 — Failing test.** `adjustWallet` audits + adjusts; bad amount → 400.
- [ ] **Step 2 — Run, FAIL.**
- [ ] **Step 3 — Implement** service + controller + DTO; mirror the guard/throttle decorators from the existing `pricing` admin routes in this controller.
- [ ] **Step 4 — Run, PASS.**
- [ ] **Step 5 — Commit checkpoint:** `feat(ads): admin wallet read + adjust endpoints`.

---

## Phase D — Web: list, drawer, packages, wallet

### Task D1: endpoints + actions + types

**Files:** `lib/api/endpoints.ts`, `lib/actions/admin.actions.ts`, `types/index.ts`

- [ ] Add endpoints: `adminWallet:(id)=>\`admin/connect/ads/wallet/${id}\``, `adminWalletAdjust:(id)=>\`admin/connect/ads/wallet/${id}/adjust\``.
- [ ] `getAdminUsers` param type += `product?: 'all'|'erp'|'connect'|'both'`; response user type → per-product shape (above). Add `adminWalletGet`, `adminWalletAdjust` actions. Add `product?` to `AdminAssignPlanPayload`/`AdminCustomAssignPayload`.
- [ ] tsc clean. Commit checkpoint: `feat(admin-web): connect plan + wallet actions/types`.

### Task D2: Users list — filter + per-product columns

**Files:** `app/admin/users/page.tsx`

- [ ] Add a segmented control `All | ERP | Connect | Both` above the table → sets `product` state → passed to `getAdminUsers` (reset page to 1 on change).
- [ ] Replace the single Plan column with: **Products** (two small tags driven by `isErpUser`/`isConnectUser`), **ERP plan** (`erpSubscription`), **Connect** (`connectSubscription` name/tier or "Free"). Keep search + show-deleted.
- [ ] Row action: rename "Manage Plan" → **"Manage Plans"** opening `ManagePlansDrawer` (D3).
- [ ] Loading/empty/error states intact; responsive scroll. tsc/lint. Commit checkpoint: `feat(admin-web): product filter + per-product user columns`.

### Task D3: Unified Manage Plans drawer

**Files:** Create `features/admin/users/ManagePlansDrawer.tsx`; reuse `ExistingPlanTab`/`CustomPlanTab` + `ConnectEntitlementsPanel`.

- [ ] Wide AntD `Drawer`, two columns (stack on narrow): **Business (ERP)** = existing assign tabs (pass `product:'erp'`); **Connect** = (a) **Assign Connect package** `Select` of active plans where `product∈{connect,bundle}` → calls assign action with that plan's product; (b) **Custom limits** = `ConnectEntitlementsPanel` for the user (now shows the 3 cap rows — see D4); when the user has no Connect sub, the panel shows the "assign a package first" prompt and the package Select offers **Free** (`connect_free`); (c) **Boost credits** = `ConnectWalletCard` (D5).
- [ ] After any assign/override, refetch the row. tsc/lint. Commit checkpoint: `feat(admin-web): side-by-side manage plans drawer`.

### Task D4: 3 cap rows in entitlements panel

**Files:** `features/connect/admin/entitlements/ConnectEntitlementsPanel.tsx` (FIELDS array) + `entitlements.types.ts`

- [ ] Add `maxCompanyPages`, `maxStorefronts`, `maxJobs` to the FIELDS array (number, `-1`=unlimited, usage kinds `company_page`/`storefront`/`job`) so plan-default / override / effective / usage render. Ensure override PUT whitelist includes them (backend `CONNECT_OVERRIDE_KEYS` — verify it already lists these; if not, add in a backend sub-task).
- [ ] tsc/lint. Commit checkpoint: `feat(admin-web): company/storefront/job rows in connect limits`.

### Task D5: Connect wallet card

**Files:** Create `features/admin/users/ConnectWalletCard.tsx`

- [ ] Show `balance` (+ `grantBalance`/`reserved` read-only) from `adminWalletGet`; amount `InputNumber` + reason `Input` + **Add** / **Deduct** buttons → `adminWalletAdjust` (Deduct sends negative). Disable while in flight; surface server errors; refresh balance on success.
- [ ] tsc/lint. Commit checkpoint: `feat(admin-web): boost credit adjust card`.

### Task D6: Connect caps in Plans admin (packages)

**Files:** `app/admin/plans/page.tsx`

- [ ] In the Connect Allowances section (shown when `product!=='erp'`), add inputs for the 3 new caps. For `product==='bundle'`, render BOTH the ERP entitlement group and the Connect allowance group (fully dynamic bundle package).
- [ ] tsc/lint. Commit checkpoint: `feat(admin-web): connect/bundle package caps editor`.

---

## Phase E — Verification

### Task E1: Backend security review

- [ ] Dispatch `security-reviewer` on the backend diff: tenant/admin-guard on new endpoints, product-scope correctness (no cross-product clobber, no bundle leak), wallet non-negative + ledger/audit, override key whitelist. Address CHANGES-REQUIRED.

### Task E2: QA pass

- [ ] Run full BE vitest + web vitest + tsc + lint. All green. Capture counts.
- [ ] Manual smoke list (owner, post-deploy): assign Connect to an ERP user (ERP survives), assign Free then tune caps, filter ERP/Connect/Both counts, add/deduct credits shows ledger.

### Task E3: Owner handoff

- [ ] Plain-English read-out + ready-to-paste smoke prompt + list of logical changes shipped. Owner commits + pushes + runs smoke.

---

## Self-review notes

- **Spec coverage:** ADR-1→A1/A2; ADR-2→A3/A4; ADR-3/4→B2; BE-4→B1/D4/D6; ADR-5→C1/C2/D5; FE-1→D2; FE-2→D3; FE-3→D6; FE-4→D5. Bundle-readiness threaded through A3/A4/B1/B2/D6. All covered.
- **Type consistency:** per-product user shape (`erpSubscription`/`connectSubscription`/`isErpUser`/`isConnectUser`) defined in B2 and consumed identically in D1/D2/D3. `supersededProducts()` used in A1/A2. `adjust()` signature consistent C1→C2→D5.
- **No data migration:** new plan caps default; no `bundle` rows exist; `adjustment` ledger type pre-existing.
- **Owner sign-off items already approved** ("implement"): A1/A2 (assignment behavior), A3/A4 (resolution), B1 (schema +3), B2 (endpoint shape+param), C2 (new endpoints).
