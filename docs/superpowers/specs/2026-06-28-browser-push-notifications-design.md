# Browser Push Notifications (FCM Web) — Design

Date: 2026-06-28
Status: Approved (design); implementation plan to follow.

## Goal

Deliver platform notifications as real browser push to **desktop browsers and
Android installed PWAs**, by completing the already-scaffolded `browser_push`
channel and adding the missing web-client half. Reuses the existing
`firebase-admin` sender and the `user-devices` token registry. iOS is out of
scope for v1.

## Decisions (locked)

- **Tech:** Firebase Cloud Messaging (FCM) Web. Chosen because the backend FCM
  engine (`PushAdapter`) and the `user-devices` registry (which already supports
  `platform: 'web'`) are already built, so backend work is minimal.
- **Platforms:** Desktop + Android installed PWA only. iOS deferred (Apple's web
  push only fires for home-screen PWAs and Firebase's web SDK is unreliable
  there; the deferred native mobile app will cover iOS later).
- **Permission UX:** Soft prompt first. An in-app "Enable notifications"
  banner/button triggers the browser's native permission prompt only on user
  click. Plus an on/off toggle in the existing notification settings drawer.
- **Opt-in granularity:** Enabling push turns on `browserPush` for **all** the
  user's toggleable notification categories at once (one decision). Per-category
  off-switches already exist in settings for anyone who wants to mute a type.

## What already exists (no work needed)

- `NotificationsService.dispatch()` already fans out to a registered
  `browser_push` channel
  (`api/src/modules/notifications/notifications.service.ts`).
- A per-category, per-channel `browserPush` preference already exists and
  defaults to off, with a settings drawer
  (`features/connect/notifications/PreferencesDrawer.tsx`) and the
  `USER_TOGGLEABLE_CATEGORIES` gate in `notification-categories.ts`.
- The `user-devices` module stores FCM tokens (`platform: 'ios'|'android'|'web'`)
  and fans out via `firebase-admin`
  (`api/src/modules/user-devices/`, `finance/reminders/adapters/push.adapter.ts`).
- Endpoints already exist: `POST /devices/register`, `GET /devices`,
  `DELETE /devices/:id`, `DELETE /devices`.

## Backend changes (small)

1. **Make `BrowserPushChannel` real**
   (`api/src/modules/notifications/channels/browser-push.channel.ts`):
   - `isAvailable(recipientId)` → returns true iff the user has at least one
     registered device with `platform: 'web'`.
   - `send(input)` → send an FCM web push to the user's **web-platform tokens
     only**. `UserDevicesService.pushUser` currently fans out to ALL of a user's
     devices (any platform), so add a web-scoped variant (e.g.
     `pushUserWeb(userId, payload)` filtering `platform: 'web'`, reusing the same
     `PushAdapter.sendUserPush` + dead-token pruning) and call that here. Payload
     carries `title`, `message`, and a deep-link in `data` (derived from
     `category` + `entityId`).
   - Dead-token pruning is already handled by the existing `pushUser` path.
2. **Module wiring:** inject `UserDevicesService` into `NotificationsModule`
   (one new import). No new endpoints, no schema/migration changes.

## Web client changes (the bulk)

3. **Firebase SDK:** add `firebase/app` + `firebase/messaging`, initialised from
   new `NEXT_PUBLIC_FIREBASE_*` env vars (read through `lib/env.ts`). Guard so
   the whole feature no-ops when config is absent (parity with the backend's
   "Firebase config missing → disabled" pattern).
4. **Service worker:** new `public/firebase-messaging-sw.js` for FCM background
   messages. It coexists with the existing PWA `public/sw.js`
   (different file/registration; FCM uses its own registration or an explicit
   `serviceWorkerRegistration` handle).
5. **Soft-prompt + registration flow:**
   - An "Enable notifications" banner/button (shown when permission is
     `default` and the feature is configured).
   - On click → `Notification.requestPermission()` → on grant,
     `getToken({ vapidKey })` → `POST /devices/register { platform: 'web', fcmToken }`.
   - On successful registration, flip the user's `browserPush` prefs ON for all
     toggleable categories so `dispatch()` actually sends.
6. **Settings toggle:** add an "Enable browser notifications" control to the
   existing `PreferencesDrawer`. Off → revoke the device
   (`DELETE /devices/:id`) and/or clear `browserPush` prefs.
7. **Foreground messages:** `onMessage` handler shows a lightweight in-app toast
   (reuses existing notification UI). Optional but recommended.

## Preference behavior

- **Toggleable categories** (social events): respect the existing per-category
  `browserPush` pref. Enabling push sets them on; users may mute individual
  types later.
- **Operational categories** (e.g. `INVITE_RECEIVED`, `connect.boost_taken_down`,
  `erp.member_cap`): `dispatch()` skips the pref check for these, so once a web
  token is registered they will browser-push regardless of prefs. This is the
  existing dispatch contract and is acceptable for v1 (these are important
  account/operational alerts).

## Credentials the owner must supply (one-time)

- Firebase **web app** config → `NEXT_PUBLIC_FIREBASE_API_KEY`,
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
- **Web Push certificate (VAPID) public key** from Firebase console →
  `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- Backend service account (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`) — already wired in `env.ts`; just set real values in
  the deployed backend `.env`.

## Out of scope (v1)

- iOS push.
- Quiet-hours enforcement (persisted but inert today).
- Email / SMS / WhatsApp channels.
- Notifications emitted via the legacy `createNotification` path (e.g.
  depreciation) — only `dispatch()`-routed notifications get browser push.

## Success criteria

- A logged-in user on desktop Chrome/Edge or Android PWA can click "Enable
  notifications", grant permission, and receive a real browser push for a
  dispatch-routed notification (e.g. a connection request or message), including
  when the tab is backgrounded.
- Declining permission, or absent Firebase config, leaves the app fully
  functional with the feature silently inert.
- Turning the setting off stops further pushes (token revoked).
- No regression to the existing in-app (socket) notification system.
