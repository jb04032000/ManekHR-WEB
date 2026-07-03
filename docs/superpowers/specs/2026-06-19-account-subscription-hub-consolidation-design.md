# Account Subscription Hub — consolidation design

Date: 2026-06-19
Status: APPROVED (direction + buy-button behavior) — pending spec review
Owner decisions captured:

- Bring the full subscription experience the ERP work-app had into the
  product-neutral `/account/subscription` area, reusing the EXISTING pages /
  components (not a rebuild). ("we had all the things ... we just have to use here")
- Buy / upgrade / credit top-up actions: **show the sections, but the purchase
  action shows a clear "online payments coming soon — contact admin" notice**
  instead of a dead checkout. Flips to real checkout automatically when online
  payments are switched on.

This builds on the same-day fix that made `/account/*` App-Lock-exempt
(`appLockEnabled = mode === 'erp'`; neutral account endpoints carry
`@SkipPinUnlock`). See memory `project_app_lock_erp_only`.

---

## 1. Problem

`/account/subscription` only shows a bare overview (plan card + low-credit
notice + recent activity). The rich subscription tooling (Plans, Add-Ons,
Credits, Invoices, Billing Info, Payment Method, Refunds, History) still lives
under `/dashboard/subscription/*`, which is:

- **Locked behind the ERP `PolicyGate`** (`app/dashboard/layout.tsx`), so
  Connect-only users (who never accepted ERP terms) cannot reach it.
- **Hidden from `/account/subscription`** by the `hasErpBilling = !!sub &&
plan?.tier !== 'free'` gate — so a Free / admin-assigned plan (the common
  case) sees none of it.

The old `/dashboard/subscription` overview already `redirect()`s to
`/account/subscription`, so there is no longer a single complete subscription
home. This consolidates everything into the neutral account area.

## 2. Key finding (why reuse is safe)

Investigation (read-only) confirmed every deep page is built on **user-scoped**
data only — each backing endpoint authorizes on `req.user.sub`, none require a
`workspaceId`, RBAC role, or paid plan, and none import `<Can>` /
`ModuleLockedPage` / `FeatureGate`. All components already render honest empty
states ("no payments", "no history", "no active plan") for Free / Connect-only
users. The ONLY thing keeping these pages out of the account area is the ERP
`PolicyGate` wrapper on the `/dashboard` tree — not the pages themselves.

Therefore consolidation is mostly **relocation + un-gating**, plus a backend
App-Lock exemption so the endpoints work without a PIN for everyone.

## 3. Scope

### 3.1 Frontend — make `/account/subscription` the tabbed hub

Turn the account Subscription section into the same tabbed experience the ERP
had, living under `/account/subscription`:

```
/account/subscription                 → Overview  (existing overview page, un-gated)
/account/subscription/plans           → Plans
/account/subscription/addons          → Add-Ons
/account/subscription/addons/history  → Add-On history
/account/subscription/credits         → Credits
/account/subscription/invoices        → Invoices
/account/subscription/billing-info    → Billing Info
/account/subscription/payment-method  → Payment Method
/account/subscription/refunds         → Refunds
/account/subscription/history         → History
```

- **New `app/account/subscription/layout.tsx`**: renders a tab bar across the
  top of the section (base `/account/subscription`), adapted from the existing
  `app/dashboard/subscription/layout.tsx` Tabs. Labels via i18n (`profile.*`
  namespace, consistent with AccountShell). It renders inside the existing
  AccountShell (so the left account menu stays).
- **Relocate the page bodies**: move the thin `page.tsx` (and any co-located
  `loading.tsx`) from `app/dashboard/subscription/<x>/` to
  `app/account/subscription/<x>/`. The shared components they import
  (`components/subscription/*`, e.g. `InvoicesTable`, `MandateManager`,
  `BillingProfileForm`, `PaymentCheckoutModal`, `RefundRequestModal`) stay put
  and are imported from the new locations unchanged.
- **Un-gate the Overview**: remove the `hasErpBilling` hiding so the
  plan/quick-links/CTAs always render; the pages' own empty states cover the
  Free / no-data case. Re-point every internal link from
  `/dashboard/subscription/*` to `/account/subscription/*`.
- **Overview tab content**: keep the existing overview as the Overview tab.

### 3.2 "Coming soon" gating for purchases (no live payment gateway)

Online payments are not live yet (plans/credits assigned by admin). Gate ONLY
the actions that open a real payment checkout; everything else stays live.

- **One FE flag**: `NEXT_PUBLIC_PAYMENTS_ENABLED` (default `false`), exposed via
  `lib/env.ts` as `env.paymentsEnabled`. (Kill-switch pattern, mirrors
  `NEXT_PUBLIC_PWA_ENABLED`.) When `true`, real checkout runs exactly as today;
  when `false`, purchase CTAs show the coming-soon notice.
- **Shared notice**: a small `PaymentsComingSoonNotice` (modal or inline) with
  copy like "Online payments aren't available yet — contact your admin to change
  your plan or add credits." i18n in all four locales.
- **Gated entry points** (when `paymentsEnabled === false`, intercept the CTA to
  show the notice instead of opening checkout / firing the paid mutation):
  - Plans: paid-plan "Select / Upgrade" → checkout modal.
  - Credits: "Buy credits" pack purchase.
  - Add-Ons: "Purchase" add-on.
  - Payment Method: "Set up auto-renew" (create mandate).
  - The `/account/subscription` overview Buy-credits / Browse-plans / Change-plan
    CTAs.
- **Stays live regardless of the flag** (no gateway needed): viewing all data,
  cancel subscription, cancel scheduled, billing-info edit, auto-recharge config
  toggle, mandate pause/resume/cancel, refund request, invoice download.
- The flag is read at the CTA layer, so flipping it to `true` lights up real
  checkout with no further code change.

### 3.3 Resolve the duplicate "Billing" menu item

`/account/billing` currently overlaps the new hub (current plan + history). Fold
it in: the Overview + Invoices + History tabs cover it.

- Remove the "Billing" item from the AccountShell PLAN group (keep
  "Subscription" as the single hub entry).
- `/account/billing` → redirect to `/account/subscription` (keep the route as a
  redirect so any existing links/bookmarks survive).

### 3.4 Old-route redirects

Add permanent redirects (in `next.config.ts`, next to the existing
`/dashboard/subscription` → `/account/subscription` one) for each deep route:
`/dashboard/subscription/<x>` → `/account/subscription/<x>`. Delete the old
`app/dashboard/subscription/*` page files after relocation (the redirect
replaces them). Keep `app/dashboard/subscription/page.tsx`'s existing redirect.

### 3.5 Backend — App-Lock exemption for the user-scoped billing endpoints

The relocated pages call user-scoped self-service endpoints that are NOT yet
`@SkipPinUnlock`, so a no-PIN Connect-only user (or an idle ERP user on the now
App-Lock-exempt account area) would 423 on them. Exempt the controllers that are
ENTIRELY the user's own subscription/billing/add-on self-service (verify each
has no admin/workspace-scoped method before class-level decorating; otherwise go
method-level):

- `SubscriptionsController` — all methods are user-scoped (`req.user.sub`) or
  `@Public()`; promote to class-level `@SkipPinUnlock()` (supersedes the three
  method-level ones already added: `my`, `cancel`, `my/subscriptions`).
- Billing controllers under `src/modules/subscriptions/billing/` — payments,
  invoice, billing-profile, refund (all `req.user.sub`-scoped). Class-level
  `@SkipPinUnlock()` after verifying no admin methods live on the same class.
- `add-ons` controller — user-scoped self-service. Class-level `@SkipPinUnlock()`.
- Admin controllers (e.g. `AdminSessionsController`, any `admin/*` billing)
  stay locked — do NOT exempt.

This is consistent with the established principle: App Lock guards ERP
payroll/finance/staff data, not a user's own account/billing self-service.

## 4. Out of scope

- Building or enabling a real payment gateway (separate effort; the coming-soon
  gate is the bridge).
- Any change to plan pricing, entitlements, or the subscription data model.
- Mobile app (no mobile work per standing rule).
- Admin-side plan assignment flows (unchanged).

## 5. Structure / isolation

- The tab bar is one small layout component; each tab is an independent page
  with a single purpose and its own `loading.tsx`.
- The coming-soon gate is one flag + one shared notice component, applied at CTA
  sites — no change to the underlying checkout code, so it cannot break the
  real-payments path when enabled.
- Backend change is purely additive (a metadata decorator); the guard logic is
  untouched.

## 6. Testing / verification

- FE: `typecheck`, `check:i18n` (new keys in all four locales: en / gu / gu-en /
  hi-en), `lint`. Manual smoke: open each tab as (a) Free/admin-assigned and (b)
  Connect-only — each renders an honest state, no PIN prompt, no ERP gate; buy
  CTAs show the coming-soon notice.
- BE: `lint`; `pin-unlock.guard` vitest stays green; confirm the exempted
  controllers contain only user-scoped methods (no admin/workspace leak).
- Redirects: old `/dashboard/subscription/*` URLs land on the new pages.

## 7. Risks / watch-items

- **Link drift**: other surfaces (sidebar, DunningBanner, UpgradePrompt,
  LowBalanceBanner) link to `/dashboard/subscription/*`. The plan must sweep all
  of these to the new paths (grep `/dashboard/subscription`).
- **Controller exemption breadth**: only class-level-exempt a controller after
  confirming every method is the caller's own self-service. If any method is
  admin/workspace-scoped, exempt per-method instead.
- **i18n parity**: new tab labels + coming-soon copy must exist in all four
  locales or `check:i18n` fails.
- **Free-plan UX**: a couple of pages (Plans, Payment Method) are plan-aware;
  confirm they read cleanly on Free/no-sub (they already show honest states).
