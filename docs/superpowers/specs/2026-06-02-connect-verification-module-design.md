# Connect Business Verification module - design

Date: 2026-06-02
Status: Design only (UI/flow complete on paper; backend + third-party API deferred).
Reference: handoff `connect-verify-onboarding.jsx` (VerificationHub + GST/Udyam/ERP flows).
Dependency: requires a third-party GSTIN/Udyam verification API to reach the
"verified" state - recorded in workspace `REQUIREMENTS.md` ("Zari360 Connect -
third-party integrations"). Until connected, the module ships an honest
"self-declared / pending" state and never fabricates a verified badge.

## Why this module

Trust is the moat for a Surat textile B2B network. A buyer choosing a workshop
they have never met needs signals they can rely on. The reference designs a
tiered verification ladder; we reconcile it to what we can prove truthfully today
vs. what needs an external API.

## Trust tiers (reconciled to our data)

| Tier               | Signal                        | Source                                                          | State today                                    |
| ------------------ | ----------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| **0 - ERP-linked** | "Runs a live ERP workspace"   | the existing `erpWorkspaceId` link -> `erpLink {linked, since}` | **WORKS NOW** (real, no API)                   |
| **1a - GST**       | GSTIN confirmed real + active | third-party GSTIN API                                           | **declared now, verified after API**           |
| **1b - Udyam**     | MSME registration confirmed   | third-party Udyam API                                           | declared now, verified after API               |
| **2 - Contact**    | Mobile / email confirmed      | existing OTP infra                                              | mobile OTP already exists (Team module); reuse |

The ERP tier is deliberately first: it is the signal competitors cannot fake and
we already own. GST/Udyam are the classic Indian-B2B trust marks but they need an
external lookup to verify - so we capture them now (self-declared) and verify later.

## Surface + placement

A **Verification** surface reachable from the profile and the storefront/company
settings (a "Verify your business" entry). One hub, reused for the person (profile)
and the business (storefront / company page) contexts.

Route: `/connect/verify` (in-app, authed). Also surfaced as a card on the profile
owner view + the storefront/company manage console (a "Verification" row that deep-
links here).

## Layout (the hub)

- **Header**: "Verify your business" + a one-line trust explainer.
- **Trust meter**: a small ladder showing which tiers are done (ERP green when
  linked; GST/Udyam show "declared" or "verified"; contact shows confirmed).
  Honest: a tier is "verified" ONLY when its real check passed.
- **Tier cards** (stacked), each with its state + action:
  - **ERP-linked**: if linked -> green "Verified via your ERP workspace" + since
    date (real). If not -> "Link an ERP workspace" CTA to the existing ERP-link
    setting. No API.
  - **GST**: input GSTIN (15-char, format-validated client-side). On submit ->
    **"Submitted, pending verification"** state (NOT verified). A note: "We confirm
    your GSTIN against official records. Until then it shows as self-declared."
    When the API is wired, this flips to "Verified - <legal name>, <state>".
  - **Udyam**: input Udyam number -> same declared/pending pattern.
  - **Contact**: reuse the existing mobile-OTP verify (Team module's
    `TeamMobileOtp` pattern) for a confirmed-mobile check; email later.
- **Right rail**: explains the badges buyers will see + that ERP-linked is the
  strongest signal (the moat narrative).

## Honest states (the no-fabrication contract)

- A green "Verified" badge renders ONLY when a real check passed (ERP link today;
  GST/Udyam once the API confirms).
- A self-declared GSTIN renders as a neutral "Self-declared" chip, never a green
  check. This mirrors the marketplace epic decision (`gstStatus: 'declared'`).
- No tier shows a number/name we did not truthfully obtain.

## Data model (deferred - backend not built yet)

When implemented, add a `SellerVerification` (or fields on Storefront/CompanyPage):

- `gstin?: string`, `gstStatus: 'none' | 'declared' | 'pending' | 'verified' | 'failed'`,
  `gstLegalName?`, `gstState?`, `gstCheckedAt?`.
- `udyamNumber?: string`, `udyamStatus` (same enum).
- ERP tier is derived (no new field).
- `mobileVerifiedAt?` (reuse the Team OTP proof pattern).

Endpoints: `POST /connect/verify/gst` (captures + calls provider -> pending),
provider webhook/poll -> flips to verified, `GET /connect/verify/me`.

## Third-party API requirement (the blocker)

GST + Udyam verification **cannot function without an external provider** (official
GSP or a vendor such as Signzy / Surepass / Sandbox.co.in). The owner must supply a
provider account + API credentials (env: `CONNECT_GST_API_KEY`, `CONNECT_GST_API_BASE`,
etc.). Documented in workspace `REQUIREMENTS.md`. Until then the module is fully
designed and the capture UI works, but the verify step stays at "declared / pending".

## Build phases (when greenlit)

1. **UI shell + ERP tier (real) + GST/Udyam capture as self-declared.** Ships value
   immediately (ERP badge + declared GSTIN), no external dep. Needs the
   `SellerVerification` fields + capture endpoint.
2. **Wire the GST/Udyam provider** once credentials exist: verify call + webhook ->
   `verified`, surface legal name/state, badge flips to green.
3. **Contact tier** (reuse mobile OTP) + email verify.
4. Index the verified bits for the marketplace "Verified sellers only" filter +
   "ERP-verified first" sort (ties into marketplace epic Phase B).

## i18n + a11y

All four locales (en/gu/gu-en/hi-en); gu/gu-en/hi-en owe native review. Forms are
keyboard-navigable, states announced, badges have text labels (not colour-only).

## Non-negotiables

- No fabricated "verified" badge. Pending is pending.
- ERP tier never depends on an external API.
- Reuse the existing ERP-link setting + Team mobile-OTP pattern (do not rebuild).
