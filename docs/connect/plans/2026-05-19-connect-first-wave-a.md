# Connect-first Wave A - Signup & Entry - Implementation Plan

> **STATUS - SHIPPED (2026-05-20).** Person-only signup (drop forced workspace),
> entry-marker routing, guided post-signup workspace step - all live. Preserved
> for history. See `docs/connect/PROGRESS.md` - Connect-first milestone section -
> for the canonical record. Do NOT re-execute this plan.

---

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Git:** the project owner runs ALL git commands. "Checkpoint" steps mark a commit point - the executing assistant does NOT run `git`.

**Goal:** Make Connect signup person-only - signup creates a `User` with no workspace; an entry marker (`?for=erp`) decides whether the user is routed straight into the guided workspace-creation step or into Connect.

**Architecture:** Web-only change. The backend `verify-otp` / `register` endpoints **already** support User-only creation - when the `workspace` payload is absent they take the "otp-only" branch and create a `User` (with the supplied name + password, no placeholder), `hasWorkspace: false`. Wave A simply stops the web from sending `workspace`: it strips the workspace section from `SignupMode`, drops `workspace` from the verify/register call sites, and adds entry-marker routing in `AuthClient`. Workspace creation moves entirely to the existing `/auth/setup-workspace` route (already used by the ERP runtime guard in `DashboardLayout`).

**Tech Stack:** Next.js 16, React 19, AntD v6, next-intl. Web worktree: `.worktrees/crewroster-web/zari360-connect` - all paths below are relative to that root. No backend change.

**Verification note:** these are UI-flow refactors with no unit-test harness for the auth modes. Verify per task with `pnpm exec eslint <file>`; verify the whole wave with `pnpm exec tsc --noEmit`, `pnpm run check:i18n`, `pnpm exec next build`, and the manual smoke test in Task 9.

---

## File structure

| File                                              | Change                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `components/auth/modes/types.ts`                  | `SignupFormData` drops the `workspace` block                                 |
| `components/auth/modes/SignupMode.tsx`            | Remove the Workspace form section → name/password/confirm only               |
| `components/auth/modes/OtpVerifyMode.tsx`         | Drop `workspace` from the `verifyOtp` call                                   |
| `components/auth/modes/EmailOtpVerifyMode.tsx`    | Drop `workspace` from the `register` call                                    |
| `lib/actions/auth.actions.ts`                     | `verifyOtp` payload type drops `workspace`                                   |
| `types/index.ts`                                  | `RegisterPayload` drops `workspace`                                          |
| `app/auth/AuthClient.tsx`                         | Entry-marker routing in `handleAuthSuccess`                                  |
| `components/auth/modes/RegisterWorkspaceMode.tsx` | `hideAccountFields` prop - skip name/password for an already-registered user |
| `app/auth/setup-workspace/page.tsx`               | Pass `hideAccountFields` (the user already has name + password)              |
| `app/messages/{en,gu,gu-en,hi-en}.json`           | Remove the now-unused `auth.signup.*` workspace keys                         |

**Left untouched (deliberately):** the legacy `RegisterMode` + `register_workspace` mode + the OTP-only `handleAuthSuccess` variant - these are the mobile-app-style legacy path; Wave A does not break or remove them (removal is scope creep, and `RegisterWorkspaceMode` is still used by `/auth/setup-workspace`). The backend - no change.

---

## Task 1: `SignupFormData` - drop `workspace`

**Files:** Modify `components/auth/modes/types.ts`

- [ ] **Step 1: Remove the `workspace` block from the interface**

Current:

```ts
export interface SignupFormData {
  /** Set when channel is mobile. */
  mobile?: string;
  /** Set when channel is email. */
  email?: string;
  name: string;
  password: string;
  workspace: {
    name: string;
    location?: string;
    businessType?: 'trading' | 'manufacturing' | 'service' | 'composition';
    gstin?: string;
    pan?: string;
    fyStartMonth?: number;
  };
}
```

Replace with:

```ts
export interface SignupFormData {
  /** Set when channel is mobile. */
  mobile?: string;
  /** Set when channel is email. */
  email?: string;
  name: string;
  password: string;
}
```

Also update the interface's doc-comment: replace the sentence "so User + Workspace are created atomically server-side" with "so the User is created server-side" - and drop the words "+ workspace fields".

- [ ] **Step 2: Lint**

Run: `pnpm exec eslint components/auth/modes/types.ts`
Expected: no errors.

- [ ] **Step 3: Checkpoint** - owner commits: `refactor(connect): SignupFormData is person-only`

## Task 2: `SignupMode` - person-only form

**Files:** Modify `components/auth/modes/SignupMode.tsx`

- [ ] **Step 1: Trim `handleSubmit` - remove the workspace object**

Replace the whole `handleSubmit` function. Current signature destructures workspace fields and builds a `workspace` object. New version:

```ts
const handleSubmit = async (vals: { name: string; password: string; confirm: string }) => {
  setError('');
  setLoading(true);

  if (channel === 'mobile' && mobile && onProceedToOtp) {
    const res = await sendOtp(mobile, 'register');
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    const formData: SignupFormData = {
      mobile,
      name: vals.name.trim(),
      password: vals.password,
    };
    onProceedToOtp(formData, {
      resendCooldownSec: res.data.resendCooldownSec,
      mockMode: res.data.mockMode,
    });
    setLoading(false);
    return;
  }

  if (channel === 'email' && email && onProceedToEmailOtp) {
    const res = await sendEmailRegistrationOtp(email);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    const formData: SignupFormData = {
      email,
      name: vals.name.trim(),
      password: vals.password,
    };
    onProceedToEmailOtp(formData, {
      resendCooldownSec: res.data.resendCooldownSec,
    });
    setLoading(false);
    return;
  }

  setLoading(false);
};
```

- [ ] **Step 2: Remove the Workspace JSX section**

In the returned `<Form>`, delete everything from the `<h2>` whose text is `t('signup.sectionWorkspace')` through the end of the `<Collapse … />` element (the `workspaceName` `Form.Item`, the `location` `Form.Item`, and the entire `<Collapse>` Business Details panel). Keep the Account section (`signup.sectionAccount` heading + name/password/confirm), the owner-note info box, and the submit button.

- [ ] **Step 3: Drop `initialValues` and now-unused imports**

On the `<Form>` element, remove the `initialValues={{ fyStartMonth: 4 }}` prop.

At the top of the file, the import line is:

```ts
import { Form, Input, Button, Alert, Select, InputNumber, Collapse } from 'antd';
```

Change to (only `Form`, `Input`, `Button`, `Alert` remain used):

```ts
import { Form, Input, Button, Alert } from 'antd';
```

And the icon import:

```ts
import {
  ArrowLeftOutlined,
  BankOutlined,
  EditOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
```

Change to (only `ArrowLeftOutlined`, `EditOutlined`, `UserOutlined` remain used):

```ts
import { ArrowLeftOutlined, EditOutlined, UserOutlined } from '@ant-design/icons';
```

Delete the now-unused `GSTIN_RE` and `PAN_RE` constants.

- [ ] **Step 4: Update the file doc-comment**

The block comment above `export function SignupMode` describes "Captures name + password + workspace details upfront so the /auth/verify-otp call … creates User + Workspace atomically". Rewrite it to describe a person-only signup: it captures name + password; the verify step creates the `User` only; a workspace, if needed, is created afterward in the guided workspace step.

- [ ] **Step 5: Lint**

Run: `pnpm exec eslint components/auth/modes/SignupMode.tsx`
Expected: no errors (no unused imports/vars).

- [ ] **Step 6: Checkpoint** - owner commits: `refactor(connect): SignupMode is person-only`

## Task 3: `OtpVerifyMode` - drop `workspace` from the verify call

**Files:** Modify `components/auth/modes/OtpVerifyMode.tsx`

- [ ] **Step 1: Remove `workspace` from the `verifyOtp` payload**

In `handleVerify`, current:

```ts
const res = await verifyOtp({
  mobile: ctx.mobile,
  otp: value,
  flowType: ctx.flowType,
  // Web combined-signup payload - only attached on register-flow verifies
  // when the user came through SignupMode. BE atomically creates User +
  // Workspace on success.
  ...(ctx.flowType === 'register' && signupFormData
    ? {
        name: signupFormData.name,
        password: signupFormData.password,
        workspace: signupFormData.workspace,
      }
    : {}),
});
```

Replace with:

```ts
const res = await verifyOtp({
  mobile: ctx.mobile,
  otp: value,
  flowType: ctx.flowType,
  // Person-only signup payload - name + password attached on register-flow
  // verifies when the user came through SignupMode. The BE creates the
  // User only; the workspace (if any) is created later in the guided
  // workspace step.
  ...(ctx.flowType === 'register' && signupFormData
    ? { name: signupFormData.name, password: signupFormData.password }
    : {}),
});
```

Also update the `signupFormData` prop's doc-comment in the `OtpVerifyModeProps` interface - replace "name + password + workspace fields are added to the verifyOtp payload so the BE creates User + Workspace atomically" with "name + password are added to the verifyOtp payload so the BE creates the User".

- [ ] **Step 2: Lint**

Run: `pnpm exec eslint components/auth/modes/OtpVerifyMode.tsx`
Expected: no errors.

- [ ] **Step 3: Checkpoint** - owner commits: `refactor(connect): OtpVerifyMode sends no workspace`

## Task 4: `EmailOtpVerifyMode` - drop `workspace` from the register call

**Files:** Modify `components/auth/modes/EmailOtpVerifyMode.tsx`

- [ ] **Step 1: Remove `workspace` from the `registerAction` payload**

In `handleVerify`, current:

```ts
const res = await registerAction({
  name: signupFormData.name,
  email: signupFormData.email,
  password: signupFormData.password,
  workspace: signupFormData.workspace,
  emailOtp: value,
});
```

Replace with:

```ts
const res = await registerAction({
  name: signupFormData.name,
  email: signupFormData.email,
  password: signupFormData.password,
  emailOtp: value,
});
```

Also update the file doc-comment: the line "creates User + Workspace atomically, returns AuthResult" becomes "creates the User, returns AuthResult".

- [ ] **Step 2: Lint**

Run: `pnpm exec eslint components/auth/modes/EmailOtpVerifyMode.tsx`
Expected: no errors.

- [ ] **Step 3: Checkpoint** - owner commits: `refactor(connect): EmailOtpVerifyMode sends no workspace`

## Task 5: Drop `workspace` from the action + payload types

**Files:** Modify `lib/actions/auth.actions.ts`, `types/index.ts`

- [ ] **Step 1: `verifyOtp` action - remove the `workspace` field**

In `lib/actions/auth.actions.ts`, the `verifyOtp` function's payload parameter type has a `workspace?: { … }` block (with a doc-comment about "Web combined-signup payload"). Delete that entire `workspace?` property and its doc-comment from the parameter type. Leave `name?`, `password?`, `inviteToken?`, `flowType`, `mobile`, `otp` intact.

- [ ] **Step 2: `RegisterPayload` - remove `workspace`**

In `types/index.ts`, find the `RegisterPayload` interface. Remove its `workspace?` field (the nested workspace-fields object). Leave `name`, `email`/`mobile`, `password`, `emailOtp`, `inviteToken` intact.

(`RegisterPayload` is the web `register` action's payload type. If a `workspace` field is referenced nowhere else after Tasks 2-4, this is clean. If `tsc` in Step 3 flags another consumer, that consumer is also part of the dead workspace-signup path - report it as DONE_WITH_CONCERNS rather than guessing.)

- [ ] **Step 3: Lint + typecheck the two files**

Run: `pnpm exec eslint lib/actions/auth.actions.ts types/index.ts`
Expected: no errors.

- [ ] **Step 4: Checkpoint** - owner commits: `refactor(connect): drop workspace from web signup payloads`

## Task 6: `AuthClient` - entry-marker routing

**Files:** Modify `app/auth/AuthClient.tsx`

After a person-only signup the new `User` has no workspace. `doRedirect` already sends a workspace-less user to `/connect/home`. Wave A adds: when the user arrived via an ERP entry point (`/auth?for=erp`), route them instead to the guided workspace step.

- [ ] **Step 1: Derive the entry marker**

Inside `AuthClient`, just after `const params = useSearchParams();` is used (the component already calls `useSearchParams()`), add a derived constant near the top of the component body:

```ts
// Entry marker - an ERP landing page links to `/auth?for=erp`. It decides
// where a brand-new signup is routed: ERP entry → the guided workspace
// step; Connect / no marker → Connect (handled by doRedirect).
const forErp = params.get('for') === 'erp';
```

- [ ] **Step 2: Route ERP-entry signups to the workspace step**

In `handleAuthSuccess`, the web combined-signup branch currently is:

```ts
if (signupFormData) {
  // Variant 1 - web combined-signup. Clear the form data eagerly so
  // the password isn't held in memory longer than needed.
  setSignupFormData(null);
  setAuth(result.user, result.accessToken, result.refreshToken);
  await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
  doRedirect(result.user, result.mustResetPassword);
  return;
}
```

Replace with:

```ts
if (signupFormData) {
  // Person-only signup succeeded - the User has no workspace. Clear the
  // form data eagerly so the password isn't held in memory longer than
  // needed.
  setSignupFormData(null);
  setAuth(result.user, result.accessToken, result.refreshToken);
  await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
  // ERP entry → guided workspace step. Otherwise doRedirect sends a
  // workspace-less user to /connect/home.
  if (forErp) {
    router.replace('/auth/setup-workspace');
  } else {
    doRedirect(result.user, result.mustResetPassword);
  }
  return;
}
```

- [ ] **Step 3: Route the email signup branch the same way**

Further down in `handleAuthSuccess`, the email combined-signup is handled by the block:

```ts
if (result.isNewUser && signupFormData?.email) {
  setSignupFormData(null);
}
```

…which then falls through to the shared `setAuth` + `syncAuthCookie` + `doRedirect`. Replace that block with one that routes ERP-entry email signups to the workspace step:

```ts
if (result.isNewUser && signupFormData?.email) {
  setSignupFormData(null);
  setAuth(result.user, result.accessToken, result.refreshToken);
  await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
  if (forErp) {
    router.replace('/auth/setup-workspace');
  } else {
    doRedirect(result.user, result.mustResetPassword);
  }
  return;
}
```

(The shared `setAuth`/`syncAuthCookie`/`doRedirect` lines below this block continue to handle login + forgot flows unchanged.)

- [ ] **Step 4: Lint + typecheck**

Run: `pnpm exec eslint app/auth/AuthClient.tsx`
Expected: no errors.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(connect): entry-marker routing for person-only signup`

## Task 7: `RegisterWorkspaceMode` - skip name/password for an already-registered user

**Files:** Modify `components/auth/modes/RegisterWorkspaceMode.tsx`

A person-only-signup user routed to `/auth/setup-workspace` already has a name + password. `RegisterWorkspaceMode`'s `isOtpPath` heuristic (`!registerData.password`) would show optional name + password fields again. Add a prop to suppress them.

- [ ] **Step 1: Add the `hideAccountFields` prop**

In the `RegisterWorkspaceModeProps` interface, add:

```ts
  /**
   * True when the caller is already a registered user with a name + password
   * (e.g. the post-signup workspace step). Suppresses the inline name/password
   * fields that the legacy OTP-only path shows.
   */
  hideAccountFields?: boolean;
```

Destructure it in the component signature: `({ setMode, registerData, onAuthSuccess, hideAccountFields = false })`.

- [ ] **Step 2: Gate the inline name/password block**

The JSX block `{isOtpPath && ( <> <Form.Item name="name" …/> <Form.Item name="password" …/> </> )}` - change the condition to `{isOtpPath && !hideAccountFields && ( … )}`.

In `handleSubmit`, the two best-effort blocks guarded by `if (isOtpPath && vals.password)` and `if (isOtpPath && vals.name)` - change both conditions to `if (isOtpPath && !hideAccountFields && vals.password)` and `if (isOtpPath && !hideAccountFields && vals.name)` respectively (when the fields are hidden, `vals.name`/`vals.password` are undefined anyway, but the explicit guard documents intent and avoids a needless profile PATCH).

The `workspaceName` `Form.Item` has `autoFocus={!isOtpPath}` - change to `autoFocus={!isOtpPath || hideAccountFields}` so the workspace-name field is focused when the account fields are hidden.

- [ ] **Step 3: Lint**

Run: `pnpm exec eslint components/auth/modes/RegisterWorkspaceMode.tsx`
Expected: no errors.

- [ ] **Step 4: Checkpoint** - owner commits: `refactor(connect): RegisterWorkspaceMode can hide account fields`

## Task 8: `setup-workspace` page - pass `hideAccountFields`

**Files:** Modify `app/auth/setup-workspace/page.tsx`

- [ ] **Step 1: Pass the prop**

On the `<RegisterWorkspaceMode … />` element in `SetupWorkspacePage`, add the prop `hideAccountFields`:

```tsx
<RegisterWorkspaceMode
  setMode={setMode}
  identifier={user.mobile ?? user.email ?? ''}
  setIdentifier={() => {}}
  hideAccountFields
  registerData={{
    name: '',
    identifier: user.mobile ?? user.email ?? '',
    password: undefined,
  }}
  onAuthSuccess={async () => {
    router.replace('/dashboard');
  }}
  onSessionLimit={() => {}}
/>
```

- [ ] **Step 2: Lint**

Run: `pnpm exec eslint app/auth/setup-workspace/page.tsx`
Expected: no errors.

- [ ] **Step 3: Checkpoint** - owner commits: `refactor(connect): setup-workspace hides account fields`

## Task 9: i18n cleanup + full verification

**Files:** Modify `app/messages/en.json`, `app/messages/gu.json`, `app/messages/gu-en.json`, `app/messages/hi-en.json`

- [ ] **Step 1: Remove the now-unused signup workspace keys**

In each of the 4 locale files, inside the `auth.signup` object, delete the keys that Task 2 stopped using: `sectionWorkspace`, `workspaceName` (the whole nested object), and `location` (the whole nested object). Keep `sectionAccount`, `name`, `password`, `confirm`, `ownerNote`, `title`, `subtitle`, `sentTo`, `edit`, `editAriaMobile`, `editAriaEmail`, `back`, `submit`.

Do NOT touch the `auth.registerWorkspace.*` namespace - `RegisterWorkspaceMode` still uses it.

If `check:i18n` (Step 3) reports any of these keys missing-in-some-locale rather than present-everywhere, just ensure the deletion is applied identically in all 4 files.

- [ ] **Step 2: Lint the message files are valid JSON**

Run: `pnpm exec eslint app/messages/en.json`
Expected: no errors (valid JSON; trailing-comma clean).

- [ ] **Step 3: Full-wave verification**

Run each, expect a clean result:

- `pnpm exec tsc --noEmit` - no type errors.
- `pnpm run check:i18n` - note: there is a **pre-existing** failure for missing `auth.signup.*` / `profile.*` keys in gu/gu-en/hi-en unrelated to this wave; confirm this wave introduces no NEW missing keys (the keys removed in Step 1 must be removed from all 4 locales so they do not become a new mismatch).
- `pnpm exec next build` - compiles.

- [ ] **Step 4: Manual smoke test**

With the web dev server running:

1. `/auth` (no marker) → enter a new mobile → `SignupMode` shows **only** name/password/confirm (no workspace fields) → OTP → lands in Connect (`/connect/home`), no workspace created.
2. `/auth?for=erp` → new mobile → person-only signup → OTP → lands on `/auth/setup-workspace`, which shows the workspace form with **no** name/password fields → create workspace → `/dashboard`.
3. Repeat 1 with a new email address (the email-OTP path).
4. An existing ERP user with a workspace → login → still lands on `/dashboard` (unchanged).

- [ ] **Step 5: Checkpoint** - owner commits: `chore(connect): remove unused signup workspace i18n keys`

---

## Self-review (completed during planning)

- **Spec coverage:** spec §13 item 3 (person-only signup, drop forced workspace) = Tasks 1-5; item 4 (entry-marker routing + guided workspace step) = Tasks 6-8; the ERP runtime guard already exists in `DashboardLayout` (spec §5) - no task needed, covered by the Task 9 smoke test #2. ✓
- **Placeholders:** none - every step has exact code or an exact command. Task 5 Step 2 names a concrete fallback action (report DONE_WITH_CONCERNS) for the one genuinely unknowable cross-reference. ✓
- **Type consistency:** `SignupFormData` loses `workspace` in Task 1; every consumer (`SignupMode`, `OtpVerifyMode`, `EmailOtpVerifyMode`) is updated in Tasks 2-4; the action/payload types in Task 5 - `tsc` in Task 9 Step 3 is the cross-check. `hideAccountFields` is defined in Task 7 and consumed in Task 8 with the same name. ✓

## Out of scope (Wave B / later)

- The Connect policy/terms consent gate (a checkbox in `SignupMode`) - **Wave B**.
- Browse-first Connect / onboarding-on-action - **Wave B**.
- ERP-branded signup heading when `for=erp` - cosmetic; deferred (the routing is what matters).
- Removing the legacy `RegisterMode` / `register_workspace` mode - dead-path cleanup, not required for Wave A.
- Backend changes - none; the existing no-workspace `verify-otp` / `register` branch is the mechanism.
