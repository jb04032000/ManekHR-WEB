# Connect-first Identity & Access Architecture - Design

**Date:** 2026-05-19
**Status:** Approved in brainstorming - pending spec review
**Owner decision area:** signup, access, onboarding, and ERP/Connect cross-sell across both products

---

## 1. Context

Zari360 ships two products on one account:

- **ERP** - business operations (payroll, attendance, finance). Production-ready, 41 modules. Structurally requires a **workspace**.
- **Connect** - public professional network / marketplace / jobs for the Surat embroidery industry. Mid-build (Phase 3 of 9 complete).

Today the product is **ERP-first**: web signup forces workspace creation up front, and Connect is hidden behind a per-user `connectEnabled` flag that only the `seed-connect.ts` script ever sets to `true`. A real account therefore lands in ERP, and a non-seeded account sees the Connect "coming soon" placeholder with no way through.

The build plan already names Connect "the growth surface" and sets its rollout to default-on at GA. This design makes that explicit now: Connect becomes the **default front door**, ERP becomes the **upgrade for businesses** - without weakening ERP's hard requirement of a workspace.

---

## 2. The model

Connect is **two layers**:

- **Connect access** - the ability to browse Connect (feed, profiles, search, and the marketplace/jobs as they ship). **Default ON for every account.**
- **Connect presence** - a public, findable profile at `/u/[userId]`. **Earned by completing onboarding**, guarded by an explicit policy/terms consent.

**ERP access** is structural, not a flag: a user "has ERP" exactly when they own or belong to a workspace.

This split reconciles the two requirements that otherwise conflict: _everyone gets Connect_ (access is universal) and _no data is ever published without consent_ (presence is consented and deliberate).

---

## 3. Decisions

| #   | Decision         | Choice                                                                                                                    |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Connect gating   | Two layers - universal **access**, consented **presence**                                                                 |
| 2   | Signup shape     | One **person-only** signup (name, mobile, optional email, password). No workspace, no profile fields                      |
| 3   | Entry routing    | Signup link carries an entry marker (`?for=erp` vs Connect/default); the marker decides post-signup routing, not the form |
| 4   | ERP path         | ERP requires a workspace; workspace creation is a guided post-signup step, plus a runtime guard                           |
| 5   | Connect entry    | **Browse-first** - browse with no profile; onboarding triggers on the first participatory action                          |
| 6   | Going public     | Completing onboarding publishes the profile (`visibility: public`). No "keep private" option in onboarding                |
| 7   | Cross-sell       | ERP→Connect broad; Connect→ERP intent-driven (`workshop_owner` intent + no workspace)                                     |
| 8   | `connectEnabled` | Schema default `true`; backfill existing users; retained only as an admin kill-switch                                     |

---

## 4. Signup - person-only, one flow

- **One signup form**, identical underneath for everyone: **name, mobile (OTP-verified), email (optional), password**. No workspace fields, no profile fields.
- The signup link carries an **entry marker** - `?for=erp` for ERP landing pages, absent/`for=connect` otherwise.
- **Connect policy/terms acceptance** is shown at registration when the entry is Connect or default.
- **Post-signup routing** (the marker decides where the user goes next, not what the form looks like):
  - `for=erp` → straight into the guided **workspace-creation** step.
  - Connect / default → into Connect.
- The signup page copy/branding may adapt to the marker (ERP-branded heading when `for=erp`); the underlying flow is one.
- Splitting the workspace out of signup is safe: a user with no workspace is now a normal, valid state.

## 5. ERP path

- ERP is meaningless without a workspace, so "uses ERP" ⇔ "has a workspace".
- A workspace is created either:
  - as the **guided post-signup step** for an ERP-entry signup, or
  - via the **ERP runtime guard** - a user in ERP mode with no workspace is forced to workspace setup. This guard already half-exists (`DashboardLayout` redirects a workspace-less user to setup when `mode === 'erp'`).

## 6. Connect - browse-first

- Anyone with Connect access **browses freely** - feed, profiles, search, marketplace/jobs as they ship - with **no onboarding and no profile**.
- A `ConnectProfile` is created **lazily on the first participatory (write) action**: post, comment, react, apply to a job, list a product, send a connection request, send a message. Pure reads never create a profile.
- The participatory action **intercepts** with the onboarding flow, then completes the original action once onboarding finishes.
- ERP→Connect crossover users accept the **Connect policy at first Connect entry** (Connect-entry signups already accepted it at registration).

## 7. Onboarding → public

- **Triggered by the first participatory action**, never merely by entering Connect.
- Flow: **intent** (`workshop_owner` / `karigar` / `buyer` / `explorer`) → build the profile (headline, skills, photo, portfolio) → complete.
- Completing onboarding sets `onboardedAt` and **`visibility: public`** - the profile becomes findable at `/u/[userId]`.
- There is **no "keep private" choice** in onboarding. A deliberate private-account feature is deferred (see §9).
- If the intent is `workshop_owner`, the ERP cross-sell fires after onboarding (see §8).

## 8. Cross-sell + product switcher

- **Connect → ERP - intent-driven.** Trigger: the user picked the `workshop_owner` intent and has no workspace. They are shown an ERP cross-sell surface (modal / sidebar highlight - exact surface finalized at UI time). Every other user simply sees ERP available in the product switcher, never pushed.
- **ERP → Connect - broad.** Every ERP user gets a dismissible Connect nudge ("get your workshop discovered, find karigars, sell"). Connect is free and low-commitment, so the nudge is universal.
- The **ERP ⇆ Connect product switcher** is always present for every account.
- Cross-sell dismissal is recorded so the user is not re-nagged.

## 9. Privacy & consent

- **Consent** = the **policy/terms acceptance** - captured at registration (Connect-entry signups) or at first Connect entry (ERP crossover). Recorded with a timestamp on the user record.
- **"Private account"** - hiding the profile / being unfindable - is a **separate, later feature** in Connect settings, built on the existing `ConnectProfile.visibility` field (`public | connections | hidden`). It also serves the "ERP-only user wants no Connect presence" opt-out. **Not in this milestone.**
- An ERP user who never touches Connect has no `ConnectProfile` at all - no presence, automatic opt-out.

## 10. `connectEnabled` flag

- `User.connectEnabled` schema **default → `true`**. Existing users **backfilled to `true`**.
- Retained only as an **admin kill-switch** (per-user revoke for abuse). When revoked, the user sees the existing "coming soon" panel.

---

## 11. Data model changes

- `User.connectEnabled` - default `true` (was effectively `false`/unset).
- `User.connectPolicyAcceptedAt: Date | null` - records policy/terms consent.
- `User` (or a small prefs document) - `connectCrossSellDismissedAt` / `erpCrossSellDismissedAt` timestamps for cross-sell nag control.
- JWT - new `family` claim (Wave 0, see §13).
- `ConnectProfile` - no schema change; `visibility` already exists, lazy creation already exists. Onboarding now stamps `visibility: public` alongside `onboardedAt`.

---

## 12. Edge cases

- Workspace-less user enters ERP mode → forced into workspace setup (runtime guard).
- ERP user who never touches Connect → no `ConnectProfile`, no public presence - automatic opt-out.
- Onboarding abandoned mid-flow → profile stays unpublished (private) until onboarding completes.
- Admin revokes `connectEnabled` → user sees the "coming soon" panel.
- A `ConnectProfile` that exists but is not yet onboarded → not public, not in `/u/[id]`, not in search.

---

## 13. Build sequence

### Wave 0 - unblock (immediate, small)

1. **`connectEnabled` default-on** - schema default `true` + a one-off backfill of existing users.
2. **PIN-loop fix** - re-key App-Lock from the access-token `jti` to a per-login `family` claim.

**The PIN-loop bug.** App-Lock unlock is keyed to the access-token `jti` (`unlocked:jti:<jti>`). The browser holds the localStorage token; Connect server components authenticate with the httpOnly cookie token; the middleware and `serverHttp` refresh the cookie independently of the browser, so the two become different valid tokens on parallel refresh chains with different `jti`s. The user unlocks the localStorage token's `jti`; the server component checks the cookie token's `jti`, which is still locked → `423` → the PIN modal reopens forever.

**The fix.** Mint a per-login `family` id (a JWT claim), copied unchanged across every refresh. Both the cookie and localStorage chains descend from one login, so they share the family. Key the App-Lock unlock on `unlocked:fam:<family>` instead of `unlocked:jti:<jti>`. The unlock then survives token rotation and is shared by both token chains; a different login (different device) gets a different family and locks independently. Touches `issueTokens`, `refreshToken`, `verifyPin`, `PinUnlockGuard`, `revokeTokens`, the setup-grace key, and `getPinStatus`; legacy tokens with no `family` fall back to `jti` keying during the rollover window.

### Connect-first milestone

3. Person-only signup refactor (drop forced workspace).
4. Entry-marker routing + the guided post-signup workspace step.
5. Connect policy/terms consent gate.
6. Browse-first Connect - `/connect/home` no longer forces onboarding; onboarding triggers on the first participatory action and intercepts it.
7. Intent-driven Connect→ERP cross-sell + broad ERP→Connect nudge.
8. Product-switcher and in-context-action polish ("zero friction").

---

## 14. Impact on existing code & the 9-phase plan

- The web combined-signup flow is refactored - workspace is no longer collected at signup.
- `/connect/home` smart-entry no longer forces onboarding; `getEntryState` semantics adjust to the access/presence model.
- The auth token shape gains a `family` claim; App-Lock keying changes.
- This effectively **revises Phase 1 (Identity / Onboarding)** of the build plan and should be recorded there.
- Marketplace / jobs / messaging stay behind their own module flags and render "coming soon" until built - so Connect default-on is safe mid-build.

---

## 15. Acceptance criteria

1. A new person signs up with name + mobile + password, no workspace, and lands in Connect.
2. A signup from a `?for=erp` link lands in the workspace-creation step; a signup without the marker lands in Connect.
3. A logged-in user browses the Connect feed and profiles with no onboarding and no `ConnectProfile`.
4. The first participatory action (e.g. posting) intercepts with onboarding; completing it publishes the profile at `/u/[userId]`.
5. A user who picked the `workshop_owner` intent and has no workspace is shown the ERP cross-sell; a `karigar`/`buyer` is not.
6. `connectEnabled` is `true` by default for new and backfilled users; after the family-claim fix, unlocking the PIN once does not re-prompt.

---

## 16. Out of scope (deliberately deferred)

- The **private-account / hide-profile** feature (and with it the explicit ERP-only Connect opt-out UI) - a later Connect settings feature on the `visibility` field.
- The **public-launch go/no-go** - opening Connect to general public signups is a launch decision made when Connect is further built, not an architecture decision.
- The **cross-sell visual design** (modal vs sidebar highlight, copy, timing) - finalized at UI-design time.
- An **admin UI toggle** for `connectEnabled` - the flag exists and defaults on; a management screen is a separate, optional task.

---

## 17. Testing

- Signup routing: ERP marker → workspace step; Connect marker / none → Connect.
- Person-only signup creates a valid workspace-less account.
- Browse Connect with no `ConnectProfile`; confirm no profile is created by reads.
- A participatory action triggers onboarding and, on completion, publishes the profile.
- Cross-sell fires for `workshop_owner` intent + no workspace; does not fire otherwise.
- `connectEnabled` schema default + backfill; admin revoke falls back to "coming soon."
- PIN family-claim: unlock survives a token refresh; a second login (different device) locks independently; legacy `jti`-only tokens still work.

---

## 18. Role terminology (addendum, 2026-05-19)

No occupation/role word may be hardcoded in Connect copy. "Karigar" is the Surat embroidery industry's word for the craft worker, but Connect serves many roles (karigar, designer, tailor, master, contractor, manager…) and many owners - a fixed role word is wrong wherever the role is not genuinely fixed. Three buckets, three rules:

1. **Role-agnostic CTAs & structural copy** (e.g. "hire karigars", "connect with karigars") → **role-neutral wording** ("hire skilled people", "find work and talent", "post a job"). The CTA names no role.
2. **Genuinely role-specific surfaces** - a job post, a marketplace listing, a search filter → the role is **data the user picks** from the role taxonomy (below), never hardcoded copy. A job post shows "Designer" because the poster chose it.
3. **ERP-data echo** - the "From your ERP" callout, the ERP-linked panel → the **workspace's own configured designation labels** (the ERP Designations system, per-locale), not a fixed word.

**Keep "karigar" deliberately** where it is a _true_ reference, not a stand-in: the `karigar` onboarding persona ("I'm a karigar"), industry-descriptive marketing prose, and illustrative placeholders/examples ("e.g. Zari karigar, 12 years"). Stripping the word everywhere would make Connect generic and inauthentic to its market - the rule is _right word, right place_, not erase-everywhere.

**Role taxonomy** - a curated, extensible, localized set of occupations powers bucket 2 (job-post role selection, profile roles, search filters, the onboarding persona). It is a **Phase 5 (Jobs)** design item: Jobs is the heaviest consumer; profiles / search / intents draw on the same set.

**Deferred:** the copy cleanup of existing Phase 1-3 strings (the ERP-echo callout + role-agnostic CTAs, all 4 locales) is a focused follow-up pass - not part of the Connect-first milestone, and not a rushed inline edit (it is 4-locale, marketing-voice-sensitive, owner-flagged non-priority). ERP-domain `karigar*` strings (the ERP Team / Job-Work "Karigar profile" feature) are unaffected - that is a real ERP domain concept, not Connect copy.
