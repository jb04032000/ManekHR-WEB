# Boost Post Web Foundation Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]`.
>
> **Project git rule:** OWNER stages and commits. "Commit" steps = stage + pause for owner. Assistant runs no git.
>
> **Depends on Plan 1 (backend).** This plan consumes the backend endpoints under `connect/ads/*`. It can be built against a running backend or with the actions stubbed, but the feed-seam + composer tasks assume Plan 1 endpoints exist.

**Goal:** Ship the advertiser-facing web layer for Boost Post: server actions, the Boost composer with ERP-verified audience targeting + live estimates + wallet pay, the wallet UI, the feed render seam that shows promoted posts (with viewability + click beacons), the results view, a minimal admin review page, and full i18n across en/gu/gu-en/hi-en.

**Architecture:** Next.js App Router. Ad decision runs in a Server Component during feed SSR (no layout shift); the client `AdCard` mounts only an IntersectionObserver (viewability beacon) + click redirect. The existing provider-agnostic `features/connect/feed/feed-ads.ts` interleaver is extended to carry a promoted-post row; the existing `HousePromo` stays the fallback. Server actions wrap the backend via the existing axios `serverHttp` + `unwrapServer`.

**Tech Stack:** Next.js (App Router, server actions), axios `serverHttp`/`unwrapServer`, AntD v6, Tailwind (cr-\* tokens), next-intl (4 locales), vitest/RTL where used. Conventions: RBAC `<Can>` atom (`components/rbac/Can.tsx`), design language per the Team v2 admin-page pattern, no em-dashes, WCAG AA, empty/loading/error states.

**Worktree:** web `.worktrees/crewroster-web/zari360-connect`. Paths below are relative to that root.

---

## File Structure

```
features/connect/ads/
  ads.actions.ts            # server actions: boost, wallet, audience, decide, events
  ads.types.ts              # shared TS types (AdDecision, BoostInput, WalletView, ...)
  BoostButton.tsx           # entry on a post card (author/page-admin only)
  BoostComposer.tsx         # objective + audience + budget/duration + pay
  AudienceFilter.tsx        # role/sector/district chips + live reach
  BoostResults.tsx          # spend/views/clicks/reach + pause/resume
  WalletPanel.tsx           # balance + top-up + history
  AdCard.tsx                # client: renders promoted post + IntersectionObserver beacon + click
features/connect/feed/
  feed-ads.ts               # MODIFY: add promoted-post row alongside HousePromo
  <feed server component>   # MODIFY: call decide() at SSR, inject into buildFeedRows
app/connect/boost/[postId]/page.tsx   # composer route (modal fallback acceptable)
app/connect/ads/wallet/page.tsx       # wallet page
app/(admin)/admin/connect/ads/review/page.tsx  # minimal admin review
app/messages/{en,gu,gu-en,hi-en}.json # MODIFY: connect.ads.* keys
```

---

## Task 1: Server actions + types (`ads.actions.ts`, `ads.types.ts`)

**Files:** Create `features/connect/ads/ads.actions.ts`, `features/connect/ads/ads.types.ts`.

- Step 0 (discovery): read an existing actions file (e.g. `features/connect/notifications/notifications.actions.ts`) for the `serverHttp` + `unwrapServer` pattern and the `'use server'` header. Mirror it exactly.
- [ ] Step 1: `ads.types.ts` -- `AdDecision {impressionToken, postRef, campaignId}`; `TargetingInput {roles[],sectors[],districts[],companySizes[],maxConnectionDegree?}`; `BoostInput {postId,objective,totalBudget,days,targeting}`; `BoostStatus {status,objective,spend,budgetRemaining,reach,views,clicks}`; `WalletView {balance,reserved}`; `ReachEstimate {reach,belowFloor}`.
- [ ] Step 2: `ads.actions.ts` (`'use server'`): `createBoost(input)` POST `/connect/ads/boosts`; `getBoost(id)` GET; `pauseBoost(id)`/`resumeBoost(id)` POST; `getWallet()` GET `/connect/ads/wallet`; `topupWallet(amount, ref?)` POST; `estimateAudience(targeting)` POST `/connect/ads/audience/estimate`; `decideAd(placementKey)` POST `/connect/ads/decide`; `recordImpression(token)` / `recordClick(token)` POST `/connect/ads/events/*`. Each wraps `serverHttp` + `unwrapServer`, typed.
- [ ] Step 3: typecheck (project script, e.g. `npm run typecheck` or `tsc -p` on the feature) -> commit `feat(ads-web): server actions + types`.

## Task 2: Extend the feed interleaver (`feed-ads.ts`, pure, TDD)

**Files:** Modify `features/connect/feed/feed-ads.ts`; Test `features/connect/feed/__tests__/feed-ads.vitest.ts` (extend existing if present).

- Goal: a feed slot can carry a promoted post OR a house promo. Keep cadence (FIRST_AD_AFTER=4, AD_INTERVAL=6, never adjacent, under 30% density).
- [ ] Step 1: write failing test -- `buildFeedRows(posts, { promotedPost, housePromos })` injects the promoted post at the first ad slot when present; falls back to a house promo when absent; preserves cadence; never duplicates the promoted post against an organic post already in the page (dedupe by postRef).
- [ ] Step 2: run vitest (FAIL).
- [ ] Step 3: extend the `FeedRow` union to `{ kind: 'post' } | { kind: 'ad', ad: PromotedPostRow | HousePromo }`; `PromotedPostRow { type:'promoted', postRef, impressionToken, campaignId }`. Update `buildFeedRows` signature + injection logic; keep `HousePromo` path intact.
- [ ] Step 4: run vitest (PASS).
- [ ] Step 5: commit `feat(ads-web): feed interleaver supports promoted post`.

## Task 3: AdCard client component (`AdCard.tsx`)

**Files:** Create `features/connect/ads/AdCard.tsx`.

- Renders the promoted post using the EXISTING post-card renderer (do not rebuild a post card; reuse it) with a small "Promoted" tag (i18n `connect.ads.promotedLabel`). For a house promo, render the existing house-promo card.
- [ ] Step 1: client component (`'use client'`). On mount, an IntersectionObserver fires `recordImpression(impressionToken)` once when >=50% visible for >=1s (MRC-style); guard against double-fire with a ref.
- [ ] Step 2: wrap the post in a click handler/link that calls `recordClick(impressionToken)` then navigates (profile or post). Non-blocking beacon (fire-and-forget, swallow errors).
- [ ] Step 3: a11y -- the "Promoted" tag has an accessible label; the card is keyboard-focusable; beacon does not trap focus.
- [ ] Step 4: typecheck + commit `feat(ads-web): AdCard with viewability + click beacons`.

## Task 4: Wire decision into the feed SSR

**Files:** Modify the Connect feed server component (find: read `features/connect/feed/*` for the feed page/list server component).

- [ ] Step 1: in the Server Component, after loading the page of posts, call `decideAd('feed_promoted_post')`. If it returns an `AdDecision`, pass it as `promotedPost` to `buildFeedRows`; else pass none (house promo fills).
- [ ] Step 2: render rows: `kind:'post'` -> existing post card; `kind:'ad'` -> `AdCard` (promoted post via the post renderer, or house promo). The promoted post renders on ALL viewports (remove the mobile-only `md:hidden` constraint for the promoted-post case; house promo keeps its current behavior).
- [ ] Step 3: handle decision errors gracefully (null -> house promo; never block the feed).
- [ ] Step 4: manual check (run the app, view the feed); typecheck; commit `feat(ads-web): serve promoted post in feed at SSR`.

## Task 5: BoostButton on the post card (`BoostButton.tsx`)

**Files:** Create `features/connect/ads/BoostButton.tsx`; Modify the post-card component to render it.

- [ ] Step 1: button shows only when the viewer is the post author or a page admin -- gate with the existing `<Can>` atom (find the right module/action; fallback to an author-id check). Hidden otherwise.
- [ ] Step 2: clicking routes to `/connect/boost/[postId]` (or opens the composer modal). i18n label `connect.ads.boost`.
- [ ] Step 3: typecheck + commit `feat(ads-web): boost entry on post card`.

## Task 6: BoostComposer + AudienceFilter (`BoostComposer.tsx`, `AudienceFilter.tsx`)

**Files:** Create both; create `app/connect/boost/[postId]/page.tsx`.

- [ ] Step 1: AudienceFilter -- chip selectors for role / sector / district (seed options from existing taxonomies; reuse designation/industry/location sources). Optional company size + connection degree. On change, debounced call to `estimateAudience` -> show "about N people" (or a "very small audience" note when belowFloor).
- [ ] Step 2: BoostComposer -- objective radio (reach / inquiries / profile visits), AudienceFilter, budget input (min 99, suggested chips 99/299/500/1000), duration (3/7/14/30). Live "estimated views" range derived from budget + duration + reach.
- [ ] Step 3: pay section -- show wallet balance (from `getWallet`); a one-tap "Boost now - INR X" button; if balance < budget, show an inline top-up step first (links to WalletPanel top-up).
- [ ] Step 4: submit -> `createBoost`; on success show the live status (BoostResults); on error show a toast (AntD `App.useApp()` message), i18n `connect.ads.actionError`.
- [ ] Step 5: typecheck + commit `feat(ads-web): boost composer + audience filter`.

## Task 7: Composer states + validation + a11y

**Files:** Modify `BoostComposer.tsx`, `AudienceFilter.tsx`.

- [ ] Step 1: loading state (estimates + submit), disabled submit while invalid, empty/zero-audience guidance, error state on estimate/create failures.
- [ ] Step 2: validation messages (budget below min, no audience selected = broadest reach is allowed but warn), all via i18n.
- [ ] Step 3: keyboard navigation, focus management on modal open/close, labels on every control (WCAG AA). No em-dashes in copy.
- [ ] Step 4: typecheck + commit `feat(ads-web): composer states + a11y`.

## Task 8: WalletPanel (`WalletPanel.tsx`, wallet page)

**Files:** Create `features/connect/ads/WalletPanel.tsx`; Create `app/connect/ads/wallet/page.tsx`.

- [ ] Step 1: show balance + reserved (from `getWallet`). Top-up form: amount, a GST note (18%, added at payment), suggested amounts. On submit -> `topupWallet` (in the real flow the payment gateway confirms first; reuse the existing subscription gateway path -- find it and mirror).
- [ ] Step 2: history list (ledger rows) if a list endpoint exists; otherwise show recent top-ups returned by the wallet read. Empty/loading/error states.
- [ ] Step 3: typecheck + commit `feat(ads-web): ad wallet panel + top-up`.

## Task 9: BoostResults (`BoostResults.tsx`)

**Files:** Create `features/connect/ads/BoostResults.tsx`.

- [ ] Step 1: from `getBoost(id)` show spend, budget remaining, reach, views, clicks, status. StatTile style per the Team v2 admin pattern.
- [ ] Step 2: pause/resume controls (`pauseBoost`/`resumeBoost`) with optimistic state + rollback on error + toast.
- [ ] Step 3: empty (no data yet) / loading / error states; i18n; a11y.
- [ ] Step 4: typecheck + commit `feat(ads-web): boost results + controls`.

## Task 10: Minimal admin review page

**Files:** Create `app/(admin)/admin/connect/ads/review/page.tsx` (confirm the admin route group by reading an existing admin page).

- [ ] Step 1: list pending creatives (GET `/admin/connect/ads/review`); each row shows the post preview + advertiser + objective + budget.
- [ ] Step 2: approve / reject actions (reject requires a reason); optimistic update + toast. Gate behind the existing admin guard/route group.
- [ ] Step 3: a placement/pricing settings section (floor CPM, enabled, min spend) -> PUT `/admin/connect/ads/placements/:key`; a revenue summary tile (GET revenue).
- [ ] Step 4: empty/loading/error states; i18n; typecheck; commit `feat(ads-web): minimal admin ad review`.

## Task 11: i18n across 4 locales + final polish

**Files:** Modify `app/messages/{en,gu,gu-en,hi-en}.json`.

- [ ] Step 1: add all `connect.ads.*` keys used above (boost, promotedLabel, objectives, audience labels, budget/duration, payNow, walletBalance, topUp, gstNote, results labels, pause/resume, admin review labels, actionError, empty/error strings) in all 4 locales. No em-dashes; Gujarati + Latin-script variants per the locale conventions.
- [ ] Step 2: run `npm run check:i18n` (expect parity across the 4 files).
- [ ] Step 3: run the project lint + typecheck on touched files (avoid whole-project tsc per resource caution); fix any issues.
- [ ] Step 4: manual pass -- feed shows a promoted post on desktop + mobile, composer estimates update live, wallet top-up flows, results render, admin approve/reject works.
- [ ] Step 5: commit `feat(ads-web): i18n (4 locales) + polish`.

---

## Self-Review

**Spec coverage (design -> task):** server actions -> T1; feed render seam -> T2/T3/T4; boost entry -> T5; composer + ERP-verified targeting + live estimates + pay -> T6/T7; wallet + GST -> T8; results + pause/resume -> T9; minimal admin (review/pricing/revenue) -> T10; i18n 4 locales + a11y + states -> T7/T9/T10/T11. Viewability + click beacons -> T3. SSR no-layout-shift -> T4.
**Placeholders:** none in intent. Discovery steps (existing actions file, post-card renderer, feed server component, `<Can>` module/action, admin route group, gateway path) are repo-specific lookups with named targets + how to use them.
**Type consistency:** `AdDecision` shape matches the backend decide response (impressionToken/postRef/campaignId); `TargetingInput` mirrors backend `TargetingDto`; `impressionToken` is the single key passed to both beacons; `FeedRow` union extension keeps the existing `HousePromo` path.
**Reuse (not rebuild):** existing post-card renderer (AdCard wraps it), existing `feed-ads.ts` seam + `HousePromo` fallback, existing actions pattern (`serverHttp`/`unwrapServer`), `<Can>` atom, Team v2 StatTile/admin tokens, existing subscription gateway path for top-up, notifications `App.useApp()` toast pattern.

## Execution Handoff

Plan 2 of 2 (web). With Plan 1 (backend) this completes the Boost Post foundation road map.
Execution options: (1) Subagent-Driven (recommended) -- fresh subagent per task, review between; (2) Inline -- this session with checkpoints. Build Plan 1 (backend) before or alongside Plan 2 so the web layer has live endpoints.
