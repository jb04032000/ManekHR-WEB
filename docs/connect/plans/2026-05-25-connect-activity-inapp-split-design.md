# Connect - in-app vs public Activity split + photo-strip render fix

**Status:** Design approved (owner picked both open decisions 2026-05-25). Not yet
implemented.
**Date:** 2026-05-25.
**Phase:** Feed (Phase 3) follow-on. Builds on the shipped public-activity surface
(`/u/[slug]/activity`) + the rich `ActivityCard`.
**Worktrees:** web `.worktrees/crewroster-web/zari360-connect`, backend
`.worktrees/crewroster-backend/zari360-connect`. Zero git ops by the assistant: the
owner stages + commits. This is web-only (no backend change).

---

## 1. Goal

Connect has two profile surfaces:

- **PUBLIC** (SEO, logged-out, no app shell): `app/(connect-public)/u/[slug]/page.tsx`
  - `.../u/[slug]/activity/page.tsx`, rendered via `PublicActivityList`. Intentional,
    stays public + crawlable.
- **IN-APP** (authenticated, Connect shell + rails): `app/connect/u/[slug]/page.tsx`.
  Has NO activity route today.

Two defects:

1. **Routing leak.** `app/connect/u/[slug]/page.tsx` (line 92) sets
   `showAllHref={`/u/${shareToken}/activity`}`, the PUBLIC route. A signed-in member
   viewing a colleague in-app and tapping "Show all activity" lands on the bare public
   page: no shell, no rails, an "Open Connect" header. Confirmed live at
   `/u/<id>/activity`.
2. **Render.** The public activity photo strip (`ActivityCard`'s photo branch) reads
   cramped / misaligned next to the feed's polished `PostPhotoGrid` teaser.

## 2. Root cause

One teaser component (`ActivityPreview` -> `ActivityCard`) is shared by both the public
and the in-app profile, but the in-app profile passes a PUBLIC `showAllHref`. There is
no in-app activity destination to point at, so the only available "Show all" target was
the public route.

## 3. Owner decisions (2026-05-25)

| #   | Decision                                     | Choice                                    | Rationale                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Authed-user redirect off public `/u/*`       | **Middleware in `proxy.ts`**              | Keeps the public pages pure SSR/ISR + crawlable (no per-request `getMe()`). Mirrors the existing `/auth -> /dashboard` authed redirect. `proxy.ts` already special-cases `/u` (public + device-tier-exempt). No redirect loop: `/connect/*` never re-matches the `/u` rule.                                                              |
| D2  | `#4` photo strip: share a component or match | **Match `PostPhotoGrid`, no shared file** | The feed grid needs AntD `<Image>` + `Image.PreviewGroup` (lightbox). The card needs a plain `<img>` inside the post `<Link>` (link-through, no lightbox). A shared component would have to branch lightbox-vs-link on a `mode` prop: a leakier abstraction than the ~6 lines it would dedupe. Align geometry, keep the leaves separate. |

Both are architecture calls (not domain), surfaced per the task brief and ENGINEERING
-STANDARDS #13. No schema, no permission, no new module: not a logical change.

## 4. Surfaces (after this change)

| Surface                   | Route                                    | Activity "Show all" target         | Indexed | Shell + rails                          |
| ------------------------- | ---------------------------------------- | ---------------------------------- | ------- | -------------------------------------- |
| Public profile            | `app/(connect-public)/u/[slug]`          | `/u/[slug]/activity` (public)      | yes     | no (public layout + Footer + Join CTA) |
| Public activity           | `app/(connect-public)/u/[slug]/activity` | n/a                                | yes     | no                                     |
| In-app profile            | `app/connect/u/[slug]`                   | `/connect/u/[slug]/activity` (NEW) | no      | yes (DashboardLayout shell)            |
| **In-app activity (NEW)** | `app/connect/u/[slug]/activity`          | n/a                                | no      | yes (shell + `ConnectLayout` rails)    |
| Owner profile             | `app/connect/profile`                    | `/connect/profile/activity`        | n/a     | yes                                    |
| Owner activity            | `app/connect/profile/activity`           | n/a                                | n/a     | yes (template for the new route)       |

Logged-out behaviour on the public tree is unchanged.

## 5. The new in-app activity route (`#1`)

`app/connect/u/[slug]/activity/page.tsx`. Server Component. Models the OWNER activity
route `app/connect/profile/activity/page.tsx` (the in-app rails template), but for a
viewed member's PUBLIC posts. ENGINEERING-STANDARDS #5/#7/#9.

- Data: `getPublicConnectProfileBySlug(slug)` + `getPublicActivity(slug)` in parallel
  (the same actions the public activity page uses). `notFound()` on a failed profile
  read (hidden / non-public / unknown 404s upstream).
- Own profile: `getRelationship(slug)` -> `self` -> `redirect('/connect/profile/activity')`
  (single owner activity view, mirrors the in-app profile's self -> `/connect/profile`
  redirect). The in-app shell already provides the viewer session.
- Shell: wrap in `ConnectLayout`:
  - `topBar` = back link to `/connect/u/[slug]` (reuse `connect.profile.activity.backToProfile`,
    "Back to profile": the in-app `/connect/u/[slug]` IS the profile).
  - `left` = the viewed member's `ProfileMiniCard` (name + headline + avatar from the
    populated `userId`, `href` to `/connect/u/[slug]`) + `AdSlot placement="connect.left.top"`.
  - `right` = `PeopleYouMayKnow` (hydrated `getSuggestions` top few, like the owner
    route) + `AdSlot placement="connect.right.top"`.
  - children = `PublicActivityList` (reused as-is, server-seeded first page). Wrap in
    `QueryProvider` only if the `/connect` shell does not already provide one (verify in
    impl: the feed mounts TanStack Query inside the shell, so a provider likely exists;
    if so do not double-wrap).
- `generateMetadata`: title via `connect.profile.activity.byUser` ("Activity by {name}");
  `robots: { index: false, follow: false }` (the public mirror owns SEO). Matches the
  in-app profile's noindex contract.
- A `loading.tsx` sibling (skeleton), matching the in-app profile route which ships one.
- States: empty / load-error / caught-up are already inside `PublicActivityList`; the
  route adds the not-found gate + the loading skeleton.

i18n: expected ZERO new keys (reuse `byUser` + `backToProfile`). Confirm during impl;
if a distinct meta title is wanted, reuse `byUser` rather than minting a key, to avoid
new gu / gu-en / hi-en strings.

## 6. Repoint the in-app profile (`#2`)

`app/connect/u/[slug]/page.tsx` line 92: `showAllHref={`/u/${shareToken}/activity`}` ->
`showAllHref={`/connect/u/${shareToken}/activity`}`. Update the adjacent comment if it
names the public target. The PUBLIC profile
(`app/(connect-public)/u/[slug]/page.tsx`) keeps `showAllHref` ->
`/u/[slug]/activity` (correct for logged-out + SEO). Leave it.

`shareToken` is `profile.userId.handle || profile.userId._id`; both forms resolve via the
same backend `:slug` path, so the in-app activity route accepts either, same as the
profile route.

## 7. Authed redirect off the public tree (`#3`, `proxy.ts`)

Send a logged-in visitor who hits `/u/*` to the in-app `/connect/u/*` mirror, so shared
/ direct links keep authed users in the shell. Logged-out visitors are untouched.

Add a pure helper:

```ts
/** Authed users viewing a public Connect profile/activity are sent to the in-app
 *  mirror (shell + rails). Logged-out visitors still get the public page. */
function connectMirrorPath(pathname: string): string | null {
  if (pathname === '/u' || pathname.startsWith('/u/')) return `/connect${pathname}`;
  return null;
}
```

Apply it at the two points where the request is known-authenticated, preserving the
query string and (on the refresh path) the freshly-issued cookies:

- **Fast path** (`if (hasValidAccess)`, ~line 130): before the `/auth` handling,
  `const mirror = connectMirrorPath(pathname); if (mirror) return NextResponse.redirect(new URL(mirror + search, request.url));`
- **After successful silent refresh** (the `tryRefresh` success block): if
  `connectMirrorPath(pathname)` is set, return a redirect to the mirror with the new
  access / refresh / platform cookies set on the redirect response. This covers the
  primary use case: an idle-token member clicking a shared `/u/<slug>` link. Without it,
  that exact user would see the public page once before the token refreshes.

No loop (`/connect/*` is not `/u/*`). Self-view still resolves correctly: `/u/<self>` ->
`/connect/u/<self>` -> the profile route's `self` redirect to `/connect/profile`. The
matcher already includes `/u/*` and excludes static assets.

## 8. Photo-strip render fix (`#4`, `ActivityCard`)

Rewrite `MediaPreview`'s `kind === 'photo'` branch in
`features/connect/profile/ActivityCard.tsx` to match the feed's `PostPhotoGrid`
(`components/connect/PostCard.tsx` line 925) geometry, kept as a compact, static,
link-through teaser:

- `shown = media.slice(0, 4)`; `overflow = media.length - 4`.
- `display: grid`; `gridTemplateColumns: shown.length === 1 ? '1fr' : '1fr 1fr'`; `gap: 2`.
- per tile `aspectRatio: shown.length === 1 ? '16 / 10' : '1 / 1'`, `overflow: hidden`,
  rounded to match the card.
- plain `<img object-fit: cover>` (NOT AntD `<Image>` / `PreviewGroup`): the whole card
  is already a `<Link href="/connect/posts/[id]">`, so a tap goes to the post. No
  lightbox here (would fight the link). Keep `loading="lazy"` + the
  `no-img-element` eslint-disable the file already uses.
- "+N" overlay on the 4th tile when `overflow > 0` (same dark scrim the feed uses). Keep
  the literal `+{overflow}` glyph (a symbol, not prose: no i18n key, matches the current
  card).
- Cap the grid width so it reads as a teaser inside the card, not a full-bleed feed post
  (e.g. a `max-width` around the feed teaser's compact size; tune live at 380 px).

Video / document / voice branches stay as-is. This is the only change to `ActivityCard`,
so the public activity list, the public profile preview, the in-app profile preview, and
the new in-app activity route all pick it up (one card, every surface: #5). D3 of the
photo-display-mode doc stands (no carousel on `ActivityCard` / public mirror).

## 9. Public page conversion CTA (`#5`)

No change required: the public profile + activity already render under the
`(connect-public)` layout (marketing `Footer`) and the public profile carries the
Join / Open-Connect CTA. Verify it is present and that the pages still work logged-out
during the Playwright pass. Do not gate any public surface behind auth.

## 10. Part B - close-out leftovers (carried from the prior photo-display-mode session)

Independent of the activity split; no design needed. Track as their own tasks.

- **B1** Verify the unverified Composer change: the active attachment-mode button now
  shows an "x" deselect cue (`components/connect/Composer.tsx`). Run `pnpm typecheck` +
  `eslint Composer.tsx` + the Composer test. Fix if red.
- **B2** Unit tests: `components/connect/PhotoLayoutChooser.test.tsx` (render, both
  modes, selection, a11y) + a `MediaUploadGrid` drag-drop reorder test.
- **B3** `/design-system` (`app/design-system/DesignSystemGallery.tsx`): add a
  `PhotoLayoutChooser` entry (#11).
- **B4** Flag the new gu / gu-en / hi-en strings for native-speaker review:
  `connect.feed.composer.layout.*`, `connect.feed.post.carousel.*`,
  `connect.feed.media.dropHint`. (Record in PROGRESS.md owner-follow-ups; assistant
  -authored translations always get flagged.)
- **B5** Re-enable GateGuard if it was disabled (the GateGuard hook gating Edit/Write).
  NOTE: GateGuard is currently ACTIVE (it gated this very doc write), so B5 is likely
  already satisfied. Confirm and close.

## 11. File-by-file task list

Part A (the split + render fix):

- A-1 NEW `app/connect/u/[slug]/activity/page.tsx` - ConnectLayout mirror of the owner
  activity route; public posts via `PublicActivityList`; self -> redirect; noindex.
- A-2 NEW `app/connect/u/[slug]/activity/loading.tsx` - skeleton (match the in-app
  profile `loading.tsx`).
- A-3 `app/connect/u/[slug]/page.tsx` - repoint `showAllHref` to
  `/connect/u/${shareToken}/activity`; fix the comment.
- A-4 `proxy.ts` - `connectMirrorPath` helper + redirect at the fast path and the
  post-refresh path; preserve query + cookies.
- A-5 `features/connect/profile/ActivityCard.tsx` - photo branch -> count-aware cropped
  grid matching `PostPhotoGrid`.
- A-6 i18n - only if a new key proves necessary (target: zero new keys). 4-locale parity.
- A-7 Tests - extend `PublicActivityList` / `ActivityCard` tests for the grid; a render
  test for the new route is optional (it is a thin server wrapper).

Part B: B1-B5 above.

## 12. Verification

- **web:** `pnpm typecheck` · `pnpm exec eslint <changed files>` ·
  `pnpm exec vitest run connect` · `pnpm run check:i18n` (4-locale parity, no em-dash in
  `connect.*`).
- **Live (Playwright, screenshot-first, do NOT iterate blind):** seed
  (`pnpm -C <backend worktree> run seed:connect`, re-login: new ObjectIds), login mobile
  - dev OTP 123456 / PIN 123456. At 380 / 768 / 1280:
  1. Capture the CURRENT broken `/u/<id>/activity` photo strip before the fix (baseline).
  2. In-app: open a member profile `/connect/u/<id>`, tap "Show all activity" -> lands on
     `/connect/u/<id>/activity` WITH shell + rails (not the bare public page).
  3. Authed redirect: hit `/u/<id>` and `/u/<id>/activity` while logged in -> bounced to
     `/connect/u/<id>(/activity)`. Then logged-out -> public page renders unchanged with
     the Join CTA.
  4. Photo strip: a 4-photo and a 7-photo post both render a clean cropped grid + "+N",
     tapping through to the post.
- **ECC:** run `ecc:typescript-reviewer` over the changed files at the end; fix HIGH/
  CRITICAL.

## 13. Open items / flags

- **Not a logical change** (no schema / permission / module). No owner approval gate
  beyond the two D1/D2 calls already made.
- **i18n:** target zero new keys. Any unavoidable new gu / gu-en / hi-en string is
  assistant-authored -> flag for native-speaker review (Part B4 bucket).
- **Pre-existing, not introduced here:** the web `FeedPost` type lacks `authorDistrict`
  (drift shared with `getMyActivity` / `getPublicActivity`); public reads carry no
  throttler tier (repo-wide convention for public Connect reads). Owner to decide
  module-wide; out of scope.
- **Zero git ops** - owner stages + commits. Update `PROGRESS.md` at session end.
