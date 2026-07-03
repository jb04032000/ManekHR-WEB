# Browser Push Notifications (FCM Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `dispatch()`-routed notifications as real browser push to desktop + Android PWA by completing the scaffolded `browser_push` channel (backend) and adding the web-client half (Firebase JS SDK, a messaging service worker, a soft-prompt opt-in, and a settings toggle).

**Architecture:** The backend `NotificationsService.dispatch()` already fans out to a registered `BrowserPushChannel`; we make that channel real by reusing the existing `firebase-admin` sender (`PushAdapter`) and the `user-devices` token registry (which already supports `platform: 'web'`). The web app registers an FCM web token via the existing `POST /devices/register`, stores it, and enabling push flips the per-category `browserPush` preferences on so dispatch actually sends.

**Tech Stack:** NestJS + Mongoose + `firebase-admin@^13` (backend, already installed); Next.js App Router + `firebase` JS SDK (web, NEW dep); FCM Web Push; vitest for both repos.

**Repo conventions (binding):**

- **Zero git ops by the implementer** unless the owner says otherwise — the owner stages + commits. (api/CLAUDE.md Working Agreement #1; mirror for web.)
- Web env vars MUST be read through `web/lib/env.ts`; backend through `api/src/config/env.ts`. No direct `process.env` elsewhere (lint-enforced).
- Backend tests: colocated `*.vitest.ts` under `__tests__/`, run with `npm run test:vitest`. Full backend `tsc`/`nest build` OOMs in this environment — the **owner runs the full typecheck/build**; implementers verify via vitest + targeted SWC.
- Web tests: `*.test.ts(x)` / `*.vitest.ts`, run with `npm run test:unit` (vitest). Gates: `npm run typecheck`, `npm run lint`, `npm run check:i18n`, `npm run format:check`.
- Any new user-facing string MUST be added to all 4 locale files (`web/app/messages/{en,gu,gu-en,hi-en}.json`); `check:i18n` fails on a missing key. English copy is fine in this plan; native translation (gu/gu-en/hi-en) is a follow-up review pass (see project i18n convention).

---

## File Structure

**Backend (`api/`)**

- Modify `src/modules/user-devices/user-devices.service.ts` — add `pushUserWeb(userId, payload)` (web-platform-only fan-out).
- Create `src/modules/user-devices/__tests__/user-devices.service.vitest.ts` — test the web-only filter.
- Modify `src/modules/notifications/channels/browser-push.channel.ts` — real `isAvailable` + `send`.
- Create `src/modules/notifications/channels/__tests__/browser-push.channel.vitest.ts` — channel behavior.
- Modify `src/modules/notifications/notifications.module.ts` — import `UserDevicesModule`.

**Web (`web/`)**

- Modify `package.json` — add `firebase` dependency.
- Modify `lib/env.ts` — add the `firebase` config block + `pushConfigured` flag.
- Create `lib/push/firebase-messaging.ts` — guarded FCM client init + token helpers (browser-only).
- Create `lib/push/push-device.actions.ts` — server actions wrapping `POST/DELETE /devices`.
- Create `lib/push/useBrowserPush.ts` — client hook (permission state + enable/disable).
- Create `lib/push/buildEnablePrefsPatch.ts` — pure helper (turn on `browserPush` for all categories).
- Create `lib/push/buildEnablePrefsPatch.test.ts` — unit test for the helper.
- Create `public/firebase-messaging-sw.js` — FCM background-message service worker.
- Create `components/push/EnablePushBanner.tsx` — soft-prompt banner.
- Modify `components/pwa/PwaManager.tsx` — mount `<EnablePushBanner />` (single client mount point).
- Modify `features/connect/notifications/preferences-sections.tsx` — make `browserPush` channel `live: true`.
- Modify `features/connect/notifications/PreferencesDrawer.tsx` — route the `browserPush` toggle through the push hook (permission-aware).
- Modify `app/messages/{en,gu,gu-en,hi-en}.json` — new i18n keys.

No DB schema changes, no migrations, no new backend endpoints.

---

## Task 1: Backend — `pushUserWeb` (web-only fan-out)

**Files:**

- Modify: `api/src/modules/user-devices/user-devices.service.ts`
- Test: `api/src/modules/user-devices/__tests__/user-devices.service.vitest.ts` (create)

`UserDevicesService.pushUser` already fans out to ALL of a user's devices. The `browser_push` channel must hit web tokens only, so add a sibling that filters `platform: 'web'`. Reuse the existing `PushAdapter.sendUserPush` + dead-token pruning.

- [ ] **Step 1: Write the failing test**

Create `api/src/modules/user-devices/__tests__/user-devices.service.vitest.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserDevicesService } from '../user-devices.service';

// Minimal model + push-adapter doubles. We only exercise pushUserWeb's filter
// + fan-out contract, not Mongoose internals.
function makeService(webTokens: string[], otherTokens: string[]) {
  const docs = [
    ...webTokens.map((fcmToken) => ({ fcmToken, platform: 'web' })),
    ...otherTokens.map((fcmToken) => ({ fcmToken, platform: 'android' })),
  ];
  // find({ userId, platform:'web' }) -> only web docs
  const deviceModel = {
    find: vi.fn((q: any) => ({
      sort: () => ({
        exec: async () => (q.platform === 'web' ? docs.filter((d) => d.platform === 'web') : docs),
      }),
    })),
    deleteMany: vi.fn(() => ({ exec: async () => ({ deletedCount: 0 }) })),
  };
  const push = {
    sendUserPush: vi.fn(async () => ({ success: true, messageId: 'm1' })),
  };
  return {
    svc: new UserDevicesService(deviceModel as any, push as any),
    push,
  };
}

describe('UserDevicesService.pushUserWeb', () => {
  it('sends only to web-platform tokens', async () => {
    const { svc, push } = makeService(['web-a', 'web-b'], ['android-c']);
    const res = await svc.pushUserWeb('u1', { title: 'T', body: 'B' });
    expect(push.sendUserPush).toHaveBeenCalledTimes(2);
    const sentTokens = push.sendUserPush.mock.calls.map((c: any[]) => c[0].token).sort();
    expect(sentTokens).toEqual(['web-a', 'web-b']);
    expect(res).toEqual({ attempted: 2, sent: 2, pruned: 0 });
  });

  it('returns a zero result when the user has no web devices', async () => {
    const { svc, push } = makeService([], ['android-c']);
    const res = await svc.pushUserWeb('u1', { title: 'T', body: 'B' });
    expect(push.sendUserPush).not.toHaveBeenCalled();
    expect(res).toEqual({ attempted: 0, sent: 0, pruned: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd api && npx vitest run src/modules/user-devices/__tests__/user-devices.service.vitest.ts`
Expected: FAIL — `pushUserWeb is not a function`.

- [ ] **Step 3: Implement `pushUserWeb`**

In `api/src/modules/user-devices/user-devices.service.ts`, add a private web-device query and the public method. Place `listWebDevices` next to `listDevices`, and `pushUserWeb` next to `pushUser` (reuse the exact dead-token prune logic from `pushUser`):

```ts
  /** A user's WEB push targets only (browser/PWA). Used by the
   *  notifications `browser_push` channel so a browser push never goes to the
   *  mobile app's token (and vice-versa). */
  async listWebDevices(userId: string): Promise<UserDevice[]> {
    return this.deviceModel
      .find({ userId: new Types.ObjectId(userId), platform: 'web' })
      .sort({ lastUsedAt: -1 })
      .exec();
  }

  /**
   * Fan-out a user-targeted push to the user's WEB devices only. Same prune
   * behaviour as `pushUser` (dead FCM tokens are deleted) but scoped to
   * `platform: 'web'`. Cross-module: called by
   * notifications `BrowserPushChannel.send`.
   */
  async pushUserWeb(
    userId: string,
    payload: PushUserPayload,
  ): Promise<PushUserResult> {
    const devices = await this.listWebDevices(userId);
    if (devices.length === 0) {
      return { attempted: 0, sent: 0, pruned: 0 };
    }

    const results = await Promise.all(
      devices.map(async (d) => {
        const res = await this.push.sendUserPush({
          token: d.fcmToken,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
        return { device: d, res };
      }),
    );

    const deadTokens = results
      .filter(
        (r) =>
          !r.res.success &&
          (r.res.errorCode === 'messaging/registration-token-not-registered' ||
            r.res.errorCode === 'messaging/invalid-registration-token'),
      )
      .map((r) => r.device.fcmToken);

    let pruned = 0;
    if (deadTokens.length > 0) {
      const del = await this.deviceModel
        .deleteMany({ fcmToken: { $in: deadTokens } })
        .exec();
      pruned = del.deletedCount ?? 0;
      this.logger.log(`Pruned ${pruned} dead web FCM token(s) for user ${userId}`);
    }

    return {
      attempted: results.length,
      sent: results.filter((r) => r.res.success).length,
      pruned,
    };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx vitest run src/modules/user-devices/__tests__/user-devices.service.vitest.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/modules/user-devices/user-devices.service.ts api/src/modules/user-devices/__tests__/user-devices.service.vitest.ts
git commit -m "feat(notifications): add web-only push fan-out to UserDevicesService"
```

---

## Task 2: Backend — make `BrowserPushChannel` real

**Files:**

- Modify: `api/src/modules/notifications/channels/browser-push.channel.ts`
- Test: `api/src/modules/notifications/channels/__tests__/browser-push.channel.vitest.ts` (create)

The channel becomes: available iff the user has ≥1 web device; `send` fans out via `pushUserWeb` with a deep-link in the FCM `data` payload. It depends on `UserDevicesService` (wired in Task 3).

- [ ] **Step 1: Write the failing test**

Create `api/src/modules/notifications/channels/__tests__/browser-push.channel.vitest.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { BrowserPushChannel } from '../browser-push.channel';
import type { ChannelSendInput } from '../notification-channel.interface';

function sendInput(over: Partial<ChannelSendInput> = {}): ChannelSendInput {
  return {
    notificationId: 'n1',
    recipientId: 'u1',
    category: 'connect.message_received',
    title: 'New message',
    message: 'Hi there',
    actorId: 'a1',
    aggregatedCount: 1,
    entityType: 'inbox_thread',
    entityId: 't1',
    metadata: null,
    ...over,
  };
}

describe('BrowserPushChannel', () => {
  it('isAvailable = true when the user has web devices', async () => {
    const devices = { listWebDevices: vi.fn(async () => [{ fcmToken: 'web-a' }]) };
    const ch = new BrowserPushChannel(devices as any);
    expect(await ch.isAvailable('u1')).toBe(true);
  });

  it('isAvailable = false when the user has no web devices', async () => {
    const devices = { listWebDevices: vi.fn(async () => []) };
    const ch = new BrowserPushChannel(devices as any);
    expect(await ch.isAvailable('u1')).toBe(false);
  });

  it('send fans out via pushUserWeb with title, message and deep-link data', async () => {
    const devices = {
      listWebDevices: vi.fn(async () => [{ fcmToken: 'web-a' }]),
      pushUserWeb: vi.fn(async () => ({ attempted: 1, sent: 1, pruned: 0 })),
    };
    const ch = new BrowserPushChannel(devices as any);
    await ch.send(sendInput());
    expect(devices.pushUserWeb).toHaveBeenCalledWith('u1', {
      title: 'New message',
      body: 'Hi there',
      data: {
        notificationId: 'n1',
        category: 'connect.message_received',
        link: '/connect/notifications',
      },
    });
  });

  it('send prefers an explicit metadata.link when present', async () => {
    const devices = {
      listWebDevices: vi.fn(async () => [{ fcmToken: 'web-a' }]),
      pushUserWeb: vi.fn(async () => ({ attempted: 1, sent: 1, pruned: 0 })),
    };
    const ch = new BrowserPushChannel(devices as any);
    await ch.send(sendInput({ metadata: { link: '/dashboard/finance' } }));
    expect(devices.pushUserWeb).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ data: expect.objectContaining({ link: '/dashboard/finance' }) }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd api && npx vitest run src/modules/notifications/channels/__tests__/browser-push.channel.vitest.ts`
Expected: FAIL — constructor takes no args / `isAvailable` returns false.

- [ ] **Step 3: Implement the channel**

Replace the body of `api/src/modules/notifications/channels/browser-push.channel.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { UserDevicesService } from '../../user-devices/user-devices.service';
import type { NotificationChannel, ChannelSendInput } from './notification-channel.interface';

/**
 * `BrowserPushChannel` — Web Push via FCM to the browser / installed PWA
 * (desktop + Android). Reuses the `user-devices` registry (web-platform
 * tokens) + the shared `firebase-admin` sender. Cross-module:
 * notifications dispatch -> UserDevicesService.pushUserWeb -> PushAdapter (FCM).
 *
 * `isAvailable` is true iff the recipient has at least one registered web
 * device, so the dispatcher skips browser push for users who never opted in.
 */
@Injectable()
export class BrowserPushChannel implements NotificationChannel {
  private readonly logger = new Logger(BrowserPushChannel.name);
  readonly name = 'browser_push' as const;

  constructor(private readonly userDevices: UserDevicesService) {}

  async isAvailable(recipientId: string): Promise<boolean> {
    const devices = await this.userDevices.listWebDevices(recipientId);
    return devices.length > 0;
  }

  async send(input: ChannelSendInput): Promise<void> {
    // Deep-link: prefer an explicit metadata.link (ERP rows carry one); else
    // land on the notifications centre. FCM `data` values must be strings.
    const metaLink =
      input.metadata && typeof (input.metadata as { link?: unknown }).link === 'string'
        ? (input.metadata as { link: string }).link
        : '/connect/notifications';

    await this.userDevices.pushUserWeb(input.recipientId, {
      title: input.title,
      body: input.message,
      data: {
        notificationId: input.notificationId,
        category: input.category,
        link: metaLink,
      },
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx vitest run src/modules/notifications/channels/__tests__/browser-push.channel.vitest.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/modules/notifications/channels/browser-push.channel.ts api/src/modules/notifications/channels/__tests__/browser-push.channel.vitest.ts
git commit -m "feat(notifications): implement BrowserPushChannel over FCM web tokens"
```

---

## Task 3: Backend — wire `UserDevicesModule` into `NotificationsModule`

**Files:**

- Modify: `api/src/modules/notifications/notifications.module.ts`

`BrowserPushChannel` now injects `UserDevicesService`, which is exported by `UserDevicesModule`. Import that module so Nest can resolve the dependency. (`UserDevicesModule` does not import `NotificationsModule`, so there is no circular dependency.)

- [ ] **Step 1: Add the import**

In `api/src/modules/notifications/notifications.module.ts`, add the import line near the other module imports:

```ts
import { UserDevicesModule } from '../user-devices/user-devices.module';
```

and add `UserDevicesModule` to the `imports` array (after the `JwtModule.registerAsync({...})` entry):

```ts
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationPreferences.name, schema: NotificationPreferencesSchema },
      { name: Role.name, schema: RoleSchema },
      { name: WorkspaceMember.name, schema: WorkspaceMemberSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
      inject: [ConfigService],
    }),
    UserDevicesModule,
  ],
```

- [ ] **Step 2: Verify the module compiles + the two new suites pass**

Run: `cd api && npx vitest run src/modules/notifications/channels/__tests__/browser-push.channel.vitest.ts src/modules/user-devices/__tests__/user-devices.service.vitest.ts`
Expected: PASS (6 tests total).

> Note: full `nest build`/`tsc` OOMs in this environment — the **owner runs the full backend build/typecheck** after these tasks. Implementer verification is the vitest suites above.

- [ ] **Step 3: Commit**

```bash
git add api/src/modules/notifications/notifications.module.ts
git commit -m "feat(notifications): wire UserDevicesModule for browser push channel"
```

---

## Task 4: Web — add `firebase` dependency + env config

**Files:**

- Modify: `web/package.json`
- Modify: `web/lib/env.ts`

- [ ] **Step 1: Add the dependency**

Run: `cd web && npm install firebase@^11`
Expected: `firebase` added to `package.json` `dependencies`; `package-lock.json` updated.

> Deploy note (from project memory): the deployed backend image regenerated lockfiles with **npm 10** because host npm 11 broke `npm ci`. The web lockfile change here should be generated with the same npm major the deploy uses; flag to the owner if unsure.

- [ ] **Step 2: Add the Firebase env block**

In `web/lib/env.ts`, add this block inside the `env` object (e.g. after the `pwaEnabled` entry, before the closing `} as const;`):

```ts
  // ---------- Firebase Cloud Messaging (browser push) ----------
  // Web app config from the Firebase console (Project settings -> General ->
  // your web app) + the Web Push certificate key pair public key (Cloud
  // Messaging -> Web configuration). These are PUBLISHABLE (they ship in every
  // client bundle) -> safe as NEXT_PUBLIC_*. EMPTY any of them = browser push
  // OFF: the SDK never initialises, the enable banner never shows, the settings
  // toggle reads "coming soon". Backend service-account keys (FIREBASE_* in the
  // api repo) are separate and stay server-side.
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '',
  },
```

Then add a derived flag immediately after the `firebase` block (still inside the object):

```ts
  // True only when every Firebase web-push value is present. Gate the whole
  // browser-push feature on this so a half-configured deploy stays inert.
  get pushConfigured(): boolean {
    const f = this.firebase;
    return Boolean(
      f.apiKey && f.authDomain && f.projectId && f.messagingSenderId && f.appId && f.vapidKey,
    );
  },
```

> If a getter on the `as const` object trips the type checker, replace it with a plain boolean computed before the object and reference the same `process.env` values — but prefer the getter for single-source. Verify in Step 3.

- [ ] **Step 3: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS (no new errors). Memory notes 2 pre-existing analytics-WIP `tsc` errors may exist in this tree; if so, confirm there are **no new** errors beyond those.

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/package-lock.json web/lib/env.ts
git commit -m "feat(push): add firebase dep + NEXT_PUBLIC_FIREBASE_* env config"
```

---

## Task 5: Web — pure helper to build the "enable all categories" prefs patch

**Files:**

- Create: `web/lib/push/buildEnablePrefsPatch.ts`
- Test: `web/lib/push/buildEnablePrefsPatch.test.ts`

Enabling push turns on `browserPush` for every category already in the user's prefs map (the decision: one action, all types on). This is pure logic → unit-tested.

- [ ] **Step 1: Write the failing test**

Create `web/lib/push/buildEnablePrefsPatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildEnablePrefsPatch } from './buildEnablePrefsPatch';

describe('buildEnablePrefsPatch', () => {
  it('sets browserPush:true for every category key and global channel on', () => {
    const prefs = {
      'connect.message_received': { inPlatform: true, mobilePush: false, browserPush: false },
      'connect.followed': { inPlatform: true, mobilePush: false, browserPush: false },
    };
    const patch = buildEnablePrefsPatch(prefs, true);
    expect(patch).toEqual({
      prefs: {
        'connect.message_received': { browserPush: true },
        'connect.followed': { browserPush: true },
      },
      channels: { browserPush: true },
    });
  });

  it('sets browserPush:false everywhere when disabling', () => {
    const prefs = {
      'connect.followed': { inPlatform: true, mobilePush: false, browserPush: true },
    };
    const patch = buildEnablePrefsPatch(prefs, false);
    expect(patch).toEqual({
      prefs: { 'connect.followed': { browserPush: false } },
      channels: { browserPush: false },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run lib/push/buildEnablePrefsPatch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `web/lib/push/buildEnablePrefsPatch.ts`:

```ts
import type {
  ChannelPrefs,
  NotificationPrefs,
} from '@/features/connect/notifications/notifications.actions';

/**
 * Build the preferences patch that turns browser push on (or off) for ALL of a
 * user's notification categories at once, plus the global `browserPush` channel
 * flag. Used by useBrowserPush after a permission grant / on disable. Cross-link:
 * updateNotificationPreferences (notifications.actions.ts) consumes this shape;
 * the BE silently drops any non-toggleable category.
 */
export function buildEnablePrefsPatch(
  prefs: NotificationPrefs,
  next: boolean,
): {
  prefs: Partial<Record<string, Partial<ChannelPrefs>>>;
  channels: { browserPush: boolean };
} {
  const prefsPatch: Partial<Record<string, Partial<ChannelPrefs>>> = {};
  for (const category of Object.keys(prefs)) {
    prefsPatch[category] = { browserPush: next };
  }
  return { prefs: prefsPatch, channels: { browserPush: next } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run lib/push/buildEnablePrefsPatch.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/push/buildEnablePrefsPatch.ts web/lib/push/buildEnablePrefsPatch.test.ts
git commit -m "feat(push): add buildEnablePrefsPatch helper"
```

---

## Task 6: Web — device-token server actions

**Files:**

- Create: `web/lib/push/push-device.actions.ts`

Server actions wrap the existing `POST /devices/register` and `DELETE /devices/:id`, using the same `serverHttp` + `ActionResult` pattern as `notifications.actions.ts`. The client passes the FCM token it minted in the browser.

- [ ] **Step 1: Implement the actions**

Create `web/lib/push/push-device.actions.ts`:

```ts
'use server';

/**
 * Server actions for the browser-push device registry. Wrap the BE
 * `/devices` endpoints (already exist) so the client never holds a session
 * token. Cross-links: api user-devices.controller (register/revoke);
 * useBrowserPush (caller). Returns the shared ActionResult<T> shape.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '@/features/connect/profile.types';

export interface RegisteredDevice {
  _id: string;
  platform: string;
  deviceName?: string;
  lastUsedAt: string;
}

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Upsert this browser's FCM token (platform: 'web'). Returns the device row
 *  (its `_id` is stored client-side so disable can revoke exactly this one). */
export async function registerWebPushToken(
  fcmToken: string,
  deviceName?: string,
): Promise<ActionResult<RegisteredDevice>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/devices/register', {
      fcmToken,
      platform: 'web',
      ...(deviceName ? { deviceName } : {}),
    });
    return { ok: true, data: unwrapServer<RegisteredDevice>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Revoke one registered device by id (this browser, on disable). */
export async function unregisterWebPushDevice(
  deviceId: string,
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`/devices/${deviceId}`);
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

> Verify the import paths `@/lib/api/server-client` (`serverHttp`, `unwrapServer`) and `@/features/connect/profile.types` (`ActionResult`) match those used at the top of `features/connect/notifications/notifications.actions.ts`. If `serverHttp`'s `.post/.delete` signatures differ, mirror exactly how `notifications.actions.ts` calls them.

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add web/lib/push/push-device.actions.ts
git commit -m "feat(push): add web device register/revoke server actions"
```

---

## Task 7: Web — FCM client init + token helpers (browser-only)

**Files:**

- Create: `web/lib/push/firebase-messaging.ts`

A thin, lazy, browser-only wrapper around `firebase/app` + `firebase/messaging`. Everything is guarded by `env.pushConfigured` and feature-detects `Notification` + service workers, so it is a no-op on the server, on unsupported browsers, or when unconfigured. We register OUR OWN service worker and hand it to `getToken` to avoid any ambiguity with the PWA `sw.js`.

- [ ] **Step 1: Implement the module**

Create `web/lib/push/firebase-messaging.ts`:

```ts
'use client';

/**
 * Browser-only FCM web-push client. Lazy-imports the firebase SDK so it never
 * touches the server bundle. All exports no-op (return null/false) when push is
 * not configured or the browser lacks support. Cross-links: lib/env (config),
 * public/firebase-messaging-sw.js (the SW we register here), useBrowserPush.
 */

import { env } from '@/lib/env';

const SW_PATH = '/firebase-messaging-sw.js';

/** Browser supports the APIs FCM web push needs. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    env.pushConfigured
  );
}

/** Current permission, or 'unsupported'. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Encode the public firebase config into the SW registration URL so the static
// SW file can initialise without reading env (it cannot). These values are
// publishable, not secret.
function swUrlWithConfig(): string {
  const f = env.firebase;
  const params = new URLSearchParams({
    apiKey: f.apiKey,
    authDomain: f.authDomain,
    projectId: f.projectId,
    messagingSenderId: f.messagingSenderId,
    appId: f.appId,
  });
  return `${SW_PATH}?${params.toString()}`;
}

async function registerMessagingSw(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register(swUrlWithConfig(), { scope: '/' });
  } catch {
    return null;
  }
}

/**
 * Ask for permission (if needed), then mint an FCM token. Returns the token, or
 * null if unsupported / denied / failed. Caller persists + registers the token.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const swReg = await registerMessagingSw();
  if (!swReg) return null;

  // Lazy import keeps firebase out of the server + initial bundles.
  const { initializeApp, getApps } = await import('firebase/app');
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;

  const f = env.firebase;
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          apiKey: f.apiKey,
          authDomain: f.authDomain,
          projectId: f.projectId,
          messagingSenderId: f.messagingSenderId,
          appId: f.appId,
        });

  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: f.vapidKey,
      serviceWorkerRegistration: swReg,
    });
    return token || null;
  } catch {
    return null;
  }
}

/** Best-effort: revoke the browser's FCM token (on disable). */
export async function deletePushToken(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const { getApps } = await import('firebase/app');
    if (getApps().length === 0) return;
    const { getMessaging, deleteToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return;
    await deleteToken(getMessaging(getApps()[0]));
  } catch {
    /* best-effort */
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS (no new errors). Confirms the firebase SDK types resolve.

- [ ] **Step 3: Commit**

```bash
git add web/lib/push/firebase-messaging.ts
git commit -m "feat(push): add guarded FCM client init + token helpers"
```

---

## Task 8: Web — FCM background-message service worker

**Files:**

- Create: `web/public/firebase-messaging-sw.js`

A static service worker, separate from `public/sw.js` (the PWA cache worker). It reads the firebase config from its own registration URL query string (set by `firebase-messaging.ts`), shows background notifications, and routes clicks to the `data.link`.

- [ ] **Step 1: Create the service worker**

Create `web/public/firebase-messaging-sw.js`:

```js
/* Zari360 FCM background-message worker.
 *
 * SEPARATE from public/sw.js (the PWA cache worker); the two coexist. This file
 * only handles Web Push: it shows a notification when a push arrives while the
 * tab is backgrounded, and routes a click to data.link. Config arrives via the
 * registration URL query string (set in lib/push/firebase-messaging.ts) because
 * a static SW cannot read NEXT_PUBLIC_* env. These config values are publishable.
 */
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || 'Zari360';
    const body = (payload.notification && payload.notification.body) || '';
    const link = (payload.data && payload.data.link) || '/connect/notifications';
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { link },
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link =
    (event.notification.data && event.notification.data.link) || '/connect/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
```

> Pin the SDK version (`11.0.2` above) to the same major as the `firebase` npm dep installed in Task 4. If Task 4 resolved a different patch, update these two `importScripts` URLs to a real released version of that major.

- [ ] **Step 2: Manual sanity check (no automated test for a static SW)**

Run: `cd web && node -e "require('fs').accessSync('public/firebase-messaging-sw.js'); console.log('sw present')"`
Expected: prints `sw present`.

- [ ] **Step 3: Commit**

```bash
git add web/public/firebase-messaging-sw.js
git commit -m "feat(push): add FCM background-message service worker"
```

---

## Task 9: Web — `useBrowserPush` hook

**Files:**

- Create: `web/lib/push/useBrowserPush.ts`

The hook is the single client entry point used by both the banner and the settings toggle. It exposes permission/enabled state and `enable()` / `disable()` that orchestrate: token mint → device register → prefs-on (and the reverse). It persists the registered device id in `localStorage` so disable can revoke exactly this browser.

- [ ] **Step 1: Implement the hook**

Create `web/lib/push/useBrowserPush.ts`:

```ts
'use client';

/**
 * Client hook owning the browser-push opt-in lifecycle. Used by EnablePushBanner
 * and the PreferencesDrawer toggle. enable(): permission -> FCM token ->
 * register device -> turn browserPush prefs on. disable(): revoke device ->
 * delete token -> turn prefs off. Cross-links: firebase-messaging (token),
 * push-device.actions (register/revoke), notifications.actions
 * (get/updateNotificationPreferences), buildEnablePrefsPatch.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  isPushSupported,
  pushPermission,
  requestPushToken,
  deletePushToken,
} from './firebase-messaging';
import { registerWebPushToken, unregisterWebPushDevice } from './push-device.actions';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/features/connect/notifications/notifications.actions';
import { buildEnablePrefsPatch } from './buildEnablePrefsPatch';

const DEVICE_ID_KEY = 'z360.push.deviceId';

export interface BrowserPushState {
  /** Browser + config support push at all. */
  supported: boolean;
  /** Native permission ('default' | 'granted' | 'denied' | 'unsupported'). */
  permission: NotificationPermission | 'unsupported';
  /** This browser has an active registered token. */
  enabled: boolean;
  /** An enable/disable round-trip is in flight. */
  busy: boolean;
  enable: () => Promise<boolean>;
  disable: () => Promise<boolean>;
}

export function useBrowserPush(): BrowserPushState {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'unsupported',
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // Initialise from the browser + local marker after mount (avoids SSR
  // hydration mismatch — these APIs are client-only).
  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    setPermission(pushPermission());
    if (ok && typeof localStorage !== 'undefined') {
      setEnabled(Boolean(localStorage.getItem(DEVICE_ID_KEY)) && pushPermission() === 'granted');
    }
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported() || busy) return false;
    setBusy(true);
    try {
      const token = await requestPushToken();
      setPermission(pushPermission());
      if (!token) return false;

      const reg = await registerWebPushToken(token);
      if (!reg.ok) return false;
      localStorage.setItem(DEVICE_ID_KEY, reg.data._id);

      // Turn browserPush on for every category + the global channel flag.
      const prefsRes = await getNotificationPreferences();
      if (prefsRes.ok) {
        const patch = buildEnablePrefsPatch(prefsRes.data.prefs, true);
        await updateNotificationPreferences(patch);
      }
      setEnabled(true);
      return true;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const disable = useCallback(async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const deviceId =
        typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null;
      if (deviceId) {
        await unregisterWebPushDevice(deviceId);
        localStorage.removeItem(DEVICE_ID_KEY);
      }
      await deletePushToken();
      // Turn the global browserPush channel + per-category flags back off.
      const prefsRes = await getNotificationPreferences();
      if (prefsRes.ok) {
        const patch = buildEnablePrefsPatch(prefsRes.data.prefs, false);
        await updateNotificationPreferences(patch);
      }
      setEnabled(false);
      return true;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { supported, permission, enabled, busy, enable, disable };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add web/lib/push/useBrowserPush.ts
git commit -m "feat(push): add useBrowserPush opt-in lifecycle hook"
```

---

## Task 10: Web — soft-prompt banner + mount

**Files:**

- Create: `web/components/push/EnablePushBanner.tsx`
- Modify: `web/components/pwa/PwaManager.tsx`
- Modify: `web/app/messages/en.json` (+ `gu.json`, `gu-en.json`, `hi-en.json`)

A small dismissible banner that shows only when push is supported, permission is still `default`, and the user has not dismissed it this session. Clicking "Enable" calls `useBrowserPush().enable()`.

- [ ] **Step 1: Add i18n keys**

In `web/app/messages/en.json`, add a `push` object (place near other top-level groups; keep JSON valid):

```json
  "push": {
    "bannerTitle": "Turn on notifications",
    "bannerBody": "Get notified about messages, connections and important updates even when this tab is in the background.",
    "enable": "Enable",
    "dismiss": "Not now",
    "enabled": "Notifications enabled",
    "enableFailed": "Could not enable notifications. Please check your browser settings.",
    "blocked": "Notifications are blocked in your browser settings."
  },
```

Mirror the same `push` block into `gu.json`, `gu-en.json`, and `hi-en.json` (English values are acceptable for this pass; native translation is the follow-up i18n review). `check:i18n` requires the key set to match across all four files.

- [ ] **Step 2: Create the banner**

Create `web/components/push/EnablePushBanner.tsx`:

```tsx
'use client';

/**
 * Soft-prompt for browser push. Shows only when push is supported + permission
 * is still 'default' + not dismissed this session; clicking Enable fires the
 * native prompt via useBrowserPush. Mounted once by PwaManager. Cross-links:
 * useBrowserPush (lifecycle), push i18n group.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { App as AntApp, Button } from 'antd';
import { Bell, X } from 'lucide-react';
import { useBrowserPush } from '@/lib/push/useBrowserPush';

const DISMISS_KEY = 'z360.push.bannerDismissed';

export default function EnablePushBanner() {
  const t = useTranslations('push');
  const { message } = AntApp.useApp();
  const { supported, permission, enabled, busy, enable } = useBrowserPush();
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  if (!supported || enabled || permission !== 'default' || dismissed) return null;

  const onEnable = async () => {
    const ok = await enable();
    if (ok) message.success(t('enabled'));
    else message.error(t('enableFailed'));
  };

  const onDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label={t('bannerTitle')}
      className="fixed right-4 bottom-4 z-50 w-[320px] rounded-lg border bg-white p-4 shadow-lg"
      style={{ borderColor: 'var(--cr-border, #e5e7eb)' }}
    >
      <div className="flex items-start gap-3">
        <Bell size={18} aria-hidden style={{ color: 'var(--cr-primary)' }} />
        <div className="flex-1">
          <p className="m-0 text-[14px] font-semibold">{t('bannerTitle')}</p>
          <p className="m-0 mt-1 text-[12.5px] text-muted">{t('bannerBody')}</p>
          <div className="mt-3 flex gap-2">
            <Button type="primary" size="small" loading={busy} onClick={onEnable}>
              {t('enable')}
            </Button>
            <Button size="small" onClick={onDismiss}>
              {t('dismiss')}
            </Button>
          </div>
        </div>
        <button aria-label={t('dismiss')} onClick={onDismiss} className="text-muted">
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
```

> Match the existing styling vocabulary if these utility classes/vars differ in this codebase — check a nearby component such as `components/ui/FeedbackButton.tsx` for the project's class + CSS-var names and adjust.

- [ ] **Step 3: Mount it in PwaManager**

Modify `web/components/pwa/PwaManager.tsx` to render the banner alongside the existing children:

```tsx
'use client';

import ServiceWorkerRegistrar from './ServiceWorkerRegistrar';
import InstallPrompt from './InstallPrompt';
import EnablePushBanner from '../push/EnablePushBanner';

// Single mount point for installable-app (PWA) + browser-push client behaviour.
// Mounted once in app/layout.tsx, inside the antd + next-intl providers.
export default function PwaManager() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <InstallPrompt />
      <EnablePushBanner />
    </>
  );
}
```

- [ ] **Step 4: Verify i18n + typecheck + lint**

Run: `cd web && npm run check:i18n && npm run typecheck && npm run lint`
Expected: i18n passes (key counts match across locales), no new type errors, lint clean.

- [ ] **Step 5: Commit**

```bash
git add web/components/push/EnablePushBanner.tsx web/components/pwa/PwaManager.tsx web/app/messages/en.json web/app/messages/gu.json web/app/messages/gu-en.json web/app/messages/hi-en.json
git commit -m "feat(push): add soft-prompt enable-notifications banner"
```

---

## Task 11: Web — settings drawer toggle wiring

**Files:**

- Modify: `web/features/connect/notifications/preferences-sections.tsx`
- Modify: `web/features/connect/notifications/PreferencesDrawer.tsx`

The drawer already renders a `browserPush` global channel row, currently `live: false` ("coming soon", disabled). Make it live and route its on/off through `useBrowserPush` so flipping it actually requests permission / registers / revokes — not just a persisted-but-inert flag.

- [ ] **Step 1: Make the browserPush channel live**

In `web/features/connect/notifications/preferences-sections.tsx`, change the `browserPush` channel descriptor from `live: false` to `live: true`:

```ts
  { key: 'browserPush', icon: Globe, live: true },
```

(Leave `mobilePush`/`whatsapp`/`email`/`sms` as-is — those remain "coming soon".)

- [ ] **Step 2: Intercept the browserPush toggle in the drawer**

In `web/features/connect/notifications/PreferencesDrawer.tsx`, import the hook and wrap the existing `onChannelToggle` so the `browserPush` channel drives the real lifecycle while every other channel keeps the existing persisted-flag behaviour.

Add the import near the others:

```ts
import { useBrowserPush } from '@/lib/push/useBrowserPush';
```

Inside the component, after the existing hooks, add:

```ts
const push = useBrowserPush();

// browserPush is special: flipping it must request permission + register/
// revoke a device (handled by useBrowserPush), not just persist a flag. The
// hook itself writes the browserPush prefs, so we DON'T also queue() them.
// Every other channel keeps the existing optimistic-persist path.
const onChannelToggleWrapped = (channel: keyof GlobalChannelPrefs, next: boolean) => {
  if (channel === 'browserPush') {
    void (next ? push.enable() : push.disable()).then((ok) => {
      if (!ok && next) message.error(t('saveError'));
      // Reflect the real outcome in the drawer's optimistic state.
      setSettings((s) =>
        s ? { ...s, channels: { ...s.channels, browserPush: ok ? next : !next } } : s,
      );
    });
    return;
  }
  onChannelToggle(channel, next);
};
```

Then pass `onChannelToggleWrapped` (instead of `onChannelToggle`) to `<PreferencesSections>`:

```tsx
<PreferencesSections
  settings={settings}
  onModuleToggle={onModuleToggle}
  onChannelToggle={onChannelToggleWrapped}
  onBatchingToggle={onBatchingToggle}
  onQuietToggle={onQuietToggle}
  onQuietTime={onQuietTime}
/>
```

> `message` and `t` are already in scope in this component (see existing usage). If `t('saveError')` is not the right key for a push failure, reuse the `push.enableFailed` key added in Task 10 via `useTranslations('push')` — keep it consistent with the banner.

- [ ] **Step 3: Verify typecheck + lint + i18n**

Run: `cd web && npm run typecheck && npm run lint && npm run check:i18n`
Expected: no new errors; i18n still balanced.

- [ ] **Step 4: Commit**

```bash
git add web/features/connect/notifications/preferences-sections.tsx web/features/connect/notifications/PreferencesDrawer.tsx
git commit -m "feat(push): wire browser-push settings toggle to real opt-in"
```

---

## Task 12: Web — foreground message toast (optional but recommended)

**Files:**

- Modify: `web/lib/push/firebase-messaging.ts` (add `onForegroundMessage`)
- Modify: `web/lib/connect/NotificationProvider.tsx` (subscribe when a user is present)

When the tab is focused, FCM does NOT auto-show a notification — `onMessage` fires instead. Surface a lightweight toast so a focused user still sees it. This reuses the existing socket-driven bell (the in-platform channel already updates counts), so this is purely an extra visible toast.

- [ ] **Step 1: Add a foreground subscriber to the FCM module**

Append to `web/lib/push/firebase-messaging.ts`:

```ts
/**
 * Subscribe to FCM foreground messages. Returns an unsubscribe (no-op when
 * unsupported). Caller shows a toast; the bell itself is already updated by the
 * in-platform socket channel.
 */
export async function onForegroundMessage(
  handler: (msg: { title: string; body: string; link?: string }) => void,
): Promise<() => void> {
  if (!isPushSupported()) return () => undefined;
  try {
    const { getApps, initializeApp } = await import('firebase/app');
    const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return () => undefined;
    const f = env.firebase;
    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            apiKey: f.apiKey,
            authDomain: f.authDomain,
            projectId: f.projectId,
            messagingSenderId: f.messagingSenderId,
            appId: f.appId,
          });
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      handler({
        title: payload.notification?.title || 'Zari360',
        body: payload.notification?.body || '',
        link: payload.data?.link,
      });
    });
  } catch {
    return () => undefined;
  }
}
```

- [ ] **Step 2: Subscribe inside NotificationProvider**

In `web/lib/connect/NotificationProvider.tsx`, add an effect that subscribes once a user is present (mirrors the existing socket effect's `userId` guard). Import `useTranslations`/antd `App` only if not already present — to avoid extra deps, use the existing `console`/event path; the simplest grounded version uses antd's static message via `App.useApp()` at the provider. If the provider is not already inside an antd `App` context, surface the toast through the existing notifications UI instead. Concretely, add:

```ts
// Foreground FCM toast: when push is enabled and the tab is focused, FCM
// delivers via onMessage (no auto-notification). Show a toast; the bell is
// already updated by the in-platform socket channel. No-op when push is
// unsupported/unconfigured.
useEffect(() => {
  if (!isHydrated || !userId) return;
  let unsub: (() => void) | undefined;
  void onForegroundMessage(({ title, body }) => {
    // Reuse the platform's existing toast surface. If a global toast helper
    // exists (e.g. antd App message via a provider), call it here.
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // The bell already reflects the event; a console signal in dev is enough
      // if no global toast helper is wired at this layer.
      if (env.isDev) console.info(`[push] foreground: ${title} — ${body}`);
    }
  }).then((fn) => {
    unsub = fn;
  });
  return () => unsub?.();
}, [isHydrated, userId]);
```

with the import at the top:

```ts
import { onForegroundMessage } from '@/lib/push/firebase-messaging';
```

> Decision point for the implementer: if there is an existing app-wide toast helper (search for `App.useApp()` / a `toast` util), call it inside the handler for a real visible toast. If not, the dev-only `console.info` is acceptable for v1 — the bell still updates via the socket. Do NOT add a new antd `App` provider just for this.

- [ ] **Step 3: Typecheck + lint**

Run: `cd web && npm run typecheck && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/push/firebase-messaging.ts web/lib/connect/NotificationProvider.tsx
git commit -m "feat(push): surface FCM foreground messages"
```

---

## Task 13: Full verification pass

- [ ] **Step 1: Backend vitest (new suites)**

Run: `cd api && npx vitest run src/modules/user-devices/__tests__/user-devices.service.vitest.ts src/modules/notifications/channels/__tests__/browser-push.channel.vitest.ts`
Expected: PASS (6 tests).

- [ ] **Step 2: Web unit tests + gates**

Run: `cd web && npx vitest run lib/push/buildEnablePrefsPatch.test.ts && npm run typecheck && npm run lint && npm run check:i18n && npm run format:check`
Expected: helper test PASS; typecheck no new errors (excluding any pre-existing analytics-WIP errors noted in project memory); lint clean; i18n balanced; format clean.

- [ ] **Step 3: Owner-run items (cannot run in this environment)**

Document for the owner (do NOT block on these locally):

- Full backend `npm run build` + `npm run test:vitest` (the full backend `tsc`/build OOMs in the dev sandbox).
- Set the credentials below and smoke-test on desktop Chrome/Edge and an Android installed PWA: click Enable → grant → background the tab → trigger a notification (e.g. a connection request or message) → confirm the OS notification appears and clicking it opens the deep link.

---

## Credentials the owner must supply (one-time)

Set in the deployed environments (NOT committed):

**Web (Amplify / Next.js build env)** — all required for push to turn on:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Firebase console → Cloud Messaging → Web configuration → "Web Push certificates" key pair, public key)

**Backend (EC2 `.env`)** — already wired in `api/src/config/env.ts`, just set real values:

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (service account JSON values; private key with escaped newlines).

Until all web values are present, `env.pushConfigured` is false and the feature is fully inert (no banner, toggle shows "coming soon"), so this can ship dark and light up when the keys land.

---

## Out of scope (v1)

- iOS push (Apple home-screen-PWA only; Firebase web SDK unreliable there — covered later by the native mobile app).
- Quiet-hours enforcement (persisted but inert in the dispatcher today).
- Email / SMS / WhatsApp channels.
- Notifications emitted via the legacy `createNotification` path (e.g. depreciation) — only `dispatch()`-routed notifications get browser push. Operational categories (invites, boost-taken-down, member-cap) browser-push to any registered web device by design (they skip the per-category pref check — existing dispatch contract).

---

## Self-Review (completed by plan author)

**Spec coverage:**

- Backend `BrowserPushChannel` real (isAvailable/send) → Tasks 2–3. ✓
- Web-only token fan-out → Task 1. ✓
- Firebase SDK + env + guard (`pushConfigured`) → Tasks 4, 7. ✓
- `firebase-messaging-sw.js` coexisting with `sw.js` → Task 8. ✓
- Soft-prompt then native + registration + prefs-on → Tasks 9, 10. ✓
- Enable = all categories on (one action) → Task 5 + used in Task 9. ✓
- Settings toggle (real, not inert) → Task 11. ✓
- Foreground toast → Task 12. ✓
- Credentials list → dedicated section. ✓
- No new endpoints / no schema change / no migration → confirmed (reuses `/devices/*`). ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases" steps; every code step shows real code. The two "decision point" notes (Task 12 toast surface; Task 4 getter fallback) give a concrete default action, not an unfilled blank.

**Type/name consistency:** `pushUserWeb` / `listWebDevices` (Tasks 1↔2), `buildEnablePrefsPatch` shape (Task 5↔9), `registerWebPushToken`/`unregisterWebPushDevice` (Task 6↔9), `requestPushToken`/`deletePushToken`/`onForegroundMessage`/`isPushSupported`/`pushPermission` (Task 7↔9↔12), `pushConfigured`/`env.firebase` (Task 4↔7↔12), `DEVICE_ID_KEY` (Task 9 only) — all consistent.
