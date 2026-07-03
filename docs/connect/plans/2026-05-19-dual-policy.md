# Dual-Policy Consent Model - Implementation Plan

> **STATUS - SHIPPED (2026-05-20).** Separate Connect + ERP policy acceptance
> (`connectPolicyAcceptedAt`, `erpPolicyAcceptedAt`), per-product `PolicyGate`,
> `/me/policy/erp-state` + accept endpoints - all live. Terms stubs at
> `/terms/connect` and `/terms/erp`. Preserved for history. See
> `docs/connect/PROGRESS.md` for the canonical record.

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Connect and ERP each their own policy, and gate every authenticated page
of each product behind a full-screen forced-acceptance gate until that product's policy
is accepted.

**Architecture:** Mirror the existing Wave B Connect policy. Add an `erpPolicyAcceptedAt`
field + two ERP `me/erp-*` endpoints. Move both products' consent gates from page-level
to the shell layout (`app/connect/layout.tsx`, `app/dashboard/layout.tsx`) so every route
is covered. One shared full-screen `PolicyGate` component serves both. Signup records the
entry product's policy by intent.

**Tech Stack:** NestJS + Mongoose (backend), Next.js 16 App Router + React 19 + AntD v6 +
next-intl (web). Spec: `docs/connect/specs/2026-05-19-dual-policy-design.md`.

**Worktrees:** web = `.worktrees/crewroster-web/zari360-connect`; backend =
`.worktrees/crewroster-backend/zari360-connect`. **Owner runs all git - the assistant
runs zero git commands.**

---

## File structure

**Backend** (`.worktrees/crewroster-backend/zari360-connect/`):

- Modify `src/modules/users/schemas/user.schema.ts` - add `erpPolicyAcceptedAt`.
- Modify `src/modules/users/users.service.ts` - `getErpPolicyState`, `acceptErpPolicy`.
- Create `src/modules/users/me-policy.controller.ts` - `GET me/erp-entry`, `POST me/erp-policy-accept`.
- Modify `src/modules/users/users.module.ts` - register the controller.
- Create `src/modules/users/__tests__/users.service.erp-policy.vitest.ts` - unit tests.

**Web** (`.worktrees/crewroster-web/zari360-connect/`):

- Create `features/policy/policy.actions.ts` - `getErpEntryState`, `acceptErpPolicy`.
- Create `components/policy/PolicyGate.tsx` - shared full-screen gate.
- Delete `features/connect/home/ConnectPolicyGate.tsx` - folded into `PolicyGate`.
- Rewrite `app/connect/layout.tsx` - gating server component.
- Rewrite `app/connect/home/page.tsx` - slimmed (entry branches now in the layout).
- Rewrite `app/dashboard/layout.tsx` - gating server component.
- Create `app/(marketing)/terms/connect/page.tsx` + `app/(marketing)/terms/erp/page.tsx`.
- Modify `components/auth/modes/SignupMode.tsx` - product-aware consent checkbox.
- Modify `app/auth/AuthClient.tsx` - pass `forErp`, record ERP vs Connect acceptance.
- Modify `app/messages/{en,gu,gu-en,hi-en}.json` - `erp.policy.*`, `terms.placeholder.*`,
  `connect.policy.signOut`, `auth.signup.policyErp.*`.

---

## Task 1: Backend - `erpPolicyAcceptedAt` schema field

**Files:**

- Modify: `src/modules/users/schemas/user.schema.ts`

- [ ] **Step 1: Add the field**

In `src/modules/users/schemas/user.schema.ts`, find the `connectPolicyAcceptedAt`
block and append the new field directly after it.

Replace:

```ts
  @Prop({ type: Date, default: null })
  connectPolicyAcceptedAt?: Date | null;
```

With:

```ts
  @Prop({ type: Date, default: null })
  connectPolicyAcceptedAt?: Date | null;

  /**
   * Zari360 ERP - timestamp the user accepted the ERP policy/terms.
   * Null/absent ⇒ not yet accepted; the ERP shell shows the consent gate.
   * Mirrors `connectPolicyAcceptedAt`; the future admin-synced policy module
   * consolidates both into one versioned record.
   */
  @Prop({ type: Date, default: null })
  erpPolicyAcceptedAt?: Date | null;
```

- [ ] **Step 2: Typecheck**

Run (in the backend worktree): `npx nest build`
Expected: builds clean (SWC typecheck - full `tsc` OOMs, do not use it).

---

## Task 2: Backend - `getErpPolicyState` + `acceptErpPolicy` service methods (TDD)

**Files:**

- Test: `src/modules/users/__tests__/users.service.erp-policy.vitest.ts` (create)
- Modify: `src/modules/users/users.service.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/users/__tests__/users.service.erp-policy.vitest.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Model } from 'mongoose';

// Stub @nestjs/mongoose BEFORE importing the service - it transitively imports
// the `User` schema, whose `@Prop()` decorators trip vitest's SWC reflect-
// metadata pipeline. The service is unit-tested with a plain mock model.
// Mirrors `connect-profile.service.vitest.ts`.
vi.mock('@nestjs/mongoose', () => {
  const noopDecorator = () => () => undefined;
  return {
    Prop: () => noopDecorator(),
    Schema: () => noopDecorator(),
    SchemaFactory: { createForClass: () => ({ index: () => undefined }) },
    InjectModel: () => () => undefined,
    getModelToken: (name: string) => `${name}Model`,
    MongooseModule: { forFeature: () => ({}) },
  };
});

import { UsersService } from '../users.service';
import type { User } from '../schemas/user.schema';

/**
 * Minimal `Model<User>` mock - supports `findById(...).select(...).lean().exec()`
 * and `updateOne(...).exec()`, the only builder chains the ERP-policy methods use.
 */
function mockUserModel(user: { erpPolicyAcceptedAt?: Date | null } | null): Model<User> {
  const chain = {
    select: vi.fn(() => chain),
    lean: vi.fn(() => chain),
    exec: () => Promise.resolve(user),
  };
  const updateChain = { exec: vi.fn(() => Promise.resolve({ modifiedCount: 1 })) };
  return {
    findById: vi.fn(() => chain),
    updateOne: vi.fn(() => updateChain),
  } as unknown as Model<User>;
}

const userId = '6a0a8f515ea9af111dd403bd';

describe('UsersService.getErpPolicyState', () => {
  it('reports erpPolicyAccepted=false when the field is unset', async () => {
    const svc = new UsersService(mockUserModel({ erpPolicyAcceptedAt: null }));
    await expect(svc.getErpPolicyState(userId)).resolves.toEqual({ erpPolicyAccepted: false });
  });

  it('reports erpPolicyAccepted=false when the user record is missing', async () => {
    const svc = new UsersService(mockUserModel(null));
    await expect(svc.getErpPolicyState(userId)).resolves.toEqual({ erpPolicyAccepted: false });
  });

  it('reports erpPolicyAccepted=true when erpPolicyAcceptedAt is stamped', async () => {
    const svc = new UsersService(mockUserModel({ erpPolicyAcceptedAt: new Date() }));
    await expect(svc.getErpPolicyState(userId)).resolves.toEqual({ erpPolicyAccepted: true });
  });
});

describe('UsersService.acceptErpPolicy', () => {
  it('returns the acceptedAt timestamp after stamping', async () => {
    const stampedAt = new Date('2026-05-19T10:00:00.000Z');
    const svc = new UsersService(mockUserModel({ erpPolicyAcceptedAt: stampedAt }));
    const result = await svc.acceptErpPolicy(userId);
    expect(result.acceptedAt).toBeInstanceOf(Date);
  });

  it('falls back to now when the user record is missing (idempotent)', async () => {
    const svc = new UsersService(mockUserModel(null));
    const result = await svc.acceptErpPolicy(userId);
    expect(result.acceptedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run the test - verify it fails**

Run: `npx vitest run src/modules/users/__tests__/users.service.erp-policy.vitest.ts --no-file-parallelism`
Expected: FAIL - `getErpPolicyState` / `acceptErpPolicy` are not functions.

- [ ] **Step 3: Implement the two methods**

In `src/modules/users/users.service.ts`, find the `updateFcmToken` method (the last
method in the class) and insert the two new methods directly before the class-closing
brace.

Replace:

```ts
  async updateFcmToken(id: string, fcmToken: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        $set: { fcmToken, fcmTokenUpdatedAt: new Date() },
      })
      .exec();
  }
}
```

With:

```ts
  async updateFcmToken(id: string, fcmToken: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        $set: { fcmToken, fcmTokenUpdatedAt: new Date() },
      })
      .exec();
  }

  /**
   * ERP policy-consent state for a user - `erpPolicyAccepted` is true once
   * `erpPolicyAcceptedAt` is stamped. Read by the ERP shell gate. Mirrors
   * `ConnectProfileService.getEntryState`'s policy read.
   */
  async getErpPolicyState(userId: string): Promise<{ erpPolicyAccepted: boolean }> {
    const user = await this.userModel
      .findById(userId)
      .select('erpPolicyAcceptedAt')
      .lean<{ erpPolicyAcceptedAt?: Date | null }>()
      .exec();
    return { erpPolicyAccepted: !!user?.erpPolicyAcceptedAt };
  }

  /**
   * Stamp the ERP policy/terms acceptance (idempotent - first write wins).
   * Mirrors `ConnectProfileService.acceptPolicy`.
   */
  async acceptErpPolicy(userId: string): Promise<{ acceptedAt: Date }> {
    const now = new Date();
    await this.userModel
      .updateOne(
        { _id: userId, erpPolicyAcceptedAt: { $in: [null, undefined] } },
        { $set: { erpPolicyAcceptedAt: now } },
      )
      .exec();
    const user = await this.userModel
      .findById(userId)
      .select('erpPolicyAcceptedAt')
      .lean<{ erpPolicyAcceptedAt?: Date | null }>()
      .exec();
    return { acceptedAt: user?.erpPolicyAcceptedAt ?? now };
  }
}
```

- [ ] **Step 4: Run the test - verify it passes**

Run: `npx vitest run src/modules/users/__tests__/users.service.erp-policy.vitest.ts --no-file-parallelism`
Expected: PASS - 5/5.

---

## Task 3: Backend - `me-policy.controller.ts` + module registration

**Files:**

- Create: `src/modules/users/me-policy.controller.ts`
- Modify: `src/modules/users/users.module.ts`

- [ ] **Step 1: Create the controller**

Create `src/modules/users/me-policy.controller.ts`:

```ts
import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PostHogService } from '../../common/posthog/posthog.service';
import { UsersService } from './users.service';

/** JWT payload shape populated by `JwtAuthGuard` - `sub` is the User id. */
type AuthedRequest = Request & { user: { sub: string } };

/**
 * `/me/erp-*` - the caller's ERP policy-consent surface.
 *
 * The ERP mirror of `connect/profile`'s `entry` + `policy-accept` endpoints.
 * `JwtAuthGuard` only - user-scoped, not workspace-scoped. The accept emits a
 * PostHog event (mirrors Connect's `acceptPolicy`, which is PostHog-only -
 * policy acceptance is a user self-action, not an admin write, so it is not
 * AuditService-logged). See docs/connect/specs/2026-05-19-dual-policy-design.md.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MePolicyController {
  constructor(
    private readonly usersService: UsersService,
    private readonly postHog: PostHogService,
  ) {}

  /** ERP policy-consent state - drives the ERP shell's server-side gate. */
  @Get('erp-entry')
  getErpEntry(@Req() req: AuthedRequest) {
    return this.usersService.getErpPolicyState(req.user.sub);
  }

  /** Record the caller's one-time ERP policy/terms acceptance. */
  @Post('erp-policy-accept')
  async acceptErpPolicy(@Req() req: AuthedRequest) {
    const res = await this.usersService.acceptErpPolicy(req.user.sub);
    this.postHog.capture({
      distinctId: req.user.sub,
      event: 'erp.policy_accepted',
      properties: {},
    });
    return res;
  }
}
```

- [ ] **Step 2: Register the controller**

In `src/modules/users/users.module.ts`:

Replace:

```ts
import { UsersController } from './users.controller';
```

With:

```ts
import { UsersController } from './users.controller';
import { MePolicyController } from './me-policy.controller';
```

Replace:

```ts
  controllers: [UsersController],
```

With:

```ts
  controllers: [UsersController, MePolicyController],
```

- [ ] **Step 3: Verify backend**

Run (backend worktree):

- `npx nest build` - Expected: builds clean.
- `npx eslint src/modules/users` - Expected: no errors.
- `npx vitest run src/modules/users --no-file-parallelism` - Expected: all pass.

---

## Task 4: Web - `policy.actions.ts` server actions

**Files:**

- Create: `features/policy/policy.actions.ts`

- [ ] **Step 1: Create the actions file**

Create `features/policy/policy.actions.ts`:

```ts
'use server';

/**
 * ERP policy - server actions. The ERP mirror of the Connect policy actions
 * in `features/connect/profile.actions.ts`. Calls the backend `me/erp-*`
 * endpoints through the httpOnly-cookie-authed `serverHttp` client.
 * See docs/connect/specs/2026-05-19-dual-policy-design.md.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

/**
 * ERP policy-consent state for the caller. Read by the ERP shell layout
 * (`app/dashboard/layout.tsx`) to decide whether to show the policy gate.
 * The layout fails open on `{ ok: false }` - see the spec §4.3.
 */
export async function getErpEntryState(): Promise<Result<{ erpPolicyAccepted: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/erp-entry');
    return { ok: true, data: unwrapServer<{ erpPolicyAccepted: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Record the caller's one-time ERP policy/terms acceptance. */
export async function acceptErpPolicy(): Promise<Result<{ acceptedAt: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/me/erp-policy-accept', {});
    return { ok: true, data: unwrapServer<{ acceptedAt: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

- [ ] **Step 2: Typecheck**

Run (web worktree): `npx tsc --noEmit`
Expected: clean. (`serverHttp` / `unwrapServer` are the same imports `features/connect/profile.actions.ts` uses - confirm the import path resolves.)

---

## Task 5: Web - i18n keys (4 locales)

**Files:**

- Modify: `app/messages/en.json`, `app/messages/gu.json`, `app/messages/gu-en.json`,
  `app/messages/hi-en.json`

Each file gets three edits: (A) two new top-level namespaces `erp` + `terms` inserted
before `common`; (B) a `signOut` key added to `connect.policy`; (C) a `policyErp` block
added to `auth.signup`. All copy is generic - no policy text, no em-dashes.

- [ ] **Step 1: `app/messages/en.json`**

Edit A - replace:

```
  "common": {
    "loading":
```

With:

```
  "erp": {
    "policy": {
      "gateTitle": "One quick step before you continue",
      "gateBody": "Please review and accept the Zari360 terms to continue.",
      "agree": "Agree and continue",
      "termsLink": "Zari360 terms",
      "signOut": "Sign out"
    }
  },
  "terms": {
    "placeholder": {
      "title": "Terms",
      "body": "The full {product} terms will be published here soon."
    }
  },
  "common": {
    "loading":
```

Edit B - replace:

```
      "agree": "Agree and continue",
      "termsLink": "Connect terms"
    },
```

With:

```
      "agree": "Agree and continue",
      "termsLink": "Connect terms",
      "signOut": "Sign out"
    },
```

Edit C - replace:

```
        "required": "Please accept the Connect terms to continue."
      }
    },
```

With:

```
        "required": "Please accept the Connect terms to continue."
      },
      "policyErp": {
        "label": "I agree to the <terms>Zari360 terms</terms>.",
        "required": "Please accept the Zari360 terms to continue."
      }
    },
```

- [ ] **Step 2: `app/messages/gu.json`**

Edit A - replace `  "common": {\n    "loading":` with:

```
  "erp": {
    "policy": {
      "gateTitle": "ચાલુ રાખતા પહેલાં એક ઝડપી પગલું",
      "gateBody": "Zari360 ની શરતો વાંચો અને ચાલુ રાખવા સ્વીકૃતિ આપો.",
      "agree": "સંમત છું, ચાલુ રાખો",
      "termsLink": "Zari360 ની શરતો",
      "signOut": "સાઇન આઉટ"
    }
  },
  "terms": {
    "placeholder": {
      "title": "શરતો",
      "body": "સંપૂર્ણ {product} શરતો ટૂંક સમયમાં અહીં પ્રકાશિત થશે."
    }
  },
  "common": {
    "loading":
```

Edit B - replace:

```
      "agree": "સંમત છું, ચાલુ રાખો",
      "termsLink": "Connect ની શરતો"
    },
```

With:

```
      "agree": "સંમત છું, ચાલુ રાખો",
      "termsLink": "Connect ની શરતો",
      "signOut": "સાઇન આઉટ"
    },
```

Edit C - replace:

```
        "required": "ચાલુ રાખવા Connect ની શરતો સ્વીકારો."
      }
    },
```

With:

```
        "required": "ચાલુ રાખવા Connect ની શરતો સ્વીકારો."
      },
      "policyErp": {
        "label": "હું <terms>Zari360 ની શરતો</terms> સ્વીકારું છું.",
        "required": "ચાલુ રાખવા Zari360 ની શરતો સ્વીકારો."
      }
    },
```

- [ ] **Step 3: `app/messages/gu-en.json`**

Edit A - replace `  "common": {\n    "loading":` with:

```
  "erp": {
    "policy": {
      "gateTitle": "Continue karta pehla ek nanu paglu",
      "gateBody": "Zari360 ni sharto vaanchi ne aage vadha mate sammati apo.",
      "agree": "Sammati, continue karo",
      "termsLink": "Zari360 ni sharto",
      "signOut": "Sign out"
    }
  },
  "terms": {
    "placeholder": {
      "title": "Sharto",
      "body": "Sampoorna {product} sharto jaldi ahiya publish thashe."
    }
  },
  "common": {
    "loading":
```

Edit B - replace:

```
      "agree": "Sammati, continue karo",
      "termsLink": "Connect ni sharto"
    },
```

With:

```
      "agree": "Sammati, continue karo",
      "termsLink": "Connect ni sharto",
      "signOut": "Sign out"
    },
```

Edit C - replace:

```
        "required": "Continue karva Connect ni sharto swikaro."
      }
    },
```

With:

```
        "required": "Continue karva Connect ni sharto swikaro."
      },
      "policyErp": {
        "label": "Hu <terms>Zari360 ni sharto</terms> swikaru chhu.",
        "required": "Continue karva Zari360 ni sharto swikaro."
      }
    },
```

- [ ] **Step 4: `app/messages/hi-en.json`**

Edit A - replace `  "common": {\n    "loading":` with:

```
  "erp": {
    "policy": {
      "gateTitle": "Aage badhne se pehle ek chhota sa kadam",
      "gateBody": "Zari360 ki sharten padhein aur aage badhne ke liye sahmati dein.",
      "agree": "Sahmati dein, aage badhen",
      "termsLink": "Zari360 ki sharten",
      "signOut": "Sign out"
    }
  },
  "terms": {
    "placeholder": {
      "title": "Sharten",
      "body": "Poori {product} sharten jaldi yahan publish hongi."
    }
  },
  "common": {
    "loading":
```

Edit B - replace:

```
      "agree": "Sahmati dein, aage badhen",
      "termsLink": "Connect ki sharten"
    },
```

With:

```
      "agree": "Sahmati dein, aage badhen",
      "termsLink": "Connect ki sharten",
      "signOut": "Sign out"
    },
```

Edit C - replace:

```
        "required": "Aage badhne ke liye Connect ki sharten sweekar karein."
      }
    },
```

With:

```
        "required": "Aage badhne ke liye Connect ki sharten sweekar karein."
      },
      "policyErp": {
        "label": "Main <terms>Zari360 ki sharten</terms> maanta hoon.",
        "required": "Aage badhne ke liye Zari360 ki sharten sweekar karein."
      }
    },
```

- [ ] **Step 5: Verify the JSON + key parity**

Run (web worktree): `node scripts/check-i18n.js`
Expected: the four new key paths (`erp.policy.*`, `terms.placeholder.*`,
`connect.policy.signOut`, `auth.signup.policyErp.*`) are present and consistent across
all four locales. NOTE: a PRE-EXISTING failure for unrelated `auth.signup.*` / `profile.*`
keys missing in the non-`en` locales may still be reported - confirm this task adds NO
new flagged keys; do not fix the pre-existing failure here.

---

## Task 6: Web - shared `PolicyGate` component

**Files:**

- Create: `components/policy/PolicyGate.tsx`

- [ ] **Step 1: Create the component**

Create `components/policy/PolicyGate.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { acceptConnectPolicy } from '@/features/connect/profile.actions';
import { acceptErpPolicy } from '@/features/policy/policy.actions';
import { logout } from '@/lib/actions/auth.actions';
import { useAuthStore } from '@/lib/store';

type PolicyProduct = 'connect' | 'erp';

/**
 * Per-product config - the i18n namespace, the (public, un-gated) terms-page
 * route, and the accept server action.
 */
const PRODUCT = {
  connect: { ns: 'connect.policy', terms: '/terms/connect', accept: acceptConnectPolicy },
  erp: { ns: 'erp.policy', terms: '/terms/erp', accept: acceptErpPolicy },
} as const;

/**
 * Full-screen policy-consent gate. Rendered by `app/connect/layout.tsx` /
 * `app/dashboard/layout.tsx` INSTEAD of the product shell when the caller has
 * not accepted that product's policy - so it covers every authenticated route
 * of the product, with no nav chrome to click around it. Accepting stamps the
 * backend then refreshes the server tree so the layout re-runs and the real
 * shell renders. The gate carries NO policy text - only the consent action
 * and a link to the (separate) terms page.
 * See docs/connect/specs/2026-05-19-dual-policy-design.md §4.4.
 */
export default function PolicyGate({ product }: { product: PolicyProduct }) {
  const cfg = PRODUCT[product];
  const t = useTranslations(cfg.ns);
  const router = useRouter();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const storeLogout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgree() {
    setLoading(true);
    setError(null);
    const res = await cfg.accept();
    if (res.ok) {
      // The layout re-runs on refresh; the gate clears, the real shell renders.
      router.refresh();
      return;
    }
    setLoading(false);
    setError(res.error || 'Something went wrong. Please try again.');
  }

  async function handleSignOut() {
    setSigningOut(true);
    if (refreshToken) await logout(refreshToken).catch(() => undefined);
    storeLogout();
    router.replace('/auth');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-6 py-10">
      <div className="mx-auto w-full max-w-[560px] text-center">
        <span
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: 'var(--cr-primary-light)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
          <img src="/zari360-symbol.svg" alt="" aria-hidden className="h-11 w-11" />
        </span>

        <h1 className="mt-4 font-display text-[clamp(1.55rem,1rem+1.9vw,2.25rem)] font-semibold text-heading">
          {t('gateTitle')}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{t('gateBody')}</p>

        <p className="mt-2 text-[14px]">
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

        {error && (
          <p
            className="mt-3 text-[13px]"
            style={{ color: 'var(--cr-error, #d32f2f)' }}
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button type="primary" size="large" loading={loading} onClick={handleAgree}>
            {t('agree')}
          </Button>
          <Button type="text" size="small" loading={signingOut} onClick={handleSignOut}>
            {t('signOut')}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (web worktree): `npx tsc --noEmit`
Expected: clean. If `useTranslations(cfg.ns)` is rejected because next-intl strict-types
the namespace against a union literal, the implementer may type `cfg.ns` as `string`
where passed - but try the union first; a union of two valid namespaces is normally
assignable.

---

## Task 7: Web - Connect shell gate (layout) + slim the home page

**Files:**

- Rewrite: `app/connect/layout.tsx`
- Rewrite: `app/connect/home/page.tsx`
- Delete: `features/connect/home/ConnectPolicyGate.tsx`

The Connect entry branching (locked / authFailed / connectEnabled / policy) moves from
`app/connect/home/page.tsx` UP into `app/connect/layout.tsx`, so it covers every
`/connect/*` route. `connectEnabled` MUST be checked before `policyAccepted` - the
backend reports `policyAccepted: false` for a not-enabled user, so a not-enabled user
must see "coming soon", never the policy gate.

- [ ] **Step 1: Rewrite the Connect layout**

Overwrite `app/connect/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getConnectEntryState } from '@/features/connect/profile.actions';
import ConnectComingSoon from '@/features/connect/home/ConnectComingSoon';
import ConnectLockedEntry from '@/features/connect/home/ConnectLockedEntry';
import PolicyGate from '@/components/policy/PolicyGate';

export const metadata: Metadata = {
  title: { template: '%s | Zari360', default: 'Connect' },
  description:
    'Zari360 Connect - the marketplace, jobs and professional network for the embroidery industry.',
};

/**
 * Connect shell layout - the single chokepoint for every authenticated
 * `/connect/*` route. Gates entry server-side: a locked session sees the PIN
 * screen, a signed-out session is routed to sign-in, a not-enabled user sees
 * the "coming soon" panel, and a user who has not accepted the Connect policy
 * is held at the full-screen `PolicyGate` before any Connect page renders.
 * Each gate state renders WITHOUT `DashboardLayout` (no nav chrome to click
 * around). See docs/connect/specs/2026-05-19-dual-policy-design.md §4.3.
 *
 * `connectEnabled` is not in the JWT, so the check is a backend call.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const entryRes = await getConnectEntryState();

  if (!entryRes.ok) {
    // App-Locked session (423) - show the PIN unlock screen.
    if (entryRes.locked) return <ConnectLockedEntry />;
    // Genuinely signed out - a 401 that survived the refresh-retry. Route to
    // sign-in. NEVER the "coming soon" panel: a revoked token is not a missing
    // `connectEnabled` flag.
    if (entryRes.authFailed) redirect('/auth?redirect=/connect/home');
    // Any other failure - surface via the route error boundary (./error.tsx).
    throw new Error(entryRes.error || 'Failed to load Connect.');
  }

  const entry = entryRes.data;
  if (!entry.connectEnabled) return <ConnectComingSoon />;
  // Forced policy consent - must come AFTER connectEnabled (a not-enabled user
  // also reports policyAccepted=false; they get "coming soon", not the gate).
  if (!entry.policyAccepted) return <PolicyGate product="connect" />;

  return <DashboardLayout mode="connect">{children}</DashboardLayout>;
}
```

- [ ] **Step 2: Slim the Connect home page**

Overwrite `app/connect/home/page.tsx` with:

```tsx
import { getFeaturedWorkshops, getMyConnectProfile } from '@/features/connect/profile.actions';
import Day1Home from '@/features/connect/home/Day1Home';

/**
 * `/connect/home` - the Connect Day-1 home. Connect access, App-Lock, policy
 * consent and the "coming soon" branch are all handled one level up in
 * `app/connect/layout.tsx` (the shell gate), so this page only loads the
 * home's data. Browse-first: a not-onboarded user is NOT forced into
 * onboarding here; onboarding is triggered later by the first participatory
 * action (see the feed).
 */
export default async function ConnectHomePage() {
  const [profileRes, workshopsRes] = await Promise.all([
    getMyConnectProfile(),
    getFeaturedWorkshops(),
  ]);

  return (
    <Day1Home
      profile={profileRes.ok ? profileRes.data : null}
      featuredWorkshops={workshopsRes.ok ? workshopsRes.data : []}
    />
  );
}
```

- [ ] **Step 3: Delete the old page-level gate**

First confirm nothing else imports it:
Run: `grep -rl "ConnectPolicyGate" --include=*.tsx --include=*.ts .` (web worktree)
Expected: only `features/connect/home/ConnectPolicyGate.tsx` itself remains (the
`app/connect/home/page.tsx` import was removed in Step 2). If any other importer
exists, stop and report it.

Then delete the file: `features/connect/home/ConnectPolicyGate.tsx`.

- [ ] **Step 4: Typecheck**

Run (web worktree): `npx tsc --noEmit`
Expected: clean.

---

## Task 8: Web - ERP shell gate (layout)

**Files:**

- Rewrite: `app/dashboard/layout.tsx`

- [ ] **Step 1: Rewrite the ERP layout**

Overwrite `app/dashboard/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PolicyGate from '@/components/policy/PolicyGate';
import { getErpEntryState } from '@/features/policy/policy.actions';

export const metadata: Metadata = {
  title: { template: '%s | Zari360', default: 'Dashboard' },
  description: 'Zari360 - manage your crew, attendance, payroll and operations in one place.',
};

/**
 * ERP shell layout - the single chokepoint for every authenticated
 * `/dashboard/*` route. A user who has not accepted the ERP policy is held at
 * the full-screen `PolicyGate` before any ERP page renders.
 *
 * The gate FAILS OPEN: any error (App-Locked 423, signed-out 401, backend
 * unreachable) renders the shell and lets ERP's own client-side App-Lock /
 * auth handling take over - a transient policy-check failure must not
 * white-screen the whole ERP. The gate blocks ONLY on a clean backend
 * response that explicitly says the ERP policy is unaccepted.
 * See docs/connect/specs/2026-05-19-dual-policy-design.md §4.3.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const res = await getErpEntryState();
  if (res.ok && res.data.erpPolicyAccepted === false) {
    return <PolicyGate product="erp" />;
  }
  return <DashboardLayout mode="erp">{children}</DashboardLayout>;
}
```

- [ ] **Step 2: Typecheck**

Run (web worktree): `npx tsc --noEmit`
Expected: clean.

---

## Task 9: Web - terms placeholder pages

**Files:**

- Create: `app/(marketing)/terms/connect/page.tsx`
- Create: `app/(marketing)/terms/erp/page.tsx`

Both live under the public `(marketing)` route group so they are NOT behind either
product gate (a user at the gate must be able to open the terms in a new tab).

- [ ] **Step 1: Create the Connect terms page**

Create `app/(marketing)/terms/connect/page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server';

/**
 * Connect terms - placeholder. The full, versioned policy content ships with
 * the admin-synced policy module. This page exists so the `PolicyGate` and the
 * signup consent checkbox have a real, un-gated, public link target.
 */
export default async function ConnectTermsPage() {
  const t = await getTranslations('terms.placeholder');
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-heading">{t('title')}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {t('body', { product: 'Connect' })}
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Create the ERP terms page**

Create `app/(marketing)/terms/erp/page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server';

/**
 * ERP (Zari360) terms - placeholder. See `terms/connect/page.tsx`.
 */
export default async function ErpTermsPage() {
  const t = await getTranslations('terms.placeholder');
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-heading">{t('title')}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {t('body', { product: 'Zari360' })}
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run (web worktree): `npx tsc --noEmit`
Expected: clean. If the existing `app/(marketing)/*` pages use a server i18n helper other
than `getTranslations` from `next-intl/server`, mirror that helper instead.

---

## Task 10: Web - product-aware signup consent checkbox

**Files:**

- Modify: `components/auth/modes/SignupMode.tsx`

- [ ] **Step 1: Add the `forErp` prop**

In `components/auth/modes/SignupMode.tsx`, in the `SignupModeProps` interface, add the
prop. Replace:

```ts
  /** Email path. Required when channel='email'. */
  onProceedToEmailOtp?: (data: SignupFormData, sendResult: { resendCooldownSec: number }) => void;
}
```

With:

```ts
  /** Email path. Required when channel='email'. */
  onProceedToEmailOtp?: (data: SignupFormData, sendResult: { resendCooldownSec: number }) => void;
  /**
   * ERP-entry signup (`/auth?for=erp`). Switches the consent checkbox to the
   * ERP policy; default (Connect front door) keeps the Connect policy.
   */
  forErp?: boolean;
}
```

- [ ] **Step 2: Destructure the prop**

Replace:

```ts
export function SignupMode({
  setMode,
  mobile,
  email,
  onProceedToOtp,
  onProceedToEmailOtp,
}: SignupModeProps) {
```

With:

```ts
export function SignupMode({
  setMode,
  mobile,
  email,
  onProceedToOtp,
  onProceedToEmailOtp,
  forErp = false,
}: SignupModeProps) {
```

- [ ] **Step 3: Make the consent checkbox product-aware**

Replace the entire `policyAccepted` `Form.Item`:

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

With:

```tsx
<Form.Item
  name="policyAccepted"
  valuePropName="checked"
  rules={[
    {
      validator: (_, v: boolean) =>
        v
          ? Promise.resolve()
          : Promise.reject(
              new Error(t(forErp ? 'signup.policyErp.required' : 'signup.policy.required')),
            ),
    },
  ]}
>
  <Checkbox>
    {t.rich(forErp ? 'signup.policyErp.label' : 'signup.policy.label', {
      terms: (chunks) => (
        <a
          href={forErp ? '/terms/erp' : '/terms/connect'}
          target="_blank"
          rel="noopener noreferrer"
        >
          {chunks}
        </a>
      ),
    })}
  </Checkbox>
</Form.Item>
```

- [ ] **Step 4: Typecheck**

Run (web worktree): `npx tsc --noEmit`
Expected: clean.

---

## Task 11: Web - `AuthClient` records the entry product's policy

**Files:**

- Modify: `app/auth/AuthClient.tsx`

- [ ] **Step 1: Import the ERP accept action**

Replace:

```ts
import { acceptConnectPolicy } from '@/features/connect/profile.actions';
```

With:

```ts
import { acceptConnectPolicy } from '@/features/connect/profile.actions';
import { acceptErpPolicy } from '@/features/policy/policy.actions';
```

- [ ] **Step 2: Record ERP vs Connect acceptance - mobile signup path**

In `handleAuthSuccess`, in the `signupFormData` (mobile) branch, replace:

```ts
// Connect-entry signups consented via the SignupMode checkbox - record
// it. Best-effort: a failed write must not block the redirect (the
// /connect entry policy gate re-prompts if this did not land).
if (!forErp) {
  await acceptConnectPolicy().catch(() => undefined);
}
```

With:

```ts
// Signup consented via the SignupMode checkbox - record the entry
// product's policy. Best-effort: a failed write must not block the
// redirect (the product's policy gate re-prompts if this did not land).
if (forErp) {
  await acceptErpPolicy().catch(() => undefined);
} else {
  await acceptConnectPolicy().catch(() => undefined);
}
```

- [ ] **Step 3: Record ERP vs Connect acceptance - email signup path**

In the `signupFormData?.email` branch, replace the identical block:

```ts
// Connect-entry signups consented via the SignupMode checkbox - record
// it. Best-effort: a failed write must not block the redirect (the
// /connect entry policy gate re-prompts if this did not land).
if (!forErp) {
  await acceptConnectPolicy().catch(() => undefined);
}
```

With:

```ts
// Signup consented via the SignupMode checkbox - record the entry
// product's policy. Best-effort: a failed write must not block the
// redirect (the product's policy gate re-prompts if this did not land).
if (forErp) {
  await acceptErpPolicy().catch(() => undefined);
} else {
  await acceptConnectPolicy().catch(() => undefined);
}
```

- [ ] **Step 4: Pass `forErp` to `SignupMode`**

In the `mode === 'signup'` render block, add the `forErp` prop to `<SignupMode>`.
Replace:

```tsx
                      <SignupMode
                        setMode={setMode}
                        identifier={identifier}
                        setIdentifier={setIdentifier}
                        mobile={isEmail ? undefined : identifier.replace(/[\s-]/g, '')}
                        email={isEmail ? identifier.trim() : undefined}
```

With:

```tsx
                      <SignupMode
                        setMode={setMode}
                        identifier={identifier}
                        setIdentifier={setIdentifier}
                        forErp={forErp}
                        mobile={isEmail ? undefined : identifier.replace(/[\s-]/g, '')}
                        email={isEmail ? identifier.trim() : undefined}
```

- [ ] **Step 5: Typecheck**

Run (web worktree): `npx tsc --noEmit`
Expected: clean.

---

## Task 12: Full verification

**Files:** none - verification only.

- [ ] **Step 1: Backend**

In the backend worktree:

- `npx nest build` - Expected: builds clean.
- `npx eslint src/modules/users` - Expected: no errors/warnings.
- `npx vitest run src/modules/users --no-file-parallelism` - Expected: all pass.

- [ ] **Step 2: Web - typecheck, lint, i18n**

In the web worktree:

- `npx tsc --noEmit` - Expected: clean, zero `any`.
- `npx eslint app components features lib` - Expected: no errors (incl. `i18next` - every
  user-facing string in `PolicyGate` / terms pages / `SignupMode` goes through `t()`).
- `node scripts/check-i18n.js` - Expected: no NEW flagged keys (pre-existing unrelated
  failures may remain - see Task 5 Step 5).

- [ ] **Step 3: Web - build**

In the web worktree: `npx next build`
(Run `next build` directly - `pnpm build` runs the `prebuild` check-i18n hook which trips
the pre-existing failure.)
Expected: build succeeds.

- [ ] **Step 4: Manual acceptance pass (owner / reviewer)**

Against the spec's §6 acceptance criteria, at 380px and desktop:

1. Connect front-door signup → first `/dashboard` visit shows the full-screen ERP gate;
   accept → ERP opens.
2. `?for=erp` signup → first `/connect/*` visit shows the Connect gate; accept → opens.
3. Both policies accepted → neither gate appears.
4. Deep-link `/connect/feed` and `/dashboard/attendance` without that product's policy →
   still gated (layout-level).
5. `/u/[id]` and `(marketing)` pages reachable logged-out, no gate.
6. Each gate at 380px + desktop, all four locales, generic copy; the terms links
   (`/terms/connect`, `/terms/erp`) resolve.

---

## Notes for the executor

- **Zero git.** The owner stages and commits. Do not run `git add` / `commit` / `push`.
- **Task order matters.** 1-3 (backend) → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. Task 7
  deletes `ConnectPolicyGate.tsx` only AFTER its importer is rewritten.
- **Backend typecheck is `nest build`,** never whole-project `tsc` (it OOMs - see memory
  `feedback_be_test_resource`). Scope `vitest` to `src/modules/users`.
- **No em-dashes** in any `connect.*` / `erp.*` / `terms.*` i18n copy (Standard #18).
- The two `*PolicyAcceptedAt` fields + two mirror endpoint sets are deliberate
  transitional structure - the future admin-synced policy module consolidates them. Do
  not extend the mirror to a third policy.
