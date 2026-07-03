# Handoff - Connect "Activity" view (LinkedIn-style)

> **SHIPPED 2026-05-24 (uncommitted).** Built per this brief. Do NOT re-execute.
> See `PROGRESS.md` ("Profile Activity view") for the as-built record. The owner
> stages + commits.

> Self-contained brief for a fresh, low-cost session. Created 2026-05-24. The
> owner asked for a profile Activity view (own posts / comments / reactions),
> like LinkedIn. Scope was decided autonomously per the build philosophy
> (research + decide, do not poll the owner on product scope) and confirmed.

## Decision (locked)

- **Types:** Posts + Comments + Reactions (own only, v1). Reposts fold into the
  Posts tab. Saved keeps its existing `/connect/saved` page (separate).
- **Location:** tabs on the user's OWN profile (LinkedIn pattern), not a new
  top-level route.
- **Logical-change approval:** already given (owner requested the feature).

## Current state (verify first)

- **No activity endpoint exists.** The only "activity" in the code is the
  unrelated `post:activity` realtime event. Data is present and queryable:
  - `Post.authorId` (+ `deletedAt: null`, `repostOf` for reposts)
  - `Comment.authorId` (+ `deletedAt: null`, `postId` parent)
  - `Reaction { userId, postId }` (one like per user per post)
- Worktrees: web `.worktrees/crewroster-web/zari360-connect`, backend
  `.worktrees/crewroster-backend/zari360-connect`. Branch `zari360-connect`.

## Backend (keep it minimal)

One endpoint with a `type` param (simpler than three routes):
`GET /me/connect/feed/activity?type=posts|comments|reactions&cursor=<createdAt>`

- `posts` - `Post.find({ authorId: me, deletedAt: null })` sorted `createdAt` desc,
  `FEED_PAGE_SIZE`, cursor on `createdAt`. Hydrate via the existing `toPage`
  helper in `feed.service.ts` so viewer-state + author come back identical to the
  feed.
- `comments` - `Comment.find({ authorId: me, deletedAt: null })` desc; for each,
  return the comment + a hydrated preview of its parent `Post` (reuse the
  single-post hydration).
- `reactions` - `Reaction.find({ userId: me })` desc, postIds, hydrate those
  posts (skip since-deleted), same shape as the feed.
- Add `FeedService.getActivity(userId, type, cursor)` + a DTO with a `type` enum.
  Read-only, so PostHog/OTel span only (no audit write), per repo conventions in
  `connect-feed.module` / `feed.controller`.
- Verify: scoped `pnpm exec tsc -p tsconfig.connect-check.json` (only NEW connect
  errors count) + `npx vitest run src/modules/connect/feed --no-file-parallelism`.

## Web

- `ProfileView` (own-profile path): add an Activity section using `ModuleTabs`
  (URL `?activityTab=`), tabs Posts / Comments / Reactions. Render only for the
  owner viewing their own profile (not when viewing someone else).
- `feed.actions.ts`: `getMyActivity(type, cursor)` mirroring `getFeed`'s
  hydration + `ActionResult` shape.
- Reuse: `PostCard` for Posts + Reactions tabs (it already handles all kinds +
  delete/save). Comments tab: a small `ActivityCommentItem` (comment body +
  relative time + link to `/connect/posts/[postId]`). Reuse the feed's
  `useInfiniteQuery` + `useWindowVirtualizer` pattern from `FeedList`. REMEMBER
  `getItemKey: (i) => items[i]._id` - index-keyed measurement caused the
  overlap/gap bug just fixed.
- i18n: `connect.profile.activity.*` (tab labels, empty states) x4 locales
  (en/gu/gu-en/hi-en); keep parity (`check:i18n` gates the build). No em-dash.
- Tests: list renders per tab, empty state, tab switch via URL.
- Verify: `pnpm typecheck` + `pnpm exec eslint <changed>` + `pnpm run check:i18n`
  - `pnpm exec vitest run connect`.

## Success criteria (verifiable)

1. Own profile, Activity, Posts: my posts newest-first, paginated, honest empty state.
2. Comments tab: my comments, each linking to its post.
3. Reactions tab: posts I liked, hydrated like the feed.
4. typecheck + eslint + check:i18n (4-locale parity) + scoped BE vitest + web vitest all green.
5. In-browser pass at 380 / 768 / 1280; tabs swap via URL without remounting the shell.

## ECC

Run `ecc:code-architect` (designs the feature against existing patterns) OR the
`ecc:feature-dev` / `ecc:plan` skill FIRST. Note: ECC subagents auto-pause on a
cost hook and cannot be resumed mid-run when session cost is already high, so
start fresh (low cost) before invoking them.

## Constraints

- Zero git ops by the assistant - the owner stages + commits.
- No em-dash anywhere (hyphen / period / comma).
- BE resource caution: scoped tsc + module-only vitest (the full suite /
  whole-project tsc OOMs).
- Non-English strings are assistant-authored - flag for native-speaker review.

## Resume prompt for the new session

> Build the Connect Activity view. Read `docs/connect/HANDOFF-activity.md` first.
> Scope is locked (Posts + Comments + Reactions, own-only, profile tabs). Verify
> there is still no activity endpoint, then implement the BE
> `GET /me/connect/feed/activity?type=` + the web profile Activity tabs per the
> handoff. Run `ecc:code-architect` (or `ecc:feature-dev`) first. Owner commits.
