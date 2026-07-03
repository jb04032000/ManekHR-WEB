# Connect Nudge Dismissal - Backend-Persisted + Targeted

> **STATUS - SHIPPED (2026-05-20).** Backend `User.dismissedHints: string[]` +
> `POST /me/dismiss-hint`; `ConnectNudge` reads + writes via
> `features/connect/hints.actions.ts`; nudge hidden for users who already have a
> Connect profile and survives a logout/login cycle. Preserved for history. See
> `docs/connect/PROGRESS.md` for the canonical record.

---

**Date:** 2026-05-19
**Status:** Approved (design); implementing.

---

## Diagnosis

The three Connect nudges - `ConnectNudge` ("You are on Connect too", ERP sidebar),
`ConnectErpCrossSell` (Connect feed), and `FeedProfileCard` (Connect feed) - stored their
"dismissed" flag in **localStorage**.

`localStorage.clear()` runs on every dead-session / sign-out path -
`lib/api/client.ts` (a 401 whose token-refresh fails, and a 401 with no refresh token)
and `components/auth/LockOverlay.tsx` (App-Lock "Sign out"). It wipes **all** of
localStorage, the dismiss flags included. So a dismissed nudge reappears after any
sign-out cycle. localStorage is also per-device. It is the wrong store for a
"dismissed forever" user preference.

Separately, `ConnectNudge` had **no targeting** - it showed to every ERP user, even one
who already lives in Connect.

## Decision

Persist dismissal on the **backend** as a per-user preference, and target the Connect
nudge so a user who already uses Connect never sees it.

- **Storage:** a `User.dismissedHints: string[]` field. On `User` (not `ConnectProfile`)
  because `ConnectNudge` targets ERP users who may have no `ConnectProfile` yet -
  dismissing must not lazily mint a profile. Survives sign-out, App-Lock, and follows
  the user across devices; cannot be wiped by `localStorage.clear()`.
- **Hints:** `connect_explore` (`ConnectNudge`), `connect_profile_card`
  (`FeedProfileCard`), `connect_erp_crosssell` (`ConnectErpCrossSell`).
- **Write:** `POST /me/dismiss-hint { hint }` - idempotent (`$addToSet`).
- **Read:** `dismissedHints` rides on the `User` object already returned by login / `/me`
  reads, so the client reads it from the auth store - no extra fetch.
- **Targeting:** `ConnectNudge` shows only when the user is NOT Connect-onboarded AND
  has not dismissed `connect_explore`. `ConnectErpCrossSell` keeps its existing tight
  gate (workshop-owner intent + no workspace). `FeedProfileCard` keeps its auto-hide at
  profile strength 100.

Not in scope: the broader `localStorage.clear()` bug also nukes non-Connect UI prefs
(e.g. the billing `DunningBanner` dismiss). Flagged separately - not fixed here.

## Tasks

**Backend** (`.worktrees/crewroster-backend/zari360-connect/`):

1. `src/modules/users/schemas/user.schema.ts` - add `dismissedHints: string[]` (`default []`).
2. `src/modules/users/users.service.ts` - `dismissHint(userId, hint)` via `$addToSet`;
   `src/modules/users/dto/dismiss-hint.dto.ts` - `DISMISSIBLE_HINTS` + `@IsIn` DTO;
   `__tests__/users.service.dismiss-hint.vitest.ts`.
3. `src/modules/users/me-prefs.controller.ts` - `POST /me/dismiss-hint`; register in
   `users.module.ts`.

**Web** (`.worktrees/crewroster-web/zari360-connect/`): 4. `types/index.ts` - `User.dismissedHints?: string[]`;
`features/connect/hints.actions.ts` - `dismissHint(hint)` server action +
`DismissibleHint` type. 5. `components/connect/ConnectErpCrossSell.tsx` - dismiss via the backend + auth store
(drop localStorage). 6. `components/connect/ConnectNudge.tsx` - dismiss via the backend; suppress for
Connect-onboarded users (`getConnectEntryState().onboarded`) (drop localStorage). 7. `components/connect/FeedProfileCard.tsx` - dismiss via the backend + auth store
(drop localStorage). 8. Verify - backend `nest build` + `vitest` + `eslint`; web `tsc` + `eslint` +
`check-i18n` + `npm run build`.

## Acceptance criteria

1. Dismiss any of the three nudges, sign out, sign back in - it stays dismissed.
2. Dismiss on one device - it is dismissed on another after sign-in.
3. A Connect-onboarded user never sees the "You are on Connect too" sidebar nudge.
4. `ConnectErpCrossSell` still shows only to a workshop-owner with no workspace;
   `FeedProfileCard` still hides at profile strength 100.
