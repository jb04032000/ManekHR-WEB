# Connect-first Wave C - Cross-sell & Switcher - Implementation Plan

> **STATUS - SHIPPED (2026-05-20).** This plan is preserved for history.
> The work it describes landed via ad-hoc owner-prompted sessions (intent
> persistence + cross-sell card + nudge with backend-persisted dismissal),
> not by executing this plan task-by-task. Audit on 2026-05-20 confirms every
> Wave-C deliverable is present in code:
>
> - Backend `ConnectProfile.onboardingIntent` schema field + `completeOnboarding`
>   persists it + vitest coverage.
> - Web `ConnectProfile.onboardingIntent` type.
> - `ConnectErpCrossSell` (intent-driven, dismissible) - rendered in `FeedScreen`
>   instead of the deleted `Day1Home`.
> - `ConnectNudge` (ERP→Connect, dismissible) - mounted in `Sidebar.tsx` with
>   **backend-persisted** dismissal (`User.dismissedHints` + `/me/dismiss-hint`),
>   not the localStorage scheme described below.
> - `ModeSwitcher` present in both shells.
> - `connect.crossSell.*` i18n in 4 locales.
>
> See `docs/connect/PROGRESS.md` - Connect-first milestone section - for the
> canonical record. Do NOT re-execute this plan.

---

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`).
>
> **Git:** the owner runs ALL git commands. "Checkpoint" = a commit point; the assistant runs no `git`.

**Goal:** The final Connect-first wave - (1) intent-driven **Connect→ERP cross-sell** (a workshop-owner-intent user with no workspace is offered ERP setup); (2) a broad **ERP→Connect nudge** (every ERP user is invited to Connect); (3) confirm the **product switcher** is everywhere.

**Scope (lean):** the product switcher (`ModeSwitcher`) already exists and works - Wave C only confirms it. The cross-sell surfaces are deliberately **simple dismissible cards**, not elaborate modals (the spec §8 left "modal vs sidebar highlight" to UI time - this finalises it as a card). Dismissal is **localStorage** - no backend dismissal field/endpoint (a per-user persisted timestamp is a future enhancement; localStorage is sufficient for a nudge).

**Architecture:** The cross-sell trigger needs the onboarding intent, which today is NOT persisted. Wave C persists it (`ConnectProfile.onboardingIntent`). The Connect→ERP card reads `profile.onboardingIntent === 'workshop_owner'` + `user.hasWorkspace === false`. The ERP→Connect nudge shows to any ERP user. Both are client components, dismissed via `localStorage`.

**Tech Stack:** Next.js 16, NestJS, Mongoose, AntD v6, next-intl. Backend worktree `.worktrees/crewroster-backend/zari360-connect`; web worktree `.worktrees/crewroster-web/zari360-connect`.

**Verification:** backend - `eslint` + `vitest run src/modules/connect/profile` (no full `tsc` - OOMs). Web - `tsc --noEmit`, `eslint`, `next build`.

---

## File structure

**Backend**
| File | Change |
|------|--------|
| `src/modules/connect/profile/schemas/connect-profile.schema.ts` | Add `onboardingIntent` field |
| `src/modules/connect/profile/connect-profile.service.ts` | `completeOnboarding` persists the intent |
| `src/modules/connect/profile/__tests__/connect-profile.service.vitest.ts` | Cover intent persistence |

**Web**
| File | Change |
|------|--------|
| `features/connect/profile.types.ts` | `ConnectProfile` gains `onboardingIntent` |
| `components/connect/ConnectErpCrossSell.tsx` | **New** - dismissible Connect→ERP card |
| `features/connect/home/Day1Home.tsx` | Render the cross-sell card |
| `components/connect/ConnectNudge.tsx` | **New** - dismissible ERP→Connect nudge card |
| `components/layout/Sidebar.tsx` | Mount the nudge in the ERP sidebar |
| `app/messages/{en,gu,gu-en,hi-en}.json` | New `connect.crossSell.*` keys |

---

## Task 1: Backend - persist the onboarding intent

**Files (backend worktree):** `schemas/connect-profile.schema.ts`, `connect-profile.service.ts`, `__tests__/connect-profile.service.vitest.ts`

- [ ] **Step 1: Schema field**

In `connect-profile.schema.ts`, near the `ConnectProfile` document class, define the intent constant near the other enums at the top (after `CONNECT_CONTACT_PREFERENCES`):

```ts
/** `ConnectProfile.onboardingIntent` - the persona picked at onboarding. */
export const CONNECT_ONBOARDING_INTENTS = [
  'workshop_owner',
  'karigar',
  'buyer',
  'explorer',
] as const;
export type ConnectOnboardingIntentValue = (typeof CONNECT_ONBOARDING_INTENTS)[number];
```

Inside the `ConnectProfile` class, after the `onboardedAt` `@Prop`, add:

```ts
  /**
   * The persona the user picked in the onboarding intent flow. Persisted so
   * downstream surfaces (the Connect→ERP cross-sell) can read it. `null` until
   * the user completes onboarding.
   */
  @Prop({ type: String, enum: CONNECT_ONBOARDING_INTENTS, default: null })
  onboardingIntent?: ConnectOnboardingIntentValue | null;
```

- [ ] **Step 2: Persist it in `completeOnboarding`**

In `connect-profile.service.ts`, `completeOnboarding(userId, intent)` currently stamps `onboardedAt` and applies the karigar pre-set but does NOT store the intent. Add - right after the `onboardedAt` line, before `profile.save()`:

```ts
profile.set('onboardingIntent', intent);
```

Update the method's doc-comment: it currently says "The intent itself is not persisted" - change that to state the intent IS now persisted on `onboardingIntent` (and still drives the pre-set + analytics event).

- [ ] **Step 3: Test**

In `connect-profile.service.vitest.ts`, find the `completeOnboarding` describe block. Add (or extend an existing) test asserting that after `completeOnboarding(userId, 'workshop_owner')` the saved profile has `onboardingIntent === 'workshop_owner'` (assert via the mock `profile.set` calls or the saved doc, matching the file's existing assertion style).

- [ ] **Step 4: Verify**

Run: `pnpm exec eslint src/modules/connect/profile/schemas/connect-profile.schema.ts src/modules/connect/profile/connect-profile.service.ts` - expect 0 errors.
Run: `pnpm exec vitest run src/modules/connect/profile` - expect green.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(connect): persist onboarding intent`

## Task 2: Web - `ConnectProfile` type gains `onboardingIntent`

**Files (web worktree):** `features/connect/profile.types.ts`

- [ ] **Step 1: Add the field**

In `profile.types.ts`, the `ConnectProfile` interface - after `onboardedAt?: string | null;` add:

```ts
  /** The persona picked at onboarding; `null`/absent until onboarding completes. */
  onboardingIntent?: ConnectOnboardingIntent | null;
```

`ConnectOnboardingIntent` is already defined in this file (`'workshop_owner' | 'karigar' | 'buyer' | 'explorer'`) - reuse it.

- [ ] **Step 2: Verify**

Run: `pnpm exec eslint features/connect/profile.types.ts` - expect 0 errors.

- [ ] **Step 3: Checkpoint** - owner commits: `feat(connect): ConnectProfile.onboardingIntent type`

## Task 3: Connect→ERP cross-sell card

**Files (web worktree):** `components/connect/ConnectErpCrossSell.tsx` (new), `features/connect/home/Day1Home.tsx`

- [ ] **Step 1: The card component**

Create `components/connect/ConnectErpCrossSell.tsx` - a `'use client'` component:

- Props: `{ intent?: ConnectOnboardingIntent | null }` (import the type from `@/features/connect/profile.types`).
- Reads `user` from `useAuthStore` (`@/lib/store`).
- Reads dismissal from `localStorage` key `z360_connect_erp_crosssell_dismissed` (`useState` initialised in a mount `useEffect` to avoid an SSR/hydration mismatch - render nothing until mounted).
- **Show only when:** `intent === 'workshop_owner'` AND `user?.hasWorkspace === false` AND not dismissed. Otherwise render `null`.
- The card: a heading + body inviting the user to set up their ERP workspace (run payroll/attendance for their workshop), a primary action `Link` to `/auth/setup-workspace`, and a dismiss "×" button that sets the localStorage key + hides the card.
- `useTranslations('connect.crossSell')`. Mirror the card styling/tokens used by `ConnectComingSoon` / the `Day1Home` sections (`var(--cr-surface)`, `var(--cr-border)`, `var(--cr-radius-lg)`). Keep it ~60-80 lines.

- [ ] **Step 2: Render it in `Day1Home`**

`Day1Home` is a Server Component receiving `profile: ConnectProfile | null`. Import `ConnectErpCrossSell`. Render it at the TOP of the returned column (right after the `<header>`, before `ProfileStrengthCard`):

```tsx
<ConnectErpCrossSell intent={profile?.onboardingIntent} />
```

The client component self-hides when the conditions are not met, so an unconditional render here is correct.

- [ ] **Step 3: Verify**

Run: `pnpm exec eslint components/connect/ConnectErpCrossSell.tsx features/connect/home/Day1Home.tsx` - expect 0 errors.

- [ ] **Step 4: Checkpoint** - owner commits: `feat(connect): Connect-to-ERP cross-sell card`

## Task 4: ERP→Connect nudge + switcher confirmation

**Files (web worktree):** `components/connect/ConnectNudge.tsx` (new), `components/layout/Sidebar.tsx`

- [ ] **Step 1: The nudge component**

Create `components/connect/ConnectNudge.tsx` - a `'use client'` component:

- No props.
- Dismissal from `localStorage` key `z360_connect_nudge_dismissed` (same mounted-`useEffect` pattern as Task 3 - render `null` until mounted).
- Show when not dismissed; otherwise `null`.
- A compact card inviting the ERP user to Connect ("Get your workshop discovered - find karigars, sellers and buyers on Connect"), a `Link` to `/connect/home`, and a dismiss "×".
- `useTranslations('connect.crossSell')`. Compact styling suited to a sidebar - keep it small (~50-70 lines).

- [ ] **Step 2: Mount it in the ERP sidebar**

READ `components/layout/Sidebar.tsx` (the ERP-mode sidebar). Mount `<ConnectNudge />` in a sensible spot - near the bottom of the nav, above the footer/user area, so it does not push the primary nav. Follow the file's existing layout patterns; do not restructure the sidebar.

Also CONFIRM `ModeSwitcher` is already mounted in this sidebar's header (it should be - `ModeSwitcher`'s doc-comment says it lives in the sidebar header for both products). If it is present, no change. If it is genuinely absent, mount `<ModeSwitcher />` in the sidebar header (mirroring how `ConnectModuleNav` mounts it) and note it in the report.

- [ ] **Step 3: Verify**

Run: `pnpm exec eslint components/connect/ConnectNudge.tsx components/layout/Sidebar.tsx` - expect 0 errors.

- [ ] **Step 4: Checkpoint** - owner commits: `feat(connect): ERP-to-Connect nudge`

## Task 5: i18n + full verification

**Files (web worktree):** `app/messages/{en,gu,gu-en,hi-en}.json`

- [ ] **Step 1: Add the `connect.crossSell.*` keys (all 4 locales)**

Under the `connect` object, add a `crossSell` object. English values:

- `erpTitle`: "Run your workshop on Zari360"
- `erpBody`: "You signed up as a workshop owner. Set up your workspace to run attendance and payroll, and your factory's track record builds your Connect trust badge."
- `erpAction`: "Set up my workspace"
- `nudgeTitle`: "You are on Connect too"
- `nudgeBody`: "Get your workshop discovered. Find karigars, sellers and buyers in the embroidery trade."
- `nudgeAction`: "Open Connect"
- `dismiss`: "Dismiss"

Translate all 7 into `gu` (Gujarati script), `gu-en` (romanized Gujarati), `hi-en` (romanized Hindi), matching each file's register. **No em-dashes** (Connect Standard #18).

- [ ] **Step 2: Full-wave verification**

- `pnpm exec eslint app/messages/en.json app/messages/gu.json app/messages/gu-en.json app/messages/hi-en.json` - 0 errors.
- `pnpm exec tsc --noEmit` - 0 errors.
- `pnpm run check:i18n` - confirm the 7 new `connect.crossSell.*` keys add no NEW missing-key mismatch (present in all 4 files). The pre-existing `auth.signup.*` / `profile.*` gap is unrelated.
- `pnpm exec next build` - run `next build` directly (not `pnpm run build`). Expect a successful compile.
- Manual smoke: a user who onboarded as `workshop_owner` with no workspace sees the Connect→ERP card on `/connect/home`; dismiss → it stays gone (reload). An ERP user sees the Connect nudge in the sidebar; dismiss → gone. The ERP ⇆ Connect switcher is present in both shells.

- [ ] **Step 3: Checkpoint** - owner commits: `chore(connect): wave C i18n`

---

## Self-review (completed during planning)

- **Spec coverage:** §13 item 7 (intent-driven Connect→ERP cross-sell + broad ERP→Connect nudge) = Tasks 1-4; item 8 (product switcher always present) = Task 4 Step 2's confirmation - the switcher already exists, so no build is needed beyond confirming it.
- **Scope:** lean - simple dismissible cards (not modals), localStorage dismissal (no backend dismissal field). The intent-persistence is the one genuinely-required new field. No new backend module.
- **Placeholders:** none - exact code for the schema, type, and `Day1Home` wiring; the two new components are specced with precise props/conditions/keys; Task 4 Step 2 names the file to read and the precise placement.
- **Type consistency:** `onboardingIntent` - backend `ConnectOnboardingIntentValue` (Task 1) ↔ web `ConnectOnboardingIntent` reused on `ConnectProfile` (Task 2) ↔ `ConnectErpCrossSell` prop (Task 3). The `connect.crossSell.*` keys (Task 5) match the `useTranslations('connect.crossSell')` namespace used by both new components.

## Out of scope (deliberately)

- Backend-persisted, cross-device cross-sell dismissal (`connectCrossSellDismissedAt`) - localStorage is the lean choice; a per-user timestamp is a future enhancement.
- Elaborate cross-sell modals / animated highlights - a simple card is the finalised surface.
- Product-switcher redesign - it already works; Wave C only confirms its presence.
- This is the LAST Connect-first wave - after it, the milestone (spec §13 items 3-8) is complete.
