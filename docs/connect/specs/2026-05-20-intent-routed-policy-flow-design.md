# Intent-Routed Signup + Dual-Policy Flow Polish - Design

**Date:** 2026-05-20
**Status:** Approved (design); pending implementation plan.
**Refines:** `2026-05-19-dual-policy-design.md` (the two-product policy model)
and `2026-05-19-connect-first-architecture-design.md` (the connect-first signup
flow). Locks in the URL-driven intent capture, the no-intent product picker,
the product-distinct policy gate copy, and the cross-screen flow polish.

---

## 1. Context

Zari360 ships two products on one account (Connect + ERP). Two policies, two
acceptance records, one signup flow. The dual-policy work landed but the
end-to-end signup experience still has three sharp edges:

1. **The PolicyGate copy is generic.** Both the Connect gate and the ERP gate
   render "Zari360 terms" - readers cannot tell them apart. A Connect-signup
   user who later visits `/dashboard` reads "Zari360 terms" twice and thinks
   the same gate has fired again.
2. **Neutral-entry signup silently defaults to Connect.** A user who lands on
   `/auth` directly (no `?for=…` query) is routed through a Connect-flavoured
   signup, accepts Connect terms, and is dropped at `/connect/feed`. There is
   no visible choice - and no path to land in ERP from the same signup.
3. **Three flow screens drift in spacing, hierarchy, and brand continuity.**
   The OTP screen carries the full marketing left rail; the PIN-setup and
   PolicyGate screens are stark cream. The PIN screen's title row breaks; the
   OTP screen duplicates its "We sent a 6-digit code" line; the PolicyGate
   stacks its sign-out beneath the primary CTA, fighting for attention.

This design fixes all three within the existing dual-policy model - no
data-model churn, no new endpoints.

## 2. Decisions locked

| #   | Decision             | Choice                                                                                                                |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Neutral-entry signup | Product picker step inside SignupMode (mini intent screen, two cards)                                                 |
| 2   | URL intent param     | Extend existing `?for=connect\|erp`; absence = neutral                                                                |
| 3   | PolicyGate trigger   | Cross-product entry only (signup-captured product is never re-gated) + observability on silent-fail signup acceptance |
| 4   | Polish scope         | All four screens (PolicyGate, PIN setup, OTP verify, left-rail consistency)                                           |

## 3. Architecture

### 3.1 URL intent capture

`AuthClient` currently derives a single boolean `forErp = params.get('for') === 'erp'`.
Widen to a discriminated `intent`:

```ts
type SignupIntent = 'connect' | 'erp' | null;
const intent: SignupIntent =
  params.get('for') === 'erp' ? 'erp' : params.get('for') === 'connect' ? 'connect' : null;
```

Pass `intent` (not `forErp`) into `SignupMode`. The two existing redirect /
acceptance branches inside `handleAuthSuccess` switch from `if (forErp)` to
`if (effectiveIntent === 'erp')`, where `effectiveIntent` is `intent ?? <picked-in-form>`.

The marketing pages that already deep-link to `/auth?for=erp` need no change.
Connect-marketing CTAs gain `?for=connect` so an explicit Connect-intent
signup skips the picker. Direct `/auth` visits and any CTA that omits `?for=`
fall into the neutral-entry picker.

### 3.2 SignupMode - product picker step

The current SignupMode renders one form (name + password + product-aware T&C
checkbox + submit). Add a single new sub-step **before** that form, gated
on `intent === null`:

```
SignupMode states:
  intent === 'connect' | 'erp' → <SignupForm intent={intent} />
  intent === null              → <IntentPicker onPick={(i) => setLocalIntent(i)} />
                                  then <SignupForm intent={localIntent} />
```

`<IntentPicker>` is a single-screen step inside SignupMode (no new route):

- Heading: "Where are you starting?"
- Subtitle: "Pick how you want to use Zari360. You can use both later - this
  just decides where you land first."
- Two cards (stacked < 640 px, side-by-side ≥ 640 px):
  - **Connect** - icon (Zari360 mark variant), title "Zari360 Connect",
    1-line value prop: "Your professional profile, network, marketplace,
    jobs."
  - **ERP** - icon (Zari360 mark variant), title "Zari360 ERP", 1-line value
    prop: "Run your workshop. Attendance, payroll, parties, invoices."
- Each card is a button (entire surface clickable, focusable, keyboard-arrow
  navigable per the AntD card-button pattern already used elsewhere).
- No "Both" option. A future revisit can add it; for now the model is "start
  with one, the other is one click away later".
- Footer link: "Already have an account? Sign in" (mirrors current SignupMode
  back-affordance pattern).

Picking a card sets `localIntent` → `IntentPicker` unmounts → `SignupForm`
mounts with that intent. The intent does NOT alter the URL (no `router.replace`)

- a refresh re-shows the picker, by design (no implicit choice).

`SignupForm` is the existing SignupMode body, factored out unchanged except:

- The `forErp` prop is renamed to `intent: 'connect' | 'erp'` (non-null in
  this component).
- The consent checkbox + terms link reads the product from `intent`.
- A small "Starting in **Zari360 Connect** [Change]" pill at the top of the
  form so a picker-routed user can correct a mis-pick without a back-button.
  The Change link sets `localIntent` back to `null`.

### 3.3 PolicyGate - product-distinct copy + reliability

`components/policy/PolicyGate.tsx` already namespaces translations per product
(`connect.policy.*` vs `erp.policy.*`). The drift is in the copy itself, not
the wiring. Rewrite the four keys per product so the product name is
unambiguous:

| Key         | Connect copy (en)                                                                | ERP copy (en)                                                                      |
| ----------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `gateTitle` | "Accept Zari360 Connect terms"                                                   | "Accept Zari360 ERP terms"                                                         |
| `gateBody`  | "Review the Zari360 Connect terms to use your profile, network and marketplace." | "Review the Zari360 ERP terms to use attendance, payroll and your workshop tools." |
| `termsLink` | "Read the Zari360 Connect terms"                                                 | "Read the Zari360 ERP terms"                                                       |
| `agree`     | "Agree and open Connect"                                                         | "Agree and open ERP"                                                               |

The gate gains a **product mark** beside the existing lock icon - small text
under the icon reading "Zari360 Connect" or "Zari360 ERP". Same brand mark
(`/zari360-symbol.svg`); the differentiation is the typed label, not a new
graphic. That keeps the design surface small and consistent across the two
products.

**Reliability fix.** `AuthClient.handleAuthSuccess` currently swallows
acceptance failures:

```ts
if (forErp) {
  await acceptErpPolicy().catch(() => undefined);
}
```

A silent failure leaves the user with stamped tokens but no
`*PolicyAcceptedAt` - the very next layout-level gate fires, and the user
sees the policy screen the user just "accepted" at signup. Replace with:

- Wrap in a typed catch that captures the error.
- Emit Sentry `Sentry.captureException(err, { tags: { module: 'auth', op:
'signup.acceptPolicy', product } })`.
- Emit a PostHog event `auth.policy_accept_failed_at_signup` with the
  product as a property.
- Retry once silently (network blip recovery). Still failing → continue the
  redirect; the layout gate is the safety net (correct by spec) but we now
  have observability + a confirmed-real reason for the second prompt.

No user-visible error toast - the redirect must still happen, the gate
catches it.

### 3.4 Flow-screen polish

#### 3.4.1 OTP verify (the "Check your email" screen)

- The screen currently renders both "We sent a 6-digit code. Enter it below."
  AND "We sent a 6-digit code to user@example.com [Edit]" as two paragraphs.
  Merge to one: title "Check your email", single meta line "Code sent to
  **user@example.com** [Edit]". Drop the duplicate sentence.
- "Verify & create account" CTA is disabled until 6 digits are typed.
  Current state renders a flat opaque button with no disabled affordance.
  Disabled state uses `--cr-text-disabled` on the foreground +
  `--cr-surface-2` background; enabled flips to `--cr-primary`.
- Tighter vertical rhythm: 32 px between header and code cells, 24 px from
  cells to CTA, 16 px between CTA and "Didn't get it / Resend in 23s" row.

#### 3.4.2 PIN setup

- Lock icon + title share a single flex row (the current 2-row break is a
  width regression at `< 480 px`). Title is the focal element; the icon is
  decorative (`aria-hidden`).
- "NEW PIN" and "CONFIRM PIN" inputs sit inside a single `<fieldset>` with a
  shared visually-hidden `<legend>` describing the section for screen readers.
- The body paragraph compresses to one sentence: "Zari360 uses a 6-digit PIN
  to keep your account locked when you step away." The "5 minutes…" and
  "reopen the tab" details move into an `<InfoTooltip>` next to the title
  (existing pattern).
- Show toggle pinned to the right of the NEW PIN row, not floating above.

#### 3.4.3 PolicyGate

- Tighter vertical rhythm: `mt-4` body → `mt-5`, `mt-6` actions → `mt-8`.
- Primary CTA stays "Agree and open <Product>" (product-named - see 3.3).
- "Sign out" demotes from the primary stack to a small utility link at the
  bottom-right of the screen container (mirrors AuthClient's bottom strip
  pattern). It no longer competes with the primary CTA.
- Subtle product-tinted accent: the icon-circle background uses
  `--cr-primary-light` (indigo wash) for Connect and a neutral cream
  (`--cr-cream`) for ERP. The CTA stays `--cr-primary` for both - the brand
  primary is one indigo across the suite.

#### 3.4.4 Left rail consistency across post-/auth screens

OTP / PIN / PolicyGate are all post-`/auth` screens. Today only OTP carries
the marketing left rail. Add a **compact** version of the rail to PIN and
PolicyGate so the user does not feel dropped into a stark page:

- Compact rail = brand mark + the eyebrow line + the trust line. No
  feature list (the feature list is signup-marketing, not relevant after
  signup).
- Full rail (with feature list) stays on the OTP screen because that is
  still pre-account-creation.
- Mobile (< 1024 px) hides the rail entirely on all three screens - current
  behaviour.

### 3.5 i18n

New keys (all four locales - `en`, `gu`, `gu-en`, `hi-en`), no em-dashes:

- `auth.signup.intent.title` - "Where are you starting?"
- `auth.signup.intent.subtitle` - "Pick how you want to use Zari360. You can
  use both later."
- `auth.signup.intent.connect.title` - "Zari360 Connect"
- `auth.signup.intent.connect.desc` - "Your professional profile, network,
  marketplace, jobs."
- `auth.signup.intent.erp.title` - "Zari360 ERP"
- `auth.signup.intent.erp.desc` - "Run your workshop. Attendance, payroll,
  parties, invoices."
- `auth.signup.intent.changePill` - "Starting in {product}"
- `auth.signup.intent.change` - "Change"

Revised keys:

- `connect.policy.gateTitle` / `gateBody` / `termsLink` / `agree` - rewrite
  per the table in §3.3.
- `erp.policy.gateTitle` / `gateBody` / `termsLink` / `agree` - rewrite per
  the table in §3.3.

`scripts/check-i18n.js` must remain green after the rewrite.

## 4. Edge cases

| Case                                                           | Handling                                                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User opens `/auth` directly (no `?for=`)                       | Picker step inside SignupMode. No URL redirect; picker is a sub-mode of SignupMode.                                                                               |
| User opens `/auth?for=connect`                                 | Picker skipped; SignupForm renders with Connect intent.                                                                                                           |
| User opens `/auth?for=erp`                                     | Picker skipped; SignupForm renders with ERP intent. Existing behaviour preserved.                                                                                 |
| User picks Connect, then clicks "Change" pill                  | Returns to picker; re-renders with same identifier carryover; no data loss on the picker itself (nothing was written).                                            |
| User logs in (not signs up) without `?for=`                    | Picker does NOT fire. Picker is a SignupMode sub-step only; LoginMode + CheckMode are unaffected.                                                                 |
| Connect signup succeeds; `acceptConnectPolicy` fails (network) | Retry once. Still fails → Sentry + PostHog event; redirect still happens; PolicyGate at `/connect/feed` catches the user. New-copy gate makes it readable.        |
| Connect-signup user later opens `/dashboard`                   | Picker NOT involved (already authed). ERP PolicyGate fires with ERP copy + ERP product mark. Distinct from any gate the user saw before - no perceived duplicate. |
| ERP-signup user later opens `/connect/feed`                    | Connect PolicyGate fires with Connect copy + Connect product mark. Same logic, mirrored.                                                                          |
| User refreshes mid-picker                                      | Picker re-renders (intent state was local). Acceptable - there is no in-flight credentials to lose at that step.                                                  |
| User on mobile (< 640 px)                                      | Picker cards stack vertically; SignupForm unchanged; rail hidden. Vertical rhythm of cards uses 12 px gap.                                                        |
| User on `/auth?for=foo` (unknown value)                        | Treated as neutral (`intent = null`). Picker fires. No 404.                                                                                                       |

## 5. Acceptance criteria

1. A user opens `/auth` directly, sees the intent picker, picks **Connect**,
   completes signup, and lands at `/connect/feed` with `connectPolicyAcceptedAt`
   stamped. No PolicyGate renders.
2. A user opens `/auth?for=erp`, sees no picker, completes signup, accepts the
   ERP terms checkbox, and lands at `/dashboard` (via setup-workspace) with
   `erpPolicyAcceptedAt` stamped. No PolicyGate renders.
3. A Connect-signup user later types `/dashboard` directly. The ERP PolicyGate
   renders with **ERP-distinct copy** ("Accept Zari360 ERP terms") and the
   "Zari360 ERP" product mark beside the lock icon. Accepting opens
   `/dashboard`.
4. A signup whose `acceptConnectPolicy` request fails twice (network) still
   completes signup and reaches `/connect/feed`; the PolicyGate fires as a
   safety net; Sentry receives the failure; PostHog receives
   `auth.policy_accept_failed_at_signup`.
5. All three flow screens (OTP / PIN / PolicyGate) render at **380 / 768 /
   1280 px** in all four locales (`en`, `gu`, `gu-en`, `hi-en`), with the
   compact marketing left rail visible on desktop across all three.

## 6. Files touched (overview - exact paths and code in the implementation plan)

**Web** (`.worktrees/crewroster-web/zari360-connect/`):

- `app/auth/AuthClient.tsx` - widen `forErp` → `intent`; replace silent
  `.catch(() => undefined)` on `accept*Policy` with one-shot retry + Sentry +
  PostHog.
- `components/auth/modes/SignupMode.tsx` - extract `<SignupForm>` (existing
  body); add `<IntentPicker>` sub-step; gate on `intent` prop.
- `components/auth/modes/IntentPicker.tsx` - new.
- `components/policy/PolicyGate.tsx` - add product-mark label beside the
  lock icon; restructure spacing per §3.4.3; demote sign-out to utility
  link.
- `components/auth/PinSetupCard.tsx` (or whichever component renders the
  PIN setup screen) - restructure per §3.4.2.
- `components/auth/modes/OtpVerifyMode.tsx` + `EmailOtpVerifyMode.tsx` -
  merge duplicate meta line; CTA disabled-state until 6 digits typed.
- A new shared `components/auth/AuthCompactRail.tsx` (or extend the
  existing rail in `AuthClient.tsx`) - the compact post-/auth-screen rail;
  wire into PIN setup + PolicyGate.
- `app/messages/{en,gu,gu-en,hi-en}.json` - new `auth.signup.intent.*` keys;
  revised `connect.policy.*` + `erp.policy.*` keys.

**Backend** (`.worktrees/crewroster-backend/zari360-connect/`):

- None. Existing schema fields and accept endpoints suffice.

## 7. Out of scope

- Real T&C content. (Owned by the future admin-synced policy module.)
- A unified `GET /me/policy-status` endpoint. (Transitional debt - see the
  dual-policy spec §8.)
- Third product gate. (See same.)
- "Both at once" picker option.
- PIN setup product-awareness (PIN is per-account; product-agnostic - keep
  as-is).
- Changing where SignupMode lives in the AuthClient state machine (still a
  sub-mode of `mode === 'signup'`).

## 8. Standing engineering standards (applied)

- TypeScript strict, no `any`.
- 4-locale i18n every user-facing string; `scripts/check-i18n.js` green.
- Mobile-first verification at 380 / 768 / 1280 px.
- Reuse before build - compose `components/ui/Ds*` + existing AntD primitives.
- AntD-first; Tailwind for layout utilities only.
- No em-dashes in `connect.*` / `erp.*` copy (Connect Standard #18).
- No git operations by the assistant; owner stages and commits.
- Per-phase hardening: analytics events (`auth.policy_accept_failed_at_signup`,
  picker selection PostHog event), WCAG-AA self-audit, perf budget, demo note.
