# Connect-first Wave 0 - Implementation Plan

> **STATUS - SHIPPED (2026-05-20).** Wave 0 (Part A `connectEnabled` default-on +
> backfill, Part B PIN-loop family-claim fix) is live. Preserved for history.
> See `docs/connect/PROGRESS.md` - Connect-first milestone section - for the
> canonical record. Do NOT re-execute this plan.

---

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Git:** the project owner runs ALL git commands. "Checkpoint" steps mark a commit point - the executing assistant does NOT run `git`. Surface the suggested message; the owner commits.

**Goal:** Unblock Connect testing - make `connectEnabled` default-on for every account, and fix the App-Lock PIN-loop so a Connect server-component page does not re-prompt the PIN forever.

**Architecture:** Two independent parts. **Part A** flips `User.connectEnabled` to default `true` and backfills existing users. **Part B** re-keys the App-Lock unlock from the access-token `jti` to a per-login `family` JWT claim - the `family` is minted at login, copied unchanged across every token refresh, and shared by the browser-side and cookie-side token chains (both descend from one login), so a PIN unlock survives refresh and is seen by server components.

**Tech Stack:** NestJS, Mongoose, `@nestjs/jwt`, ioredis, Passport JWT, Vitest. Backend worktree: `.worktrees/crewroster-backend/zari360-connect`. Spec: `docs/connect/specs/2026-05-19-connect-first-architecture-design.md`.

**Verification note:** the backend full `tsc` OOMs - do NOT run `pnpm run typecheck`. Verify with `eslint` on changed files and `vitest run src/modules/auth`. All paths below are relative to the backend worktree root.

---

## Part A - `connectEnabled` default-on

### Task A1: Schema default → true

**Files:**

- Modify: `src/modules/users/schemas/user.schema.ts` (the `connectEnabled` `@Prop`)

- [ ] **Step 1: Change the default and the comment**

Current:

```ts
  /**
   * Zari360 Connect - per-user beta gate (rollout layer 2). Admin-set during
   * the closed beta; becomes self-serve opt-in at GA. `false` ⇒ the user sees
   * the `/platform` "coming soon" placeholder instead of the Connect app.
   */
  @Prop({ type: Boolean, default: false })
  connectEnabled: boolean;
```

Replace with:

```ts
  /**
   * Zari360 Connect - per-user access flag. Connect is the default front door,
   * so this defaults to `true` for every account. Retained only as an admin
   * kill-switch: setting it `false` makes the user see the Connect "coming
   * soon" placeholder instead of the app. See
   * docs/connect/specs/2026-05-19-connect-first-architecture-design.md §10.
   */
  @Prop({ type: Boolean, default: true })
  connectEnabled: boolean;
```

- [ ] **Step 2: Lint the file**

Run: `pnpm exec eslint src/modules/users/schemas/user.schema.ts`
Expected: no errors.

- [ ] **Step 3: Checkpoint** - owner commits: `feat(connect): connectEnabled defaults to true`

### Task A2: Backfill existing users

**Files:**

- Create: `scripts/backfill-connect-enabled.ts`
- Modify: `package.json` (add a script entry)

- [ ] **Step 1: Write the backfill script**

Create `scripts/backfill-connect-enabled.ts`:

```ts
/**
 * One-off backfill - set `connectEnabled: true` on every existing User that
 * does not already have it true. New users get `true` from the schema default
 * (see user.schema.ts); this catches accounts created before that change.
 *
 * Run: pnpm run backfill:connect-enabled
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/schemas/user.schema';

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    const res = await userModel.updateMany(
      { connectEnabled: { $ne: true } },
      { $set: { connectEnabled: true } },
    );
    console.log(`[backfill-connect-enabled] updated ${res.modifiedCount} user(s)`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('[backfill-connect-enabled] failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the package.json script**

In `package.json` `scripts`, after the `seed:connect` line, add:

```json
    "backfill:connect-enabled": "ts-node -r tsconfig-paths/register scripts/backfill-connect-enabled.ts"
```

- [ ] **Step 3: Lint the script**

Run: `pnpm exec eslint scripts/backfill-connect-enabled.ts`
Expected: no errors.

- [ ] **Step 4: Run the backfill (dev DB)**

Run: `pnpm run backfill:connect-enabled`
Expected: logs `updated N user(s)` and exits 0.

- [ ] **Step 5: Checkpoint** - owner commits: `chore(connect): backfill connectEnabled on existing users`

---

## Part B - App-Lock PIN-loop fix (per-login `family` claim)

### Task B1: Restore the auth Vitest suite

The auth vitest suites currently fail to load with:
`Failed to load url dotenv/config (resolved id: dotenv/config) in src/config/env.ts`
This blocks test-driven verification of every auth change below, so it is fixed first.

**Files:**

- Inspect: `vitest.config.ts` (or `vitest.config.mts`/`vite.config.ts`), `package.json`, `src/config/env.ts`

- [ ] **Step 1: Reproduce**

Run: `pnpm exec vitest run src/modules/auth/__tests__/auth.service.pin.vitest.ts`
Expected: fails to load with the `dotenv/config` error above.

- [ ] **Step 2: Diagnose**

Check, in order:

1. Is `dotenv` in `package.json` `dependencies` or `devDependencies`? If absent, that is the cause.
2. Does the vitest config externalise or fail to inline `dotenv`? Look for `test.deps`, `server.deps`, `optimizeDeps`.

- [ ] **Step 3: Fix**

- If `dotenv` is missing from `package.json`: the owner runs `pnpm add -D dotenv` (dependency install - owner action, not the assistant).
- If `dotenv` is present but vitest cannot resolve the `dotenv/config` subpath: in the vitest config add it to inlined deps:

  ```ts
  test: {
    // ...existing config...
    server: { deps: { inline: ['dotenv'] } },
  }
  ```

  (Merge into the existing `test` block - do not duplicate it.)

- [ ] **Step 4: Verify the suite loads**

Run: `pnpm exec vitest run src/modules/auth/__tests__/auth.service.pin.vitest.ts`
Expected: the suite LOADS - the 14 tests run (they should pass; the pre-existing `linkPendingInvitations` failure is in a different file, `sms-otp.service.vitest.ts`, and is out of scope here).

- [ ] **Step 5: Checkpoint** - owner commits: `test(auth): restore auth vitest suite loading`

### Task B2: Add the `family` claim to the JWT

**Files:**

- Modify: `src/modules/auth/types/auth.types.ts`
- Modify: `src/modules/auth/utils/token-issuer.ts`
- Modify: `src/modules/auth/strategies/jwt.strategy.ts`

- [ ] **Step 1: Add `family` to the payload types**

In `auth.types.ts`, in `AuthJwtPayload`, add `family` after `jti`:

```ts
export interface AuthJwtPayload {
  sub: string;
  platform?: Platform;
  jti?: string;
  /**
   * Per-login session-family id. Minted once at login by `issueTokens`,
   * copied UNCHANGED across every `/auth/refresh`. App-Lock unlock state is
   * keyed to it so an unlock survives token rotation. See
   * docs/connect/specs/2026-05-19-connect-first-architecture-design.md §13.
   */
  family?: string;
  forgotPasswordReset?: true;
  iat?: number;
  exp?: number;
}
```

In the same file, in `DecodedJwtMeta`, add `family`:

```ts
export interface DecodedJwtMeta {
  jti?: string;
  family?: string;
  exp?: number;
}
```

- [ ] **Step 2: Mint / propagate `family` in `issueTokens`**

In `token-issuer.ts`, replace the `issueTokens` signature and `basePayload`:

```ts
export async function issueTokens(
  jwt: JwtService,
  config: ConfigService,
  userId: string,
  platform?: Platform,
  extraClaims?: IssueTokensExtraClaims,
  family?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();
  // New login → fresh family. Refresh → caller passes the existing family so
  // the whole refresh chain (and the browser + cookie token chains that branch
  // off one login) share it. App-Lock unlock is keyed to this.
  const sessionFamily = family ?? crypto.randomUUID();
  const basePayload = {
    sub: userId,
    platform: platform || Platform.WEB,
    family: sessionFamily,
    ...(extraClaims ?? {}),
  };
```

(The two `jwt.signAsync` calls below are unchanged - they already spread `basePayload`.)

- [ ] **Step 3: Surface `family` on `req.user`**

In `jwt.strategy.ts`, in `validate`, add `family` to the returned object (after `jti`):

```ts
return {
  sub: payload.sub,
  email: user.email,
  mobile: user.mobile,
  isAdmin: user.isAdmin ?? false,
  platform: payload.platform,
  jti: payload.jti,
  family: payload.family,
  forgotPasswordReset: payload.forgotPasswordReset === true,
};
```

- [ ] **Step 4: Lint**

Run: `pnpm exec eslint src/modules/auth/types/auth.types.ts src/modules/auth/utils/token-issuer.ts src/modules/auth/strategies/jwt.strategy.ts`
Expected: no errors.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(auth): add per-login family claim to JWT`

### Task B3: The App-Lock key helper

**Files:**

- Create: `src/modules/auth/utils/app-lock-key.ts`
- Create: `src/modules/auth/utils/__tests__/app-lock-key.vitest.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/auth/utils/__tests__/app-lock-key.vitest.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { appLockKey } from '../app-lock-key';

describe('appLockKey', () => {
  it('keys on family when present', () => {
    expect(appLockKey('unlocked', { family: 'fam-1', jti: 'jti-1' })).toBe('unlocked:fam:fam-1');
    expect(appLockKey('setup-grace', { family: 'fam-1' })).toBe('setup-grace:fam:fam-1');
  });

  it('falls back to jti for legacy tokens with no family', () => {
    expect(appLockKey('unlocked', { jti: 'jti-1' })).toBe('unlocked:jti:jti-1');
  });

  it('returns null when neither id is present', () => {
    expect(appLockKey('unlocked', {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm exec vitest run src/modules/auth/utils/__tests__/app-lock-key.vitest.ts`
Expected: FAIL - cannot resolve `../app-lock-key`.

- [ ] **Step 3: Write the helper**

Create `src/modules/auth/utils/app-lock-key.ts`:

```ts
/**
 * App-Lock Redis key builder.
 *
 * App-Lock unlock + setup-grace state is keyed to the per-login `family`
 * claim, NOT the access-token `jti`. A token refresh rotates the `jti` but
 * preserves the `family`; the browser-side and cookie-side token chains both
 * descend from one login and share the `family`. Keying on `family` is what
 * lets a PIN unlock survive a refresh and be seen by server components.
 *
 * `jti` is the fallback for legacy tokens minted before the `family` claim
 * existed. Those age out within the 7-day refresh-token TTL.
 */
export type AppLockIds = { family?: string | null; jti?: string | null };

export function appLockKey(prefix: 'unlocked' | 'setup-grace', ids: AppLockIds): string | null {
  if (ids.family) return `${prefix}:fam:${ids.family}`;
  if (ids.jti) return `${prefix}:jti:${ids.jti}`;
  return null;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm exec vitest run src/modules/auth/utils/__tests__/app-lock-key.vitest.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint** - owner commits: `feat(auth): add appLockKey helper`

### Task B4: `refreshToken` - copy `family`, drop the dead carry block

**Files:**

- Modify: `src/modules/auth/auth.service.ts` (`refreshToken`)

- [ ] **Step 1: Remove the dead carry-forward block**

In `refreshToken`, DELETE this entire block (added in an earlier attempt; it never runs because no caller sends `oldAccessToken` in the Authorization header):

```ts
// App Lock - a refresh rotates the access-token jti, which would orphan
// the `unlocked:jti:<jti>` key and re-lock the app on the next request
// (every ~15 min - the access-token TTL). Carry an active unlock forward
// onto the new jti so a silent token refresh never re-prompts the Quick
// PIN for a session the user already unlocked.
if (oldAccessToken) {
  try {
    const oldDecoded: DecodedJwtMeta | null = this.jwtService.decode(oldAccessToken);
    const newDecoded: DecodedJwtMeta | null = this.jwtService.decode(tokens.accessToken);
    const oldJti = oldDecoded?.jti;
    const newJti = newDecoded?.jti;
    if (oldJti && newJti && oldJti !== newJti) {
      const unlockVal = await this.redis.get(`unlocked:jti:${oldJti}`);
      if (unlockVal) {
        const remaining = await this.redis.ttl(`unlocked:jti:${oldJti}`);
        let ttl = remaining;
        if (ttl <= 0) {
          const parsed = Number.parseInt(unlockVal, 10);
          ttl = Number.isFinite(parsed) ? parsed : 0;
        }
        if (ttl > 0) {
          await this.redis.set(`unlocked:jti:${newJti}`, unlockVal, 'EX', ttl);
        }
      }
    }
  } catch (carryErr) {
    this.logger.warn(
      `[refreshToken] App-Lock unlock carry-forward failed: ${(carryErr as Error)?.message ?? carryErr}`,
    );
  }
}
```

The `return { ...tokens, platformAccess };` line that followed it stays.

- [ ] **Step 2: Pass the existing `family` into `generateTokens`**

`refreshToken` verifies the refresh token into `payload` (`AuthJwtPayload`). Change the token-mint line:

```ts
const tokens = await this.generateTokens(this.getUserId(user), payload.platform);
```

to:

```ts
// Carry the session family across the refresh so App-Lock unlock state
// (keyed to `family`) survives token rotation.
const tokens = await this.generateTokens(
  this.getUserId(user),
  payload.platform,
  undefined,
  payload.family,
);
```

- [ ] **Step 3: Widen `generateTokens` to accept `family`**

`generateTokens` currently:

```ts
  private async generateTokens(
    userId: string,
    platform?: Platform,
    extraClaims?: { forgotPasswordReset?: true },
  ) {
    return issueTokens(this.jwtService, this.configService, userId, platform, extraClaims);
  }
```

Replace with:

```ts
  private async generateTokens(
    userId: string,
    platform?: Platform,
    extraClaims?: { forgotPasswordReset?: true },
    family?: string,
  ) {
    return issueTokens(this.jwtService, this.configService, userId, platform, extraClaims, family);
  }
```

(All other `generateTokens` callers - login, register, google, OTP - pass no `family`, so `issueTokens` mints a fresh one: a new login = a new family. Correct.)

- [ ] **Step 4: Lint**

Run: `pnpm exec eslint src/modules/auth/auth.service.ts`
Expected: no errors.

- [ ] **Step 5: Checkpoint** - owner commits: `fix(auth): carry session family across token refresh`

### Task B5: Re-key the App-Lock writes in `auth.service.ts`

All five methods below currently key on `unlocked:jti:`/`setup-grace:jti:`. Re-key them via `appLockKey`. Each `(userId, jti, dto)` method gains an optional `family?: string` last parameter (optional → existing 3-arg test calls still compile and exercise the `jti` fallback).

**Files:**

- Modify: `src/modules/auth/auth.service.ts`

- [ ] **Step 1: Import the helper**

At the top of `auth.service.ts`, with the other local imports, add:

```ts
import { appLockKey } from './utils/app-lock-key';
```

- [ ] **Step 2: `writeSetupGraceIfNeeded` - key on family**

It already decodes the access token. Replace its body's key logic:

```ts
const decoded: DecodedJwtMeta | null = this.jwtService.decode(accessToken);
const jti = decoded?.jti;
if (!jti) return;
const ttlSec = Math.floor(env.appLock.graceMs / 1000);
await this.redis.set(`setup-grace:jti:${jti}`, '1', 'EX', ttlSec);
```

with:

```ts
const decoded: DecodedJwtMeta | null = this.jwtService.decode(accessToken);
const key = appLockKey('setup-grace', { family: decoded?.family, jti: decoded?.jti });
if (!key) return;
const ttlSec = Math.floor(env.appLock.graceMs / 1000);
await this.redis.set(key, '1', 'EX', ttlSec);
```

- [ ] **Step 3: `setPin` - add `family` param, re-key**

Signature: add `family?: string` last:

```ts
  async setPin(
    userId: string,
    jti: string,
    dto: SetPinDto,
    family?: string,
  ): Promise<{ ok: true; unlockExpiresAt: string }> {
```

In its body replace:

```ts
await this.redis.del(`setup-grace:jti:${jti}`);
await this.redis.set(`unlocked:jti:${jti}`, String(ttlSec), 'EX', ttlSec);
```

with:

```ts
const graceKey = appLockKey('setup-grace', { family, jti });
const unlockKey = appLockKey('unlocked', { family, jti });
if (graceKey) await this.redis.del(graceKey);
if (unlockKey) await this.redis.set(unlockKey, String(ttlSec), 'EX', ttlSec);
```

- [ ] **Step 4: `verifyPin` - add `family` param, re-key**

Signature: add `family?: string` last. In its success path replace:

```ts
await this.redis.set(`unlocked:jti:${jti}`, String(ttlSec), 'EX', ttlSec);
```

with:

```ts
const unlockKey = appLockKey('unlocked', { family, jti });
if (unlockKey) await this.redis.set(unlockKey, String(ttlSec), 'EX', ttlSec);
```

- [ ] **Step 5: `changePin` - add `family` param, re-key**

Signature: add `family?: string` last. Replace its `redis.set(\`unlocked:jti:${jti}\`, ...)`with the same`unlockKey` pattern as Step 4.

- [ ] **Step 6: `getPinStatus` - add `family` param, re-key**

Signature: add `family?: string` last. Replace:

```ts
ttlMs = await this.redis.pttl(`unlocked:jti:${jti}`);
```

with:

```ts
const unlockKey = appLockKey('unlocked', { family, jti });
ttlMs = unlockKey ? await this.redis.pttl(unlockKey) : -2;
```

- [ ] **Step 7: `forgotPinReset` - add `family` param, re-key**

Signature: add `family?: string` last. Replace its `redis.set(\`unlocked:jti:${jti}\`, ...)`with the`unlockKey` pattern from Step 4.

- [ ] **Step 8: `lockSession` - add `family` param, re-key**

Signature: add `family?: string` last. Replace:

```ts
await this.redis.del(`unlocked:jti:${jti}`);
```

with:

```ts
const unlockKey = appLockKey('unlocked', { family, jti });
if (unlockKey) await this.redis.del(unlockKey);
```

- [ ] **Step 9: `revokeTokens` + `completeForgotPasswordReset` - del both family and jti keys**

In `revokeTokens`, inside the `for` loop, the decoded token has `family`. Replace:

```ts
await this.redis.del(`unlocked:jti:${jti}`).catch(() => undefined);
await this.redis.del(`setup-grace:jti:${jti}`).catch(() => undefined);
```

with:

```ts
// Drop both the family-keyed and the legacy jti-keyed App-Lock keys.
await this.redis.del(`unlocked:jti:${jti}`).catch(() => undefined);
await this.redis.del(`setup-grace:jti:${jti}`).catch(() => undefined);
if (decoded?.family) {
  await this.redis.del(`unlocked:fam:${decoded.family}`).catch(() => undefined);
  await this.redis.del(`setup-grace:fam:${decoded.family}`).catch(() => undefined);
}
```

Apply the identical change in `completeForgotPasswordReset`'s denylist loop (same two `redis.del` lines).

- [ ] **Step 10: Lint**

Run: `pnpm exec eslint src/modules/auth/auth.service.ts`
Expected: no errors.

- [ ] **Step 11: Checkpoint** - owner commits: `fix(auth): key App-Lock unlock on session family`

### Task B6: Controller passes `family`

**Files:**

- Modify: `src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Add `family` to the request-user type**

In `auth.controller.ts`, the `AuthedRequest` type's `user` shape - add `family`:

```ts
  user: {
    sub: string;
    platform?: string;
    jti?: string;
    family?: string;
    forgotPasswordReset?: boolean;
  };
```

- [ ] **Step 2: Pass `family` into the PIN endpoints**

Update these six handler bodies to pass `req.user.family` as the new last argument:

- `setPin` → `this.authService.setPin(req.user.sub, req.user.jti ?? '', body, req.user.family)`
- `changePin` → `this.authService.changePin(req.user.sub, req.user.jti ?? '', body, req.user.family)`
- `verifyPin` → `this.authService.verifyPin(req.user.sub, req.user.jti ?? '', body, req.user.family)`
- `pinStatus` → `this.authService.getPinStatus(req.user.sub, req.user.jti ?? '', req.user.family)`
- `forgotPinReset` → `this.authService.forgotPinReset(req.user.sub, req.user.jti ?? '', body, req.user.family)`
- `lock` → `this.authService.lockSession(req.user.sub, req.user.jti ?? '', undefined, req.user.family)`

  Note for `lock`: `lockSession(userId, jti, actorNameSnapshot?, family?)` - `family` is the 4th param, so pass `undefined` for `actorNameSnapshot` explicitly.

- [ ] **Step 3: Lint**

Run: `pnpm exec eslint src/modules/auth/auth.controller.ts`
Expected: no errors.

- [ ] **Step 4: Checkpoint** - owner commits: `fix(auth): thread session family into PIN endpoints`

### Task B7: `PinUnlockGuard` reads the family key

**Files:**

- Modify: `src/common/guards/pin-unlock.guard.ts`

- [ ] **Step 1: Import the helper + widen the request-user type**

Add the import:

```ts
import { appLockKey } from '../../modules/auth/utils/app-lock-key';
```

Widen the request-user type:

```ts
const request = context.switchToHttp().getRequest<{
  user?: { sub?: string; jti?: string; family?: string; isAdmin?: boolean };
}>();
```

- [ ] **Step 2: Re-key the grace check**

Replace:

```ts
const grace = await this.redis.get(`setup-grace:jti:${user.jti}`);
if (grace) return true;
```

with:

```ts
const graceKey = appLockKey('setup-grace', { family: user.family, jti: user.jti });
const grace = graceKey ? await this.redis.get(graceKey) : null;
if (grace) return true;
```

- [ ] **Step 3: Re-key the unlock check + the sliding-TTL refresh**

Replace:

```ts
      const unlocked = await this.redis.get(`unlocked:jti:${user.jti}`);
      if (unlocked) {
```

with:

```ts
      const unlockKey = appLockKey('unlocked', { family: user.family, jti: user.jti });
      const unlocked = unlockKey ? await this.redis.get(unlockKey) : null;
      if (unlocked && unlockKey) {
```

Then in that block, replace the sliding-TTL line:

```ts
await this.redis.expire(`unlocked:jti:${user.jti}`, refreshedTtl);
```

with:

```ts
await this.redis.expire(unlockKey, refreshedTtl);
```

- [ ] **Step 4: Lint**

Run: `pnpm exec eslint src/common/guards/pin-unlock.guard.ts`
Expected: no errors.

- [ ] **Step 5: Checkpoint** - owner commits: `fix(auth): PinUnlockGuard reads the family-keyed unlock`

### Task B8: Update + extend the PIN tests

**Files:**

- Modify: `src/modules/auth/__tests__/auth.service.pin.vitest.ts`

The existing 14 tests call the PIN methods with 3 args (no `family`) → the `jti` fallback keeps `unlocked:jti:${jti}` / `setup-grace:jti:${jti}`, so every existing assertion still passes unchanged. Add tests proving the family path.

- [ ] **Step 1: Add family-keyed tests**

After the existing `verifyPin` tests, add:

```ts
// ─────────────── family-keyed unlock (PIN-loop fix) ───────────────

it('verifyPin: keys the unlock on family when a family is supplied', async () => {
  usersService.findByIdWithPinFields.mockResolvedValue(
    baseUserDoc({ pinHash: '$2a$12$existing', pinAttempts: 0 }),
  );
  usersService.update.mockResolvedValue(baseUserDoc());
  bcryptCompare.mockResolvedValue(true);

  await svc.verifyPin(userId.toString(), jti, { pin: '123456' }, 'fam-xyz');

  expect(redis.set).toHaveBeenCalledWith(
    'unlocked:fam:fam-xyz',
    expect.any(String),
    'EX',
    expect.any(Number),
  );
});

it('setPin: keys unlock + grace on family when a family is supplied', async () => {
  usersService.findByIdWithPinFields.mockResolvedValue(baseUserDoc());
  usersService.update.mockResolvedValue(baseUserDoc());

  await svc.setPin(userId.toString(), jti, { pin: '123456' }, 'fam-xyz');

  expect(redis.del).toHaveBeenCalledWith('setup-grace:fam:fam-xyz');
  expect(redis.set).toHaveBeenCalledWith(
    'unlocked:fam:fam-xyz',
    expect.any(String),
    'EX',
    expect.any(Number),
  );
});

it('getPinStatus: reads the family-keyed unlock when a family is supplied', async () => {
  usersService.findByIdWithPinFields.mockResolvedValue(baseUserDoc({ pinHash: '$2a$12$existing' }));
  redis.pttl.mockResolvedValue(120000);

  const res = await svc.getPinStatus(userId.toString(), jti, 'fam-xyz');

  expect(redis.pttl).toHaveBeenCalledWith('unlocked:fam:fam-xyz');
  expect(res.locked).toBe(false);
});

it('lockSession: deletes the family-keyed unlock when a family is supplied', async () => {
  await svc.lockSession(userId.toString(), jti, undefined, 'fam-xyz');
  expect(redis.del).toHaveBeenCalledWith('unlocked:fam:fam-xyz');
});
```

- [ ] **Step 2: Run the auth PIN suite**

Run: `pnpm exec vitest run src/modules/auth/__tests__/auth.service.pin.vitest.ts`
Expected: PASS - all original tests plus the 4 new ones.

- [ ] **Step 3: Checkpoint** - owner commits: `test(auth): cover family-keyed App-Lock`

### Task B9: Full Wave 0 verification

- [ ] **Step 1: Lint every changed backend file**

Run: `pnpm exec eslint src/modules/auth/auth.service.ts src/modules/auth/auth.controller.ts src/modules/auth/types/auth.types.ts src/modules/auth/utils/token-issuer.ts src/modules/auth/utils/app-lock-key.ts src/modules/auth/strategies/jwt.strategy.ts src/common/guards/pin-unlock.guard.ts src/modules/users/schemas/user.schema.ts scripts/backfill-connect-enabled.ts`
Expected: no errors.

- [ ] **Step 2: Run the auth module test suites**

Run: `pnpm exec vitest run src/modules/auth`
Expected: `auth.service.pin.vitest.ts` and `app-lock-key.vitest.ts` pass. (The pre-existing `sms-otp.service.vitest.ts` `linkPendingInvitations` failure is unrelated and out of scope.)

- [ ] **Step 3: Manual smoke test**

With both dev servers running:

1. Log in fresh as a non-seed test user.
2. Open `/connect/home`. Enter the PIN once when prompted.
3. Wait past one access-token rotation (~15 min) or trigger a refresh, then navigate within Connect.
4. Confirm: the PIN is **not** re-prompted; `/connect/home` renders (onboarding or Day-1 home, not "coming soon").

- [ ] **Step 4: Checkpoint** - owner commits any remaining staged changes.

---

## Self-review (completed during planning)

- **Spec coverage:** Wave 0 of the spec = §13 items 1–2 (`connectEnabled` default-on + backfill; PIN-loop family-claim fix). Part A covers item 1; Part B covers item 2 across all the touch points enumerated in spec §13. ✓
- **Placeholders:** none - every step has exact code or an exact command. B1 is a diagnosis task with a concrete reproduction, concrete causes, and a concrete done-condition (suite loads). ✓
- **Type consistency:** `family?: string` is appended consistently as the last param on `setPin`/`verifyPin`/`changePin`/`getPinStatus`/`forgotPinReset`; `lockSession` gets it 4th (after the existing optional `actorNameSnapshot`). `appLockKey` returns `string | null`; every caller guards the `null`. `AppLockIds` accepts `string | null | undefined` so `decoded?.family` and `user.family` both fit. ✓

## Out of scope (this is Wave 0 only)

The Connect-first milestone - person-only signup refactor, entry-marker routing, policy/terms gate, browse-first onboarding, intent cross-sell, switcher polish - is a separate plan, written after Wave 0 lands and the owner has tested the working Connect app.
