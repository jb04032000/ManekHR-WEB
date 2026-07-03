# Intent-Routed Signup + Dual-Policy Flow Polish - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the post-/auth signup flow into an intent-routed experience: capture the product intent (Connect vs ERP) from the URL OR a new picker step, render product-distinct PolicyGate copy + product mark, fix the silent-fail signup acceptance path, and polish the OTP / PIN / PolicyGate screens with a compact post-/auth marketing rail.

**Architecture:** Single product `intent: 'connect' | 'erp' | null` derived in `AuthClient` from `?for=connect|erp`. Neutral entry (`null`) renders a new `IntentPicker` sub-step inside `SignupMode`. The existing dual-policy data model and accept endpoints stay unchanged. Failed signup-time acceptance retries once then logs to Sentry + PostHog; the layout PolicyGate remains the safety net with new product-distinct copy and a product mark.

**Tech Stack:** Next.js 16 App Router, React, TypeScript strict, AntD v6.3.2, Tailwind v4, next-intl (4 locales), Zustand, Sentry, PostHog. No backend changes.

**Spec:** `docs/connect/specs/2026-05-20-intent-routed-policy-flow-design.md`.

**Standing rule - owner runs every git operation.** The `git add` / `git commit` blocks in each task below describe the change the owner should stage and commit once they have reviewed the task. The implementer (subagent or inline executor) MUST NOT run `git add`, `git commit`, `git push`, or any other git mutation. Stage the edits in the working tree, surface a one-line summary, and stop - the owner runs the commit. This rule overrides any default behaviour from the executing skill.

---

## File structure

| File                                           | Action     | Responsibility                                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/auth/modes/IntentPicker.tsx`       | **Create** | Two-card product picker rendered as a sub-step of SignupMode when `intent === null`.                                                                                                                                                       |
| `components/auth/modes/SignupMode.tsx`         | **Modify** | Accept `intent` prop (rename from `forErp`). Render `<IntentPicker>` when `intent === null`. Keep the existing form (now called `<SignupForm>` inline render branch) for the non-null case. Add the "Starting in {product} [Change]" pill. |
| `components/auth/modes/types.ts`               | **Modify** | Add `SignupIntent` type if a shared type is useful (otherwise inline).                                                                                                                                                                     |
| `app/auth/AuthClient.tsx`                      | **Modify** | Derive `intent` from `?for=`. Pass into `SignupMode`. Replace silent `.catch(() => undefined)` on `accept*Policy` with one-shot retry + Sentry + PostHog. Use `effectiveIntent` (URL or picker) for the redirect branch.                   |
| `components/policy/PolicyGate.tsx`             | **Modify** | Add product mark label beside the lock icon, tighten spacing, demote sign-out to bottom-right utility link.                                                                                                                                |
| `components/auth/AuthCompactRail.tsx`          | **Create** | Compact marketing rail (brand + eyebrow + trust line) shared across PIN setup + PolicyGate.                                                                                                                                                |
| `app/auth/setup-pin/page.tsx`                  | **Modify** | Title row fix (single flex row), single fieldset around PIN + Confirm, body sentence + InfoTooltip, compact rail.                                                                                                                          |
| `components/auth/modes/OtpVerifyMode.tsx`      | **Modify** | Merge duplicate "code sent" lines; disable "Verify & create account" until 6 digits.                                                                                                                                                       |
| `components/auth/modes/EmailOtpVerifyMode.tsx` | **Modify** | Same merge + disabled-state CTA.                                                                                                                                                                                                           |
| `app/messages/en.json`                         | **Modify** | New `auth.signup.intent.*` keys. Revise `connect.policy.*` + `erp.policy.*` copy. New `auth.appLock.setupPin.tooltip` key.                                                                                                                 |
| `app/messages/gu.json`                         | **Modify** | Mirror en.                                                                                                                                                                                                                                 |
| `app/messages/gu-en.json`                      | **Modify** | Mirror en.                                                                                                                                                                                                                                 |
| `app/messages/hi-en.json`                      | **Modify** | Mirror en.                                                                                                                                                                                                                                 |

No backend files touched.

---

## Task 1: Add `SignupIntent` type + thread it through types.ts

**Files:**

- Modify: `components/auth/modes/types.ts`

- [ ] **Step 1: Read current types.ts to confirm shape**

Open `components/auth/modes/types.ts`. Confirm `BaseModeProps` / `SignupFormData` exports exist.

- [ ] **Step 2: Add SignupIntent type**

Add at the top of the exports section:

```ts
/**
 * Product intent at signup time - derived from the `?for=` URL query OR set
 * inside `<IntentPicker>` when the user enters /auth without an intent. `null`
 * means "no intent yet" and SignupMode renders the picker sub-step. The two
 * non-null values mirror the dual-policy products.
 */
export type SignupIntent = 'connect' | 'erp' | null;
```

- [ ] **Step 3: Commit**

```bash
git add components/auth/modes/types.ts
git commit -m "feat(auth): add SignupIntent type for intent-routed signup"
```

---

## Task 2: Create `IntentPicker` component

**Files:**

- Create: `components/auth/modes/IntentPicker.tsx`

- [ ] **Step 1: Author the component**

Create `components/auth/modes/IntentPicker.tsx`:

```tsx
'use client';

import { ArrowRightOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

/**
 * Product picker - the first sub-step of `<SignupMode>` when the URL carries
 * no `?for=` intent. Two large cards: Connect vs ERP. Picking one calls
 * `onPick(product)` so the parent can hand off to the existing signup form
 * with that product's T&C checkbox. Carries no own state (the parent owns
 * `localIntent`); a refresh re-renders this picker by design - there is no
 * silent default.
 *
 * Design spec: docs/connect/specs/2026-05-20-intent-routed-policy-flow-design.md §3.2.
 */
interface IntentPickerProps {
  onPick: (product: 'connect' | 'erp') => void;
}

interface CardProps {
  product: 'connect' | 'erp';
  title: string;
  description: string;
  onPick: (product: 'connect' | 'erp') => void;
  ariaLabel: string;
}

function ProductCard({ product, title, description, onPick, ariaLabel }: CardProps) {
  return (
    <button
      type="button"
      onClick={() => onPick(product)}
      aria-label={ariaLabel}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition hover:border-primary hover:shadow-md focus:border-primary focus:ring-2 focus:ring-primary/40 focus:outline-none"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/zari360-symbol.svg" alt="" aria-hidden className="h-6 w-6" />
        </span>
        <span className="font-display text-[17px] font-semibold text-heading">{title}</span>
        <ArrowRightOutlined className="ml-auto text-muted transition group-hover:text-primary" />
      </div>
      <p className="m-0 text-[13px] leading-relaxed text-muted">{description}</p>
    </button>
  );
}

export function IntentPicker({ onPick }: IntentPickerProps) {
  const t = useTranslations('auth.signup.intent');

  return (
    <section aria-labelledby="signup-intent-heading">
      <h1
        id="signup-intent-heading"
        className="m-0 mb-2 font-display text-2xl font-extrabold text-heading"
      >
        {t('title')}
      </h1>
      <p className="m-0 mb-6 text-[13px] leading-relaxed text-muted">{t('subtitle')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ProductCard
          product="connect"
          title={t('connect.title')}
          description={t('connect.desc')}
          onPick={onPick}
          ariaLabel={t('connect.title')}
        />
        <ProductCard
          product="erp"
          title={t('erp.title')}
          description={t('erp.desc')}
          onPick={onPick}
          ariaLabel={t('erp.title')}
        />
      </div>

      <p className="mt-5 text-[12px] text-subtle">{t('helper')}</p>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/auth/modes/IntentPicker.tsx
git commit -m "feat(auth): add IntentPicker sub-step for neutral-entry signup"
```

---

## Task 3: Refactor SignupMode to accept `intent` + render picker when null

**Files:**

- Modify: `components/auth/modes/SignupMode.tsx`

- [ ] **Step 1: Replace the `forErp` prop with `intent`**

In `SignupMode.tsx`, change the props interface:

```ts
import type { BaseModeProps, SignupFormData, SignupIntent } from './types';
import { IntentPicker } from './IntentPicker';

interface SignupModeProps extends BaseModeProps {
  mobile?: string;
  email?: string;
  onProceedToOtp?: (
    data: SignupFormData,
    sendResult: { resendCooldownSec: number; mockMode: boolean },
  ) => void;
  onProceedToEmailOtp?: (data: SignupFormData, sendResult: { resendCooldownSec: number }) => void;
  /**
   * Signup intent - `null` triggers the in-form `<IntentPicker>` sub-step.
   * Once non-null (URL-driven or user-picked), the form renders with that
   * product's consent checkbox + terms link.
   */
  intent: SignupIntent;
  /**
   * Lifts the picker selection out of SignupMode so `AuthClient` can compute
   * the `effectiveIntent` for redirect + policy-accept after auth success.
   * Called only from the picker; no-op for URL-driven intent.
   */
  onIntentPicked?: (product: 'connect' | 'erp') => void;
}
```

- [ ] **Step 2: Track local intent (parent's URL intent OR picker's choice)**

Inside the component body (right after `const t = useTranslations('auth')`):

```ts
import { useState } from 'react';

// ...
export function SignupMode({
  setMode,
  mobile,
  email,
  onProceedToOtp,
  onProceedToEmailOtp,
  intent,
  onIntentPicked,
}: SignupModeProps) {
  const t = useTranslations('auth');
  const [pickedIntent, setPickedIntent] = useState<'connect' | 'erp' | null>(null);
  const effectiveIntent: 'connect' | 'erp' | null = intent ?? pickedIntent;
  // ... rest unchanged below
```

- [ ] **Step 3: Render the picker branch**

Before the existing `return (<>` block, add the picker render:

```tsx
if (effectiveIntent === null) {
  return (
    <IntentPicker
      onPick={(product) => {
        setPickedIntent(product);
        onIntentPicked?.(product);
      }}
    />
  );
}
```

- [ ] **Step 4: Replace every `forErp` reference with `effectiveIntent === 'erp'`**

Inside the existing form's JSX, find every `forErp` and replace. Currently three places:

```tsx
// Consent checkbox rules:
rules={[
  {
    validator: (_, v: boolean) =>
      v
        ? Promise.resolve()
        : Promise.reject(
            new Error(t(effectiveIntent === 'erp' ? 'signup.policyErp.required' : 'signup.policy.required')),
          ),
  },
]}

// Checkbox label:
{t.rich(effectiveIntent === 'erp' ? 'signup.policyErp.label' : 'signup.policy.label', {
  terms: (chunks) => (
    <a
      href={effectiveIntent === 'erp' ? '/terms/erp' : '/terms/connect'}
      target="_blank"
      rel="noopener noreferrer"
    >
      {chunks}
    </a>
  ),
})}
```

- [ ] **Step 5: Insert the "Starting in {product} [Change]" pill**

Right above the existing `<h1>{t('signup.title')}</h1>`, insert:

```tsx
<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-[12px] text-muted">
  <span>
    {t.rich('signup.intent.changePill', {
      product: () => (
        <strong className="text-heading">
          {t(effectiveIntent === 'erp' ? 'signup.intent.erp.title' : 'signup.intent.connect.title')}
        </strong>
      ),
    })}
  </span>
  {intent === null && (
    // Only show "Change" when the user got here via the picker (URL-driven
    // intent has no picker to return to - it's the canonical signup link).
    <button
      type="button"
      onClick={() => setPickedIntent(null)}
      className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-medium text-primary hover:underline"
    >
      {t('signup.intent.change')}
    </button>
  )}
</div>
```

- [ ] **Step 6: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/auth/modes/SignupMode.tsx
git commit -m "feat(auth): SignupMode accepts intent + renders IntentPicker when null"
```

---

## Task 4: AuthClient - derive `intent` from URL + wire SignupMode

**Files:**

- Modify: `app/auth/AuthClient.tsx`

- [ ] **Step 1: Replace `forErp` derivation with `intent`**

Find:

```ts
// Entry marker - an ERP landing page links to `/auth?for=erp`. It decides
// where a brand-new signup is routed: ERP entry → the guided workspace
// step; Connect / no marker → Connect (handled by doRedirect).
const forErp = params.get('for') === 'erp';
```

Replace with:

```ts
// Entry marker - landing pages link to `/auth?for=connect` or `/auth?for=erp`
// to pin the signup intent. Absence triggers the in-form product picker (no
// silent default). The picker writes back via `onIntentPicked` so the
// `handleAuthSuccess` redirect branches on the same `effectiveIntent`.
import type { SignupIntent } from '@/components/auth/modes/types';

const urlIntent: SignupIntent =
  params.get('for') === 'erp' ? 'erp' : params.get('for') === 'connect' ? 'connect' : null;
const [pickedIntent, setPickedIntent] = useState<'connect' | 'erp' | null>(null);
const effectiveIntent: 'connect' | 'erp' | null = urlIntent ?? pickedIntent;
```

- [ ] **Step 2: Replace `forErp` branch in `handleAuthSuccess` (mobile/OTP path)**

Find (the signupFormData mobile branch):

```ts
if (forErp) {
  await acceptErpPolicy().catch(() => undefined);
} else {
  await acceptConnectPolicy().catch(() => undefined);
}
// ERP entry → guided workspace step. Otherwise doRedirect sends a
// workspace-less user to /connect/feed.
if (forErp) {
  router.replace('/auth/setup-workspace');
} else {
  doRedirect(result.user, result.mustResetPassword);
}
```

Replace with (Task 5 lands the retry/Sentry helper - for now keep the existing `.catch` shape; Task 5 swaps it):

```ts
const product = effectiveIntent ?? 'connect'; // post-OTP success implies a picked intent
if (product === 'erp') {
  await acceptErpPolicy().catch(() => undefined);
} else {
  await acceptConnectPolicy().catch(() => undefined);
}
if (product === 'erp') {
  router.replace('/auth/setup-workspace');
} else {
  doRedirect(result.user, result.mustResetPassword);
}
```

- [ ] **Step 3: Replace `forErp` branch in `handleAuthSuccess` (email path)**

Find the second `if (forErp)` block (email path, below the mobile branch). Apply the same replacement.

- [ ] **Step 4: Pass `intent` + `onIntentPicked` into SignupMode**

Find the `<SignupMode .../>` render block. Replace `forErp={forErp}` with:

```tsx
intent={effectiveIntent}
onIntentPicked={(p) => setPickedIntent(p)}
```

- [ ] **Step 5: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/auth/AuthClient.tsx
git commit -m "feat(auth): AuthClient derives signup intent from ?for= + picker"
```

---

## Task 5: AuthClient - reliable policy-accept (retry + Sentry + PostHog)

**Files:**

- Modify: `app/auth/AuthClient.tsx`

- [ ] **Step 1: Add the helper at module scope**

Inside `AuthClient.tsx`, above the component, add:

```ts
import * as Sentry from '@sentry/nextjs';
import { posthog } from '@/lib/posthog/client';

/**
 * Try a policy-accept once, retry once on failure (network blip recovery).
 * Still-failing → log to Sentry + emit a PostHog event so the eventual
 * PolicyGate-as-safety-net trip has an audit trail. Never throws - signup
 * redirect must always proceed; the layout gate is the safety net.
 *
 * Returns `true` on success, `false` on confirmed failure. Callers ignore
 * the return today; future flows may key on it.
 */
async function acceptPolicyWithRetry(
  product: 'connect' | 'erp',
  accept: () => Promise<{ ok: true } | { ok: false; error?: string }>,
  distinctId: string | null,
): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await accept();
      if (res.ok) return true;
      // Server returned { ok: false } - fall through to retry / log.
      if (attempt === 2) {
        Sentry.captureMessage('signup.acceptPolicy returned ok=false', {
          level: 'warning',
          tags: { module: 'auth', op: 'signup.acceptPolicy', product },
          extra: { error: res.error ?? null },
        });
      }
    } catch (err) {
      if (attempt === 2) {
        Sentry.captureException(err, {
          tags: { module: 'auth', op: 'signup.acceptPolicy', product },
        });
      }
    }
  }
  if (distinctId) {
    posthog.capture('auth.policy_accept_failed_at_signup', { product, distinctId });
  }
  return false;
}
```

If `@/lib/posthog/client` is the wrong import path for the PostHog instance, swap to whichever module exposes the client-side singleton (`grep -nE "posthog\.(capture|identify)" lib/` to find it). Keep the call signature identical.

- [ ] **Step 2: Swap the two `.catch(() => undefined)` accept calls to use the helper**

In `handleAuthSuccess`, mobile/OTP branch - replace:

```ts
if (product === 'erp') {
  await acceptErpPolicy().catch(() => undefined);
} else {
  await acceptConnectPolicy().catch(() => undefined);
}
```

with:

```ts
await acceptPolicyWithRetry(
  product,
  product === 'erp' ? acceptErpPolicy : acceptConnectPolicy,
  result.user?._id ?? null,
);
```

Apply the same swap in the email-path branch.

- [ ] **Step 3: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no errors. If `@sentry/nextjs` is not the configured import, swap to the existing project Sentry import path (`grep -n "from '@sentry" app/auth/`).

- [ ] **Step 4: Commit**

```bash
git add app/auth/AuthClient.tsx
git commit -m "fix(auth): retry + observe silent signup policy-accept failures"
```

---

## Task 6: PolicyGate - product mark + spacing + sign-out demotion

**Files:**

- Modify: `components/policy/PolicyGate.tsx`

- [ ] **Step 1: Add a product label below the icon**

Find the icon-circle block (the `<span>` containing the brand mark image). Wrap into a column so a typed product label sits below:

```tsx
<div className="mx-auto mb-6 flex flex-col items-center gap-2">
  <span
    className="flex h-20 w-20 items-center justify-center rounded-2xl"
    style={{
      background:
        product === 'connect' ? 'var(--cr-primary-light)' : 'var(--cr-wash, var(--cr-surface-2))',
    }}
  >
    {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
    <img src="/zari360-symbol.svg" alt="" aria-hidden className="h-11 w-11" />
  </span>
  <span className="font-display text-[12px] font-semibold tracking-[0.18em] text-muted uppercase">
    {t('productLabel')}
  </span>
</div>
```

(`productLabel` is a new i18n key added in Task 10: `"Zari360 Connect"` / `"Zari360 ERP"`.)

- [ ] **Step 2: Tighten spacing in the body**

Find:

```tsx
<h1 className="mt-4 font-display ...">{t('gateTitle')}</h1>
<p className="mt-3 ...">{t('gateBody')}</p>
<p className="mt-2 ...">
  <a href={cfg.terms} ...>{t('termsLink')}</a>
</p>
```

Replace with:

```tsx
<h1 className="mt-5 font-display text-[clamp(1.55rem,1rem+1.9vw,2.25rem)] font-semibold text-heading">
  {t('gateTitle')}
</h1>
<p className="mt-5 text-[15px] leading-relaxed text-muted">{t('gateBody')}</p>

<p className="mt-4 text-[14px]">
  <a
    href={cfg.terms}
    target="_blank"
    rel="noopener noreferrer"
    className="font-medium no-underline"
    style={{ color: 'var(--cr-primary)' }}
  >
    {t('termsLink')}
  </a>
</p>
```

- [ ] **Step 3: Demote sign-out to a utility link below the card**

Find the action stack:

```tsx
<div className="mt-6 flex flex-col items-center gap-3">
  <Button type="primary" size="large" loading={loading} onClick={handleAgree}>
    {t('agree')}
  </Button>
  <Button type="text" size="small" loading={signingOut} onClick={handleSignOut}>
    {t('signOut')}
  </Button>
</div>
```

Replace with:

```tsx
<div className="mt-8 flex flex-col items-center gap-3">
  <Button type="primary" size="large" loading={loading} onClick={handleAgree}>
    {t('agree')}
  </Button>
</div>;

{
  /* Utility link demoted out of the primary stack so it no longer competes
    with the agree CTA. Bottom-of-screen position mirrors AuthClient's
    bottom strip pattern. */
}
<div className="absolute right-6 bottom-6 text-[12px]">
  <button
    type="button"
    onClick={handleSignOut}
    disabled={signingOut}
    className="cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-heading"
  >
    {signingOut ? `${t('signOut')}…` : t('signOut')}
  </button>
</div>;
```

The outer container already centers everything; add `relative` to the outermost `<div>` so the absolute-positioned utility link anchors to it. Change:

```tsx
<div className="flex min-h-screen items-center justify-center bg-page px-6 py-10">
```

to:

```tsx
<div className="relative flex min-h-screen items-center justify-center bg-page px-6 py-10">
```

- [ ] **Step 4: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/policy/PolicyGate.tsx
git commit -m "feat(policy): product mark + tighter spacing + demote sign-out"
```

---

## Task 7: OtpVerifyMode + EmailOtpVerifyMode - copy + disabled CTA

**Files:**

- Modify: `components/auth/modes/OtpVerifyMode.tsx`
- Modify: `components/auth/modes/EmailOtpVerifyMode.tsx`

- [ ] **Step 1: Merge the duplicate "code sent" line in OtpVerifyMode**

Open `OtpVerifyMode.tsx`. Locate the two adjacent paragraphs rendering "We sent a 6-digit code…" - there are two `<p>` blocks under the title with overlapping copy. Replace both with one:

```tsx
<p className="m-0 mb-5 text-[13px] text-muted">
  {t.rich('otpVerify.sentTo', {
    target: () => <strong className="text-primary">{maskedMobile}</strong>,
    edit: () => (
      <button
        type="button"
        onClick={() => setMode('check')}
        className="ml-1 inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[12px] font-medium text-primary hover:underline"
        aria-label={t('otpVerify.editAria')}
      >
        <EditOutlined /> {t('otpVerify.edit')}
      </button>
    ),
  })}
</p>
```

Where `maskedMobile` is the existing local masked-mobile string used by the screen. Drop the redundant first paragraph entirely. (Use the existing `EditOutlined` import; add it if absent.)

- [ ] **Step 2: Disable the CTA until 6 digits typed**

Locate the OTP submit Button. Add a `disabled` prop tied to OTP length:

```tsx
<Button
  type="primary"
  htmlType="submit"
  size="large"
  loading={loading}
  disabled={otp.length !== 6}
  block
  className="h-[52px] font-semibold"
>
  {t('otpVerify.submit')}
</Button>
```

Where `otp` is the existing OTP-input state variable in the component.

- [ ] **Step 3: Mirror the same merge + disabled CTA into EmailOtpVerifyMode.tsx**

Open `EmailOtpVerifyMode.tsx`. Apply the same two-paragraph merge (use `t.rich('otpVerify.sentTo', { target: () => <strong>{email}</strong>, edit: () => ... })` with the email variable). Apply the same `disabled={otp.length !== 6}` on the Verify CTA.

- [ ] **Step 4: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/auth/modes/OtpVerifyMode.tsx components/auth/modes/EmailOtpVerifyMode.tsx
git commit -m "polish(auth): merge OTP 'code sent' lines + disable CTA until 6 digits"
```

---

## Task 8: PIN setup polish

**Files:**

- Modify: `app/auth/setup-pin/page.tsx`

- [ ] **Step 1: Replace the title row with a single flex row**

Find:

```tsx
<div className="mb-4 flex items-center gap-3">
  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
    <LockOutlined />
  </span>
  <h1 className="m-0 text-lg font-semibold text-heading">{t('title')}</h1>
</div>
```

Replace with (note `min-w-0` + `flex-wrap-disabled` strategy to keep on one row at 380px):

```tsx
<div className="mb-4 flex items-center gap-3">
  <span
    className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
    aria-hidden
  >
    <LockOutlined />
  </span>
  <h1 className="m-0 truncate font-display text-lg font-semibold text-heading">{t('title')}</h1>
  <InfoTooltip text={t('tooltip')} iconClassName="ml-1 text-[14px]" />
</div>
```

Add the import:

```ts
import { InfoTooltip } from '@/components/ui';
```

- [ ] **Step 2: Compress the body to one sentence**

Find:

```tsx
<p className="mb-5 text-sm text-muted">{t('subtitle')}</p>
```

Keep that single line. Move the "5 minutes / reopen the tab" detail out of `subtitle` and into the tooltip text - the i18n change lands in Task 10. The page-level JSX is now lighter.

- [ ] **Step 3: Wrap the two PIN inputs in a single fieldset**

Find the two `<label>` + `<PinInput>` blocks. Wrap both in a `<fieldset>` with a screen-reader-only legend:

```tsx
<fieldset className="m-0 border-0 p-0">
  <legend className="sr-only">{t('fieldsetLegend')}</legend>
  <div className="mb-2 flex items-center justify-between">
    <label className="block text-xs font-medium tracking-wide text-muted uppercase">
      {t('pinLabel')}
    </label>
    <button
      type="button"
      onClick={() => setReveal((r) => !r)}
      className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-heading"
      aria-label={reveal ? tCommon('hidePinAria') : tCommon('showPinAria')}
      aria-pressed={reveal}
    >
      {reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
      <span>{reveal ? tCommon('hidePin') : tCommon('showPin')}</span>
    </button>
  </div>
  <PinInput
    value={pin}
    onChange={setPin}
    autoFocus
    disabled={submitting}
    reveal={reveal}
    ariaLabel={t('pinLabel')}
  />

  <label className="mt-4 mb-2 block text-xs font-medium tracking-wide text-muted uppercase">
    {t('confirmLabel')}
  </label>
  <PinInput
    value={confirmPin}
    onChange={setConfirmPin}
    disabled={submitting}
    reveal={reveal}
    ariaLabel={t('confirmLabel')}
  />
</fieldset>
```

- [ ] **Step 4: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/auth/setup-pin/page.tsx
git commit -m "polish(auth): tighten PIN setup screen layout + tooltip"
```

---

## Task 9: Compact post-/auth rail + wire into PIN + PolicyGate

**Files:**

- Create: `components/auth/AuthCompactRail.tsx`
- Modify: `app/auth/setup-pin/page.tsx`
- Modify: `components/policy/PolicyGate.tsx`

- [ ] **Step 1: Author the compact rail component**

Create `components/auth/AuthCompactRail.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * Compact post-/auth marketing rail - brand mark + eyebrow line + trust
 * line. Replaces the full feature-list rail (used pre-account-creation in
 * `AuthClient`) on screens that come AFTER auth success: PIN setup and the
 * PolicyGate. Adds visual continuity so the user does not feel dropped into
 * a stark page after the OTP step.
 *
 * Mobile (< 1024 px) hides the rail entirely - same breakpoint as AuthClient.
 *
 * Design spec: docs/connect/specs/2026-05-20-intent-routed-policy-flow-design.md §3.4.4.
 */
export function AuthCompactRail() {
  const t = useTranslations('auth');

  return (
    <div
      className="auth-hero relative hidden w-[420px] flex-shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex"
      style={{
        background:
          'linear-gradient(160deg,var(--cr-primary) 0%,var(--cr-indigo-400) 60%,var(--cr-text) 100%)',
      }}
    >
      <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full border border-white/[0.12]" />
      <div className="absolute -bottom-15 -left-15 h-65 w-65 rounded-full border border-white/[0.1]" />
      <Link href="/" className="block no-underline" aria-label={t('hero.brand')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/zari360-reversed.svg" alt={t('hero.brand')} className="h-12 w-auto" />
      </Link>
      <div>
        <p className="mb-3 text-[12px] font-semibold tracking-[0.18em] text-[#C9A227] uppercase">
          {t('hero.eyebrow')}
        </p>
        <p className="text-[15px] leading-relaxed text-white/85">{t('hero.subheading')}</p>
      </div>
      <p className="text-[13px] tracking-wide text-white/70">{t('hero.trustLine')}</p>
    </div>
  );
}
```

- [ ] **Step 2: Wire the rail into PIN setup**

In `app/auth/setup-pin/page.tsx`, replace the outer wrapper:

```tsx
return (
  <div className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
    <div className="w-[min(440px,100%)] rounded-xl border border-border-light bg-surface p-7 shadow-md">
      ...
```

with a two-column shell:

```tsx
import { AuthCompactRail } from '@/components/auth/AuthCompactRail';

// ...

return (
  <div className="flex min-h-screen font-body">
    <AuthCompactRail />
    <div className="flex flex-1 items-center justify-center bg-page px-4 py-10">
      <div className="w-[min(440px,100%)] rounded-xl border border-border-light bg-surface p-7 shadow-md">
        {/* existing card contents unchanged */}
      </div>
    </div>
  </div>
);
```

- [ ] **Step 3: Wire the rail into PolicyGate**

In `components/policy/PolicyGate.tsx`, replace:

```tsx
<div className="relative flex min-h-screen items-center justify-center bg-page px-6 py-10">
  <div className="mx-auto w-full max-w-[560px] text-center">...</div>
</div>
```

with:

```tsx
import { AuthCompactRail } from '@/components/auth/AuthCompactRail';

// ...

return (
  <div className="flex min-h-screen font-body">
    <AuthCompactRail />
    <div className="relative flex flex-1 items-center justify-center bg-page px-6 py-10">
      <div className="mx-auto w-full max-w-[560px] text-center">
        {/* existing gate contents unchanged */}
      </div>
      {/* sign-out utility link block from Task 6 stays here */}
    </div>
  </div>
);
```

- [ ] **Step 4: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/auth/AuthCompactRail.tsx app/auth/setup-pin/page.tsx components/policy/PolicyGate.tsx
git commit -m "polish(auth): compact post-/auth rail on PIN setup + PolicyGate"
```

---

## Task 10: i18n - new + revised keys, all 4 locales

**Files:**

- Modify: `app/messages/en.json`
- Modify: `app/messages/gu.json`
- Modify: `app/messages/gu-en.json`
- Modify: `app/messages/hi-en.json`

- [ ] **Step 1: Add `auth.signup.intent.*` keys to en.json**

Inside `auth.signup` (sibling of `policy` / `policyErp` / `submit`), add:

```json
"intent": {
  "title": "Where are you starting?",
  "subtitle": "Pick how you want to use Zari360. You can use both later.",
  "helper": "This just decides where you land first. You can switch between Connect and ERP from your account at any time.",
  "changePill": "Starting in <product></product>",
  "change": "Change",
  "connect": {
    "title": "Zari360 Connect",
    "desc": "Your professional profile, network, marketplace and jobs."
  },
  "erp": {
    "title": "Zari360 ERP",
    "desc": "Run your workshop. Attendance, payroll, parties and invoices."
  }
}
```

- [ ] **Step 2: Revise `connect.policy.*` + `erp.policy.*` keys in en.json**

Replace the existing `erp.policy` block (top of file):

```json
"erp": {
  "policy": {
    "productLabel": "Zari360 ERP",
    "gateTitle": "Accept Zari360 ERP terms",
    "gateBody": "Review the Zari360 ERP terms to use attendance, payroll and your workshop tools.",
    "agree": "Agree and open ERP",
    "termsLink": "Read the Zari360 ERP terms",
    "signOut": "Sign out"
  }
}
```

Replace the existing `connect.policy` block:

```json
"policy": {
  "productLabel": "Zari360 Connect",
  "gateTitle": "Accept Zari360 Connect terms",
  "gateBody": "Review the Zari360 Connect terms to use your profile, network and marketplace.",
  "agree": "Agree and open Connect",
  "termsLink": "Read the Zari360 Connect terms",
  "signOut": "Sign out"
}
```

- [ ] **Step 3: Add the PIN tooltip key + fieldset legend + revised subtitle**

Inside `auth.appLock.setupPin` (sibling of the existing `title` / `subtitle` keys), find and replace:

```json
"subtitle": "Zari360 uses a 6-digit PIN to keep your account locked when you step away."
```

Add the two new keys alongside:

```json
"tooltip": "We ask for your PIN after 5 minutes of inactivity or whenever you reopen the tab.",
"fieldsetLegend": "Set your 6-digit App PIN"
```

- [ ] **Step 4: Add the OTP `sentTo` rich-text key**

Inside `auth.otpVerify` (or whichever namespace the existing OTP verify keys use - check the actual JSON path), add:

```json
"sentTo": "Code sent to <target></target> <edit></edit>",
"editAria": "Edit identifier",
"edit": "Edit"
```

If `edit` already exists in that namespace, leave it; only add the missing key(s).

- [ ] **Step 5: Mirror every above block in gu.json (Gujarati native script)**

Translate each new value into Gujarati. Examples (sanity-check translations against existing parallel keys in gu.json):

```json
"intent": {
  "title": "તમે ક્યાંથી શરૂઆત કરી રહ્યા છો?",
  "subtitle": "Zari360 નો ઉપયોગ કેવી રીતે કરવો તે પસંદ કરો. તમે પછી બંને વાપરી શકો છો.",
  "helper": "આ ફક્ત નક્કી કરે છે કે તમે પ્રથમ ક્યાં ઉતરો છો. તમે કોઈપણ સમયે તમારા ખાતામાંથી Connect અને ERP વચ્ચે સ્વિચ કરી શકો છો.",
  "changePill": "<product></product> માં શરૂ કરી રહ્યા છો",
  "change": "બદલો",
  "connect": {
    "title": "Zari360 Connect",
    "desc": "તમારી પ્રોફેશનલ પ્રોફાઇલ, નેટવર્ક, માર્કેટપ્લેસ અને જોબ્સ."
  },
  "erp": {
    "title": "Zari360 ERP",
    "desc": "તમારી વર્કશોપ ચલાવો. હાજરી, પગાર, પાર્ટીઓ અને ઇન્વોઇસ."
  }
}
```

And translate the revised policy blocks + PIN tooltip + OTP sentTo accordingly. No em-dashes (`-`) anywhere in `connect.*` / `erp.*` / `auth.*` copy.

- [ ] **Step 6: Mirror every above block in gu-en.json (Gujarati romanized)**

```json
"intent": {
  "title": "Tame kya thi shuruat kari rahya chho?",
  "subtitle": "Zari360 no upyog kevi rite karvo te pasand karo. Tame pachhi banne vapri shako chho.",
  "helper": "Aa fakt nakki kare chhe ke tame pratham kya utro chho. Tame koipan samaye tamara khata mathi Connect ane ERP vachche switch kari shako chho.",
  "changePill": "<product></product> ma shuru kari rahya chho",
  "change": "Badlo",
  "connect": {
    "title": "Zari360 Connect",
    "desc": "Tamari professional profile, network, marketplace ane jobs."
  },
  "erp": {
    "title": "Zari360 ERP",
    "desc": "Tamari workshop chalavo. Hajari, pagar, parties ane invoices."
  }
}
```

Mirror the rest.

- [ ] **Step 7: Mirror every above block in hi-en.json (Hindi romanized)**

```json
"intent": {
  "title": "Aap kahan se shuruat kar rahe hain?",
  "subtitle": "Zari360 ka upyog kaise karna hai chunein. Aap baad mein dono ka upyog kar sakte hain.",
  "helper": "Yeh sirf yeh tay karta hai ki aap pehle kahan utarte hain. Aap kabhi bhi apne account se Connect aur ERP ke beech switch kar sakte hain.",
  "changePill": "<product></product> mein shuru kar rahe hain",
  "change": "Badlein",
  "connect": {
    "title": "Zari360 Connect",
    "desc": "Aapki professional profile, network, marketplace aur jobs."
  },
  "erp": {
    "title": "Zari360 ERP",
    "desc": "Apni workshop chalayein. Haziri, salary, parties aur invoices."
  }
}
```

Mirror the rest.

- [ ] **Step 8: Verify i18n parity**

Run: `node scripts/check-i18n.js`
Expected: `OK - N keys present in en + gu / gu-en / hi-en catalogs.` (parity preserved).

- [ ] **Step 9: Commit**

```bash
git add app/messages/en.json app/messages/gu.json app/messages/gu-en.json app/messages/hi-en.json
git commit -m "feat(i18n): intent picker + product-distinct policy gate copy"
```

---

## Task 11: End-to-end verify

**Files:** none (verification only).

- [ ] **Step 1: TypeScript strict check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: ESLint on touched files**

Run:

```bash
npx eslint components/auth/modes/IntentPicker.tsx components/auth/modes/SignupMode.tsx components/auth/modes/OtpVerifyMode.tsx components/auth/modes/EmailOtpVerifyMode.tsx components/auth/AuthCompactRail.tsx components/auth/modes/types.ts app/auth/AuthClient.tsx app/auth/setup-pin/page.tsx components/policy/PolicyGate.tsx
```

Expected: clean (warnings on pre-existing files in the repo are out of scope).

- [ ] **Step 3: i18n parity check**

Run: `node scripts/check-i18n.js`
Expected: `OK`.

- [ ] **Step 4: Production build**

First clean any stale Next route cache (the renamed-route validator failed before):

```bash
rm -rf .next
npx next build
```

Expected: build succeeds; routes include `/auth`, `/auth/setup-pin`, `/auth/setup-workspace`, `/u/[slug]`.

- [ ] **Step 5: Manual responsive sweep at 380 / 768 / 1280 px**

Hit each surface in the local dev server and confirm visually:

1. `/auth` (no `?for=`): IntentPicker renders. Two cards stacked at 380 px, side-by-side at 768 px+.
2. `/auth?for=connect`: SignupMode renders form with Connect checkbox + "Starting in Zari360 Connect" pill (no Change link - URL-driven).
3. `/auth?for=erp`: SignupMode renders form with ERP checkbox + "Starting in Zari360 ERP" pill.
4. Pick Connect via the picker → form renders with Change link visible → click Change → picker returns.
5. Complete signup → OTP screen with merged "Code sent to …" line + disabled "Verify & create account" until 6 digits typed.
6. PIN setup screen - title row on one line at 380px, single fieldset, info tooltip on title, compact rail visible at 1280px.
7. Land on `/connect/feed` → no PolicyGate (signup accepted Connect).
8. Manually visit `/dashboard` → ERP PolicyGate fires with "Accept Zari360 ERP terms" + "Zari360 ERP" product label + compact rail on the left. Sign-out is bottom-right utility link, not in the primary stack.
9. Re-run all of the above in `gu`, `gu-en`, `hi-en` locales.

- [ ] **Step 6: Acceptance criteria walkthrough**

Open the spec (`docs/connect/specs/2026-05-20-intent-routed-policy-flow-design.md §5`). Tick each of the five criteria against the running build. If a criterion fails, dispatch a fix subagent for the specific gap; do not mark this task complete until all five pass.

- [ ] **Step 7: Commit (verification note - no code)**

```bash
git commit --allow-empty -m "chore(auth): intent-routed signup flow verified at 380/768/1280"
```

---

## Out of scope

- Real T&C content (admin policy module - separate work).
- Unified `GET /me/policy-status` endpoint (transitional debt; see dual-policy spec §8).
- Third product gate.
- Backend schema or endpoint changes.
- PIN setup product-awareness (App Lock is per-account; product-agnostic).
