# Connect + ERP Dual-Policy Consent Model - Design

**Date:** 2026-05-19
**Status:** Approved (design); pending implementation plan.
**Refines:** the single-policy gate from Wave B of the Connect-first milestone
(`docs/connect/specs/2026-05-19-connect-first-architecture-design.md` §9; Wave B plan).

---

## 1. Context

Zari360 has two products on one account: **ERP** (HR / payroll / attendance / finance)
and **Connect** (public network / marketplace / jobs). One `User`, one login; the two
products are modes of the same session.

Wave B of the Connect-first milestone added a single Connect policy-consent gate: a
`connectEnabled` user who has not accepted the Connect terms is shown a one-time consent
gate on `/connect/home`. That gate has two limits:

1. **Connect-only.** ERP has no equivalent. A user can be deep inside ERP without ever
   having consented to any product terms.
2. **Home-only.** The gate renders inside `app/connect/home/page.tsx`. Deep-linking to
   `/connect/feed`, `/connect/onboarding`, or any other authenticated Connect route
   bypasses it.

The product requirement: **each product has its own policy, and each product
independently forces acceptance of its policy before any of its pages render.** A user
who accepted the ERP terms but not the Connect terms is forced through the Connect gate
on first Connect visit, and symmetrically.

## 2. The model

Two products. Two policies. A per-product door gate.

- Each product (Connect, ERP) owns a separate policy and a separate acceptance record.
- To use product X, the user must have accepted product X's policy. If not, a
  **full-screen acceptance gate** intercepts them before any authenticated page of X
  renders. Accepting opens the product.
- The rule is **symmetric**: an ERP-only user visiting Connect is gated by the Connect
  policy; a Connect-only user visiting ERP is gated by the ERP policy.
- **Signup pre-collects the policy of the product the user is joining.** A signup from
  the Connect front door collects Connect-policy consent; a signup with `for=erp`
  collects ERP-policy consent. The other product's policy stays unaccepted and its gate
  fires on first visit.
- Accepting both policies (at signup, or later at each gate) opens both products.

This is a **consent gate**, not a backend security boundary. It governs which product
UI a user may enter, recorded per user. Backend per-endpoint authorization is unchanged
and out of scope.

## 3. Scope

### In scope

- A second policy (ERP) mirroring the existing Connect policy: storage field, accept
  endpoint, status read.
- Moving **both** gates from page-level to the product **shell layout**, so every
  authenticated route of each product is covered.
- A single shared `PolicyGate` component (full-screen) serving both products.
- Signup recording the correct product's policy by intent (`for=erp` vs default).
- i18n for the ERP gate and ERP signup consent, all four locales, generic copy.
- Minimal generic placeholder terms pages for both products so the gate links resolve.

### Out of scope - the future admin-synced policy module

- Real policy/terms content, a CMS, policy versioning, re-consent on version bump.
- An admin panel for editing policies.
- Backend per-endpoint policy enforcement.
- Anything in Connect-first milestone §13 not listed above (role taxonomy, etc.).

## 4. Architecture

### 4.1 Data model

Add one field to the `User` schema, mirroring the existing Wave B field:

| Field                     | Type           | Default | Meaning                                                      |
| ------------------------- | -------------- | ------- | ------------------------------------------------------------ |
| `connectPolicyAcceptedAt` | `Date \| null` | `null`  | When the user accepted the Connect policy (exists - Wave B). |
| `erpPolicyAcceptedAt`     | `Date \| null` | `null`  | When the user accepted the ERP policy (new).                 |

A `null` value = not accepted. Existing users default to `null` on both and are gated
on next visit to each product - correct one-time behaviour for legacy accounts.

### 4.2 Backend endpoints - mirror the Connect pattern

The Connect side already has, in the `connect/profile` module:

- `GET /me/connect/profile/entry` -> `{ connectEnabled, onboarded, policyAccepted }`
- `POST /me/connect/profile/policy-accept` -> idempotent stamp of `connectPolicyAcceptedAt`

Add the ERP mirror in the **`users` module** (it owns the `User` schema; if `users`
exposes no `JwtAuthGuard`-protected request-scoped controller, the `auth` module is the
fallback home - confirmed during plan recon):

- `GET /me/erp-entry` -> `{ erpPolicyAccepted: boolean }`
- `POST /me/erp-policy-accept` -> idempotent stamp of `erpPolicyAcceptedAt`

Both new endpoints are `JwtAuthGuard`-protected. The accept is idempotent: a guarded
`updateOne` that stamps `erpPolicyAcceptedAt` only when it is currently null, exactly
like Wave B's `acceptPolicy`. The accept emits a PostHog event (`erp.policy_accepted`)
and is otherwise unaudited - this mirrors Connect's `acceptPolicy`, which is PostHog-only;
policy acceptance is a user self-action, not an admin write. The read is read-only (OTel
span only).

**Decision - mirror, not unified.** A unified `GET /me/policy-status` +
`POST /me/policy-accept {product}` was considered. Rejected: it would retire Wave B's
just-built Connect endpoint (churn on uncommitted code) for a consistency the future
admin-synced policy module discards anyway. The mirror is structurally symmetric, adds
zero Wave B churn, and both halves collapse cleanly into the real module later. See the
transitional-debt register (§8).

### 4.3 Web - gates move to the shell layout

Both products render through `components/layout/DashboardLayout` via a thin route-group
layout server component:

- Connect: `app/connect/layout.tsx` -> `<DashboardLayout mode="connect">`
- ERP: `app/dashboard/layout.tsx` -> `<DashboardLayout mode="erp">`

Both layout files are **server components** and the single chokepoint for every
authenticated route of their product. The gate logic moves into them.

**Connect layout (`app/connect/layout.tsx`).** Becomes a gating server component. It
calls `getConnectEntryState()` and branches - the branching that lives in
`app/connect/home/page.tsx` today, lifted up one level:

1. error `locked` (423) -> render the PIN unlock screen (`ConnectLockedEntry`).
2. error `authFailed` (401) -> `redirect('/auth?redirect=/connect/home')`.
3. other error -> throw -> `app/connect/error.tsx` boundary.
4. `!connectEnabled` -> render `ConnectComingSoon`.
5. `!policyAccepted` -> render `<PolicyGate product="connect" />`.
6. otherwise -> render `<DashboardLayout mode="connect">{children}</DashboardLayout>`.

`app/connect/home/page.tsx` then drops the now-duplicated branches (steps 1-5) and keeps
only the Day-1 home data fetch and render.

**ERP layout (`app/dashboard/layout.tsx`).** Becomes a gating server component. It calls
a new `getErpEntryState()`:

- response `ok` and `erpPolicyAccepted === false` -> render `<PolicyGate product="erp" />`.
- otherwise - `ok` and accepted, **or any error at all** -> render
  `<DashboardLayout mode="erp">{children}</DashboardLayout>`.

The ERP gate **fails open**: a locked (423), auth-failed (401), or unreachable-backend
error does **not** block ERP. Rationale: ERP is a mature app where every page does its
own backend calls and ERP already has its own App-Lock (PIN) and auth-redirect handling;
a layout gate that threw or hard-blocked on a transient policy-check failure would
regress ERP resilience (one failed call -> whole-app white-screen) and fight the
existing PIN flow. The gate blocks only on a clean backend response that explicitly says
the ERP policy is unaccepted. Because of fail-open, `getErpEntryState()` does **not**
need the `locked` / `authFailed` classification that `getConnectEntryState()` carries.

The Connect layout keeps Wave B's richer classification: it must distinguish
`connectEnabled`, show the PIN screen, and redirect on auth failure - Connect has no
other mechanism for those.

**Layout cost.** A Next.js layout server component runs once per full page load and
persists across client-side navigation within its segment - so each gate check is one
backend call per ERP/Connect session entry, not per page. The layout is therefore the
correct and cheap place for the gate.

### 4.4 The `PolicyGate` component

Generalize Wave B's `features/connect/home/ConnectPolicyGate.tsx` into one shared
component: `components/policy/PolicyGate.tsx`.

- Prop: `product: 'connect' | 'erp'`.
- Picks per `product`: the i18n namespace (`connect.policy` / `erp.policy`), the accept
  server action (`acceptConnectPolicy` / `acceptErpPolicy`), and the terms link
  (`/connect/terms` / `/terms`).
- **Full-screen takeover** - rendered by the layout _instead of_ `<DashboardLayout>`, so
  there is no nav chrome and the user cannot click into product pages around it.
- Actions: **Accept** (calls the accept action, then `router.refresh()` so the layout
  re-runs and the gate clears) and **Sign out** (existing logout). A user who refuses
  can always leave.
- Generic copy only - the gate presents the consent action and a link to the terms
  page; it never contains policy text (consistent with the Wave C copy correction).

`features/connect/home/ConnectPolicyGate.tsx` is removed; its import site
(`app/connect/home/page.tsx`, being slimmed anyway) is updated.

### 4.5 Signup integration

Signup is person-only (Wave A). Policy acceptance is recorded as a separate call
**after** a successful signup, by `app/auth/AuthClient.tsx` - the Wave B pattern. Made
product-aware:

- `forErp` signup (`?for=erp`) -> call `acceptErpPolicy()`.
- default signup (Connect front door) -> call `acceptConnectPolicy()` (Wave B - unchanged).

If that post-signup call fails, the user is created but the policy is unrecorded; the
relevant product's gate catches them on first visit. The flow is self-healing - no need
to make signup atomic with policy acceptance.

`components/auth/modes/SignupMode.tsx` carries the consent checkbox. It becomes
product-aware: when `forErp`, the checkbox copy and terms link refer to the ERP policy;
otherwise the Connect policy (Wave B - unchanged). The checkbox stays on the
person-details step and stays required.

### 4.6 i18n

- New `erp.policy.*` namespace mirroring `connect.policy.*` (`gateTitle`, `gateBody`,
  `termsLink`, `agree`), all four locales (`en`, `gu`, `gu-en`, `hi-en`).
- New ERP variant of the signup consent copy mirroring `auth.signup.policy.*`, all four
  locales.
- A `signOut` key for the gate, reused from an existing common namespace if one exists.
- All copy generic - no policy/terms wording inside the strings, and no em-dashes in
  `connect.*` / `erp.*` copy (engineering Standard #18).

### 4.7 Placeholder terms pages

The gate and the signup checkbox link to a terms page per product. Ensure both routes
exist as **minimal generic placeholder pages** so the links never 404:

- Connect: `/connect/terms` (Wave B referenced it as a placeholder route - confirm or
  create during plan recon).
- ERP: a new `/terms` placeholder route.

Real content is the future admin-synced policy module's job.

## 5. Edge cases

| Case                                                       | Handling                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Legacy user, both fields `null`                            | Gated once per product on next visit; accepts; done.                                                                         |
| App-Locked (PIN) Connect session                           | Connect layout shows the PIN screen first (step 1); policy gate only after unlock.                                           |
| App-Locked ERP session                                     | ERP gate fails open -> ERP's existing client App-Lock shows the PIN.                                                         |
| Backend unreachable                                        | Connect: error boundary (Connect is fully backend-coupled). ERP: gate fails open, individual pages surface their own errors. |
| Public Connect pages (`(connect-public)` - `/u/[id]` etc.) | Separate route group, own layout - **not gated**. Logged-out + SEO preserved.                                                |
| Marketing (`(marketing)`) and admin (`/admin`) routes      | Not product-policy gated.                                                                                                    |
| `for=erp` user later opens Connect                         | Connect policy unaccepted -> Connect gate fires. Correct.                                                                    |
| Connect signup user later opens ERP (no workspace yet)     | ERP gate fires first; after acceptance the existing no-workspace flow proceeds.                                              |
| Post-signup accept call fails                              | User created, policy unrecorded; the product gate catches them on first visit. Self-healing.                                 |

## 6. Acceptance criteria

1. A user signing up via the Connect front door accepts the Connect policy at signup;
   the first visit to `/dashboard` is intercepted by a full-screen ERP policy gate
   before any ERP page renders; accepting opens ERP.
2. A user signing up via `?for=erp` accepts the ERP policy at signup; the first visit to
   any `/connect/*` route is intercepted by the Connect policy gate; accepting opens
   Connect.
3. A user who has accepted both policies sees neither gate on either product.
4. Deep-linking directly to a non-home product page (`/connect/feed`,
   `/dashboard/attendance`) without that product's policy accepted still hits the gate -
   it is layout-level, not page-level.
5. Public Connect pages (`/u/[id]`) and marketing pages remain reachable logged-out with
   no gate.
6. Each gate renders correctly at 380px and desktop, in all four locales, with generic
   copy.

## 7. Files touched (overview - exact paths and code in the implementation plan)

**Backend** (`.worktrees/crewroster-backend/zari360-connect/`):

- `src/modules/users/schemas/user.schema.ts` - add `erpPolicyAcceptedAt`.
- `src/modules/users/*` - `MePolicyController` (`GET /me/erp-entry`,
  `POST /me/erp-policy-accept`), `UsersService` methods, `*.vitest.ts`.

**Web** (`.worktrees/crewroster-web/zari360-connect/`):

- `app/connect/layout.tsx` - gating server component.
- `app/connect/home/page.tsx` - slimmed (moved branches removed).
- `app/dashboard/layout.tsx` - gating server component.
- `components/policy/PolicyGate.tsx` - new shared full-screen gate.
- `features/connect/home/ConnectPolicyGate.tsx` - removed.
- `features/connect/profile.actions.ts` / `profile.types.ts` - `acceptErpPolicy`,
  `getErpEntryState`, ERP types.
- `components/auth/modes/SignupMode.tsx` - product-aware checkbox.
- `app/auth/AuthClient.tsx` - record ERP vs Connect acceptance by intent.
- `app/messages/{en,gu,gu-en,hi-en}.json` - `erp.policy.*` + ERP signup consent copy.
- `/connect/terms` + new `/terms` placeholder pages.

## 8. Transitional-debt register

- Two `*PolicyAcceptedAt` fields plus two mirror endpoint sets are deliberate
  transitional structure. The planned admin-synced policy module consolidates them into
  a single versioned policy-acceptance record with re-consent on version bump.
- **Do not extend the mirror to a third policy.** A third product policy is the trigger
  to build the real module instead.
- Wave B placed the Connect gate at page level (`/connect/home` only) - a deep-link
  bypass. This design corrects it (layout level). Net debt reduction.
