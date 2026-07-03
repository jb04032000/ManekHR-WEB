# Connect Notifications redesign

Date: 2026-06-09
Status: Design (awaiting owner review)
Surfaces: `crewroster-web` (primary) + `crewroster-backend` (additive structure only)
Route: `/connect/notifications` (+ existing `/connect/notifications/preferences` kept as fallback)

---

## 1. Why

The `/connect/notifications` center works but looks flat next to the agreed
reference: plain rows, no per-row action, a thin filter strip, and a right rail
that only links to settings. The reference raises the bar to a LinkedIn-grade
inbox: tabbed counts, grouped actor faces, a category tag, a context line, and a
primary action per row. It also moves notification preferences into a structured
panel with **module toggles**, **delivery channels** (In-app, Browser push,
WhatsApp, Email, SMS), and **smart delivery** (batching + quiet hours).

The owner decision (2026-06-09): **build the full structure now so future channels
are easy to switch on, but only In-app is actually wired today.** Everything else
shows in its proper place, clearly marked not-yet-active, and still saves so no
setting is lost when the channels get built.

The owner also decided: preferences move into a **right-side drawer** opened from
a gear button; the right rail is freed up for **ads**.

## 2. Scope

In scope:

1. Restyle the notifications list (main column) to the reference: tabs with live
   counts, day groups with counts, richer rows (grouped faces, category tag,
   context line, primary action button, mark-read + delete).
2. Move preferences into a drawer opened from a header gear button. The drawer
   has three sections: By module, Channels, Smart delivery.
3. Free the right rail for ads by switching to the existing `ConnectRightRail`
   (`AdSlot`) component.
4. Additive backend structure for global channels + smart-delivery settings so
   the drawer persists real data; only In-app is honoured by the dispatch engine.
5. Full polish bar: four locales (en/gu/gu-en/hi-en), keyboard + screen-reader
   support, refreshed `loading.tsx` skeletons, empty/error states.

Out of scope (explicitly deferred, structure-only today):

- Real delivery over Browser push / WhatsApp / Email / SMS.
- Quiet-hours enforcement and smart-batching beyond what already exists.
- A dedicated `@mention` notification type (the Mentions tab is shown disabled,
  "coming soon", per owner choice).
- Surfacing ERP rows in the Connect center. The center stays Connect-scoped
  ("one engine, two inboxes"); the System tab covers Connect system/verification
  events only.

## 3. Decisions

- **Approach A (chosen): module-first preferences + structured channel grid.**
  Group the 12 Connect notification types into 6 friendly modules. A module
  switch is the master mute for every type inside it. Channels and smart delivery
  are global settings, stored but inert except In-app. Rejected B (restyle-only,
  fails the reference bar) and C (full per-type × per-channel grid, over-builds
  settings users rarely touch and channels we cannot deliver).

- **Mentions tab: kept, disabled, "coming soon"** (owner choice 2026-06-09).

- **Drawer, not page.** The drawer is the primary settings surface. The existing
  `/connect/notifications/preferences` page is kept and reachable from an "Open
  full settings" link in the drawer, so deep links and the fallback still work.

- **Right rail = ads.** Replace the bespoke preferences `RailPanel` with
  `ConnectRightRail`. No new ad code; reuse the existing `AdSlot` seam.

## 4. The list (main column)

### 4.1 Tabs (replace the current chip strip)

Tabs with a live count badge each, in this order:

`All · Unread · Mentions · Network · Feed · Jobs · Marketplace · Messages · System`

- Counts are computed from the loaded Connect rows (All = total, Unread =
  `!isRead`, others = rows whose group matches).
- **Mentions** renders disabled with a "coming soon" affordance (no data source
  yet). It is not selectable.
- Keep `all` and `unread` as the two status tabs; the rest are topic groups.
- Tabs scroll horizontally on narrow widths (mobile-first), never wrap mid-label.

Topic-group mapping (extends the existing `groupOf`):

| Tab         | Categories                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Network     | `connect.connection_requested`, `connect.connection_accepted`, `connect.followed`, `connect.page_followed` |
| Feed        | `connect.post_reacted`, `connect.post_commented`, `connect.post_reposted`, `connect.post_replied`          |
| Jobs        | `connect.job_application_received`, `connect.job_application_accepted`, `connect.job_application_declined` |
| Marketplace | `connect.inquiry_received`                                                                                 |
| Messages    | `connect.message_received`                                                                                 |
| System      | Connect system/verification rows + legacy `INVITE_*` that land in the Connect scope                        |

### 4.2 Day groups

Keep Today / This week / Earlier, now with a count on the group header (matches
the reference's right-aligned tally).

### 4.3 Row anatomy

Each row, left to right:

- **Avatar / grouped faces.** Single actor = avatar. Batched row
  (`aggregatedCount > 1`) = up to 3 stacked avatars + a "+N" pill (resolved from
  `actorIds` via the existing `getPeople` batch). Actorless rows keep the
  product/topic glyph fallback.
- **Body.** Lead line ("Name and N others ..."), the message, and a **context
  line** rendered opportunistically from known `metadata` (e.g. location list,
  applicant count, quote validity, mutual count). No fabricated data: if the
  metadata key is absent, the context line is omitted.
- **Category tag** (Feed / Marketplace / Network / Shortlisted / Action needed /
  ERP-verified ...), reusing the existing `classify` tag keys, extended.
- **Time** (relative).
- **Primary action button** per row (see 4.4), plus the existing unread dot.
- **Mark-read on click** and the **delete** button (hover/focus reveal) stay.

### 4.4 Per-row primary action

Extend the existing `notificationHref` into an action resolver returning
`{ label, href }` (label is an i18n key). Mapping:

| Category                                           | Action label    | Href                                           |
| -------------------------------------------------- | --------------- | ---------------------------------------------- |
| `connect.connection_requested`                     | View request    | `/connect/network?tab=invitations`             |
| `connect.connection_accepted` / `connect.followed` | Message         | `/connect/network`                             |
| `connect.page_followed`                            | View page       | `/connect/pages/{entityId}`                    |
| `connect.post_reacted` / `_reposted`               | View post       | `/connect/posts/{entityId}`                    |
| `connect.post_commented` / `_replied`              | Reply           | `/connect/posts/{entityId}`                    |
| `connect.inquiry_received`                         | View inquiries  | `/connect/inbox?thread=` or `?channel=inquiry` |
| `connect.job_application_received`                 | View applicants | job manage deep link                           |
| `connect.job_application_accepted` / `_declined`   | View job        | job deep link                                  |
| `connect.message_received`                         | Message         | `/connect/inbox?thread={threadId}`             |
| `INVITE_*`                                         | View            | `/dashboard/invitations`                       |

Rows with no action render just the row (no button). The whole row stays
clickable (mark-read + navigate) as today; the button is a secondary explicit
affordance.

## 5. Preferences drawer

Opened from a **gear button** in the list header (replacing the current
"Preferences" ghost button that routed to a page). AntD `<Drawer open={...}>`
(v6 `size`, not `width`), right side, `destroyOnHidden`.

Three sections, matching the reference:

### 5.1 By module

Six rows, each: icon + module name + one-line description + a single switch.

| Module                | Description                           | Backing categories |
| --------------------- | ------------------------------------- | ------------------ |
| Feed & posts          | Likes, comments and reshares          | the 4 `post_*`     |
| My Network            | Requests, follows, profile views      | the network 4      |
| Jobs                  | Applications, shortlists, post status | the jobs 3         |
| Marketplace inquiries | New inquiries and quotations          | `inquiry_received` |
| Messages              | Direct messages and replies           | `message_received` |
| System & verification | Account, GST/ERP and security         | system/`INVITE_*`  |

- Module switch state = ON when every backing category has `inPlatform: true`;
  toggling writes all backing categories at once (debounced PATCH, optimistic,
  rollback on failure - same pattern as today's `PreferencesForm`).
- These are **live** (In-app delivery honours them today).

### 5.2 Channels (global, new structure)

Five rows, each icon + name + status sub-label + switch:

| Channel      | Status sub-label                        | Live today?                  |
| ------------ | --------------------------------------- | ---------------------------- |
| In-app       | Always on inside Connect                | Yes (locked on)              |
| Browser push | Alerts when this site is open           | No - "coming soon", disabled |
| WhatsApp     | To +91 ••••••231 (masked, from profile) | No - "coming soon", disabled |
| Email        | Daily digest only                       | No - "coming soon", disabled |
| SMS          | Critical alerts only                    | No - "coming soon", disabled |

- In-app is rendered checked + disabled (cannot be turned off; it is the engine).
- The rest are visually disabled with a small "coming soon" hint. Their saved
  value still persists to the backend so the choice survives once wired.

### 5.3 Smart delivery (global, new structure)

- **Smart batching** switch + helper copy ("Groups repeated alerts so you get
  fewer notifications"). Saved; the existing §12.3 batching already groups in-app,
  so this toggle is wired for in-app and inert for other channels.
- **Quiet hours** switch + start/end time pickers + timezone label (default
  10:00 PM - 7:00 AM IST). Saved but **inert** today (no enforcement); marked
  "coming soon".

### 5.4 Footer

"Open full notification settings ->" link to `/connect/notifications/preferences`
(kept as the fallback full page).

## 6. Right rail

Replace the current preferences `RailPanel` with `<ConnectRightRail />` so the
`AdSlot` placements (`connect.right.top`, `connect.right.mid`) render ads. No new
ad code.

## 7. Backend (additive structure only - logical change, owner sign-off required)

All changes are additive, default off, and do not alter dispatch behaviour except
where noted. Per `feedback_polish_only`, this is a logical/schema change and is
called out for explicit approval; per `feedback_no_git_ops`, the owner commits.

### 7.1 `NotificationPreferences` schema

Add two optional top-level blocks (sparse, lazily seeded by `getOrCreate` like
the existing `prefs` map):

```ts
// Global delivery channels. inApp is the only channel honoured today.
channels?: {
  inApp: boolean;        // default true, always-on (engine)
  browserPush: boolean;  // default false - structure only
  whatsapp: boolean;     // default false - structure only
  email: boolean;        // default false - structure only
  sms: boolean;          // default false - structure only
};

// Smart-delivery settings. smartBatching is honoured for in-app (existing
// §12.3 grouping); quietHours is stored but not enforced yet.
delivery?: {
  smartBatching: boolean;          // default true
  quietHours: {
    enabled: boolean;              // default false
    start: string;                 // 'HH:mm', default '22:00'
    end: string;                   // 'HH:mm', default '07:00'
    tz: string;                    // IANA, default 'Asia/Kolkata'
  };
};
```

Existing per-category `prefs[<category>].inPlatform` stays the module master mute.
The legacy per-category `mobilePush` / `browserPush` fields are left untouched
(superseded by the new global `channels` for the drawer; no migration needed).

### 7.2 Preferences endpoints

- `GET /me/notifications/preferences` envelope extended to
  `{ prefs, channels, delivery }` (defaults filled by `getOrCreate`).
- `PATCH /me/notifications/preferences` body extended to accept optional
  `channels` and `delivery` partials (class-validator DTO), alongside the
  existing `prefs` partial. In-app cannot be disabled (validator pins
  `channels.inApp` true if present).
- Dispatch logic unchanged: only `prefs[...].inPlatform` (+ existing batching)
  is consulted. `channels`/`delivery.quietHours` are persisted, not enforced.

### 7.3 Tests

- Extend `notification-preferences.service.vitest.ts`: defaults seed the new
  blocks; PATCH merges `channels`/`delivery`; `channels.inApp` cannot be turned
  off; dispatch still ignores the inert channels.

## 8. Frontend file plan

- `features/connect/notifications/NotificationsScreen.tsx` - tabs with counts,
  day-group counts, new `NotificationRow`, gear opens the drawer, rail swapped to
  `ConnectRightRail`.
- `features/connect/notifications/NotificationRow.tsx` (new) - row anatomy +
  grouped faces + context line + primary action (keeps the file focused; the
  screen file is already large).
- `features/connect/notifications/PreferencesDrawer.tsx` (new) - the three-section
  drawer; reuses the debounced optimistic PATCH logic from `PreferencesForm`.
- `features/connect/notifications/notifications.actions.ts` - extend
  `NotificationPrefs` types with `channels` + `delivery`; extend the GET/PATCH
  wrappers.
- `features/connect/notifications/PreferencesForm.tsx` - kept; gains the same new
  sections so the full page mirrors the drawer (shared sub-components).
- `app/connect/notifications/loading.tsx` - refresh skeleton to mirror tabs +
  new row anatomy + ad rail.
- i18n: extend `connect.notifications` namespace across all four locales (tabs,
  module labels + descriptions, channel labels + statuses, smart-delivery copy,
  "coming soon", per-row action labels, context-line templates). Maintain key
  parity.

## 9. Accessibility

- Tabs: `role="tablist"` / `role="tab"` with `aria-selected`, arrow-key nav, the
  disabled Mentions tab `aria-disabled`.
- Drawer: focus trap (AntD), labelled, ESC closes, gear button `aria-haspopup`.
- Switches: `aria-label` per toggle; disabled channels `aria-disabled` + the
  "coming soon" text is associated, not just visual.
- Grouped faces: `aria-label` summarising "Name and N others"; decorative
  avatars `aria-hidden`.
- Per-row action button has its own accessible name distinct from the row.

## 10. Risks / watch

- Module switch "all categories" semantics: a mixed state (some categories on,
  some off, set via the full page) shows as OFF in the drawer; toggling re-syncs
  all. Documented; acceptable.
- Context lines depend on `metadata` shape varying per category - render only
  known keys, never fabricate.
- Keep the Connect-only scope: do not let the new System tab pull ERP rows into
  the Connect center.
- AntD v6 API: `<Drawer size>` not `width`, `destroyOnHidden` not
  `destroyOnClose` (per `crewroster-web/CLAUDE.md`).

## 11. Verification

- `nest build` clean (BE, SWC typecheck); targeted `notification-preferences`
  vitest green.
- `tsc` clean on the touched web files.
- i18n parity check across the four locales for the new keys.
- Manual: tabs filter + counts; drawer open/save/rollback; In-app lock; disabled
  channels persist; rail shows the ad slot; keyboard + screen-reader pass.
