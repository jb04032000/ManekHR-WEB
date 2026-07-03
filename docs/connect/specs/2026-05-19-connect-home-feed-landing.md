# Connect Home → Feed-as-Landing - Design

**Date:** 2026-05-19
**Status:** Approved (design); pending implementation plan.

---

## 1. Problem

`/connect/home` renders `Day1Home` - a Phase-1 bootstrap page: a "Welcome to Zari360
Connect / here's how to get started" banner, a profile-completion checklist, a
"Workshops to follow" section, and a **fake feed placeholder** whose own code comment
says _"the real feed is Phase 3."_

Phase 3 shipped the real feed at `/connect/feed` (`FeedScreen` - a full three-column
feed with composer, For-You / Following tabs, right-rail suggestions, ERP callout). But
no entry point was repointed. Every Connect entry - the ERP↔Connect switcher, the
marketing redirect, onboarding-complete, the sidebar logo, the `g>c` shortcut, the ERP
nudge, the workspace-less auth fallback - still routes to the stale `/connect/home`.

Result: a one-time onboarding page is shown as the **permanent home, every visit**. The
real home (the feed) is an extra click away. This is the drift this change corrects.

## 2. The change

`/connect/feed` becomes the single Connect home. Every entry point routes there
directly - no welcome page, no redirect hop. `Day1Home` is deleted; its genuinely
useful pieces move onto the feed.

## 3. What moves, what is dropped

| `Day1Home` piece                                     | Disposition                                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile-completion checklist (`ProfileStrengthCard`) | Moves to a **dismissible card at the top of the feed column** (the middle column - so it is visible on mobile AND desktop, unlike the side rails which hide below 1280px).      |
| ERP cross-sell (`ConnectErpCrossSell`)               | Moves to the top of the feed column. It is already narrowly conditional (workshop-owner intent + no workspace) and already dismissible.                                         |
| "Workshops to follow"                                | **Dropped.** `getFeaturedWorkshops()` is a stub returning `[]` (the feature moved to Phase 6 / `CompanyPage`). The feed's right-rail "people to follow" is the live equivalent. |
| Fake feed placeholder                                | **Deleted** - the real feed exists.                                                                                                                                             |
| "Welcome to Connect" banner                          | **Dropped.** The onboarding flow (`/connect/onboarding`) is the intro. Browse-first landing on the feed is the intended design.                                                 |

### The top-of-feed profile card

- A dismissible card hosting `ProfileStrengthCard`, rendered at the top of the feed's
  middle column.
- Shows only when the profile is incomplete (strength < 100) **and** the card has not
  been dismissed.
- Dismissal is persisted in `localStorage` (mirrors `ConnectNudge` /
  `ConnectErpCrossSell` - key `z360_connect_profile_card_dismissed`) - once dismissed it
  stays gone; `/connect/profile` and the nav always remain available to complete the
  profile.
- A complete profile (strength 100) sees no card. It is a nudge that recedes, never a
  blocker.

## 4. Routing changes

Repoint every `/connect/home` reference to `/connect/feed`:

- `components/layout/ModeSwitcher.tsx` - the ERP↔Connect switcher.
- `app/(marketing)/connect/page.tsx` - the marketing `/connect` redirect.
- `features/connect/onboarding/OnboardingClient.tsx` - onboarding-complete push (+ its
  `OnboardingClient.test.tsx`).
- `app/connect/onboarding/page.tsx` - the already-onboarded redirect.
- `lib/constants/keyboard-shortcuts.registry.ts` - the `g>c` "Switch to Connect"
  shortcut.
- `components/connect/ConnectModuleNav.tsx` - the sidebar logo link.
- `components/connect/ConnectNudge.tsx` - the ERP-sidebar Connect nudge.
- `app/auth/AuthClient.tsx` - the workspace-less auth fallback (two `fallback`
  assignments).
- `app/connect/layout.tsx` - the post-auth `redirect('/auth?redirect=/connect/home')`
  parameter.
- `components/layout/TopHeader.tsx` - the in-app page-title map entry.

`app/connect/home/page.tsx` becomes a thin `redirect('/connect/feed')` stub - stray
bookmarks / external links to `/connect/home` land on the feed instead of a 404.
`features/connect/home/Day1Home.tsx` is deleted.

## 5. Edge cases

| Case                               | Handling                                                                                                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not-onboarded user                 | Lands on the feed and browses - browse-first is already the intended design; the feed already redirects write actions (compose / react / comment) to `/connect/onboarding`.                                          |
| Empty feed (Connect is new)        | `FeedList`'s empty state + the right-rail "people to follow" + the top-of-feed profile card cover the cold start. The plan verifies the empty state reads well.                                                      |
| Workspace-less user (post-signup)  | Was sent to `/connect/home`, now `/connect/feed`. The Connect shell layout (`app/connect/layout.tsx`) gates access identically for any `/connect/*` route - `/connect/feed` is gated exactly as `/connect/home` was. |
| User dismissed the profile card    | It stays gone; the profile is still completable via `/connect/profile` and the nav.                                                                                                                                  |
| `/connect/home` typed / bookmarked | The redirect stub sends them to `/connect/feed` - no 404.                                                                                                                                                            |

## 6. Acceptance criteria

1. Clicking "Connect" (ERP switcher, sidebar logo, `g>c` shortcut) or following the
   marketing `/connect` link lands directly on the feed - no welcome page, no visible
   redirect hop.
2. The profile-completion card appears at the top of the feed for an incomplete
   profile, at 380px and desktop; it can be dismissed and stays dismissed.
3. A complete profile (strength 100) sees no profile card.
4. `/connect/home` (typed or bookmarked) redirects to `/connect/feed` - no 404.
5. No "Welcome to Connect" page is shown on a normal Connect visit.

## 7. Files (web only - exact paths/code in the implementation plan)

- New: a dismissible `FeedProfileCard` wrapper component.
- Modify: `app/connect/feed/page.tsx` (load the profile), `features/connect/feed/FeedScreen.tsx`
  (render the top-of-feed cards), `app/connect/home/page.tsx` (redirect stub), the ~11
  repoint sites listed in §4, `app/messages/{en,gu,gu-en,hi-en}.json` (drop the now-unused
  `connect.home.*` keys; add the dismiss control's label).
- Delete: `features/connect/home/Day1Home.tsx`.

No backend change. `getFeaturedWorkshops` (web action + backend stub endpoint) becomes
unused - left in place (harmless; the Phase-6 company work will revisit it).
