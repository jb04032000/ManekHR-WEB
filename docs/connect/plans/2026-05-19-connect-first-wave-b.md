# Connect-first Wave B - Policy Gate & Browse-first Onboarding - Implementation Plan

> **STATUS - SHIPPED (2026-05-20).** This plan is preserved for history.
> The work it describes landed via ad-hoc owner-prompted sessions (dual-policy
> design + feed-as-landing + nudge dismissal), not by executing this plan
> task-by-task. Audit on 2026-05-20 confirms every Wave-B deliverable is
> present in code:
>
> - Backend `connectPolicyAcceptedAt` + accept endpoint - shipped.
> - Web `ConnectEntryState.policyAccepted` + `acceptConnectPolicy` action - shipped.
> - `SignupMode` consent checkbox - shipped.
> - `/connect/home` no longer forces onboarding - redirect stub to `/connect/feed`.
> - PolicyGate active in `app/connect/layout.tsx`.
> - Composer trigger gated on `onboarded` (FeedScreen).
> - Reaction toggle gated (PostCard).
> - Comment submit + reply gated (PostComments).
> - i18n in 4 locales.
>
> See `docs/connect/PROGRESS.md` - Connect-first milestone section - for the
> canonical record. Do NOT re-execute this plan.

---

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`).
>
> **Git:** the owner runs ALL git commands. "Checkpoint" = a commit point; the executing assistant runs no `git`.

**Goal:** (1) A **minimal** Connect policy/terms consent gate - a consent checkbox + a recorded timestamp; (2) **browse-first** Connect - `/connect/home` and the feed no longer force onboarding; onboarding triggers when a not-onboarded user attempts a participatory action.

**Scope constraint (owner instruction):** the policy part is deliberately minimal. A full policy module (admin-panel-synced, versioned policy content) is a SEPARATE future build. Wave B adds ONLY: a consent checkbox, a `connectPolicyAcceptedAt` timestamp, one accept endpoint, and a placeholder terms link. **No** policy CMS, **no** versioning, **no** admin CRUD, **no** policy-content schema.

**Architecture:** Connect access is universal; "presence" (a published profile) is earned by onboarding (spec §2, §6-7). Wave B stops forcing onboarding at entry - a not-onboarded user browses freely - and moves the onboarding trigger to the first participatory action (posting). The policy gate records a one-time consent before a user is dropped into Connect.

**Tech Stack:** Next.js 16, NestJS, Mongoose, AntD v6, next-intl. Web worktree `.worktrees/crewroster-web/zari360-connect`; backend worktree `.worktrees/crewroster-backend/zari360-connect`. Paths are relative to the respective worktree root.

**Verification:** backend - `eslint` on changed files + `vitest run src/modules/connect`; do NOT run the full `tsc` (OOMs). Web - `tsc --noEmit`, `eslint`, `next build`.

---

## File structure

**Backend** (`.worktrees/crewroster-backend/zari360-connect`)
| File | Change |
|------|--------|
| `src/modules/users/schemas/user.schema.ts` | Add `connectPolicyAcceptedAt?: Date` |
| `src/modules/connect/profile/connect-profile.service.ts` | `getEntryState` also returns `policyAccepted`; add `acceptPolicy(userId)` |
| `src/modules/connect/profile/connect-profile.controller.ts` | Add `POST /me/connect/profile/policy-accept` |

**Web** (`.worktrees/crewroster-web/zari360-connect`)
| File | Change |
|------|--------|
| `features/connect/profile.types.ts` | `ConnectEntryState` gains `policyAccepted: boolean` |
| `features/connect/profile.actions.ts` | New `acceptConnectPolicy()` server action |
| `components/auth/modes/SignupMode.tsx` | Consent checkbox (Connect-entry only) |
| `app/auth/AuthClient.tsx` | Record policy acceptance on Connect-entry signup success |
| `features/connect/home/ConnectPolicyGate.tsx` | **New** - minimal first-entry consent panel |
| `app/connect/home/page.tsx` | Show the policy gate when not accepted; drop the forced-onboarding redirect |
| `features/connect/feed/FeedScreen.tsx` | Gate the Composer trigger behind onboarding |
| `app/connect/feed/page.tsx` | Pass `onboarded` to `FeedScreen` |
| `features/connect/feed/FeedList.tsx`, `components/connect/PostCard.tsx`, `features/connect/feed/PostComments.tsx` | Gate comment + reaction actions behind onboarding |
| `app/messages/{en,gu,gu-en,hi-en}.json` | New `connect.policy.*` + `connect.onboardGate.*` keys |

---

## Part 1 - Minimal policy consent gate

### Task 1: Backend - `connectPolicyAcceptedAt` field + accept endpoint

**Files (backend worktree):** `src/modules/users/schemas/user.schema.ts`, `src/modules/connect/profile/connect-profile.service.ts`, `src/modules/connect/profile/connect-profile.controller.ts`

- [ ] **Step 1: Schema field**

In `user.schema.ts`, after the `connectEnabled` `@Prop`, add:

```ts
  /**
   * Zari360 Connect - timestamp the user accepted the Connect policy/terms.
   * Null/absent ⇒ not yet accepted; the Connect entry shows the consent gate.
   * (A full policy module - versioned, admin-managed content - is separate.)
   */
  @Prop({ type: Date, default: null })
  connectPolicyAcceptedAt?: Date | null;
```

- [ ] **Step 2: Service - `getEntryState` returns `policyAccepted`; add `acceptPolicy`**

In `connect-profile.service.ts`, `getEntryState` currently returns `{ connectEnabled, onboarded }`. Change its return type + body to also include `policyAccepted`:

- Widen the return type to `Promise<{ connectEnabled: boolean; onboarded: boolean; policyAccepted: boolean }>`.
- The early-return for a non-enabled user becomes `return { connectEnabled: false, onboarded: false, policyAccepted: false };`.
- The `.select('connectEnabled')` on the user query → `.select('connectEnabled connectPolicyAcceptedAt')`; the `.lean<…>()` generic gains `connectPolicyAcceptedAt?: Date | null`.
- The final return becomes `return { connectEnabled: true, onboarded: !!profile?.onboardedAt, policyAccepted: !!user.connectPolicyAcceptedAt };`.

Add a new method:

```ts
  /** Stamp the Connect policy/terms acceptance (idempotent - first write wins). */
  async acceptPolicy(userId: string | Types.ObjectId): Promise<{ acceptedAt: Date }> {
    const uid = new Types.ObjectId(userId);
    const now = new Date();
    await this.userModel
      .updateOne(
        { _id: uid, connectPolicyAcceptedAt: { $in: [null, undefined] } },
        { $set: { connectPolicyAcceptedAt: now } },
      )
      .exec();
    const user = await this.userModel
      .findById(uid)
      .select('connectPolicyAcceptedAt')
      .lean<{ connectPolicyAcceptedAt?: Date | null }>()
      .exec();
    return { acceptedAt: user?.connectPolicyAcceptedAt ?? now };
  }
```

- [ ] **Step 3: Controller - the accept endpoint**

In `connect-profile.controller.ts`, in `ConnectProfileController` (the `@Controller('me/connect/profile')` class), after the `getEntry` handler add:

```ts
  /** Record the caller's one-time Connect policy/terms acceptance. */
  @Post('policy-accept')
  async acceptPolicy(@Req() req: AuthedRequest) {
    const res = await this.profileService.acceptPolicy(req.user.sub);
    this.postHog.capture({
      distinctId: req.user.sub,
      event: 'connect.policy_accepted',
      properties: {},
    });
    return res;
  }
```

(`Post`, `Req`, `AuthedRequest`, `this.postHog` are all already imported/available in this file.)

- [ ] **Step 4: Verify (backend)**

Run: `pnpm exec eslint src/modules/users/schemas/user.schema.ts src/modules/connect/profile/connect-profile.service.ts src/modules/connect/profile/connect-profile.controller.ts`
Run: `pnpm exec vitest run src/modules/connect/profile` - the existing `connect-profile.service.vitest.ts` exercises `getEntryState`; update its expectations if the added `policyAccepted` field breaks an exact `toEqual` (change `toEqual` expectations to include `policyAccepted`). Expect green.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(connect): connectPolicyAcceptedAt + policy-accept endpoint`

### Task 2: Web - entry-state type + `acceptConnectPolicy` action

**Files (web worktree):** `features/connect/profile.types.ts`, `features/connect/profile.actions.ts`

- [ ] **Step 1: Type**

In `profile.types.ts`, `ConnectEntryState` is `{ connectEnabled: boolean; onboarded: boolean }`. Add `policyAccepted: boolean`:

```ts
export interface ConnectEntryState {
  connectEnabled: boolean;
  onboarded: boolean;
  policyAccepted: boolean;
}
```

- [ ] **Step 2: Action**

In `profile.actions.ts`, after `completeOnboarding`, add:

```ts
/** Record the caller's Connect policy/terms acceptance. */
export async function acceptConnectPolicy(): Promise<ActionResult<{ acceptedAt: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/me/connect/profile/policy-accept', {});
    return { ok: true, data: unwrapServer<{ acceptedAt: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

- [ ] **Step 3: Verify**

Run: `pnpm exec eslint features/connect/profile.types.ts features/connect/profile.actions.ts` - expect no errors. (Any consumer of `ConnectEntryState` that built the object literally - the fallback `{ connectEnabled: false, onboarded: false }` in `app/connect/home/page.tsx` - is fixed in Task 4; `app/connect/onboarding/page.tsx` has the same literal and is also fixed in Task 4.)

- [ ] **Step 4: Checkpoint** - owner commits: `feat(connect): acceptConnectPolicy action`

### Task 3: SignupMode consent checkbox + record on signup

**Files (web worktree):** `components/auth/modes/SignupMode.tsx`, `app/auth/AuthClient.tsx`

- [ ] **Step 1: Consent checkbox in `SignupMode`**

`SignupMode` is reached for a Connect-entry signup. Add a required consent `Form.Item` (an AntD `Checkbox`) directly above the submit button's `Form.Item`:

```tsx
<Form.Item
  name="policyAccepted"
  valuePropName="checked"
  rules={[
    {
      validator: (_, v: boolean) =>
        v ? Promise.resolve() : Promise.reject(new Error(t('signup.policy.required'))),
    },
  ]}
>
  <Checkbox>
    {t.rich('signup.policy.label', {
      terms: (chunks) => (
        <a href="/connect/terms" target="_blank" rel="noopener noreferrer">
          {chunks}
        </a>
      ),
    })}
  </Checkbox>
</Form.Item>
```

Add `Checkbox` to the `antd` import. The `handleSubmit` `vals` type gains `policyAccepted: boolean`; it does not need to be forwarded (the checkbox just gates the submit) - the acceptance is recorded after signup succeeds (Step 2).

`/connect/terms` is a placeholder route - a real terms page belongs to the future policy module. Do NOT build a terms page in this wave; the link target can 404 for now or you may add a one-paragraph static `app/connect/terms/page.tsx` stub if trivial - owner's call, not required.

- [ ] **Step 2: Record acceptance on signup success**

In `app/auth/AuthClient.tsx`, import `acceptConnectPolicy` from `@/features/connect/profile.actions`. In `handleAuthSuccess`, in BOTH person-only-signup branches (the mobile `if (signupFormData)` block and the email `if (result.isNewUser && signupFormData?.email)` block - added in Wave A), after `await syncAuthCookie(...)` and before the `forErp` routing branch, add:

```ts
// Connect-entry signups consented via the SignupMode checkbox - record
// it. Best-effort: a failed write must not block the redirect (the
// /connect entry policy gate will re-prompt if it did not land).
if (!forErp) {
  await acceptConnectPolicy().catch(() => undefined);
}
```

(Only Connect-entry - `!forErp` - signups saw the checkbox; ERP-entry signups did not, and accept later via the entry gate in Task 4.)

- [ ] **Step 3: Verify**

Run: `pnpm exec eslint components/auth/modes/SignupMode.tsx app/auth/AuthClient.tsx` - expect no errors.

- [ ] **Step 4: Checkpoint** - owner commits: `feat(connect): signup policy consent checkbox`

## Part 2 - Browse-first onboarding

### Task 4: `/connect/home` - policy gate + drop the forced-onboarding redirect

**Files (web worktree):** `features/connect/home/ConnectPolicyGate.tsx` (new), `app/connect/home/page.tsx`, `app/connect/onboarding/page.tsx`

- [ ] **Step 1: The minimal policy gate component**

Create `features/connect/home/ConnectPolicyGate.tsx` - a `'use client'` component shown to a `connectEnabled` user who has not yet accepted the policy (the ERP-crossover case). Minimal: one panel, an "Agree & continue" button calling `acceptConnectPolicy`, then `router.refresh()`. Mirror the centered-panel layout of `ConnectComingSoon.tsx` (same wrapper classes/tokens). Use `useTranslations('connect.policy')`. On click: call `acceptConnectPolicy()`; on `ok` → `router.refresh()`; on failure → show the error inline. Include a `/connect/terms` placeholder link. Keep it under ~60 lines.

- [ ] **Step 2: `/connect/home` - gate + browse-first**

In `app/connect/home/page.tsx`, current logic after the `entryRes` checks:

```ts
  const entry = entryRes.data;

  if (!entry.connectEnabled) return <ConnectComingSoon />;
  if (!entry.onboarded) redirect('/connect/onboarding');

  const [profileRes, workshopsRes] = await Promise.all([ … ]);
  return <Day1Home … />;
```

Change to:

```ts
  const entry = entryRes.data;

  if (!entry.connectEnabled) return <ConnectComingSoon />;
  // First Connect entry - record policy consent before anything else.
  if (!entry.policyAccepted) return <ConnectPolicyGate />;
  // Browse-first: a not-onboarded user is NOT forced into onboarding - they
  // land on the Day-1 home and browse. Onboarding is triggered later, by the
  // first participatory action (see the feed).

  const [profileRes, workshopsRes] = await Promise.all([ … ]);
  return <Day1Home … />;
```

Remove the `if (!entry.onboarded) redirect('/connect/onboarding')` line entirely. Add the `ConnectPolicyGate` import. `Day1Home` already handles a not-yet-built-out profile (it takes `profile` which may be null) - confirm it renders for a not-onboarded user; if `Day1Home` hard-requires `onboardedAt`, that is a real gap - report DONE_WITH_CONCERNS rather than guessing.

- [ ] **Step 3: Fix the `ConnectEntryState` literal fallbacks**

`app/connect/home/page.tsx` and `app/connect/onboarding/page.tsx` each build a fallback `{ connectEnabled: false, onboarded: false }`. After Task 2 added `policyAccepted` to the type, these literals miss a field → `tsc` error. Add `policyAccepted: false` to both fallback literals.

`app/connect/onboarding/page.tsx` keeps its existing guard (`if (!entry.connectEnabled || entry.onboarded) redirect('/connect/home')`) - onboarding remains reachable directly; it is just no longer FORCED from the home. No other change there.

- [ ] **Step 4: Verify**

Run: `pnpm exec eslint app/connect/home/page.tsx app/connect/onboarding/page.tsx features/connect/home/ConnectPolicyGate.tsx` - expect no errors.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(connect): browse-first home + policy entry gate`

### Task 5: Participatory-action interception - gate writes behind onboarding

A not-onboarded user browses freely; the first **write** action routes them to `/connect/onboarding`.

**Files (web worktree):** `app/connect/feed/page.tsx`, `features/connect/feed/FeedScreen.tsx`, `features/connect/feed/FeedList.tsx`, `components/connect/PostCard.tsx`, `features/connect/feed/PostComments.tsx`

- [ ] **Step 1: Thread `onboarded` into the feed**

`app/connect/feed/page.tsx` is the feed Server Component - it already calls `getConnectEntryState()` or can. Read it; ensure it has the `entry` (call `getConnectEntryState()` if not already) and pass `onboarded={entry.policyAccepted ? entry.onboarded : false}` (a non-ok/locked entry → `false`) into `<FeedScreen … />`. Add an `onboarded: boolean` prop to `FeedScreenProps`.

- [ ] **Step 2: Gate the Composer trigger in `FeedScreen`**

`FeedScreen` has a "Composer trigger" `<button onClick={() => setComposerOpen(true)}>`. Change the handler so a not-onboarded user is routed to onboarding instead:

```tsx
          onClick={() => {
            if (!onboarded) {
              router.push('/connect/onboarding');
              return;
            }
            setComposerOpen(true);
          }}
```

(`router` is already in scope via `useRouter()`.)

- [ ] **Step 3: Gate comment + reaction actions**

Read `FeedList.tsx`, `components/connect/PostCard.tsx`, and `PostComments.tsx`. Each fires a participatory write (a reaction toggle on `PostCard`, a comment submit in `PostComments`). Thread the same `onboarded` boolean down from `FeedScreen` → `FeedList` → `PostCard`/`PostComments`. At each write call site (the reaction handler, the comment submit handler), add the same guard at the top: `if (!onboarded) { router.push('/connect/onboarding'); return; }`. Do not change the write logic itself - only prepend the guard. If a component has no router, add `useRouter()`.

- [ ] **Step 4: Verify**

Run: `pnpm exec eslint app/connect/feed/page.tsx features/connect/feed/FeedScreen.tsx features/connect/feed/FeedList.tsx components/connect/PostCard.tsx features/connect/feed/PostComments.tsx` - expect no errors.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(connect): onboarding-gated participatory actions`

### Task 6: i18n + full verification

**Files (web worktree):** `app/messages/{en,gu,gu-en,hi-en}.json`

- [ ] **Step 1: Add the new keys (all 4 locales, real translations, no em-dashes)**

Under `connect`, add a `policy` object and an `onboardGate` string set. English values:

- `connect.policy.gateTitle`: "One quick step before you join"
- `connect.policy.gateBody`: "Connect is a public professional network for the embroidery trade. Your profile and posts can be seen by others here. Agree to continue."
- `connect.policy.agree`: "Agree and continue"
- `connect.policy.termsLink`: "Connect terms"
- `connect.signup.policy.label`: "I agree to the <terms>Connect terms</terms>."
- `connect.signup.policy.required`: "Please accept the Connect terms to continue."

Wait - `SignupMode` uses the `auth` namespace (`useTranslations('auth')`), so the signup checkbox keys go under `auth.signup.policy` (not `connect.signup`): `auth.signup.policy.label` + `auth.signup.policy.required`. The gate component uses `connect.policy.*`.

Translate all keys into `gu` (Gujarati script), `gu-en` (romanized Gujarati), `hi-en` (romanized Hindi), matching each file's register. No em-dashes (Connect Standard #18).

- [ ] **Step 2: Full-wave verification**

- `pnpm exec tsc --noEmit` - 0 errors.
- `pnpm run check:i18n` - confirm no NEW missing keys for the keys added in Step 1 (the pre-existing `auth.signup.*` / `profile.*` gap is unrelated).
- `pnpm exec next build` - compiles.
- Manual smoke: a `connectEnabled` user who has not accepted → sees the policy gate → Agree → lands on the home. A not-onboarded user browses `/connect/home` + `/connect/feed` freely; clicking the composer (or comment/react) routes to `/connect/onboarding`; after picking an intent they return and can post.

- [ ] **Step 3: Checkpoint** - owner commits: `chore(connect): wave B i18n`

---

## Self-review (completed during planning)

- **Spec coverage:** spec §13 item 5 (policy/terms consent gate) = Tasks 1-4; item 6 (browse-first onboarding + first-participatory-action trigger) = Tasks 4-5. ✓
- **Scope:** honours the owner's "minimal policy" instruction - one timestamp field, one endpoint, one checkbox, one gate panel, a placeholder terms link. No policy CMS / versioning / admin CRUD. ✓
- **Placeholders:** none - exact code for the backend + the type/action/AuthClient/home changes; Task 4 Step 2 and Task 5 Step 3 name a concrete fallback (report DONE_WITH_CONCERNS) for the two genuinely file-dependent spots (`Day1Home`'s not-onboarded tolerance; the exact comment/react call sites).
- **Type consistency:** `ConnectEntryState.policyAccepted` (Task 2) ↔ the backend `getEntryState` return (Task 1) ↔ the two literal fallbacks (Task 4 Step 3). `onboarded` prop threaded `feed/page → FeedScreen → FeedList → PostCard/PostComments` consistently.

## Out of scope (deliberately)

- The real **policy module** - admin-panel-synced, versioned, multi-document policy content. Wave B's gate reads a single boolean; the future module replaces the placeholder `/connect/terms` link + can re-prompt on version bumps.
- A built-out `/connect/terms` page - placeholder link only.
- Cross-sell + product-switcher polish - **Wave C**.
