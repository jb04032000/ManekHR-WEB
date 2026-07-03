# Phase 1 - Wave 5 design: Connect auth alignment + smart entry

Design doc. Brainstormed + owner-approved 2026-05-18. Covers a pre-Wave-5 auth
pass ("Wave 4.5") and Wave 5 proper (smart entry + onboarding + Day-1 home).

## Why

The auth system (`proxy.ts` - the Next-16 middleware - + `DashboardLayout`) was
built purely for the ERP. Connect adds a logged-out public surface and a
per-user beta gate, neither of which ERP-shaped auth handles. Audited before
Wave 5 because smart-entry routing leans directly on auth.

## Auth audit - findings

1. **Public Connect routes blocked (bug - affects shipped Wave 4).** Middleware
   `PUBLIC_PATHS` omits `/u` → a logged-out visitor or crawler hitting
   `/u/[userId]` is bounced to `/auth`. Breaks "works logged-out" + SEO
   indexability (Phase 1 acceptance criterion #3).
2. **`connectEnabled` gate unwired.** `User.connectEnabled` + `lib/connect/
flags.ts` exist; nothing reads them. The flag is not in the JWT - so the
   gate is a page-level (server-component) check, never a middleware call.
3. **Device-tier gate catches Connect.** Middleware bounces `mobile_only`
   subscription-tier users off every web route to `/platform-restricted` -
   `/platform/*` included. "platform" there means the _device_ platform
   (mobile app vs web), a subscription concern unrelated to Connect.
4. **Already handled:** `DashboardLayout` skips the workspace-onboarding gate
   for `mode='connect'` - workspace-less users (buyers, karigars) work.

## Decisions (owner-approved)

| Decision               | Choice                                         | Rationale                                                                                                         |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Connect × device-tier  | Connect **exempt** from the `mobile_only` gate | Connect is feature-flagged (`connectEnabled`), never subscription-gated - locked plan + backend                   |
| Route naming           | Connect app `/platform/*` → **`/connect/*`**   | "platform" is overloaded (device-tier vs Connect app); `/connect` disambiguates + matches `app/(connect-public)/` |
| Onboarding signal      | new `ConnectProfile.onboardedAt`               | `getMyConnectProfile` lazily _creates_ the profile - emptiness can't flag a first-timer                           |
| `connectEnabled` check | page-level server component                    | not in the JWT; a per-request middleware backend call is wasteful                                                 |

## Wave 4.5 - auth alignment (pre-Wave-5)

- **`proxy.ts`:** add `/u` to `PUBLIC_PATHS`; exempt `/connect/*` from the
  `mobile_only` device redirect; header comment disambiguating "platform".
- **Rename `/platform/*` → `/connect/*`:** move `app/platform/` → `app/connect/`
  (`app/platform-restricted/` is the device-tier page - untouched). Update
  `ModeSwitcher`, `ConnectModuleNav`, `ConnectMobileTabBar`, `ConnectSearchBar`,
  the `(connect-public)` "Open Connect" link, the `/u/[userId]` + `not-found`
  Join CTAs, `DashboardLayout` mode detection.
- Docs: build-plan route map + PROGRESS.

## Wave 5 - smart entry + onboarding + Day-1 home

- **`app/connect/page.tsx`** - smart entry (server component). Reads the user:
  - not `connectEnabled` → "coming soon" placeholder (existing copy).
  - `connectEnabled`, no `onboardedAt` → redirect to `/connect/onboarding`.
  - `connectEnabled`, onboarded → redirect to `/connect/profile`.
- **`app/connect/onboarding/page.tsx`** - 4 intent cards: Workshop owner,
  Karigar, Buyer, Just exploring. Built destinations route through; unbuilt
  (Marketplace / Jobs / Feed) show an honest "coming soon". The Karigar intent
  pre-sets `openTo.work`. Completing the flow stamps `onboardedAt`.
- **Day-1 home** - setup-checklist hero + 3 curated featured workshops +
  a feed placeholder ("your feed fills as you connect").
- **Backend** `GET /connect/featured-workshops` (`@Public`) - top ERP-active
  workspaces; curated bootstrap, replaced by algorithmic suggestions in P2.
- **`ConnectProfile.onboardedAt`** stamped via the profile update path.
- i18n × 4 locales; component tests; `/design-system` entries for new pieces.

## Acceptance criteria

1. A logged-out visitor opens `/u/[userId]`, sees the public profile + a "Join
   Connect" CTA - no `/auth` bounce; crawlable.
2. A `connectEnabled` user opens `/connect`: first visit → onboarding;
   afterwards → their profile.
3. A non-`connectEnabled` user opens `/connect` → "coming soon", never a 404.
4. Onboarding shows 4 intents; built ones proceed, unbuilt ones say so honestly.
5. The Day-1 home shows the setup checklist + 3 featured workshops.
6. A `mobile_only` device-tier user can still reach `/connect/*`.

## Addendum (build-time) - the `/connect` route collision

`next build` revealed `/connect` was already the public marketing landing page
(`app/(marketing)/connect/`). Owner-decided resolution:

- `/connect` stays the public marketing landing (unchanged).
- The authenticated app is **`/connect/home`** (smart entry) + `/connect/onboarding`
  - `/connect/profile`. `app/connect/` has no index `page.tsx`.
- The marketing `/connect` page redirects a signed-in `connectEnabled` member to
  `/connect/home` (via `getConnectEntryState`).

So every "app entry" reference points to `/connect/home`; `/connect` means the
marketing page everywhere else - including the `(connect-public)` "Join / Open
Connect" CTAs (a logged-out visitor lands on the marketing pitch).
