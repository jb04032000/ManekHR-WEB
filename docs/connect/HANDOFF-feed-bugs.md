# Handoff - Connect feed bug-fix + tuning pass

> Self-contained resume brief for a fresh session. Created 2026-05-24 after the
> Wave 6 (Saved + Edit) slice + a Network fix + feed throttling shipped. The
> items below were deliberately deferred because they need the running app to
> reproduce (the gap) or are owner-decision / logical changes (ranker, hybrid
> fan-out). Read this top to bottom, then read the docs in "Read first".

## Worktrees (branch `zari360-connect`, NOT main checkouts)

- web: `D:\Work\Projects\Personal\zari360\.worktrees\crewroster-web\zari360-connect`
- backend: `D:\Work\Projects\Personal\zari360\.worktrees\crewroster-backend\zari360-connect`

## Read first (in order)

1. `docs/connect/README.md`
2. `docs/connect/PROGRESS.md` (web worktree) - latest "Phase 7c / Wave 6" readout + the deferred list.
3. `docs/connect/ENGINEERING-STANDARDS.md`
4. `docs/connect/phases/phase-feed-at-scale.md` (§3 hybrid fan-out, §4 retention, §6/§7 ship matrix).

This project has a `code-review-graph` MCP - prefer it over Grep/Glob for exploration.

## Current state (uncommitted on disk; owner stages + commits ALL git - assistant runs ZERO git ops)

- **Saved posts** vertical (root-keyed bookmarks) - shipped + verified.
- **Edit post** vertical (`Post.editedAt` + `connect.post.changed` event seam, emitted on create/edit/delete; W5 posts-in-search only needs the `@OnEvent` indexer) - shipped + verified. BE 75 vitest, web 151 vitest, all green.
- **Network Followers status fix** - the Followers tab now resolves connected/following per follower (`app/connect/network/page.tsx`, `features/connect/network/NetworkScreen.tsx`, `features/connect/network/FollowersTab.tsx`), so a row renders "Connected"/"Following" instead of a bare Connect that 409s. Verified.
- **Feed throttling** - `app.module.ts` tiers `connect-engage` (90/min) + `connect-write` (30/min); `@Throttle` + `ThrottlerGuard` on react / comment / save / recordViews (engage) and createPost / repost / editPost (write) in `feed.controller.ts`. Verified.

## Tasks (reproduce before fixing - do NOT fix blind, the gap especially)

### 1. Feed gap between posts

Symptom: large empty space between cards (e.g. a voice post then a repost card) in the For-You list. File: `features/connect/feed/FeedList.tsx` - `useWindowVirtualizer`, `estimateSize: () => 360`, `measureElement`, `scrollMargin`. Likely measurement drift on variable-height cards (voice player, repost-with-embedded-original). Run the stack (backend `pnpm seed:connect`, 2 logged-in users; web `pnpm dev`), reproduce, find root cause, fix, verify in-browser at 380 / 768 / 1280px.

### 2. New post appears at the bottom (For-You tab)

It is the ranker by design - a brand-new 0-engagement post from a followed author ranks below older engaged posts. The Following tab shows it at top (chronological). Decide behavior WITH OWNER (logical change - get approval):

- option A: recency-boost very-fresh posts in BE `feed/ranking/default-additive.strategy.ts`.
- option B: on the "New posts. Tap to refresh" pill, prepend the new post to the top instead of refetch + re-rank.

Realtime gives only `{ postId, authorId }` (`features/connect/feed/useConnectSocket.ts` `useFeedRealtime`; `FeedList` `onNewPost` sets `hasNewPosts` then refetches). Page-1 assembly: `feed.service.ts` (`getFeed` / `interleaveFeed` / `rankForYou`).

### 3. "New posts" pill UI

`FeedList.tsx` `hasNewPosts` pill (`position: sticky`, `top: 12`, centered dark pill). Owner says UI "not proper" - ask the owner for specifics (overlap? position?) before changing.

### 4. Deferred - hybrid fan-out + `listFollowerIds` bound (logical change, owner approval)

`network.service.ts` `listFollowerIds` loads ALL follower ids unbounded. A naive `.limit()` would silently drop followers from fan-out - the correct fix is cursor-streaming, bundled with the documented hybrid threshold (`phase-feed-at-scale.md` §3, `FANOUT_CELEBRITY_THRESHOLD` ~10k, NOT implemented). Fine at current scale (low-thousands B2B textile). Also from the scaling audit: per-like op count + single-doc `$inc` counter contention, and a Redis-counter debounce - all 100k-scale, defer with a doc note in `phase-feed-at-scale.md`.

## Constraints / conventions

- **NO em-dash anywhere** (code comments, i18n strings, chat). Use hyphen, period, or comma. Locked rule.
- **GateGuard hook** fires before each create/edit: present 4 facts (importers via grep, affected public API, data shape, verbatim user instruction). It fires once per file, then retry the same edit.
- **BE resource caution** (machine OOMs on the full suite / whole-project tsc / eslint src): test ONLY the module - `npx vitest run src/modules/connect/feed --no-file-parallelism`. Typecheck scoped - `pnpm exec tsc -p tsconfig.connect-check.json`; pre-existing errors in `add-ons` / `mail` / `users` are the documented baseline, only NEW errors in `connect/feed` count. eslint per-file; `no-unsafe-*` warnings in `*.vitest.ts` are the established `any`-mock convention - **0 errors** is the bar.
- **Verify each vertical:** BE vitest + scoped tsc + eslint; web `pnpm typecheck` + `pnpm check:i18n` + eslint + `pnpm exec vitest run connect`. i18n is x4 locales (en / gu / gu-en / hi-en), parity-checked by `check:i18n`.
- After each fix vertical goes green, run the **`ecc:typescript-reviewer`** agent on the changed files.
- **Logical / behavioral / ranker / schema** changes need explicit owner approval before shipping (surface, do not absorb).
- To run the app, use the run / verify skills; the stack needs Redis + Mongo + backend + web.

Caveman mode is the owner's default (terse; toggle with `/caveman`). Start by reading the docs above, confirming clean working trees, and reproducing tasks 1 + 2 before proposing fixes.
