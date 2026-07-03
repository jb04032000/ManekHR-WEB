# Connect Notifications Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/connect/notifications` to the reference bar - tabbed list with counts, richer rows with a per-row action, a settings drawer (modules / channels / smart delivery), and an ads right rail - plus additive backend structure for future channels and quiet hours (only In-app honoured today).

**Architecture:** Frontend-heavy redesign in `crewroster-web` over additive, behaviour-preserving backend structure in `crewroster-backend`. The notification list stays Connect-scoped. Preferences move from a standalone page into a `<Drawer>`; the page is kept as a fallback. Module toggles map to the existing per-category `inPlatform` prefs; channels + smart-delivery are new global settings persisted but inert (except In-app + existing batching).

**Tech Stack:** Next.js (App Router, server actions), React client islands, AntD v6, Tailwind + `cr-` design tokens, `next-intl` (4 locales), NestJS + Mongoose, vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-connect-notifications-redesign-design.md`

## Binding repo rules (do not violate)

- **Zero git ops by the assistant.** The owner stages + commits. This plan groups work into **owner-commit checkpoints** instead of `git commit` steps. Do NOT run `git add` / `git commit`. (`feedback_no_git_ops`)
- **Logical change gate:** the backend schema/endpoint additions in Phase 1 are a logical change; the owner approved building the structure on 2026-06-09. (`feedback_polish_only`)
- **AntD v6:** `<Drawer size>` not `width`; `destroyOnHidden` not `destroyOnClose`; no banned legacy APIs. (`crewroster-web/CLAUDE.md`)
- **BE test resource caution:** run ONLY the touched module's vitest file with `--no-file-parallelism`; typecheck BE via `npx nest build` (SWC), never whole-project `tsc`. (`feedback_be_test_resource`)
- **Code comments on change:** every new/edited non-trivial piece gets a short what / cross-link / gotcha comment. (`feedback_code_comments_on_change`)
- **No em-dash** anywhere (code, comments, i18n, chat). Use hyphen / comma / period. (`feedback_no_em_dash`)
- **Build it all, report once.** Implement every phase end to end; the owner tests the whole thing at the end. (`feedback_implement_full_scope_no_per_slice_approval`)

---

## File Structure

**Backend (`crewroster-backend`)**

- Modify: `src/modules/notifications/notification-categories.ts` - add global channel + delivery types and defaults.
- Modify: `src/modules/notifications/schemas/notification-preferences.schema.ts` - add `channels` + `delivery` props.
- Modify: `src/modules/notifications/notification-preferences.service.ts` - add `getSettingsForUser` + `updateSettings`.
- Modify: `src/modules/notifications/me-notifications.controller.ts` - extend GET/PATCH preferences envelope.
- Modify: `src/modules/notifications/__tests__/notification-preferences.service.vitest.ts` - cover the new settings.

**Frontend (`crewroster-web`)**

- Modify: `features/connect/notifications/notifications.actions.ts` - new settings types + GET/PATCH envelope.
- Create: `features/connect/notifications/notification-presentation.ts` - pure helpers (group, tag, primary action, context line) + their unit test.
- Create: `features/connect/notifications/notification-presentation.test.ts`
- Create: `features/connect/notifications/NotificationRow.tsx` - one row (faces / tag / context / action).
- Create: `features/connect/notifications/PreferencesDrawer.tsx` - 3-section settings drawer.
- Create: `features/connect/notifications/preferences-sections.tsx` - shared module/channel/delivery section UI used by both the drawer and the full page.
- Modify: `features/connect/notifications/NotificationsScreen.tsx` - tabs+counts, day-group counts, rows via `NotificationRow`, gear opens drawer, rail -> `ConnectRightRail`.
- Modify: `features/connect/notifications/PreferencesForm.tsx` - reuse `preferences-sections.tsx` so the full page mirrors the drawer.
- Modify: `app/connect/notifications/preferences/page.tsx` - load the full settings envelope.
- Modify: `app/connect/notifications/loading.tsx` - skeleton mirrors tabs + new row anatomy + ad rail.
- Modify: `app/messages/en.json`, `gu.json`, `gu-en.json`, `hi-en.json` - extend `connect.notifications`.

---

# Phase 1 - Backend: additive settings structure (TDD)

### Task 1.1: Add global-channel + delivery types and defaults

**Files:**

- Modify: `src/modules/notifications/notification-categories.ts`

- [ ] **Step 1: Append the new types + defaults** to the bottom of `notification-categories.ts`:

```ts
/* ── Global delivery settings (structure for future channels) ─────────────
 * These live ALONGSIDE the per-category `ChannelPrefs` above. The per-category
 * map stays the module master-mute (inPlatform); these globals describe HOW the
 * user wants to be reached. Only `inApp` is honoured by the dispatcher today
 * (browserPush/whatsapp/email/sms + quietHours are persisted but inert). Drawer
 * UI: features/connect/notifications/PreferencesDrawer.tsx. */
export interface GlobalChannelPrefs {
  inApp: boolean; // always-on; the engine. Cannot be turned off.
  browserPush: boolean;
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // 'HH:mm'
  end: string; // 'HH:mm'
  tz: string; // IANA zone, e.g. 'Asia/Kolkata'
}

export interface DeliverySettings {
  smartBatching: boolean; // honoured for in-app (existing batching); inert elsewhere
  quietHours: QuietHours; // persisted, NOT enforced yet
}

export function defaultGlobalChannels(): GlobalChannelPrefs {
  return { inApp: true, browserPush: false, whatsapp: false, email: false, sms: false };
}

export function defaultDeliverySettings(): DeliverySettings {
  return {
    smartBatching: true,
    quietHours: { enabled: false, start: '22:00', end: '07:00', tz: 'Asia/Kolkata' },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd crewroster-backend && npx nest build`
Expected: builds clean (no emit errors).

### Task 1.2: Add `channels` + `delivery` to the schema

**Files:**

- Modify: `src/modules/notifications/schemas/notification-preferences.schema.ts`

- [ ] **Step 1: Import the new types + defaults**. Change the type import line to also pull the new symbols:

```ts
import type {
  ChannelPrefs,
  NotificationCategory,
  GlobalChannelPrefs,
  DeliverySettings,
} from '../notification-categories';
import { defaultGlobalChannels, defaultDeliverySettings } from '../notification-categories';
```

- [ ] **Step 2: Add the two props** after the existing `prefs` prop, inside the class:

```ts
  /**
   * Global delivery channels (additive 2026-06-09). Sparse + lazily defaulted
   * like `prefs`. Only `inApp` is honoured by the dispatcher today; the rest are
   * structure-only so the settings UI persists the user's future choice.
   */
  @Prop({ type: Object, default: () => defaultGlobalChannels() })
  channels: GlobalChannelPrefs;

  /**
   * Smart-delivery settings (additive 2026-06-09). `smartBatching` ties into the
   * existing in-app batching; `quietHours` is stored but not enforced yet.
   */
  @Prop({ type: Object, default: () => defaultDeliverySettings() })
  delivery: DeliverySettings;
```

- [ ] **Step 3: Typecheck**

Run: `cd crewroster-backend && npx nest build`
Expected: builds clean.

### Task 1.3: Service - read settings (failing test first)

**Files:**

- Modify: `src/modules/notifications/__tests__/notification-preferences.service.vitest.ts`
- Modify: `src/modules/notifications/notification-preferences.service.ts`

- [ ] **Step 1: Add failing tests** at the end of the `describe` block in the vitest file:

```ts
it('getSettingsForUser returns default channels + delivery on first read', async () => {
  const service = build();
  const settings = await service.getSettingsForUser(userId);
  expect(settings.channels).toEqual({
    inApp: true,
    browserPush: false,
    whatsapp: false,
    email: false,
    sms: false,
  });
  expect(settings.delivery).toEqual({
    smartBatching: true,
    quietHours: { enabled: false, start: '22:00', end: '07:00', tz: 'Asia/Kolkata' },
  });
});

it('getSettingsForUser fills missing blocks on a legacy (pre-field) doc', async () => {
  stored = { prefs: {} }; // legacy doc: no channels/delivery
  const service = build();
  const settings = await service.getSettingsForUser(userId);
  expect(settings.channels.inApp).toBe(true);
  expect(settings.delivery.quietHours.tz).toBe('Asia/Kolkata');
});

it('updateSettings merges channels + delivery and pins inApp on', async () => {
  const service = build();
  await service.getSettingsForUser(userId); // seed
  const next = await service.updateSettings(userId, {
    channels: { whatsapp: true, inApp: false }, // inApp:false must be ignored
    delivery: { quietHours: { enabled: true } },
  });
  expect(next.channels.whatsapp).toBe(true);
  expect(next.channels.inApp).toBe(true); // pinned
  expect(next.delivery.quietHours.enabled).toBe(true);
  expect(next.delivery.quietHours.start).toBe('22:00'); // preserved
  const writeArg = prefsModel.updateOne.mock.calls.at(-1)[1].$set;
  expect(writeArg.channels.whatsapp).toBe(true);
  expect(writeArg.delivery.quietHours.enabled).toBe(true);
});
```

- [ ] **Step 2: Run - verify it fails**

Run: `cd crewroster-backend && npx vitest run src/modules/notifications/__tests__/notification-preferences.service.vitest.ts --no-file-parallelism`
Expected: FAIL - `service.getSettingsForUser is not a function`.

- [ ] **Step 3: Implement** in `notification-preferences.service.ts`. Add to the imports:

```ts
import {
  USER_TOGGLEABLE_CATEGORIES,
  defaultChannelPrefs,
  defaultPreferences,
  defaultGlobalChannels,
  defaultDeliverySettings,
  type ChannelPrefs,
  type NotificationCategory,
  type GlobalChannelPrefs,
  type DeliverySettings,
} from './notification-categories';
```

Add this exported type near `UserNotificationPrefs`:

```ts
/** Full settings envelope returned to the drawer + full preferences page. */
export interface UserNotificationSettings {
  channels: GlobalChannelPrefs;
  delivery: DeliverySettings;
}
```

Add these two methods inside the class (after `update`):

```ts
  /**
   * Read the user's global channel + smart-delivery settings, creating the
   * default doc on first access and back-filling either block on a legacy doc
   * that predates the fields. `inApp` is always coerced on (it is the engine).
   * Pairs with the per-category `getForUser`; the controller returns both.
   */
  async getSettingsForUser(userId: string | Types.ObjectId): Promise<UserNotificationSettings> {
    const uid = this.toObjectId(userId);
    let doc = await this.prefsModel.findOne({ userId: uid }).exec();
    if (!doc) {
      doc = await this.prefsModel.create({ userId: uid, prefs: defaultPreferences() });
    }
    const dc = defaultGlobalChannels();
    const dd = defaultDeliverySettings();
    return {
      channels: { ...dc, ...(doc.channels ?? {}), inApp: true },
      delivery: {
        smartBatching: doc.delivery?.smartBatching ?? dd.smartBatching,
        quietHours: { ...dd.quietHours, ...(doc.delivery?.quietHours ?? {}) },
      },
    };
  }

  /**
   * Patch global channels + smart-delivery. `inApp` can never be turned off
   * (the in-app channel IS the notifications engine). Unknown keys are dropped
   * by the typed spread. Returns the merged settings.
   */
  async updateSettings(
    userId: string | Types.ObjectId,
    patch: { channels?: Partial<GlobalChannelPrefs>; delivery?: Partial<DeliverySettings> },
  ): Promise<UserNotificationSettings> {
    const uid = this.toObjectId(userId);
    const current = await this.getSettingsForUser(userId);
    const nextChannels: GlobalChannelPrefs = {
      ...current.channels,
      ...(patch.channels ?? {}),
      inApp: true, // pinned on
    };
    const nextDelivery: DeliverySettings = {
      smartBatching:
        typeof patch.delivery?.smartBatching === 'boolean'
          ? patch.delivery.smartBatching
          : current.delivery.smartBatching,
      quietHours: { ...current.delivery.quietHours, ...(patch.delivery?.quietHours ?? {}) },
    };
    await this.prefsModel
      .updateOne({ userId: uid }, { $set: { channels: nextChannels, delivery: nextDelivery } }, { upsert: true })
      .exec();
    return { channels: nextChannels, delivery: nextDelivery };
  }
```

- [ ] **Step 4: Run - verify pass**

Run: `cd crewroster-backend && npx vitest run src/modules/notifications/__tests__/notification-preferences.service.vitest.ts --no-file-parallelism`
Expected: PASS (all prior + 3 new tests).

### Task 1.4: Controller - extend GET/PATCH envelope

**Files:**

- Modify: `src/modules/notifications/me-notifications.controller.ts`

- [ ] **Step 1: Widen the imported type** line:

```ts
import type { ChannelPrefs, GlobalChannelPrefs, DeliverySettings } from './notification-categories';
```

- [ ] **Step 2: Replace `getPreferences`** to compose the full envelope:

```ts
  /** Return the user's full preference map PLUS global channel + delivery
   *  settings (the settings drawer reads all three). */
  @Get('preferences')
  async getPreferences(@Req() req) {
    const [prefs, settings] = await Promise.all([
      this.preferencesService.getForUser(req.user.sub),
      this.preferencesService.getSettingsForUser(req.user.sub),
    ]);
    return { prefs, channels: settings.channels, delivery: settings.delivery };
  }
```

- [ ] **Step 3: Replace `updatePreferences`** to accept the extended body:

```ts
  /** Patch prefs (per-category module mutes) and/or global channels + delivery.
   *  Unknown/non-toggleable categories dropped server-side; `channels.inApp`
   *  can never be disabled. Returns the merged envelope. */
  @Patch('preferences')
  async updatePreferences(
    @Req() req,
    @Body()
    body: {
      prefs?: Partial<Record<string, Partial<ChannelPrefs>>>;
      channels?: Partial<GlobalChannelPrefs>;
      delivery?: Partial<DeliverySettings>;
    },
  ) {
    const prefs = body?.prefs
      ? await this.preferencesService.update(req.user.sub, body.prefs)
      : await this.preferencesService.getForUser(req.user.sub);
    const settings =
      body?.channels || body?.delivery
        ? await this.preferencesService.updateSettings(req.user.sub, {
            channels: body.channels,
            delivery: body.delivery,
          })
        : await this.preferencesService.getSettingsForUser(req.user.sub);
    return { prefs, channels: settings.channels, delivery: settings.delivery };
  }
```

- [ ] **Step 4: Typecheck + re-run module tests**

Run: `cd crewroster-backend && npx nest build`
Expected: builds clean.
Run: `cd crewroster-backend && npx vitest run src/modules/notifications/__tests__/notification-preferences.service.vitest.ts --no-file-parallelism`
Expected: PASS.

- [ ] **CHECKPOINT 1 (owner commits):** backend additive settings structure. Suggested message: `feat(notifications): add global channel + smart-delivery settings structure (in-app honoured; rest inert)`.

---

# Phase 2 - Frontend data layer

### Task 2.1: Extend the server-action types + envelope

**Files:**

- Modify: `features/connect/notifications/notifications.actions.ts`

- [ ] **Step 1: Add the new types** after the `NotificationPrefs` type (around line 47):

```ts
/** Global delivery channels (mirrors BE `GlobalChannelPrefs`). Only `inApp` is
 *  honoured today; the rest are structure-only and render "coming soon". */
export interface GlobalChannelPrefs {
  inApp: boolean;
  browserPush: boolean;
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // 'HH:mm'
  end: string;
  tz: string;
}

export interface DeliverySettings {
  smartBatching: boolean;
  quietHours: QuietHours;
}

/** Full settings envelope from `GET /me/notifications/preferences`. */
export interface NotificationSettings {
  prefs: NotificationPrefs;
  channels: GlobalChannelPrefs;
  delivery: DeliverySettings;
}
```

- [ ] **Step 2: Replace `getNotificationPreferences`** to return the full envelope:

```ts
export async function getNotificationPreferences(): Promise<ActionResult<NotificationSettings>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/notifications/preferences');
    return { ok: true, data: unwrapServer<NotificationSettings>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

- [ ] **Step 3: Replace `updateNotificationPreferences`** to accept + return the envelope:

```ts
export async function updateNotificationPreferences(patch: {
  prefs?: Partial<Record<string, Partial<ChannelPrefs>>>;
  channels?: Partial<GlobalChannelPrefs>;
  delivery?: Partial<DeliverySettings>;
}): Promise<ActionResult<NotificationSettings>> {
  try {
    const http = await serverHttp();
    const res = await http.patch('/me/notifications/preferences', patch);
    return { ok: true, data: unwrapServer<NotificationSettings>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

- [ ] **Step 4: Typecheck the touched file**

Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "notifications.actions" || echo "no errors in notifications.actions"`
Expected: `no errors in notifications.actions` (PreferencesForm/page errors are expected until Phase 4; they will be fixed there).

---

# Phase 3 - Frontend: list redesign

### Task 3.1: Presentation helpers (TDD - pure functions)

**Files:**

- Create: `features/connect/notifications/notification-presentation.ts`
- Create: `features/connect/notifications/notification-presentation.test.ts`

- [ ] **Step 1: Write the failing test** in `notification-presentation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupOf, primaryAction, type TopicGroup } from './notification-presentation';
import type { NotificationItem } from './notifications.actions';

function n(category: string, extra: Partial<NotificationItem> = {}): NotificationItem {
  return {
    _id: 'x',
    recipientId: 'r',
    category,
    title: 't',
    message: 'm',
    isRead: false,
    createdAt: '2026-06-09T00:00:00.000Z',
    ...extra,
  } as NotificationItem;
}

describe('groupOf', () => {
  const cases: Array<[string, TopicGroup | null]> = [
    ['connect.post_reacted', 'feed'],
    ['connect.connection_requested', 'network'],
    ['connect.page_followed', 'network'],
    ['connect.inquiry_received', 'marketplace'],
    ['connect.job_application_received', 'jobs'],
    ['connect.message_received', 'messages'],
    ['INVITE_RECEIVED', 'system'],
  ];
  it.each(cases)('maps %s -> %s', (cat, group) => {
    expect(groupOf(n(cat))).toBe(group);
  });
});

describe('primaryAction', () => {
  it('returns a labelled href for an inquiry', () => {
    const a = primaryAction(n('connect.inquiry_received'));
    expect(a?.labelKey).toBe('actions.viewInquiries');
  });
  it('returns null for an unknown category', () => {
    expect(primaryAction(n('connect.unknown'))).toBeNull();
  });
  it('deep-links a post action to its entity', () => {
    const a = primaryAction(n('connect.post_commented', { entityId: 'p1' }));
    expect(a?.href).toBe('/connect/posts/p1');
    expect(a?.labelKey).toBe('actions.reply');
  });
});
```

- [ ] **Step 2: Run - verify it fails**

Run: `cd crewroster-web && npx vitest run features/connect/notifications/notification-presentation.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement** `notification-presentation.ts`:

```ts
/**
 * notification-presentation - pure mapping helpers for the notifications center.
 * Keeps category -> group / tag / primary-action logic out of the React tree so
 * it is unit-testable. Consumed by NotificationsScreen + NotificationRow.
 * Cross-links: BE category keys in notification-categories.ts; deep-link targets
 * mirror the old NotificationsScreen.notificationHref.
 */
import type { NotificationItem } from './notifications.actions';

export type TopicGroup = 'network' | 'feed' | 'jobs' | 'marketplace' | 'messages' | 'system';
export const TOPIC_GROUPS: TopicGroup[] = [
  'network',
  'feed',
  'jobs',
  'marketplace',
  'messages',
  'system',
];

export function categoryOf(n: NotificationItem): string {
  return n.category ?? (n.metadata as { category?: string } | null)?.category ?? '';
}

/** Map a notification to its tab group. Returns null only for truly unknown
 *  rows (shown under All / Unread but no topic tab). */
export function groupOf(n: NotificationItem): TopicGroup | null {
  const cat = categoryOf(n);
  if (cat.startsWith('connect.post_')) return 'feed';
  if (cat === 'connect.message_received') return 'messages';
  if (
    cat === 'connect.followed' ||
    cat === 'connect.page_followed' ||
    cat.startsWith('connect.connection_')
  ) {
    return 'network';
  }
  if (cat === 'connect.inquiry_received') return 'marketplace';
  if (cat.includes('job')) return 'jobs';
  if (cat === 'INVITE_RECEIVED' || cat === 'INVITE_ACCEPTED') return 'system';
  return null;
}

/** Per-row category tag key (i18n under connect.notifications.tag.*). */
export function tagKeyOf(n: NotificationItem): string {
  const cat = categoryOf(n);
  switch (cat) {
    case 'connect.post_reacted':
      return 'reaction';
    case 'connect.post_commented':
      return 'comment';
    case 'connect.post_reposted':
      return 'repost';
    case 'connect.post_replied':
      return 'reply';
    case 'connect.followed':
      return 'follow';
    case 'connect.page_followed':
      return 'pageFollow';
    case 'connect.inquiry_received':
      return 'inquiry';
    case 'connect.message_received':
      return 'message';
    case 'connect.job_application_received':
    case 'connect.job_application_accepted':
    case 'connect.job_application_declined':
      return 'job';
    case 'connect.connection_requested':
    case 'connect.connection_accepted':
      return 'connection';
    case 'INVITE_RECEIVED':
    case 'INVITE_ACCEPTED':
      return 'system';
    default:
      return 'connection';
  }
}

export interface PrimaryAction {
  labelKey: string; // i18n key under connect.notifications
  href: string;
}

/** Resolve a row's primary action (label + deep link). Null = no button. */
export function primaryAction(n: NotificationItem): PrimaryAction | null {
  const cat = categoryOf(n);
  const meta = (n.metadata ?? {}) as { threadId?: string; pageId?: string };
  switch (cat) {
    case 'connect.connection_requested':
      return { labelKey: 'actions.viewRequest', href: '/connect/network?tab=invitations' };
    case 'connect.connection_accepted':
    case 'connect.followed':
      return { labelKey: 'actions.message', href: '/connect/network' };
    case 'connect.page_followed':
      return {
        labelKey: 'actions.viewPage',
        href: n.entityId ? `/connect/pages/${n.entityId}` : '/connect/pages',
      };
    case 'connect.post_reacted':
    case 'connect.post_reposted':
      return {
        labelKey: 'actions.viewPost',
        href: n.entityId ? `/connect/posts/${n.entityId}` : '/connect/feed',
      };
    case 'connect.post_commented':
    case 'connect.post_replied':
      return {
        labelKey: 'actions.reply',
        href: n.entityId ? `/connect/posts/${n.entityId}` : '/connect/feed',
      };
    case 'connect.inquiry_received':
      return {
        labelKey: 'actions.viewInquiries',
        href: meta.threadId
          ? `/connect/inbox?thread=${meta.threadId}`
          : '/connect/inbox?channel=inquiry',
      };
    case 'connect.job_application_received':
      return {
        labelKey: 'actions.viewApplicants',
        href: n.entityId ? `/connect/jobs/${n.entityId}` : '/connect/jobs',
      };
    case 'connect.job_application_accepted':
    case 'connect.job_application_declined':
      return {
        labelKey: 'actions.viewJob',
        href: n.entityId ? `/connect/jobs/${n.entityId}` : '/connect/jobs',
      };
    case 'connect.message_received':
      return {
        labelKey: 'actions.message',
        href: meta.threadId ? `/connect/inbox?thread=${meta.threadId}` : '/connect/inbox',
      };
    case 'INVITE_RECEIVED':
    case 'INVITE_ACCEPTED':
      return { labelKey: 'actions.view', href: '/dashboard/invitations' };
    default:
      return null;
  }
}

/** Whole-row navigation target (used for mark-read + click). Falls back to the
 *  primary action href; null = no navigation. */
export function rowHref(n: NotificationItem): string | null {
  return primaryAction(n)?.href ?? null;
}

export function dayBucket(iso: string, now: number): 'today' | 'week' | 'earlier' {
  const day = 24 * 60 * 60 * 1000;
  const diff = now - new Date(iso).getTime();
  if (diff < day && new Date(iso).getDate() === new Date(now).getDate()) return 'today';
  return diff < 7 * day ? 'week' : 'earlier';
}
```

- [ ] **Step 4: Run - verify pass**

Run: `cd crewroster-web && npx vitest run features/connect/notifications/notification-presentation.test.ts`
Expected: PASS.

### Task 3.2: `NotificationRow` component

**Files:**

- Create: `features/connect/notifications/NotificationRow.tsx`

- [ ] **Step 1: Implement** the row. It owns avatar/grouped-faces, lead line, message, context line, tag, time, primary action button, unread dot, and the delete button. Props are fully resolved by the parent (actor lookups stay in the screen).

```tsx
'use client';

/**
 * NotificationRow - one notification card for the center. Renders grouped actor
 * faces ("+N"), a category tag, an opportunistic context line (only from known
 * metadata, never fabricated), a per-row primary action button (deep link), the
 * unread dot, and the delete affordance. Pure presentation: the parent
 * (NotificationsScreen) resolves actors + handles click/delete.
 * Cross-links: presentation helpers in notification-presentation.ts.
 */

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Bell, Building2, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import type { NotificationItem } from './notifications.actions';
import type { PersonRef } from '@/features/connect/network.types';
import { primaryAction, tagKeyOf } from './notification-presentation';

interface NotificationRowProps {
  item: NotificationItem;
  /** The latest actor (avatar+name) if resolved. */
  actor?: PersonRef;
  /** Up to 3 resolved actors for the stacked faces (batched rows). */
  faces?: PersonRef[];
  onOpen: (item: NotificationItem) => void;
  onDelete: (id: string) => void;
}

/** Context line from known metadata only. Returns '' when nothing is known. */
function contextLine(item: NotificationItem): string {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.location === 'string') parts.push(m.location);
  if (typeof m.applicantCount === 'number') parts.push(`${m.applicantCount} applicants`);
  if (typeof m.mutualCount === 'number') parts.push(`${m.mutualCount} mutual`);
  return parts.join('  ·  ');
}

export default function NotificationRow({
  item,
  actor,
  faces,
  onOpen,
  onDelete,
}: NotificationRowProps) {
  const t = useTranslations('connect.notifications');
  const router = useRouter();
  const action = primaryAction(item);
  const count = item.aggregatedCount ?? 1;
  const lead = actor
    ? count > 1
      ? `${actor.name} ${t('andOthers', { count: count - 1 })}`
      : actor.name
    : item.title;
  const ctx = contextLine(item);
  const stack = (faces && faces.length > 0 ? faces : actor ? [actor] : []).slice(0, 3);

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full cursor-pointer rounded-[var(--cr-radius-lg)] border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
        style={{
          background: item.isRead ? 'var(--cr-surface)' : 'var(--cr-primary-light)',
          borderLeft: item.isRead ? undefined : '3px solid var(--cr-primary)',
        }}
      >
        <div className="flex items-start gap-3">
          {/* Faces: stacked avatars + "+N" for batched rows; glyph fallback. */}
          {stack.length > 0 ? (
            <span className="flex shrink-0 -space-x-2" aria-hidden>
              {stack.map((p, i) => (
                <span
                  key={p.userId}
                  className="h-9 w-9 overflow-hidden rounded-full border-2 bg-cover bg-center"
                  style={{
                    borderColor: 'var(--cr-surface)',
                    zIndex: stack.length - i,
                    ...(p.avatar
                      ? { backgroundImage: `url(${p.avatar})` }
                      : { background: 'var(--cr-primary-light)' }),
                  }}
                >
                  {!p.avatar && (
                    <span
                      className="flex h-full w-full items-center justify-center text-[13px] font-semibold"
                      style={{ color: 'var(--cr-primary)' }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              ))}
              {count > stack.length && (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-[11px] font-bold"
                  style={{
                    borderColor: 'var(--cr-surface)',
                    background: 'var(--cr-surface-2)',
                    color: 'var(--cr-text-3)',
                  }}
                >
                  +{count - stack.length}
                </span>
              )}
            </span>
          ) : (
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-primary)' }}
            >
              {item.category?.startsWith('connect.') ? <Bell size={16} /> : <Building2 size={16} />}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`m-0 min-w-0 flex-1 truncate text-[14px] text-heading ${
                  item.isRead ? 'font-semibold' : 'font-bold'
                }`}
              >
                {lead}
              </p>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
              >
                {t(`tag.${tagKeyOf(item)}` as Parameters<typeof t>[0])}
              </span>
              {!item.isRead && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: 'var(--cr-primary)' }}
                  aria-label={t('filters.unread')}
                />
              )}
            </div>
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-muted">{item.message}</p>
            {ctx && <p className="m-0 mt-1 text-[12px] text-subtle">{ctx}</p>}
            <div className="mt-1.5 flex items-center gap-3">
              <span className="text-[11px] text-subtle">{dayjs(item.createdAt).fromNow()}</span>
              {action && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onOpen(item);
                    router.push(action.href);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(action.href);
                    }
                  }}
                  className="cursor-pointer rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors"
                  style={{ borderColor: 'var(--cr-border)', color: 'var(--cr-primary)' }}
                >
                  {t(action.labelKey as Parameters<typeof t>[0])}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onDelete(item._id)}
        aria-label={t('delete')}
        title={t('delete')}
        className="hover:bg-surface-3 absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-error focus-visible:opacity-100"
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}
```

> Note: the action affordance is a `role="button"` span (not a nested `<button>`) because it lives inside the row's `<button>`; nested buttons are invalid HTML. It stops propagation and navigates itself.

- [ ] **Step 2: Typecheck**

Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "NotificationRow" || echo "no errors in NotificationRow"`
Expected: `no errors in NotificationRow`.

### Task 3.3: Rebuild `NotificationsScreen` (tabs + counts + rows + drawer + ad rail)

**Files:**

- Modify: `features/connect/notifications/NotificationsScreen.tsx`

- [ ] **Step 1: Replace the imports + filter constants.** Swap the old `groupOf/classify/dayBucket/notificationHref` locals for the new helpers, add `ConnectRightRail`, `PreferencesDrawer`, `NotificationRow`, and the `Settings` icon (gear). Replace lines 16-144 (imports through `notificationHref`) with:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { App, Empty, Popconfirm } from 'antd';
import { Bell, CheckCheck, Settings, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ConnectPage } from '@/components/connect';
import ConnectRightRail from '@/components/connect/ConnectRightRail';
import DsButton from '@/components/ui/DsButton';
import { listMyNotifications, type NotificationItem } from './notifications.actions';
import { getPeople } from '@/features/connect/network.actions';
import type { PersonRef } from '@/features/connect/network.types';
import { effectiveProduct, useShellNotifications } from '@/lib/connect/NotificationProvider';
import {
  TOPIC_GROUPS,
  dayBucket,
  groupOf,
  rowHref,
  type TopicGroup,
} from './notification-presentation';
import NotificationRow from './NotificationRow';
import PreferencesDrawer from './PreferencesDrawer';

dayjs.extend(relativeTime);

const PAGE_SIZE = 30;

/** Tab model: two status tabs, a disabled "mentions" placeholder, then topic
 *  groups. Mentions has no data source yet (owner: keep, mark coming soon). */
type StatusFilter = 'all' | 'unread';
type FilterKey = StatusFilter | 'mentions' | TopicGroup;
const STATUS_FILTERS: StatusFilter[] = ['all', 'unread'];
```

- [ ] **Step 2: Replace the component body** from the `markAllSeen` effect's dependency on the old derived data through the end of the file. Specifically, keep state/effects up to `items`/`actorMap`, then replace the filter/visibleTopics/groups/handlers/JSX. Use this full body for the function (everything from the `const live` line onward), preserving the existing hooks above it:

Replace the block from `const filtered = useMemo(` (old line 221) to the end of the file with:

```tsx
  // Tab counts off the full Connect list (status + per-group tallies).
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: items.length,
      unread: 0,
      mentions: 0,
      network: 0,
      feed: 0,
      jobs: 0,
      marketplace: 0,
      messages: 0,
      system: 0,
    };
    for (const n of items) {
      if (!n.isRead) c.unread += 1;
      const g = groupOf(n);
      if (g) c[g] += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((n) => {
        if (filter === 'all') return true;
        if (filter === 'unread') return !n.isRead;
        if (filter === 'mentions') return false; // placeholder tab, no data
        return groupOf(n) === filter;
      }),
    [items, filter],
  );

  // Topic tabs to show: any present in the list, plus the active one.
  const visibleTopics = useMemo(() => {
    const present = new Set<TopicGroup>();
    for (const n of items) {
      const g = groupOf(n);
      if (g) present.add(g);
    }
    return TOPIC_GROUPS.filter((g) => present.has(g) || filter === g);
  }, [items, filter]);

  const now = Date.now();
  const groups = useMemo(() => {
    const order: Array<'today' | 'week' | 'earlier'> = ['today', 'week', 'earlier'];
    const map = new Map<string, NotificationItem[]>();
    for (const n of filtered) {
      const b = dayBucket(n.createdAt, now);
      const arr = map.get(b) ?? [];
      arr.push(n);
      map.set(b, arr);
    }
    return order.filter((b) => map.has(b)).map((b) => ({ key: b, items: map.get(b) ?? [] }));
  }, [filtered, now]);

  const handleRowClick = useCallback(
    async (item: NotificationItem) => {
      await markRead(item._id);
      const href = rowHref(item);
      if (href) router.push(href);
    },
    [router, markRead],
  );

  const handleMarkAllRead = useCallback(async () => {
    setBusy(true);
    await markAllRead();
    setBusy(false);
  }, [markAllRead]);

  const handleClearAll = useCallback(async () => {
    setClearing(true);
    const ok = await clearAll();
    if (ok) {
      setOlder([]);
      setExhausted(true);
      setRemovedIds(new Set());
    } else {
      message.error(t('actionError'));
    }
    setClearing(false);
  }, [clearAll, message, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      setRemovedIds((prev) => new Set(prev).add(id));
      const ok = await deleteOne(id);
      if (!ok) {
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        message.error(t('actionError'));
      }
    },
    [deleteOne, message, t],
  );

  const handleLoadMore = useCallback(async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const res = await listMyNotifications({
      before: last.createdAt,
      limit: PAGE_SIZE,
      product: 'connect',
    });
    setLoadingMore(false);
    if (!res.ok) return;
    if (res.data.length < PAGE_SIZE) setExhausted(true);
    setOlder((prev) => [...prev, ...res.data]);
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // Tab chip renderer (shared by status + mentions + topic tabs).
  const renderTab = (key: FilterKey, opts?: { disabled?: boolean }) => {
    const active = filter === key;
    const disabled = opts?.disabled;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={active}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && setFilter(key)}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={
          active
            ? { background: 'var(--cr-primary)', borderColor: 'var(--cr-primary)', color: '#fff' }
            : {
                background: 'var(--cr-surface)',
                borderColor: 'var(--cr-border)',
                color: 'var(--cr-text-3)',
              }
        }
      >
        {t(`filters.${key}` as Parameters<typeof t>[0])}
        {!disabled && counts[key] > 0 && (
          <span
            className="rounded-full px-1.5 text-[10.5px] font-bold"
            style={
              active
                ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                : { background: 'var(--cr-surface-2)', color: 'var(--cr-text-4)' }
            }
          >
            {counts[key]}
          </span>
        )}
        {disabled && (
          <span className="text-[9.5px] font-bold tracking-wide uppercase opacity-70">
            {t('soon')}
          </span>
        )}
      </button>
    );
  };

  return (
    <ConnectPage className="flex justify-center gap-5">
      <main className="w-full" style={{ maxWidth: 'var(--cn-feed-max-w, 600px)' }}>
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 max-w-prose text-[13px] text-muted">{t('subtitle')}</p>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<CheckCheck size={14} aria-hidden />}
              onClick={handleMarkAllRead}
              loading={busy}
              disabled={items.length === 0 || items.every((n) => n.isRead)}
            >
              {t('markAllRead')}
            </DsButton>
            <Popconfirm
              title={t('clearAllConfirm')}
              okText={tCommon('clear')}
              cancelText={tCommon('cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={handleClearAll}
              disabled={items.length === 0}
            >
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<Trash2 size={14} aria-hidden />}
                loading={clearing}
                disabled={items.length === 0}
              >
                {t('clearAll')}
              </DsButton>
            </Popconfirm>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<Settings size={14} aria-hidden />}
              onClick={() => setPrefsOpen(true)}
              aria-haspopup="dialog"
              aria-label={t('preferencesAria')}
            >
              {t('preferences')}
            </DsButton>
          </div>
        </header>

        {/* Tabs: status + mentions (disabled) + present topic groups. */}
        <div
          role="tablist"
          aria-label={t('title')}
          className="mb-4 flex items-center gap-2 overflow-x-auto pb-1"
        >
          {STATUS_FILTERS.map((f) => renderTab(f))}
          {renderTab('mentions', { disabled: true })}
          <span aria-hidden className="mx-0.5 h-4 w-px shrink-0" style={{ background: 'var(--cr-border)' }} />
          {visibleTopics.map((f) => renderTab(f))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[var(--cr-radius-lg)] border border-border bg-surface p-8">
            <Empty
              image={<Bell size={32} aria-hidden style={{ color: 'var(--cr-text-4)' }} />}
              styles={{ image: { display: 'flex', justifyContent: 'center', height: 'auto' } }}
              description={
                <span className="text-[13px] text-muted">
                  {filter === 'mentions'
                    ? t('mentionsSoon')
                    : filter === 'all'
                      ? t('empty')
                      : t('filterEmpty')}
                </span>
              }
            />
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.key} className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="m-0 text-[11px] font-bold tracking-[0.04em] text-subtle uppercase">
                    {t(`groups.${group.key}` as Parameters<typeof t>[0])}
                  </h2>
                  <span className="text-[11px] font-semibold text-subtle">{group.items.length}</span>
                </div>
                <ul className="m-0 flex flex-col gap-2 p-0" style={{ listStyle: 'none' }}>
                  {group.items.map((n) => (
                    <NotificationRow
                      key={n._id}
                      item={n}
                      actor={n.actorId ? actorMap[n.actorId] : undefined}
                      faces={
                        n.actorIds
                          ? n.actorIds
                              .map((id) => actorMap[id])
                              .filter((p): p is PersonRef => Boolean(p))
                          : undefined
                      }
                      onOpen={handleRowClick}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              </section>
            ))}
            {!exhausted && (
              <div className="mt-1 flex justify-center">
                <DsButton dsVariant="ghost" dsSize="sm" onClick={handleLoadMore} loading={loadingMore}>
                  {t('loadOlder')}
                </DsButton>
              </div>
            )}
          </>
        )}
      </main>

      {/* Right rail = ads (house engine + future networks via AdSlot). */}
      <ConnectRightRail />

      {/* Settings drawer (modules / channels / smart delivery). */}
      <PreferencesDrawer open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </ConnectPage>
  );
}
```

- [ ] **Step 3: Add the `prefsOpen` + `filter` state.** In the state block near the top of the component, ensure `filter` is typed to the new `FilterKey` and add `prefsOpen`:

```tsx
const [filter, setFilter] = useState<FilterKey>('all');
const [prefsOpen, setPrefsOpen] = useState(false);
```

Also resolve faces for batched rows: extend the existing actor-resolution effect to include `actorIds`, replacing the `ids` computation:

```tsx
const ids = Array.from(
  new Set(
    items
      .flatMap((n) => [n.actorId, ...(n.actorIds ?? [])])
      .filter((id): id is string => Boolean(id) && !actorMap[id!]),
  ),
);
```

- [ ] **Step 4: Remove now-dead code.** Delete the old `categoryOf`, `groupOf`, `classify`, `dayBucket`, `notificationHref` local functions (now imported) and the old `TopicGroup`/`TOPIC_GROUPS`/`FilterKey` declarations replaced in Step 1. The `Building2` import is no longer used in this file (moved to `NotificationRow`); ensure it is not imported here.

- [ ] **Step 5: Typecheck**

Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "NotificationsScreen" || echo "no errors in NotificationsScreen"`
Expected: `no errors in NotificationsScreen`.

---

# Phase 4 - Frontend: preferences drawer + shared sections

### Task 4.1: Shared preference sections

**Files:**

- Create: `features/connect/notifications/preferences-sections.tsx`

- [ ] **Step 1: Implement** the shared, controlled section UI. It takes the full settings + an `onToggle` callback and renders the three sections. Module toggles map to the per-category `inPlatform`; channels + delivery are global; the non-live channels render disabled with a "coming soon" hint.

```tsx
'use client';

/**
 * preferences-sections - the three notification-settings sections (By module /
 * Channels / Smart delivery) shared by the drawer and the full preferences page.
 * Controlled: the parent owns state + persistence (debounced PATCH). Module
 * toggles fan out to per-category inPlatform; channels + delivery are global.
 * Only In-app + module mutes are live today; other channels + quiet hours render
 * disabled "coming soon" but still persist. Cross-links: notifications.actions.ts
 * (NotificationSettings), BE notification-categories.ts.
 */

import { useTranslations } from 'next-intl';
import { Switch, TimePicker } from 'antd';
import dayjs from 'dayjs';
import {
  Bell,
  Briefcase,
  Globe,
  Mail,
  MessageSquare,
  Network,
  Newspaper,
  Phone,
  ShieldCheck,
  Smartphone,
  Store,
} from 'lucide-react';
import type { NotificationSettings, GlobalChannelPrefs } from './notifications.actions';

/** Module -> its backing categories (mirrors the BE category groups). */
export const PREF_MODULES = [
  {
    key: 'feed',
    icon: Newspaper,
    categories: [
      'connect.post_reacted',
      'connect.post_commented',
      'connect.post_reposted',
      'connect.post_replied',
    ],
  },
  {
    key: 'network',
    icon: Network,
    categories: [
      'connect.connection_requested',
      'connect.connection_accepted',
      'connect.followed',
      'connect.page_followed',
    ],
  },
  {
    key: 'jobs',
    icon: Briefcase,
    categories: [
      'connect.job_application_received',
      'connect.job_application_accepted',
      'connect.job_application_declined',
    ],
  },
  { key: 'marketplace', icon: Store, categories: ['connect.inquiry_received'] },
  { key: 'messages', icon: MessageSquare, categories: ['connect.message_received'] },
  { key: 'system', icon: ShieldCheck, categories: [] as string[] }, // operational; no toggleable categories yet
] as const;

const CHANNELS: Array<{ key: keyof GlobalChannelPrefs; icon: typeof Bell; live: boolean }> = [
  { key: 'inApp', icon: Bell, live: true },
  { key: 'browserPush', icon: Globe, live: false },
  { key: 'whatsapp', icon: Smartphone, live: false },
  { key: 'email', icon: Mail, live: false },
  { key: 'sms', icon: Phone, live: false },
];

interface Props {
  settings: NotificationSettings;
  onModuleToggle: (categories: string[], next: boolean) => void;
  onChannelToggle: (channel: keyof GlobalChannelPrefs, next: boolean) => void;
  onBatchingToggle: (next: boolean) => void;
  onQuietToggle: (next: boolean) => void;
  onQuietTime: (which: 'start' | 'end', value: string) => void;
}

export default function PreferencesSections({
  settings,
  onModuleToggle,
  onChannelToggle,
  onBatchingToggle,
  onQuietToggle,
  onQuietTime,
}: Props) {
  const t = useTranslations('connect.notifications');

  // A module is ON when every backing category has inPlatform true.
  const moduleOn = (categories: string[]) =>
    categories.length === 0 || categories.every((c) => settings.prefs[c]?.inPlatform !== false);

  const Row = ({
    icon: Icon,
    title,
    desc,
    control,
    muted,
  }: {
    icon: typeof Bell;
    title: string;
    desc: string;
    control: React.ReactNode;
    muted?: boolean;
  }) => (
    <div className="flex items-center gap-3 px-1 py-2.5" style={{ opacity: muted ? 0.6 : 1 }}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' }}
        aria-hidden
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13.5px] font-semibold text-heading">{title}</p>
        <p className="m-0 mt-0.5 text-[12px] text-muted">{desc}</p>
      </div>
      {control}
    </div>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="mt-4 mb-1 text-[11px] font-bold tracking-[0.04em] text-subtle uppercase">
      {children}
    </h3>
  );

  return (
    <div className="flex flex-col">
      <SectionTitle>{t('prefSections.byModule')}</SectionTitle>
      {PREF_MODULES.map((m) => {
        const Icon = m.icon;
        return (
          <Row
            key={m.key}
            icon={Icon}
            title={t(`modules.${m.key}.title` as Parameters<typeof t>[0])}
            desc={t(`modules.${m.key}.desc` as Parameters<typeof t>[0])}
            control={
              <Switch
                checked={moduleOn(m.categories)}
                disabled={m.categories.length === 0}
                onChange={(next) => onModuleToggle(m.categories, next)}
                aria-label={t(`modules.${m.key}.title` as Parameters<typeof t>[0])}
              />
            }
            muted={m.categories.length === 0}
          />
        );
      })}

      <SectionTitle>{t('prefSections.channels')}</SectionTitle>
      {CHANNELS.map((ch) => {
        const Icon = ch.icon;
        return (
          <Row
            key={ch.key}
            icon={Icon}
            title={t(`channels.${ch.key}.title` as Parameters<typeof t>[0])}
            desc={ch.live ? t(`channels.${ch.key}.desc` as Parameters<typeof t>[0]) : t('soon')}
            control={
              <Switch
                checked={ch.key === 'inApp' ? true : settings.channels[ch.key]}
                disabled={!ch.live}
                onChange={(next) => onChannelToggle(ch.key, next)}
                aria-label={t(`channels.${ch.key}.title` as Parameters<typeof t>[0])}
              />
            }
            muted={!ch.live}
          />
        );
      })}

      <SectionTitle>{t('prefSections.smart')}</SectionTitle>
      <Row
        icon={Bell}
        title={t('smart.batching.title')}
        desc={t('smart.batching.desc')}
        control={
          <Switch
            checked={settings.delivery.smartBatching}
            onChange={onBatchingToggle}
            aria-label={t('smart.batching.title')}
          />
        }
      />
      <Row
        icon={Bell}
        title={t('smart.quiet.title')}
        desc={t('soon')}
        muted
        control={
          <Switch
            checked={settings.delivery.quietHours.enabled}
            onChange={onQuietToggle}
            aria-label={t('smart.quiet.title')}
          />
        }
      />
      {settings.delivery.quietHours.enabled && (
        <div className="flex items-center gap-2 px-1 py-2" style={{ opacity: 0.6 }}>
          <TimePicker
            format="hh:mm A"
            value={dayjs(settings.delivery.quietHours.start, 'HH:mm')}
            onChange={(v) => v && onQuietTime('start', v.format('HH:mm'))}
            aria-label={t('smart.quiet.start')}
          />
          <span className="text-[12px] text-muted">{t('smart.quiet.to')}</span>
          <TimePicker
            format="hh:mm A"
            value={dayjs(settings.delivery.quietHours.end, 'HH:mm')}
            onChange={(v) => v && onQuietTime('end', v.format('HH:mm'))}
            aria-label={t('smart.quiet.end')}
          />
          <span className="text-[12px] text-subtle">{settings.delivery.quietHours.tz}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "preferences-sections" || echo "no errors in preferences-sections"`
Expected: `no errors in preferences-sections`.

### Task 4.2: `PreferencesDrawer`

**Files:**

- Create: `features/connect/notifications/PreferencesDrawer.tsx`

- [ ] **Step 1: Implement** the drawer. It lazy-loads the settings on first open, holds local state, persists each change via a debounced optimistic PATCH (same pattern as the old `PreferencesForm`), and renders `PreferencesSections` + the "Open full settings" footer link.

```tsx
'use client';

/**
 * PreferencesDrawer - right-side settings surface opened from the notifications
 * header gear. Loads the full settings envelope on first open, persists each
 * toggle with a debounced optimistic PATCH (rollback + toast on failure), and
 * links to the full preferences page as a fallback. Cross-links:
 * notifications.actions.ts (get/update), preferences-sections.tsx (UI).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App as AntApp, Drawer, Spin } from 'antd';
import { ArrowRight } from 'lucide-react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type GlobalChannelPrefs,
  type NotificationSettings,
} from './notifications.actions';
import PreferencesSections from './preferences-sections';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Patch = Parameters<typeof updateNotificationPreferences>[0];

export default function PreferencesDrawer({ open, onClose }: Props) {
  const t = useTranslations('connect.notifications');
  const { message } = AntApp.useApp();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef<Patch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGoodRef = useRef<NotificationSettings | null>(null);

  // Load once per open if not already loaded.
  useEffect(() => {
    if (!open || settings) return;
    setLoading(true);
    void getNotificationPreferences().then((res) => {
      setLoading(false);
      if (res.ok) {
        setSettings(res.data);
        lastGoodRef.current = res.data;
      } else {
        message.error(res.error || t('saveError'));
      }
    });
  }, [open, settings, message, t]);

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const flush = useCallback(async () => {
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    const res = await updateNotificationPreferences(patch);
    if (res.ok) {
      setSettings(res.data);
      lastGoodRef.current = res.data;
    } else {
      message.error(res.error || t('saveError'));
      if (lastGoodRef.current) setSettings(lastGoodRef.current); // rollback
    }
  }, [message, t]);

  const queue = useCallback(
    (patch: Patch, optimistic: (s: NotificationSettings) => NotificationSettings) => {
      setSettings((s) => (s ? optimistic(s) : s));
      // Merge into the pending patch (shallow per top-level key).
      pendingRef.current = {
        prefs: { ...(pendingRef.current.prefs ?? {}), ...(patch.prefs ?? {}) },
        channels: { ...(pendingRef.current.channels ?? {}), ...(patch.channels ?? {}) },
        delivery: { ...(pendingRef.current.delivery ?? {}), ...(patch.delivery ?? {}) },
      };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), 500);
    },
    [flush],
  );

  const onModuleToggle = (categories: string[], next: boolean) =>
    queue({ prefs: Object.fromEntries(categories.map((c) => [c, { inPlatform: next }])) }, (s) => ({
      ...s,
      prefs: {
        ...s.prefs,
        ...Object.fromEntries(categories.map((c) => [c, { ...s.prefs[c], inPlatform: next }])),
      },
    }));

  const onChannelToggle = (channel: keyof GlobalChannelPrefs, next: boolean) =>
    queue({ channels: { [channel]: next } }, (s) => ({
      ...s,
      channels: { ...s.channels, [channel]: next },
    }));

  const onBatchingToggle = (next: boolean) =>
    queue({ delivery: { smartBatching: next } }, (s) => ({
      ...s,
      delivery: { ...s.delivery, smartBatching: next },
    }));

  const onQuietToggle = (next: boolean) =>
    queue(
      { delivery: { quietHours: { ...lastGoodRef.current!.delivery.quietHours, enabled: next } } },
      (s) => ({
        ...s,
        delivery: { ...s.delivery, quietHours: { ...s.delivery.quietHours, enabled: next } },
      }),
    );

  const onQuietTime = (which: 'start' | 'end', value: string) =>
    queue(
      { delivery: { quietHours: { ...lastGoodRef.current!.delivery.quietHours, [which]: value } } },
      (s) => ({
        ...s,
        delivery: { ...s.delivery, quietHours: { ...s.delivery.quietHours, [which]: value } },
      }),
    );

  return (
    <Drawer
      title={t('preferencesTitle')}
      placement="right"
      size={420}
      open={open}
      onClose={onClose}
      destroyOnHidden={false}
    >
      <p className="m-0 mb-2 text-[12.5px] text-muted">{t('preferencesSubtitle')}</p>
      {loading || !settings ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : (
        <>
          <PreferencesSections
            settings={settings}
            onModuleToggle={onModuleToggle}
            onChannelToggle={onChannelToggle}
            onBatchingToggle={onBatchingToggle}
            onQuietToggle={onQuietToggle}
            onQuietTime={onQuietTime}
          />
          <Link
            href="/connect/notifications/preferences"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold no-underline"
            style={{ color: 'var(--cr-primary)' }}
          >
            {t('openFullSettings')}
            <ArrowRight size={15} aria-hidden />
          </Link>
        </>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "PreferencesDrawer" || echo "no errors in PreferencesDrawer"`
Expected: `no errors in PreferencesDrawer`.

### Task 4.3: Point the full preferences page at the new sections

**Files:**

- Modify: `app/connect/notifications/preferences/page.tsx`
- Modify: `features/connect/notifications/PreferencesForm.tsx`

- [ ] **Step 1: Update the page loader.** Open `app/connect/notifications/preferences/page.tsx` and ensure it calls `getNotificationPreferences()` and passes the full `NotificationSettings` as `initial` to `PreferencesForm` (the function now returns the envelope). If it previously narrowed to `prefs`, pass the whole object instead.

- [ ] **Step 2: Rewrite `PreferencesForm`** to reuse `PreferencesSections` with the same debounced PATCH pattern as the drawer (single source of truth for the section UI). Replace the whole file body with the controlled form below:

```tsx
'use client';

/**
 * PreferencesForm - the full-page notification settings (fallback / deep-link
 * target from the drawer's "Open full settings"). Mirrors PreferencesDrawer
 * exactly via the shared PreferencesSections; only the chrome differs (page
 * header + rail instead of a drawer). Cross-links: preferences-sections.tsx,
 * notifications.actions.ts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App as AntApp } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { ConnectPage, Rail, RailPanel } from '@/components/connect';
import {
  updateNotificationPreferences,
  type GlobalChannelPrefs,
  type NotificationSettings,
} from './notifications.actions';
import PreferencesSections from './preferences-sections';

type Patch = Parameters<typeof updateNotificationPreferences>[0];

export default function PreferencesForm({ initial }: { initial: NotificationSettings }) {
  const t = useTranslations('connect.notifications');
  const { message } = AntApp.useApp();
  const [settings, setSettings] = useState<NotificationSettings>(initial);
  const pendingRef = useRef<Patch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGoodRef = useRef<NotificationSettings>(initial);

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const flush = useCallback(async () => {
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    const res = await updateNotificationPreferences(patch);
    if (res.ok) {
      setSettings(res.data);
      lastGoodRef.current = res.data;
    } else {
      message.error(res.error || t('saveError'));
      setSettings(lastGoodRef.current);
    }
  }, [message, t]);

  const queue = useCallback(
    (patch: Patch, optimistic: (s: NotificationSettings) => NotificationSettings) => {
      setSettings((s) => optimistic(s));
      pendingRef.current = {
        prefs: { ...(pendingRef.current.prefs ?? {}), ...(patch.prefs ?? {}) },
        channels: { ...(pendingRef.current.channels ?? {}), ...(patch.channels ?? {}) },
        delivery: { ...(pendingRef.current.delivery ?? {}), ...(patch.delivery ?? {}) },
      };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), 500);
    },
    [flush],
  );

  const onModuleToggle = (categories: string[], next: boolean) =>
    queue({ prefs: Object.fromEntries(categories.map((c) => [c, { inPlatform: next }])) }, (s) => ({
      ...s,
      prefs: {
        ...s.prefs,
        ...Object.fromEntries(categories.map((c) => [c, { ...s.prefs[c], inPlatform: next }])),
      },
    }));
  const onChannelToggle = (channel: keyof GlobalChannelPrefs, next: boolean) =>
    queue({ channels: { [channel]: next } }, (s) => ({
      ...s,
      channels: { ...s.channels, [channel]: next },
    }));
  const onBatchingToggle = (next: boolean) =>
    queue({ delivery: { smartBatching: next } }, (s) => ({
      ...s,
      delivery: { ...s.delivery, smartBatching: next },
    }));
  const onQuietToggle = (next: boolean) =>
    queue(
      { delivery: { quietHours: { ...lastGoodRef.current.delivery.quietHours, enabled: next } } },
      (s) => ({
        ...s,
        delivery: { ...s.delivery, quietHours: { ...s.delivery.quietHours, enabled: next } },
      }),
    );
  const onQuietTime = (which: 'start' | 'end', value: string) =>
    queue(
      { delivery: { quietHours: { ...lastGoodRef.current.delivery.quietHours, [which]: value } } },
      (s) => ({
        ...s,
        delivery: { ...s.delivery, quietHours: { ...s.delivery.quietHours, [which]: value } },
      }),
    );

  return (
    <ConnectPage className="flex justify-center gap-5">
      <main className="w-full" style={{ maxWidth: 'var(--cn-feed-max-w, 600px)' }}>
        <header className="mb-4">
          <Link
            href="/connect/notifications"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted no-underline transition-colors hover:text-body"
          >
            <ArrowLeft size={15} aria-hidden />
            {t('backToCenter')}
          </Link>
          <h1 className="mt-2 mb-1 font-display text-[22px] font-bold text-heading">
            {t('preferencesTitle')}
          </h1>
          <p className="m-0 text-[13px] text-muted">{t('preferencesSubtitle')}</p>
        </header>

        <PreferencesSections
          settings={settings}
          onModuleToggle={onModuleToggle}
          onChannelToggle={onChannelToggle}
          onBatchingToggle={onBatchingToggle}
          onQuietToggle={onQuietToggle}
          onQuietTime={onQuietTime}
        />
        <p className="mt-3 text-[12px] text-muted">{t('futureChannelsNote')}</p>
      </main>

      <Rail side="right">
        <RailPanel title={t('railTitle')}>
          <p className="m-0 text-[12.5px] leading-relaxed text-muted">{t('preferencesRailBody')}</p>
        </RailPanel>
      </Rail>
    </ConnectPage>
  );
}
```

- [ ] **Step 3: Typecheck the touched files**

Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "PreferencesForm|preferences/page" || echo "no errors in preferences page/form"`
Expected: `no errors in preferences page/form`.

- [ ] **CHECKPOINT 2 (owner commits):** frontend list redesign + settings drawer (pre-i18n). Note: the app will show missing-key warnings until Phase 5.

---

# Phase 5 - i18n + loading skeleton

### Task 5.1: Extend `connect.notifications` keys (en source of truth)

**Files:**

- Modify: `app/messages/en.json`

- [ ] **Step 1: Merge these keys** into `connect.notifications` in `en.json` (add new keys; keep existing). Update `filters` and `tag`, add the new blocks:

```jsonc
// within connect.notifications:
"soon": "Coming soon",
"mentionsSoon": "Mentions arrive when @tagging ships. Nothing here yet.",
"preferences": "Settings",
"openFullSettings": "Open full notification settings",
"filters": {
  "all": "All",
  "unread": "Unread",
  "mentions": "Mentions",
  "network": "Network",
  "feed": "Feed",
  "jobs": "Jobs",
  "marketplace": "Marketplace",
  "messages": "Messages",
  "system": "System"
},
"tag": {
  "reaction": "Reaction",
  "comment": "Comment",
  "repost": "Repost",
  "reply": "Reply",
  "follow": "Follow",
  "pageFollow": "Page follow",
  "inquiry": "Marketplace",
  "job": "Jobs",
  "message": "Message",
  "connection": "Network",
  "system": "System"
},
"actions": {
  "view": "View",
  "viewRequest": "View request",
  "viewProfile": "View profile",
  "viewPage": "View page",
  "viewPost": "View post",
  "reply": "Reply",
  "viewInquiries": "View inquiries",
  "viewApplicants": "View applicants",
  "viewJob": "View job",
  "message": "Message"
},
"prefSections": {
  "byModule": "By module",
  "channels": "Channels",
  "smart": "Smart delivery"
},
"modules": {
  "feed": { "title": "Feed & posts", "desc": "Likes, comments and reshares" },
  "network": { "title": "My Network", "desc": "Requests, follows, profile views" },
  "jobs": { "title": "Jobs", "desc": "Applications, shortlists, post status" },
  "marketplace": { "title": "Marketplace inquiries", "desc": "New inquiries and quotations" },
  "messages": { "title": "Messages", "desc": "Direct messages and replies" },
  "system": { "title": "System & verification", "desc": "Account, GST/ERP and security" }
},
"channels": {
  "inApp": { "title": "In-app", "desc": "Always on inside Connect" },
  "browserPush": { "title": "Browser push", "desc": "Alerts when this site is open" },
  "whatsapp": { "title": "WhatsApp", "desc": "Order and inquiry alerts" },
  "email": { "title": "Email", "desc": "Daily digest only" },
  "sms": { "title": "SMS", "desc": "Critical alerts only" }
},
"smart": {
  "batching": {
    "title": "Smart batching",
    "desc": "Groups repeated alerts so you get fewer notifications."
  },
  "quiet": {
    "title": "Quiet hours",
    "start": "Quiet hours start",
    "end": "Quiet hours end",
    "to": "to"
  }
}
```

Also update `groups.week` to `"This week"` to match the reference label.

- [ ] **Step 2: Verify the JSON parses**

Run: `cd crewroster-web && node -e "require('./app/messages/en.json'); console.log('en ok')"`
Expected: `en ok`.

### Task 5.2: Mirror the keys into the other three locales

**Files:**

- Modify: `app/messages/gu.json`, `app/messages/gu-en.json`, `app/messages/hi-en.json`

- [ ] **Step 1: Add the same key structure** under `connect.notifications` in each of the three files, translated:
  - `gu.json` - full Gujarati.
  - `gu-en.json` - Gujarati-in-Latin-script (transliteration), matching the house style in the existing file.
  - `hi-en.json` - Hindi-in-Latin-script, matching the house style.

Keep every key present in `en.json` present in all three (parity is enforced). Use the existing `connect.notifications` entries in each file as the tone/style reference. Do not translate proper nouns (WhatsApp, SMS, GST, ERP).

- [ ] **Step 2: Verify all parse**

Run: `cd crewroster-web && for f in en gu gu-en hi-en; do node -e "require('./app/messages/$f.json'); console.log('$f ok')"; done`
Expected: four `ok` lines.

- [ ] **Step 3: Key-parity check** (every new key in en exists in the other three):

Run:

```bash
cd crewroster-web && node -e '
const base=require("./app/messages/en.json").connect.notifications;
const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>typeof v==="object"&&v?flat(v,p+k+"."):[p+k]);
const want=flat(base);
for(const l of ["gu","gu-en","hi-en"]){
  const n=require("./app/messages/"+l+".json").connect.notifications||{};
  const have=new Set(flat(n));
  const miss=want.filter(k=>!have.has(k));
  console.log(l, miss.length?("MISSING "+miss.join(",")):"parity ok");
}'
```

Expected: three `parity ok` lines.

### Task 5.3: Refresh the loading skeleton

**Files:**

- Modify: `app/connect/notifications/loading.tsx`

- [ ] **Step 1: Read the current skeleton** and the primitives in `components/connect/Skeleton.tsx`.

- [ ] **Step 2: Rewrite** `loading.tsx` so it mirrors the new layout: a row of ~6 pill skeletons (tabs), then 2 day-group headers each with 3 tall row-skeletons (circle + 2 lines + a short action pill), and a right-rail ad-slot placeholder. Server-only (no `'use client'`, no hooks), root `aria-hidden`, import primitives directly from `components/connect/Skeleton` (not the barrel). Mirror counts/spacing of the real page (`max-w` 600 main + rail).

- [ ] **Step 3: Typecheck**

Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "notifications/loading" || echo "no errors in loading"`
Expected: `no errors in loading`.

- [ ] **CHECKPOINT 3 (owner commits):** i18n (4 locales) + loading skeleton.

---

# Phase 6 - Verification

### Task 6.1: Full typecheck + targeted tests

- [ ] **Step 1: BE build + module tests**

Run: `cd crewroster-backend && npx nest build`
Expected: clean.
Run: `cd crewroster-backend && npx vitest run src/modules/notifications/__tests__/notification-preferences.service.vitest.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 2: FE unit test + typecheck of touched files**

Run: `cd crewroster-web && npx vitest run features/connect/notifications/notification-presentation.test.ts`
Expected: PASS.
Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "features/connect/notifications|app/connect/notifications" || echo "notifications files clean"`
Expected: `notifications files clean`.

- [ ] **Step 3: Banned-AntD self-check** on the touched files:

Run:

```bash
cd crewroster-web && rg -n "destroyOnClose|<Drawer[^>]*width=|overlayStyle=|popupStyle=|<Modal[^>]*visible=|<Tabs[^>]*TabPane" features/connect/notifications app/connect/notifications || echo "no banned antd apis"
```

Expected: `no banned antd apis`.

### Task 6.2: Manual runtime verification (owner-facing checklist)

- [ ] Tabs filter correctly and show live counts; Mentions is disabled with "coming soon"; the strip scrolls on mobile width.
- [ ] Day-group headers show counts; rows show grouped faces + "+N" for batched rows, a category tag, a context line only when metadata exists, and the right per-row action button that deep-links.
- [ ] Row click marks read + navigates; delete + mark-all-read + clear-all still work.
- [ ] Gear opens the drawer; module toggles persist (reload confirms); In-app is locked on; other channels + quiet hours are disabled "coming soon" but their saved value persists; quiet-hours time pickers save.
- [ ] Right rail shows the ad slot (or collapses cleanly when no provider is wired).
- [ ] `/connect/notifications/preferences` full page mirrors the drawer.
- [ ] Keyboard: tab through tabs (arrow keys), open/close drawer with keyboard, action buttons reachable; screen-reader announces tab selection + toggle labels.
- [ ] All four locales render with no missing-key console warnings.

- [ ] **CHECKPOINT 4 (owner commits):** final. Owner runs the live smoke across the four locales and commits both repos.

---

## Self-Review notes (author)

- Spec coverage: tabs+counts (3.3), day-group counts (3.3), rich rows + faces + context + action (3.1/3.2), drawer with 3 sections (4.1/4.2), full-page mirror (4.3), ads rail (3.3), BE additive channels+delivery (1.x), Mentions-disabled (3.3), 4-locale i18n (5.x), skeleton (5.3), a11y (3.2/3.3/4.1), Connect-only scope preserved (groupOf system maps to INVITE\_\* only) - all covered.
- Type consistency: `NotificationSettings { prefs, channels, delivery }`, `GlobalChannelPrefs`, `DeliverySettings`, `QuietHours` identical names BE+FE; `primaryAction`/`groupOf`/`tagKeyOf`/`dayBucket(iso, now)` signatures consistent across tasks.
- No-git-ops honoured: checkpoints, not commits.
