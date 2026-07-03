# Connect Referral Program — "Refer a friend, earn boost credits"

**Date:** 2026-06-18
**Status:** Design approved in shape by owner (trigger = "friend becomes active"; placement = dedicated page + boost-page reminder + profile entry). Pending written-spec review, then implementation plan.
**Scope:** Backend (crewroster-backend) + Web (crewroster-web) + i18n (en/gu/gu-en/hi-en) + tests. **No mobile** (standing rule `feedback_no_mobile_app_work`).

---

## 1. Goal

Let any Connect user share a personal referral link/code. When a referred friend **becomes a real, active user**, BOTH sides earn **boost credits** (the same credits already used to promote posts/listings/jobs). The user can see how many people they referred and how many credits they earned (spendable) vs. pending (on hold). An **admin** sets the credit amounts for each side independently, can change them for promotional offers, sets safety caps, and can turn the whole program on/off — all without a deploy.

**Why this design is safe:** rewards are non-cash, non-withdrawable, non-transferable, and spendable only on in-app boosts. They are granted only after a real activation action, held for a short review window, capped, and de-duplicated. This minimises both fraud cost and India regulatory exposure (see §13).

---

## 2. Research summary (full report in session; key conclusions)

Surveyed Dropbox, PayPal, Uber, Airbnb, Revolut, Wise, and Indian apps (CRED, Google Pay, PhonePe, Razorpay, Zoho). Conclusions adopted:

- **Reward trigger:** Never on bare signup (PayPal's early program paid out junk and was killed). For a **non-cash / product-credit** reward, the documented sweet spot (Dropbox) is **trigger on a genuine activation action**, with the credit **held briefly** before it is spendable. Owner chose this.
- **Two-sided:** ~78–91% of strong programs reward both sides; double-sided ~1.8–2.4× conversion. Reward both; amounts admin-set per side (equal by default).
- **Referee-facing copy:** lead with the friend's benefit; never show the referrer's reward in friend-facing copy.
- **Caps:** make per-referrer count, per-period, total-budget, and velocity all admin-configurable (mirrors Dropbox 32-referral / PayPal $100-yr / Google Pay ₹9,000-yr caps). The annual per-user ceiling also doubles as the India TDS-194R control.
- **Attribution:** first-touch / first-code-wins, locked to the **account** at signup, deduped by phone/email; bridge click→signup via cookie + localStorage.
- **Fraud (small-team set):** activation-gated + held + capped + non-cash already removes most incentive; add self-referral block (shared phone/email/device/IP), disposable-email blocklist, velocity limits, and weekly manual review of top referrers.
- **Code/link:** human-readable stem + short random suffix (6–10 chars, no ambiguous `0/O/1/l/I`); `?ref=CODE` separate from UTM; support BOTH link (auto-capture) and a manual code box (cross-device/offline).
- **India legal:** the non-cash design is the right one; three items need professional sign-off before go-live (GST on redemption, a one-time money-circulation opinion, 194R framing for business referrers). See §13.

---

## 3. Decisions locked

| Decision       | Choice                                                                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reward trigger | Referee **activates** (phone already verified at signup via OTP **+** first real Connect action = `connect.profile.created`). Not signup-only.                                                                                                                                      |
| Holdback       | Credit is "earned but on hold" at activation, becomes **spendable after `holdbackDays`** (admin, default 7). Both sides released together.                                                                                                                                          |
| Two-sided      | Yes. `referrerCredits` and `refereeCredits` set independently by admin (equal default).                                                                                                                                                                                             |
| Reward asset   | Boost credits in the **existing `AdvertiserWallet`**, added to the permanent `balance` bucket, recorded with a **new dedicated `referral` ledger type** so free referral credits are always distinguishable from bought/granted credits (owner's "keep them labelled" requirement). |
| Attribution    | First-code-wins; `User.referredByUserId` set **once** at signup, immutable; each referee can be referred at most once.                                                                                                                                                              |
| Capture        | Visible (editable) code box on signup, auto-filled from `?ref=` carried via cookie + localStorage.                                                                                                                                                                                  |
| Surfaces       | Dedicated **/connect/referrals** page + reminder card on the boost page + small profile entry + nav item.                                                                                                                                                                           |
| On/off         | Master `enabled` flag in admin config (default **off**) + a web `REFERRAL_ENABLED` constant (kill switch), mirroring the existing `checkout-gate.ts` pattern.                                                                                                                       |

---

## 4. Reuse map (what already exists — do not rebuild)

- **Wallet + ledger:** `AdvertiserWallet`, `AdWalletLedger`, `WalletService` (`grant`/`adjust`/`reserve`/`release`/`debit`). 1 credit = ₹1, whole rupees. Ledger already has a `type` enum, `idempotencyKey` (partial-unique), `ref`, `note`, `recordedBy`. → referral crediting plugs in here.
- **Admin tunable-config pattern:** `ConnectPricingConfig` singleton (`key:'default'`) + `ConnectPricingConfigService` (60s cache, busted on write, guardrails in service, `AuditService` on change) + `AdminPricingEditor.tsx` + `PUT /admin/connect/ads/pricing`. → **mirror exactly** for referral config.
- **Admin guard:** backend `@UseGuards(JwtAuthGuard, IsAdminGuard)`; web `AdminLayout` checks `user.isAdmin`.
- **Existing referral template (institutes):** `ConnectPageInvite` schema, `institute-referral.service.ts` does **first-touch attribution on the `connect.profile.created` event**, stamping `User.invitedByCompanyPageId` once with a race guard, and marks sibling invites claimed. → copy this shape for user→user referral (`referredByUserId`).
- **Registration:** `POST /auth/register` (`RegisterDto`) + SMS path; web `AuthClient.tsx` + `SignupMode.tsx`. Phone/email OTP already verified pre-User-creation.
- **Share + link:** `lib/env.ts` `appUrl`; `lib/connect/share.ts` `waMeHref()` / `nativeShareSupported()`.
- **Boost surfaces:** `/connect/boosts` (`BoostsManagerScreen`, `HubWalletStrip`); profile (`OwnProfileClient`, `ProfileView`); nav `ConnectModuleNav`; i18n `app/messages/*.json` under `connect.*`.

---

## 5. Data model

### 5.1 `User` additions (`crewroster-backend/src/modules/users/schemas/user.schema.ts`)

- `referralCode?: string` — the user's own shareable code. **Unique, sparse, case-insensitive**. Generated lazily (first visit to the referral page or first share). Format: handle/name stem + 4 random base32 chars (exclude `0/O/1/l/I`), 6–10 chars.
- `referredByUserId?: ObjectId | null` (ref `User`, sparse) — who referred this user. **Set once at signup, immutable** (mirrors `invitedByCompanyPageId`).

### 5.2 `ConnectReferral` (new — `connect/referrals/schemas/connect-referral.schema.ts`)

One row per referred person (the tracking + audit record powering the user's stats and the admin log).

- `referrerUserId` (ObjectId ref User, indexed)
- `refereeUserId` (ObjectId ref User, **unique** — each person referred once)
- `codeUsed` (string)
- `status` (enum): `pending` (signed up, not active) → `qualified` (activated, credit earned + on hold) → `rewarded` (granted, spendable); or `rejected` (cap/fraud/clawback).
- `rejectionReason?` (enum/string): `self_referral | duplicate | cap_exceeded | budget_exceeded | velocity | fraud_review | manual_clawback`.
- `referrerCreditAmount`, `refereeCreditAmount` (number) — **snapshotted at qualify time** so later config/offer changes never retroactively alter an owed amount.
- `qualifiedAt?`, `rewardedAt?` (Date)
- `referrerLedgerId?`, `refereeLedgerId?` (ObjectId ref `AdWalletLedger`) — link to the granted credit rows.
- `signupContext?` { ipHash?, deviceHash?, refereeMobileSnapshot?, refereeEmailSnapshot? } — for self-referral / fraud checks and manual review.
- timestamps. Indexes: `{ referrerUserId, createdAt:-1 }`, `{ refereeUserId }` (unique), `{ status, qualifiedAt }` (release cron).

### 5.3 `ConnectReferralConfig` (new singleton — `connect/referrals/schemas/connect-referral-config.schema.ts`, `key:'default'`)

Admin-tunable. Defaults chosen conservatively.
| Field | Default | Guardrail | Meaning |
| --- | --- | --- | --- |
| `enabled` | `false` | bool | Master on/off. |
| `referrerCredits` | `50` | 0–10000 | Credits the referrer earns per qualified referral. |
| `refereeCredits` | `50` | 0–10000 | Credits the new joiner earns. |
| `holdbackDays` | `7` | 0–90 | Days a qualified credit is held before it becomes spendable. |
| `perReferrerCap` | `0` | ≥0 (0=∞) | Max **rewarded** referrals per referrer (lifetime). |
| `monthlyPerReferrerCap` | `0` | ≥0 | Max rewarded referrals per referrer per calendar month. |
| `annualCreditCeilingPerUser` | `19000` | ≥0 | Max referral credits a single user can **earn** per financial year (keeps business referrers under the ₹20k 194R line; 0=∞). |
| `totalBudgetCap` | `0` | ≥0 | Program-wide ceiling on total credits granted; auto-pause + alert when hit. |
| `dailyVelocityPerReferrer` | `10` | ≥0 | Max referrals attributed to one referrer per 24h. |

(Optional `creditExpiryDays` is **deferred** — it needs the expiring grant-bucket path; the annual ceiling + caps already bound liability for v1.)

---

## 6. Backend changes

New module `crewroster-backend/src/modules/connect/referrals/` (mirrors `connect/institutes/`).

### 6.1 `connect-referral-config.service.ts` (mirror `ConnectPricingConfigService`)

`getConfig()` (upsert defaults, 60s cache) · `updateConfig(dto, adminUserId)` (validate guardrails → `findOneAndUpdate` → `AuditService.logEvent({ module: ADS, entityType:'ConnectReferralConfig', action:'referral_config_updated', actorId, meta })` → bust cache).

### 6.2 `referral.service.ts`

- `getOrCreateMyCode(userId)` — mint + persist `User.referralCode` if missing (collision-safe retry).
- `getMyReferralSummary(userId)` — `{ code, linkBase, enabled, referrerCredits, refereeCredits, referredCount, rewardedCount, pendingCount, creditsEarned, creditsPending, recent: [{ name/handle, status, date }] }`. `creditsEarned` = Σ rewarded `referrerCreditAmount`; `creditsPending` = Σ qualified-not-rewarded.
- `attachReferralAtSignup({ refereeUserId, code, signupContext })` — **best-effort, never throws / never blocks signup** (try/catch + Sentry, like institutes). Guards: `config.enabled`; resolve `code`→active referrer; referrer ≠ referee; referee has no existing `referredByUserId`; not self (shared mobile/email/device/IP). On pass: create `ConnectReferral{status:'pending'}` + set `User.referredByUserId` (atomic, once).
- `qualifyReferral(refereeUserId)` — `@OnEvent(CONNECT_PROFILE_CREATED)`. Find the referee's `pending` row; snapshot amounts from live config; run velocity/cap **pre-checks**; set `qualified` + `qualifiedAt` (or `rejected` + reason). Never throws.
- `releaseHeldReferrals()` — **daily cron** (mirror existing retention crons). For `qualified` rows past `qualifiedAt + holdbackDays`: re-check `annualCreditCeilingPerUser`, `perReferrerCap`, `monthlyPerReferrerCap`, `totalBudgetCap` at grant time → if OK, credit BOTH sides via the wallet (see §6.4) with idempotency keys `referral:<id>:referrer` / `:referee`, store ledger ids, set `rewarded` + `rewardedAt`; else `rejected` + reason. Emits audit + PostHog.
- Admin: `listReferrals(filter, page)` (log) · `clawback(referralId, reason, adminUserId)` (if rewarded → `WalletService.adjust` negative for the relevant side; set `rejected:manual_clawback`; audit).

### 6.3 Controllers

- `referral.controller.ts` (`@UseGuards(JwtAuthGuard)`): `GET /connect/referrals/me` (summary; mints code on first call).
- `referral-admin.controller.ts` (`@UseGuards(JwtAuthGuard, IsAdminGuard)`): `GET/PUT /admin/connect/referrals/config`, `GET /admin/connect/referrals` (paginated log + filters), `POST /admin/connect/referrals/:id/clawback`.

### 6.4 Wallet integration (LOGICAL CHANGE — flag for approval; touches the money ledger)

- Add `referral` to the `AdWalletLedger` `type` enum.
- Add `WalletService.creditReferral(userId, amount, { idempotencyKey, referralId, recordedBy })` — adds to the permanent `balance` bucket and writes a `type:'referral'` ledger row (so free referral credits are always separable from `topup`/`grant`/`adjustment`). Reuses the existing guarded-write + idempotency pattern; clawback uses existing `adjust`.

### 6.5 Auth wiring (minimal, non-blocking)

- `RegisterDto` (+ SMS verify DTO) gains optional `referralCode?: string` (validated shape only).
- `auth.service.register()` (and SMS verify path), **after** User + session creation, calls `referral.service.attachReferralAtSignup(...)` inside try/catch so referral never affects auth success. `signupContext` (ip/device/ua already captured by auth) passed through.

### 6.6 Module wiring

`ConnectReferralsModule` imports the ads/wallet module (for `WalletService`), `AuditModule`, schemas; registered in the Connect feature module and `AdminModule` surface as needed. Cron registered with the existing schedule registrar.

---

## 7. Web changes

### 7.1 New dedicated page — `app/connect/referrals/page.tsx` (+ `loading.tsx`, binding skeleton rule)

Client `features/connect/referrals/ReferralScreen.tsx`:

- **Hero:** your link + code, Copy button, **WhatsApp share** (`waMeHref`) + native share; plain "Share your link, earn **X** credits when a friend joins and gets active; your friend gets **Y**" (amounts from config; referee benefit lead).
- **Stats:** Referred (count) · Credits earned (spendable) · Credits pending (on hold).
- **Referred list:** name/handle + status chip (Joined / Active-pending / Credited) + date.
- **How it works** (3 steps) + **Terms** link.
- **Disabled state** when `!enabled` / `!REFERRAL_ENABLED`: a "coming soon" panel (and nav item hidden).
- Empty state with a share CTA.

### 7.2 Server actions + types

`features/connect/referrals/referrals.actions.ts` (`getMyReferral`, admin `getReferralConfig`/`updateReferralConfig`/`listReferrals`/`clawback`) and `referrals.types.ts` (`ReferralSummaryView`, `ReferralConfigView`, `ReferralLogRow`).

### 7.3 Entry points

- **Nav:** add "Refer & earn" to `ConnectModuleNav` PRESENCE group (hidden when disabled).
- **Boost page:** reminder card in `BoostsManagerScreen` near `HubWalletStrip` — "Earn free boost credits — refer a friend" → `/connect/referrals`; show referral credits earned if any.
- **Profile:** small "Refer & earn" entry (+ referred count) in `OwnProfileClient`/`ProfileView` (owner-only).
- **Signup:** optional referral-code field in `SignupMode` — auto-filled from `?ref=` (read in `AuthClient`, persisted to cookie + localStorage so it survives the OTP round-trip), editable, light client validation; passed to the register/verify call.

### 7.4 Admin

- `app/admin/connect/referrals/page.tsx` + `features/connect/referrals/AdminReferralEditor.tsx` (mirror `AdminPricingEditor`: `InputNumber` per field using **AntD v6** APIs, `enabled` switch, guardrail hints, "Live on the next referral" success copy) + a **referral log table** (referrer, referee, status, amounts, date; clawback action).
- Add an AdminLayout nav item `/admin/connect/referrals`.

### 7.5 Kill switch

`features/connect/referrals/referral-gate.ts` exporting `REFERRAL_ENABLED` (mirrors `checkout-gate.ts`), consumed by nav, page, and entry points.

---

## 8. i18n

New `connect.referrals.*` namespace (hero/stats/list/how-it-works/terms/disabled/empty), signup field strings, and admin strings — added to **all four** locale files (`en`/`gu`/`gu-en`/`hi-en`) in parity; the existing parity vitest must stay green. Reuse `connect.boosts.wallet.*` money phrasing where natural.

## 9. Anti-fraud controls (built in)

Self-referral block (referrer ≠ referee; shared phone/email and, where available, device/IP); referee-once dedupe (`referredByUserId` + unique `refereeUserId`); disposable-email blocklist + MX check at attribution; `dailyVelocityPerReferrer`; the `pending`→`qualified`→`rewarded` holdback so abuse is caught pre-spend; per-referrer + monthly + annual + total-budget caps; admin log + manual clawback; weekly manual review of top referrers (operational, not code).

## 10. Attribution model

First-code-wins, locked to the account at signup, deduped by phone/email; later claims ignored once `referredByUserId` is set. `?ref=` carried via cookie + localStorage (30-day) to bridge click→signup across the OTP step. Stated in the Terms.

## 11. Feature flag / rollout

Ship **off** (`enabled=false` + `REFERRAL_ENABLED=false`). Turn on only after the legal sign-offs in §13 and a smoke test. Independent of payments: works whether or not paid top-ups (`WALLET_TOPUP_ENABLED`) are on.

## 12. Testing

- BE vitest: config-service guardrails + audit; `referral.service` attribution (incl. self-referral/dup/disabled), qualify, release-cron crediting + idempotency + caps/budget, clawback; controller auth; wallet `creditReferral` idempotency + ledger type.
- Web: `ReferralScreen` + `AdminReferralEditor` render; signup code capture; i18n parity vitest; `tsc` + `eslint` clean; new route has a matching `loading.tsx`.

## 13. Legal / compliance flags (get sign-off BEFORE switching on)

Design already minimises risk (non-cash, non-withdrawable, non-transferable, single-level, no joining fee, no chance/lottery, in-app-only). Confirm with a CA/lawyer:

1. **GST on redemption** — is GST due when a user _spends_ in-app credits (free or bought) on a boost, and on what value? (This is really a question about the boost product as a whole, not referrals specifically.)
2. **One-time money-circulation opinion** — confirm the mechanic sits outside the Prize Chits & Money Circulation Schemes Act (criminal exposure). Kept low by single-level-only design (never reward on a referee's downstream referrals).
3. **TDS 194R** — for _business-owner_ referrers earning > ₹20,000/yr of credit value; the `annualCreditCeilingPerUser` default (19000) keeps users under the line unless an offer raises it.
4. **Terms & Conditions page** — publish complete, honest terms (eligibility, how earned, value, caps, expiry, non-cash/non-withdrawable, right to modify/withdraw).

## 14. Out of scope

Mobile app; paid top-up changes; multi-level/downline; cash or withdrawable rewards; third-party (paid) device-fingerprint vendor (revisit only if fraud proves material).

## 15. Open items to confirm during planning

- **Activation event:** spec uses the existing `connect.profile.created` as "first real action" (phone already OTP-verified at signup). Stronger gates (first post/connection) are a config-free future tightening if abuse appears.
- **Wallet ledger change (§6.4):** adding the `referral` ledger type + `creditReferral` method is a logical money-path change — owner approval gate before build.
- **Git:** owner stages + commits (`feedback_no_git_ops`); assistant does not run git. All work on the current branch (no new branch).
