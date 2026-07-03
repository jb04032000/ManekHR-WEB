# Connect "Open to" Avatar Status - Reusable Core Structure - Design

- Date: 2026-06-09
- Surface: every Connect place a person avatar renders (profile, feed, comments, search, connections, inbox, people cards)
- Repos: `crewroster-web` (component + call-site swaps) + `crewroster-backend` (one derived field on person/author projections)
- Status: APPROVED (owner said go); spec for traceability

## 1. Problem

The "Open to work / Hiring" status currently lives only as cards (and a pill) on the profile page. But a person's avatar appears all over the platform (feed, comments, search rows, connections, inbox, people cards). Re-implementing the status per surface would be inconsistent and would break tight layouts. LinkedIn solves this by baking the status into a ring around the avatar, so it travels with the photo everywhere automatically.

## 2. Goal

One reusable avatar-with-status component, used by every Connect avatar spot, fed by one small `openStatus` field that travels in the data those spots already load. Consistent, layout-safe, privacy-aware. ERP (attendance/salary/team) avatars stay plain.

## 3. Non-goals

- No change to the profile intent CARDS (detail + CTA) - they stay on the profile page; this adds the traveling ring.
- No status ring on ERP dashboard avatars.
- No new payments. No companies-directory work.
- `work`/`hiring` are already mutually exclusive and `deals`/`customOrders` already paused (prior change) - this builds on that.

## 4. The core structure

### 4.1 Component: `ConnectAvatar` (web)

`components/connect/ConnectAvatar.tsx` - a thin Connect-only wrapper around the shared `DsAvatar` (`components/ui/DsBadge.tsx`).

Props:

```ts
interface ConnectAvatarProps {
  name?: string;
  src?: string;
  size?: number; // same sizing contract as DsAvatar
  status?: 'work' | 'hiring' | null; // null/undefined => plain avatar
  /** Hide the text label even at large sizes (caller override). Default false. */
  hideLabel?: boolean;
}
```

Behavior:

- `status == null` -> renders bare `DsAvatar` (zero visual change, zero overhead).
- `status` set -> wraps the avatar in a colored ring (a `padding` ring via an outer element, NOT a CSS `outline`, so it composes with the round avatar) and, at large sizes, a small curved/pill label at the bottom-center (the LinkedIn / reference pattern). Color per status (hiring vs work) from cr- tokens.
- Size-aware label rule: show the text label only when `size >= LABEL_MIN` (e.g. 64). Below that, ring + a tiny status dot/icon only, no text - so feed/comment/search avatars never overflow. `hideLabel` forces ring-only regardless.
- The ring thickness + label font scale from `size` so it reads correctly at 24, 36, 96.
- Accessibility: the status has an `aria-label` (e.g. "Open to work") so it is announced; decorative ring is `aria-hidden`.
- This component is the SINGLE source of truth for the status visual. The existing `AvatarStatusRibbon` (the header pill) is folded into it / replaced so there are not two implementations.

### 4.2 Derived data: `openStatus`

A single derived value `openStatus: 'work' | 'hiring' | null` (work/hiring are mutually exclusive, so one value suffices). Derived from the person's `openTo` booleans + `openToDetails[key].audience`:

- `hiring` on -> `'hiring'`; else `work` on -> `'work'`; else `null`.
- Audience rule for the TRAVELING value: only an `audience: 'all'` intent contributes to the person-ref/author `openStatus`. A `network`-scoped intent yields `null` in these broad projections (its ring shows only on the profile page, which already does the per-viewer audience trim). This keeps feed/search cheap and privacy-correct without per-viewer joins at scale.

Backend: add `openStatus` to the projections Connect person/author surfaces already build. Confirm exact sites during planning; expected:

- `ConnectProfileService.getPeopleByIds` -> `ConnectPersonRef` (powers search / people-you-may-know / connections people cards). It already reads `ConnectProfile`; extend the projection to also select `openTo` + `openToDetails` and compute `openStatus`.
- Feed post author + comment author hydration (feed module) - if these carry an author identity block, add `openStatus`.
- Inbox thread participant identity - add `openStatus` if cheaply available; otherwise defer inbox to a later pass (flag it).
- Profile reads already carry `openTo`+`openToDetails`, so the profile page computes `openStatus` client-side (respecting the already-trimmed network audience) - no new field needed there.

Each added projection field is additive and read-only. No schema change (derived).

### 4.3 Call-site swap (web)

Replace bare `DsAvatar` with `ConnectAvatar` (passing `status={openStatus}`) at the Connect person-avatar spots:

- Profile header (`ProfileView.tsx`) - big photo gets ring + label; fold out the old `AvatarStatusRibbon` pill.
- Feed (`PostCard.tsx`, `PostComments.tsx`, `PublicPostView.tsx`).
- Search people (`PersonCard.tsx`, `PostResultCard.tsx`, `ProfileMiniCard.tsx`, `MiniProfileCard.tsx`).
- People (`PeopleYouMayKnow.tsx`, `network/FollowingTab.tsx`).
- Inbox (`ThreadRow.tsx`, `ConversationPane.tsx`) - only if `openStatus` is wired for participants; else leave plain and flag.
- NOT swapped: ERP dashboard avatars (attendance/salary/team), `TopHeader` self-avatar (own avatar; optional later), admin layout.

A surface that does not have `openStatus` in its data simply passes `status={null}` and renders exactly as today - so the swap is safe to land incrementally.

## 5. Data flow

person/author projection (BE adds `openStatus`) -> web list/card component reads it -> passes `status` to `ConnectAvatar` -> ring renders. Profile page derives `openStatus` from the (already audience-trimmed) `openTo`/`openToDetails` it loads.

## 6. Testing

- Web unit: `ConnectAvatar` - null -> plain avatar (no ring); 'work'/'hiring' -> ring + correct `aria-label`; small size hides label, large shows it; `hideLabel` forces ring-only.
- Web: a representative call-site test (e.g. PersonCard) shows the ring when `openStatus` set.
- BE: `getPeopleByIds` returns `openStatus` correctly (hiring > work > null; network-scoped -> null) - extend the profile service vitest.

## 7. Accessibility / i18n

- `aria-label` on the status (localized): reuse `connect.profile.intents.ribbon.{work,hiring}` (already in 4 locales) or a short `connect.profile.intents.status.*`. No new layout text beyond the existing ribbon labels.

## 8. Rollout / risk

- Low risk: `ConnectAvatar` with `status=null` is visually identical to `DsAvatar`, so swapping call sites is safe even before the data field lands everywhere.
- Build order: (1) `ConnectAvatar` + tests, (2) profile header swap (data already present), (3) BE `openStatus` on `getPeopleByIds`, (4) swap people/search/feed call sites, (5) feed/inbox author `openStatus` if cheap (else flag). Each step ships working software.

## 9. Owner sign-off needed on

- The additive `openStatus` projection field on person/author reads (derived, read-only - logical but low-risk). Approved in principle via the design go-ahead.

Everything else (ring look, color tokens, label threshold, which call sites first) is the assistant's call per the build-philosophy directive.
