# Connect - Progress Tracker

**Living file. Update at the end of every work session.** A resuming session reads this
first to know exactly where things stand. Canonical copy: the **web** worktree.

---

## Status

- **Epic:** Zari360 Connect - 9 phases (0–8). See `connect-build-plan.md`.
- **Phase 0 - Foundation: COMPLETE + verified** (2026-05-18).
- **Phase 1 - Identity: CODE COMPLETE + verified - pending owner review.**
  Sub-plan: `phases/phase-1-identity.md`. Waves 1–6 ✅ (+ Wave 4.5 auth alignment).
- **Phase 2 - Network: CODE COMPLETE + verified - pending owner review** (2026-05-18).
  Sub-plan: `phases/phase-2-network.md`. Waves 1–6 ✅.
- **Phase 3 - Feed: CODE COMPLETE + verified - pending owner review**
  (2026-05-19). Sub-plan: `phases/phase-3-feed.md`. Waves 1–6 ✅.
- **Connect-first milestone (spec §13 items 3–8): CODE COMPLETE + verified**
  (2026-05-20). Person-only signup + entry-marker routing + dual-policy gate +
  browse-first onboarding + intent-driven cross-sell + ERP→Connect nudge.
  Waves 0 / A / B / C all shipped (plan docs in `plans/2026-05-19-connect-first-*`,
  stamped SHIPPED). Plus 2026-05-20 polish: shared `<ConnectPage>` width
  container, cross-shell `AppLockSettingsModal` (account menu), `DsAvatar`
  person-glyph fallback.
- **Next:** Phase 1 + Phase 2 + Phase 3 + Connect-first owner-review checkpoints
  → Phase 4 - Marketplace (OR finish Phase 2 Meilisearch provisioning).
- **Phase 7c in flight** (uncommitted): Wave D (discovery), Wave S (share + repost),
  Wave 6 doc (`phases/phase-feed-at-scale.md`), and now the **Wave 6 ship-v1
  slice - Saved posts + Edit post** (2026-05-24, below).
- **Notifications centre, gap-close (2026-05-26, uncommitted, below):** the centre was
  already built (Phase 7a, never logged here); this slice added the deferred §12.3
  batching + reply notifications + the repost web wiring.

## Ad Monetization / Boost Post - Backend (Plan 1) COMPLETE (2026-05-26, committed)

First-party ad delivery engine + Boost Post backend. Branch `zari360-connect`, 11 commits
(T1-T34 of `docs/connect/ad-monetization/2026-05-26-boost-post-backend-foundation-plan.md`).
Module `src/modules/connect/ads/`.

**ADVERTISER = the Connect User (`ownerUserId`), NOT `workspaceId`.** Connect has no workspace
concept (person-centric). The design spec + both plan docs still SAY workspaceId - that is
STALE; the shipped code uses `ownerUserId`. Any future ads/web work must use the authed user
(`req.user.sub`), never a workspace. (This was an owner-caught correction mid-build,
2026-05-26.)

**Shipped:** 9 schemas (advertiser-wallet, wallet-ledger, campaign, ad-set, creative,
placement, impression, click, daily-rollup) · pure libs (targeting match / eCPM+score / pacing
math) · WalletService (guarded idempotent topup/reserve/debit/release, reserved-floor guards,
impressionToken idempotency) · AdDecisionService (9-step auction, 6 injectable collaborators) ·
PacingDaemon · AdEventsService (two-phase debit, triple-layer double-charge guard) · reconcile

- rollup crons · class-validator DTOs · controllers (boost/wallet/audience/decide + admin;
  JwtAuthGuard; identity from req.user.sub; throttler tiers) · AdsAdminService (review / approve /
  reject + reserve release + AppModule.ADS audit) · Mongo repos (`ad-repos.ts`) · full AdsModule
  wiring (13 tokens bound, ConnectProfile targeting sources, seed `feed_promoted_post`) · PostHog
  write events (@Optional).

**Verified:** ~271 ads vitest pass, `npx nest build` clean (1466 files), changed-file eslint 0
errors, DI graph statically verified complete. NOT yet verified: runtime DI + real Mongo/Redis
(owner live smoke owed).

**Accepted simplifications (by design):** candidate read N+1 (CandidateRepoMongo + admin
listPending); predictedCtr 0.01 + relevance 1 constants (pending learning); basic IVT (click
valid=true); freq-cap consumes a hit on losing candidates; connectionDegree defaulted 1
(relative-degree deferred); companySize defaulted '' (no Phase-1 source).

**Deferred (flagged):** OTel spans + Sentry on billing catches (own observability pass, no-op
without configured endpoints); wallet topup credits directly (real gateway-confirm-first is the
web layer, web-plan T8); design/plan doc workspaceId->ownerUserId correction notes (added at
the top of those docs).

**Next:** Plan 2 (web, 11 tasks) -
`docs/connect/ad-monetization/2026-05-26-boost-post-web-foundation-plan.md`. Advertiser = authed
user, no workspaceId. Reuse: `feed-ads.ts` interleaver + HousePromo fallback, "Promoted" label,
serverHttp/unwrapServer actions, `<Can>` atom, Team v2 StatTile, subscription gateway path for
top-up.

## Notifications: §12.3 batching + reply notifications + repost wiring (2026-05-26, uncommitted)

**Discovery first.** The Connect notifications centre was ALREADY built (an earlier,
uncommitted "Phase 7a" pass that was never recorded in this file): the ERP
`NotificationsModule` was EXTENDED per `BACKEND-REUSE-AUDIT.md` (nullable `workspaceId`,
first-class `category`, a dedicated Socket.IO `/notifications` gateway + 3 channels +
preferences), `dispatch()` hooked into the react / comment / follow / accept / repost
seams (skip-self), plus a web `NotificationProvider` + bell badge +
`/connect/notifications` centre + `PreferencesForm`. So this slice did NOT rebuild it
(that would violate Standard #5), so it closed the three real gaps:

- **§12.3 batching ("N people ...").** New `Notification.actorIds[]` + `aggregatedCount`
  - a batch-lookup index. `dispatch()` folds a same-recipient + same-category +
    same-entity event into an existing UNREAD row inside a 24h window (accumulate the
    distinct actor, bump the count, re-light `seenAt`) instead of stacking N rows; only the
    four post-engagement categories batch (invite / connection / follow stay 1:1). Count
    copy stays with the caller via a new optional `DispatchInput.batchMessage(count)` so the
    dispatcher stays generic (consistent with the existing BE-authored message pattern). The
    realtime event + `ChannelSendInput` carry `aggregatedCount`; the web provider's
    `created` handler now UPDATES an existing row in place on a re-fired batched event rather
    than dropping it. **Schema logical change, owner-approved this session.**
- **Reply notifications.** New `connect.post_replied` category (BE enum + toggleable + web
  `CATEGORIES` + i18n x4 + `notificationHref`). `CommentService.addComment` loads the
  parent comment's `authorId` and notifies the parent author on a reply, skipping a
  self-reply and skipping a double-ping when the parent author is also the post author.
- **Repost web wiring.** The backend already dispatched `connect.post_reposted`; the web
  had no label or link. Added the `notificationHref` cases (TopHeader + centre), the
  `PreferencesForm` entry, and `categories.connect_post_reposted` i18n x4.

**Verified.** Backend: scoped `tsc` clean (no new connect errors; the add-ons / mail /
users errors are pre-existing repo debt, unrelated), 76 module vitest (3 new batching + 2
new reply cases), changed-file eslint clean. Web: `check:i18n` OK (4659 keys, 4-locale
parity), `typecheck` clean, changed-file eslint clean, 188 connect vitest.

**Owner follow-ups (flagged):** (1) batched copy is count-only ("N people reacted"); the
whole notification surface is name-less today, so actor-name hydration ("Alice and N
others") is a follow-up that needs the provider to resolve `actorIds` to people. (2)
Native-speaker review of the new `gu` / `gu-en` / `hi-en` strings (reposted / replied),
assistant-authored. (3) In-browser 380 / 768 / 1280 pass (needs a live stack). (4)
Pre-existing legacy `findAll` in `notifications.service.ts` carries 3 `any`-typed eslint
warnings (untouched ERP code, not absorbed here).

**Production hardening (2026-05-26, same session, uncommitted).** Owner-approved
follow-on after a gap review. (a) **Throttle** - the engagement endpoints turned out
already throttled (`connect-engage` 90/min, `connect-write` 30/min); the earlier
"no throttler tier" note was stale, no change needed. (b) **Batch atomicity** -
replaced the read-then-write + 24h window with a partial unique index on `batchKey`
(unread rows only) + an atomic `findOneAndUpdate` upsert (E11000 retry), so concurrent
folds cannot duplicate a row; an unread row folds until read. (c) **Retention** -
an `expiresAt` TTL index (90-day) set on Connect rows only (ERP rows keep null and
never auto-expire). (d) **Pagination** - keyset `before` cursor on `listForUser` +
`GET /me/notifications`; a "load older" button on the centre. (e) **Actor names** -
the centre resolves actorIds via `getPeople` and renders avatar + "Meera and N others"
(`andOthers` ICU key x4); the bell dropdown stays text-only. (f) **Test** - extracted
`applyCreatedEvent` (pure) with 3 unit cases for the batched fold. Push delivery
(FCM/APNs/VAPID) deferred to its own epic (paid deps + mobile-app repo + owner
credentials). Verified: BE scoped tsc + 19 module vitest; web check:i18n (4661 keys,
4-locale parity) + typecheck + eslint + 191 connect vitest.

## Notifications: delete + shell-aware product filter (2026-05-26, uncommitted)

Two gaps closed on top of the centre. Owner-approved logical change (a new
destructive endpoint + a cross-shell display rule).

- **Delete.** `DELETE /me/notifications/:id` (`deleteForUser`, recipient-scoped
  so a user can only delete their own rows, 404 otherwise) + `DELETE
/me/notifications?product=` clear-all (`deleteAllForUser`, product-scoped).
  Web: `deleteNotification` / `clearAllNotifications` actions; provider
  `deleteOne` / `clearAll` (optimistic, rollback on failure); a per-row trash
  button on the bell dropdown (was a mislabeled mark-read) AND the centre
  (hover / focus-revealed), plus a "Clear all" Popconfirm in both. The centre's
  clear-all scopes to Connect; the bell's clear-all scopes to the active shell.
- **ERP out of Connect (shell-aware bell).** `DashboardLayout` still mounts ONE
  `NotificationProvider` for both shells (one socket, all rows). The DISPLAY is
  now narrowed by shell via the new `useShellNotifications(product)` hook plus
  the `effectiveProduct(n)` helper (trusts the `Notification.product` stamp,
  falls back to the `connect.*` category heuristic for legacy / live-socket
  rows). `TopHeader` passes `mode === 'connect' ? 'connect' : 'erp'`, so the
  Connect bell shows only Connect rows and the ERP bell only ERP, with per-shell
  unseen / unread counts. Bulk actions are product-scoped on the BE too
  (`markAllSeen` / `markAllRead` / clear take an optional `product`; a category
  `$or` AND-composes with the product `$or` so neither is dropped), so opening
  or clearing one shell's bell never touches the other. The centre
  (`/connect/notifications`) is now Connect-only: dropped the connect / workspace
  product chips (status filter only), filters `initial` + "load older"
  (`product: 'connect'`) to Connect.
- **Product claim.** Connect rows are always stamped `connect` by `dispatch`;
  ERP rows are `erp` OR null (legacy `createNotification` predates the stamp),
  so the ERP inbox claims both (`scopeByProduct`). Live `notification:created`
  events carry no stamp, but a `connect.*` category resolves to Connect, so the
  Connect bell stays correct in realtime with no socket-payload change.
- **i18n.** `notifications.{clearAll,clearAllConfirm}` (ERP bell) +
  `connect.notifications.{clearAll,clearAllConfirm,delete}` x4 locales (4683
  keys, parity-clean). gu / gu-en / hi-en assistant-authored, pending native
  review.
- **Verified.** BE 23 notifications-module vitest (5 new: delete own + 404,
  clear-all connect + erp-null-claim, mark-seen product + category/product
  AND-compose) + scoped `tsc` (no new notifications errors; the 15 reported are
  pre-existing add-ons / mail / users debt) + changed-file eslint (0 errors,
  only the file's pre-existing untyped-`req` warnings). Web typecheck clean,
  `check:i18n` OK (4683), 8 `NotificationProvider` vitest (5 new
  `effectiveProduct`), changed-file eslint clean.
- **Owner follow-ups (flagged):** the `/me/notifications` controller still has
  NO throttler tier (pre-existing, module-wide; the new delete routes inherit
  that gap, decide module-wide). Native-speaker review of the new gu / gu-en /
  hi-en strings. In-browser pass: Connect bell shows no ERP rows, ERP bell shows
  no Connect rows, per-shell trash + clear-all, clear-all confirm. GateGuard was
  off this session (owner asked, for speed).

## Phase 7c / Wave 6 - Saved posts + Edit post (2026-05-24, uncommitted)

Per `phase-feed-at-scale.md` §6/§7 ship-v1 matrix. Full verticals, no stubs.

- **Saved posts.** `SavedPost { userId, postId }` schema (`{userId,postId}` unique +
  `{userId,createdAt}` indexes) · `FeedService.savePost`/`unsavePost`/`listSaved` +
  `viewerSaves` + `viewerSaved` in `toPage`. **Saves are ROOT-keyed** (mirror
  `viewerReposted`): saving a repost bookmarks the root content, so a bookmark
  survives the repost wrapper being deleted (the `resolveRootId` helper; the web
  toggle sends `repostRootId`). Controller `GET /me/connect/feed/saved` +
  `POST`/`DELETE /posts/:postId/save` (PostHog `connect.post_saved`, no audit -
  matches reactions). Web: `savePost`/`unsavePost`/`getSaved` actions · Save/Saved
  item in `PostCard`'s overflow menu (`onSaveChange` prunes the Saved list on
  un-save) · `/connect/saved` page + `SavedList` (reuses `removeFromFeedCache`) ·
  left-rail "Saved posts" quick link · `connect.feed.post.save.*` +
  `connect.saved.*` + `leftRail.saved` i18n ×4.
- **Edit post.** `Post.editedAt` · `FeedService.editPost` (author-only, re-validates
  text-empty, re-parses hashtags, stamps `editedAt`; **reposts are not editable**) ·
  PATCH `/me/connect/feed/posts/:postId` (audited `update` + PostHog
  `connect.post_edited`). New `connect.post.changed` domain-event seam
  (`feed/events/connect-post.events.ts`) emitted on **create + edit + delete** -
  the "search re-emit"; **pre-lands the emit half of Wave 5 posts-in-search**, so
  W5 only adds the `@OnEvent` indexer (no listener today = clean no-op, mirrors
  `connect.profile.changed`). Web: `editPost` action · author-only "Edit post"
  overflow item → `EditPostModal` (body edit) · "edited" label (with edit-time
  tooltip) · `connect.feed.post.edit.*` + `editedLabel` i18n ×4.
- **Verified.** BE 75 vitest (`src/modules/connect/feed`, `--no-file-parallelism`) +
  scoped `tsc` (no new connect errors) + eslint clean. Web 151 connect vitest +
  `tsc` + `check:i18n` (4562 keys parity) + eslint clean. Both verticals passed an
  `ecc:typescript-reviewer` pass; HIGH findings fixed (root-keyed saves;
  repost-edit guard BE+FE; modal seeds from current body; no client-clock
  timestamp).
- **Owner follow-ups (flagged, not in scope):** feed-engagement endpoints
  (`react`/`repost`/`comment`/`save`/`views`) carry **no throttler tier** - a
  pre-existing module-wide gap (throttling is opt-in per controller here), not
  save-specific; decide module-wide. W5 posts-in-search will consume
  `connect.post.changed`. MSG91/native-speaker i18n review still pending for new
  `gu`/`gu-en`/`hi-en` strings.

## Profile Activity view (LinkedIn-style), 2026-05-24, uncommitted

Per `docs/connect/HANDOFF-activity.md` (now SHIPPED). Own-profile Activity tabs
(Posts / Comments / Reactions), own data only. No new schema (reads `Post`,
`Comment`, `Reaction` directly).

- **Backend.** `GET /me/connect/feed/activity?type=posts|comments|reactions&cursor=`
  (`FeedController.getActivity`). Read-only: OTel span only, no audit / PostHog
  (matches `getFeed` / `listSaved`). `FeedService.getActivity` switches to
  `activityPosts` (own posts, `createdAt` cursor, hydrated via `toPage`),
  `activityReactions` (liked posts, reaction-time cursor, mirrors `listSaved`),
  `activityComments` (own comments + a parent-post preview; `post: null` when the
  parent was since deleted). New `ActivityType` enum + `ActivityQueryDto`;
  `Comment` model injected into `FeedService`. Verified: scoped `tsc`
  (NO_CONNECT_ERRORS) + 79 feed vitest (4 new getActivity cases).
- **Web.** `getMyActivity` (posts / reactions to `HydratedFeedPage`) plus
  `getMyActivityComments` (to `HydratedActivityCommentsPage`) in `feed.actions`.
  `ProfileActivity` (ModuleTabs, URL `?activityTab=`, shell does not remount)
  renders `ActivityPostList` (reuses `PostCard` + the feed virtualizer,
  `getItemKey` by `_id`) and `ActivityCommentList` (light `ActivityCommentItem`,
  links to `/connect/posts/[id]`). `ProfileView` gained an owner-only `activity`
  slot; `OwnProfileClient` mounts it (`onboarded` from `profile.onboardedAt`).
  `connect.profile.activity.*` i18n x4. Verified: typecheck + eslint clean,
  `check:i18n` OK (4587 keys, 4-locale parity), 159 connect vitest (8 new).
- **Owner follow-ups (flagged):** native-speaker review of the new `gu`,
  `gu-en`, `hi-en` activity strings; in-browser 380 / 768 / 1280 pass (needs a
  live stack).

**Update, 2026-05-24 (perf reorg, uncommitted).** The profile no longer renders
the full tabbed Activity block. It now shows a lightweight `ActivityPreview`
(recent posts, server-fed via `getMyActivity('posts')` in the profile page load:
no `PostCard`, no realtime socket, no extra client fetch) plus a "Show all
activity" link to the new route `app/connect/profile/activity/`, which hosts the
full tabbed `ProfileActivity`. This fixes the eager activity fetch + the per-row
socket fan-out that fired on every profile view. New
`connect.profile.activity.{showAll,metaTitle,backToProfile,previewMedia}` i18n
x4. Verified: web typecheck + eslint clean, `check:i18n` OK (4591 keys), 162
connect vitest (3 new `ActivityPreview` cases).

**Phase 2, public activity on OTHER profiles: SHIPPED 2026-05-24 (uncommitted,
logical change).** Decision (locked): posts public, comments and reactions
owner-only.

- **Backend.** New `@Public GET /connect/profiles/:slug/activity?type=posts&cursor=`
  on a new `ConnectProfileActivityPublicController` in the feed module. It mirrors
  `ConnectProfilePublicController`'s `:slug/erp-link` 404-gate: `resolveSlugToUserId`,
  then `getPublicByUserId` to reject a hidden / non-public / unknown profile before
  any post data is read. `FeedService.getPublicActivity(userId, cursor)` returns a
  RAW lean `PublicFeedPage` (`Post.find({ authorId, visibility: 'public', deletedAt:
null })`, desc, `FEED_PAGE_SIZE` window, `createdAt` cursor): no `toPage`, no
  viewer state (the viewer may be logged out). A repost embeds its public, live ROOT
  `original` via the batched `embedPublicOriginals` (mirrors `getPublicPost`). New
  `PublicActivityQueryDto` (`type` pinned to `posts`; `cursor` is `@IsISO8601`,
  hardened because the endpoint is unauthenticated). Posts only; comments and
  reactions are structurally unreachable (the service method has no `type` routing).
  Verified: scoped `tsc` (no new connect errors), 85 feed vitest (6 new
  getPublicActivity cases), production eslint clean.
- **Web.** `getPublicActivity(slug, cursor)` action (mirrors `getMyActivity`,
  hydrates the owner via `getPeople`, stamps `viewerReacted` / `viewerReposted` /
  `viewerSaved` false since a public read has no viewer state). Shared `ActivityRow`
  extracted from `ActivityPreview` (no duplication) and reused by the new client
  `PublicActivityList` (server-seeded first page plus a `useInfiniteQuery`
  load-more; a load-more failure keeps the list with an inline retry).
  `ActivityPreview` now renders on BOTH the public `/u/[slug]` profile and the
  in-shell `/connect/u/[slug]` mirror (server-fed, `showAllHref` to
  `/u/[slug]/activity`). New route `app/(connect-public)/u/[slug]/activity/`
  (visitor posts-only list, not the owner tabs). `ProfileView` `{isOwner && activity}`
  became `{activity}` (owner still gets the full `/connect/profile/activity` tabs;
  non-owners get the posts-only preview). New
  `connect.profile.activity.{byUser,loadMore,empty.posts.visitorBody}` i18n x4.
  Verified: typecheck and eslint clean, `check:i18n` OK (4594 keys), 167 connect
  vitest (5 new `PublicActivityList` cases).
- **ECC review.** `ecc:typescript-reviewer` plus `ecc:security-reviewer` passes, no
  HIGH/CRITICAL. Security confirmed: visibility filter and 404-gate ordering correct,
  comments/reactions structurally unreachable, no viewer-state or PII leak, repost
  originals public and live only, the `{activity}` change cannot surface owner tabs
  to a visitor. Fixed findings: `initialData` mount-refetch (pinned `staleTime`),
  load-more-failure UX, `@IsISO8601` cursor guard, activity-page `cache()` dedupe.
- **Owner follow-ups (flagged):** native-speaker review of the new `gu` / `gu-en` /
  `hi-en` activity strings (`byUser`, `loadMore`, `empty.posts.visitorBody`,
  assistant-authored). In-browser 380 / 768 / 1280 pass (needs a live stack).
  Pre-existing, not introduced here: the web `FeedPost` type lacks the
  `authorDistrict` the backend emits (drift shared with `getMyActivity`); the public
  reads carry no throttler tier (repo-wide convention for public Connect reads,
  owner to decide module-wide).

**Profile redesign (2026-05-24, uncommitted).** Best-in-industry pass on the
profile page (owner + public), prompted by the activity preview reading as a
bare icon + number + time.

- **Rich `ActivityCard`** (`features/connect/profile/ActivityCard.tsx`) replaces
  the bare `ActivityRow` (removed). Action verb (Posted / Shared N photos /
  Posted a video / Shared a document / Recorded a voice note / Reposted) + a
  two-line snippet + a per-kind media preview (photo strip with +N, video tile,
  document chip, voice clip with waveform + duration) + reaction / comment /
  repost tallies, linking to the post. Static (no `PostCard`, no socket); reused
  by the profile `ActivityPreview` + the public `/u/[slug]/activity` list. New
  `connect.profile.activity.{verb.*, stats.*, documentLabel}` i18n x4.
- **Section organization** (`ProfileView.tsx`): Activity now renders inside a
  `ProfileSection` card (consistent chrome + a "Show all activity" footer)
  rather than a bare block. Craft-forward order: header, About, Activity,
  Portfolio, Experience, Skills, Rates, Recommendations. The owner Visibility
  setting moved out of the content stream into the rail.
- **Footer**: the canonical marketing `Footer` (brand + link columns + contact +
  locale + social + copyright) is reused on the `(connect-public)` layout
  (replacing a bare tagline strip), so public profiles / posts get the real site
  footer. Reuse, not a parallel component.
- **Verified**: web typecheck + eslint clean, `check:i18n` OK (4604 keys), 167
  connect vitest. Not verified visually (needs a live stack). New gu / gu-en /
  hi-en strings assistant-authored, pending native-speaker review.
- **Owner activity page (`/connect/profile/activity`): unified on `ActivityCard`.**
  `ActivityPostList` (Posts + Reactions tabs) now renders the sleek static
  `ActivityCard` instead of the full interactive feed `PostCard`: consistent with
  the profile teaser + the public list, and no realtime socket per row (tapping a
  card opens the post for react / comment / edit / delete). Dropped the now-unused
  `viewerId` / `onboarded` props down the chain (`ProfileActivity` + the route +
  its test). `ActivityCommentList` (Comments tab) was already a light card, left
  as-is. Verified: typecheck + eslint clean, 167 connect vitest.
- **Footer**: the canonical marketing `Footer` now also renders at the foot of the
  logged-in Connect shell (`app/connect/layout.tsx`), not only the public pages.
  Flag: in-app it may read too marketing-heavy (prospect-facing links); a compact
  in-app footer variant is the likely refinement, and it is visually unverified
  (no live stack this session). A full link-column footer for logged-out visitors
  still needs the marketing / legal / help routes whitelisted in `proxy.ts`
  (pre-existing marketing-routes-not-public gap).

## In-app vs public Activity split + photo-strip render (2026-05-25, uncommitted)

Web-only. Design + file-by-file plan:
`plans/2026-05-25-connect-activity-inapp-split-design.md`.

- **Bug.** The in-app profile `/connect/u/[slug]` "Show all activity" link pointed at
  the PUBLIC `/u/[slug]/activity`, so a signed-in member dropped onto the bare
  logged-out page (no shell, no rails).
- **Fix.** New in-app route `app/connect/u/[slug]/activity/page.tsx` (a `ConnectLayout`
  mirror of the owner route `app/connect/profile/activity`: posts-only via the reused
  `PublicActivityList`, self -> `/connect/profile/activity`, noindex) · repointed the
  in-app `showAllHref` to `/connect/u/[slug]/activity` (the public profile keeps the
  public target) · `proxy.ts` now redirects an AUTHED visitor on `/u/*` to `/connect/u/*`
  (fast path + post-refresh, refreshed cookies carried; logged-out untouched; no loop,
  with an explicit `/connect` guard) · `ActivityCard` photo teaser rewritten to a cropped
  count-aware grid matching the feed `PostPhotoGrid` (1 full / 2-4 2-col / 5+ "+N"),
  static link-through (no carousel, no lightbox).
- **Close-outs (carried from the photo-display-mode session).** `PhotoLayoutChooser`
  - `MediaUploadGrid` drag-drop unit tests added · `/design-system` `PhotoLayoutChooser`
    entry · Composer active-mode "x" deselect cue verified (typecheck + eslint + Composer
    test green) · GateGuard confirmed active.
- **Verified.** web typecheck clean · eslint clean (changed files) · `check:i18n` OK
  (4620 keys, 4-locale parity; ZERO new keys, reused `byUser` / `backToProfile`) ·
  vitest connect 182 pass (39 files, +10 new). ECC typescript-reviewer pass: both HIGH
  items resolved without code change (QueryProvider is ambient from the root
  `app/layout.tsx`, confirmed by the owner activity route precedent; the self-redirect
  fail-open is benign and consistent with the parent profile route, and no owner-only
  data is fetched on this surface). The recommended middleware loop-guard was added.
- **Owner follow-ups (flagged):** live Playwright pass at 380 / 768 / 1280 (owner will
  run it: in-app "Show all" lands in-shell with rails; the authed `/u` redirect;
  logged-out public page unchanged with the Join CTA; the photo grid at 4 and 7 photos) ·
  native-speaker review of the gu / gu-en / hi-en strings from the photo-display-mode
  work (`connect.feed.composer.layout.*`, `connect.feed.post.carousel.*`,
  `connect.feed.media.dropHint`), assistant-authored.

## Mobile responsive alignment (2026-05-25, uncommitted)

Web-only. Closed 6 impl-vs-spec gaps against the locked design-decisions doc
(§4.2 tablet, §6.2 / §6.3 / §6.4 mobile, §4.1 rail widths). No new schema, no
backend.

- **Gap 1, §4.2 tablet (768-1279) keystone.** `FeedScreen` left rail returns at
  `lg` (was `xl`); the right-rail panels were extracted to a `rightRailPanels`
  fragment rendered BOTH in the `xl` side rail AND a below-feed block
  (`hidden md:block xl:hidden`), so the right rail folds below the content on
  tablet. In-feed PYMK retuned to `md:hidden` (mobile only, no tablet dup);
  `FeedProfileCard` to `lg:hidden` (the left rail shows the strength meter at
  lg+). `feed/loading.tsx` left skeleton synced to `lg`. **Decision: left rail
  at `lg`, not `md`.** Below lg the ERP shell ModeSidebar holds the left edge,
  so a second 240px rail at 768 would crush the feed; the ModeSidebar covers
  the small-tablet nav band.
- **Gap 2, §6.2 tap targets.** `FeedScreen` share-trigger plus the
  Photo/Video/Voice shortcuts, and the `Composer` attachment-mode pills, now
  carry `minHeight: 44`.
- **Gap 3, §6.3 mobile composer.** `Composer` (a centered AntD modal) gained a
  `.cn-composer-modal` class; a new `@media (max-width: 767px)` rule in
  globals.css makes it a full-screen sheet (100vw / 100dvh, no radius) on
  mobile, while tablet / desktop keep the centered 560 sheet. The large voice
  tap-to-record was already satisfied by the 72px `VoiceNoteRecorder`.
- **Gap 4, §6.4 mobile search.** New `ConnectMobileSearch` full-screen sheet:
  recent (localStorage `z360.connect.recentSearches`) plus curated suggested
  categories plus a live `searchConnect` typeahead plus voice (Web Speech API,
  gu-IN / hi-IN / en-IN, transcript shown before submit, button hidden where
  unsupported). Entry point: a `md:hidden` search icon in the Connect-mode
  `TopHeader` (the desktop `ConnectSearchBar` is `hidden md:flex`, so mobile
  had NO search at all before). **Saved searches deferred:** that is the §13.4
  save-search-with-alert feature, which needs its own Phase 5 / 7 backend;
  shipping recent + suggested + voice now (no stub).
- **Gap 5, Rail aria i18n.** `Rail` aria-label now reads
  `connect.shell.rail.left` / `.right` (was hardcoded English), with an
  `ariaLabel` override prop.
- **Gap 6, §4.1 rail widths.** globals.css `--cn-rail-left-w` / `-right-w`
  260/260 to **240/320** (collapsed 300/300 to 280/360); `Rail` DEFAULT_WIDTH,
  the `feed/loading.tsx` fallbacks, and the `ConnectLayout` grid aligned.
  **Supersedes the prior deliberate equal-width 260/260 trial** (the old
  globals.css comment); the spec's asymmetric ratio is the locked rule.
- **i18n.** `connect.shell.rail.*` plus `connect.shell.mobileSearch.*` (incl. 8
  suggested categories) across 4 locales; deduped a stale
  `connect.feed.media.dropHint` in en. gu / gu-en / hi-en assistant-authored,
  pending native-speaker review.
- **Verified.** `check:i18n` OK (4642 keys, 4-locale parity) · web `typecheck`
  clean · eslint clean (changed files) · connect vitest 175 pass / 38 files.
- **Owner follow-ups (flagged):**
  1. Native-speaker review of the new gu / gu-en / hi-en search + rail strings.
  2. `ConnectLayout` (post-detail + the 2 activity routes) still gates
     right@lg / left@xl, so its tablet behaviour is not yet §4.2-aligned (only
     its widths were updated). Folding its right rail below on tablet is a
     separate follow-up; gap 1 was scoped to FeedScreen + Rail.
  3. The 3 sibling `loading.tsx` (network / notifications / search) keep a dead
     `280px` rail-width FALLBACK (the CSS var is always set by DashboardLayout,
     so the fallback never renders). Cosmetic, fix when convenient.
  4. Desktop `ConnectSearchBar` still has no voice button (§13.3 "every search
     input"); mobile has voice now.
  5. `ConnectMobileSearch` is imported directly by `TopHeader`, not via the
     `components/connect` barrel, so it has no `/design-system` gallery entry
     (a full-screen overlay is awkward to gallery anyway).
  6. Live Playwright pass at 380 / 768 / 1024 / 1280 still owed (needs a running
     stack): tablet left-rail-stays + right-rail-below, mobile full-screen
     composer + search + voice, 44px targets.

## Mobile in-feed ads (2026-05-25, uncommitted)

Web-only. Follow-up to the responsive alignment above: the owner flagged the rail
sections as the ad real-estate, and on mobile (no side rail) they were invisible.
Added a native in-feed ad slot for the mobile feed. Research-backed (subagent +
standards); decisions captured here.

- **Standards applied.** Coalition for Better Ads mobile ad-density ceiling 30%;
  MRC/IAB viewability 50% px for 1s; IAB Native Advertising Playbook + FTC
  disclosure (label above content, high contrast). House promos are first-party,
  so labelled "Promoted" (FTC reserves "Sponsored" for paid third-party).
- **Cadence (`feed-ads.ts`).** First ad after post #4 (`FIRST_AD_AFTER`), then one
  per 6 posts (`AD_INTERVAL`), never two adjacent, so ~14% density, under the 30%
  ceiling. Pure `buildFeedRows(posts, promos)` interleaver, unit-tested (6 cases).
- **Placement.** `FeedList` drives its window-virtualizer off a unified `rows`
  model (post | ad). Ad rows render mobile-only: wrapped `md:hidden`, so they
  collapse to 0 height at >=md (desktop / tablet keep the rail). Hydration-safe
  (CSS visibility, no viewport branch in the row model), no CLS. Fetch-next
  trigger + item keys moved to the rows model.
- **Card (`FeedAdCard`).** PostCard chrome; "Promoted" label above content + an
  `InfoTooltip` "why am I seeing this" (rule #17) + "Hide this" dismiss (session
  frequency cap via `dismissedAds`); 44px CTA; `aria-label="Promoted: <heading>"`.
- **Inventory (v1, real CTAs, no stub, rotated round-robin):** Grow network
  (`/connect/network?tab=suggestions`), Complete profile (`/connect/profile`),
  Discover trade (`/connect/search`). Provider-agnostic seam: swap `HOUSE_PROMOS`
  for a real ad source later, nothing else changes.
- **i18n.** `connect.feed.ads.*` across 4 locales. gu / gu-en / hi-en
  assistant-authored, pending native review.
- **Verified.** typecheck clean · eslint clean (changed files) · `check:i18n` OK
  (4655 keys, 4-locale parity) · connect vitest 181 pass / 39 files (+6 new).
- **Owner follow-ups (flagged):**
  1. Real ad provider / inventory (ad server or house-campaign manager) +
     targeting + impression / click tracking + a viewability beacon. v1 is
     house promos only.
  2. Ads are mobile-only (<md). The tablet below-feed rail block has low
     viewability; consider interleaving on tablet too if ad revenue matters there.
  3. Frequency cap is session-only (in-memory `dismissedAds`); persist per-user if
     desired.
  4. Native-speaker review of the new gu / gu-en / hi-en ad strings.
  5. Live Playwright pass: first ad only after post 4, the 6-post cadence, dismiss,
     label contrast, and desktop showing no in-feed ad.

## Entity reframe (2026-05-18)

Owner reframe: Connect is a **standalone product** whose primitives are `User`,
`ConnectProfile` (1/user), `CompanyPage` (0..N/user), `Storefront` (0..N/user). No
"Workspace" concept in Connect - ERP integration is an opt-in **per-entity** link.
Company Page + Storefront are **parallel sibling entities** sharing one admin
foundation (built once in Phase 4, reused by Phase 6). Audited (3 agents) - impact is
small and concentrated.

- **Docs updated:** `IDENTITY-MODEL.md` (rewritten), `connect-build-plan.md` (identity
  architecture, decisions table, route map → `/connect/*`, component inventory,
  backend modules, phase scope), this file.
- **Shipped-code surgical fixes - DONE** (web `5a8f6bc`, backend `63d6ab9`):
  - _Backend_ - `ConnectProfile.primaryWorkspace` + its sparse index removed; the
    `erp-link` endpoints derive ERP-linked context from the User's employment
    (`WorkspaceMember` active rows) instead.
  - _Web_ - `ConnectModuleNav` reframed (flat `storefront` / `leadManager` dropped,
    conditional owned-entity groups); `primaryWorkspace` removed from `profile.types.ts`.
- **Still open (deferred to their phases, no migration owed):**
  - `getFeaturedWorkshops` / `featured-workshops` - Day-1 home featured row points at
    `CompanyPage`s, which arrive Phase 6. The endpoint stays (curated stub) until then;
    the Phase-2 plan's "switch Day-1 featured to `SuggestionService`" is moot - that
    service returns _people_ suggestions, surfaced on the Network · Suggestions tab,
    not the workshops-to-follow row. Flagged for owner.
  - `BACKEND-REUSE-AUDIT.md` §6 wording ("Company Page = workspace metadata") -
    correct at Phase 6.
- **Unchanged + reframe-clean** (audited): identity model (User + Profile 1:1,
  layered), `ErpLinkService` derivation, auth / middleware / mode-switch, the 9-phase
  order, the rest of shipped Phase 0 / 1.

## Phase 1 progress

- [x] **Wave 1 - backend identity** - `User.connectEnabled` flag · `ConnectProfileService`
      (lazy get-or-create, public read, update, `computeStrength`) · `UpdateConnectProfileDto` ·
      `ConnectProfileController` (`GET`/`PATCH /me/connect/profile`, `GET .../erp-link`) +
      `ConnectProfilePublicController` (`GET /connect/profiles/:userId`, `@Public`) · module
      wired (AuditModule, service, controllers). **33 backend tests green; connect code
      tsc-clean** (12 scoped-tsc errors are all pre-existing `add-ons`/`mail` debt).
- [x] Wave 2 - uploads `connect-banners` + `connect-portfolio` categories added.
      featured-workshops endpoint → folded into Wave 5; `seed:connect` → folded into
      Wave 4 (just-in-time - built with their consumers).
- Standing rule added (#17): inline-help info icons + plain explanations on every
  non-obvious feature - audience is affluent but low-literacy textile owners.
- [x] Wave 3 - 6 components (PersonCard, ProfileStrengthCard, ERPLinkedPanel,
      ERPCallout, RateRow, ContactPreferenceSelector) + `lib/connect/format.ts`;
      each with `InfoTooltip` help (#17); i18n 4 locales; `/design-system` entries;
      6 test files. **47 web unit tests green; tsc + eslint clean.**
- [x] **Wave 4 - Profile: COMPLETE + verified.**
  - _Backend:_ `ConnectProfile.contactPreference` (`whatsapp`/`phone`/`dm`, default
    `whatsapp`) added to schema + `UpdateConnectProfileDto` + service
    `UPDATABLE_FIELDS`; new `@Public GET /connect/profiles/:userId/erp-link`
    (privacy-trimmed - `linked` + `since` only, no raw signals). **36 backend tests
    green** (schema + service additions).
  - _Web data layer:_ `profile.types.ts` (+`ConnectContactPreference`,
    `PublicErpLinkStatus`, `ConnectProfileBody`) · `profile.actions.ts`
    (+`getPublicErpLink`) · `upload.service.ts` (+`connect-banners`/`-portfolio`).
  - _Web UI:_ `ProfileView` (read-only - banner/identity header, `TrustBadgeRow`,
    open-to pills, `ContactPreferenceSelector`, About/Skills/`RateRow`/Portfolio/
    Experience/Recommendations; owner rail = `ProfileStrengthCard` + `ERPLinkedPanel`)
    · `ProfileEditForm` (AntD Form + zod payload schema, `FileUpload` banner+portfolio,
    `Form.List` portfolio+experience, rupee↔paise) · `ProfileSkeleton` ·
    `/platform/profile` (server load + `OwnProfileClient` view/edit toggle) ·
    `/u/[userId]` (SSR, indexable metadata, `notFound()`, Join-Connect CTA) + route
    `loading.tsx` ×2 + `(connect-public)/not-found.tsx`.
  - _Rest:_ `connect.profile.*` i18n 4 locales (parity-clean) · `/design-system`
    ProfileView entry · `seed:connect` (`scripts/seed-connect.ts` + `pnpm
seed:connect`; 3 personas - master karigar, day-1 karigar, workshop owner who
    gets a workspace + 6 attendance rows so the ERP-linked badge derives live) ·
    3 web test files. **69 web tests green; web `tsc` + Wave-4 `eslint` + `next
build` clean; backend Connect code scoped-`tsc` clean** (`tsconfig.connect-check.json`).
- [x] **Wave 4.5 - Auth alignment + `/platform`→`/connect` rename: COMPLETE + verified.**
      Brainstormed audit of the ERP-shaped auth; owner-approved design at
      `phases/phase-1-wave-5-design.md`. `proxy.ts`: `/u` → `PUBLIC_PATHS` (public
      profiles work logged-out + crawlable - fixes a shipped-Wave-4 bug); `/connect` + `/u` exempt from the `mobile_only` device-tier redirect (Connect is
      feature-flagged, never subscription-gated); `PLATFORM_RESTRICTED_PATHS` →
      `DEVICE_TIER_EXEMPT_PATHS` + a disambiguating comment. Connect app route
      `/platform/*` → `/connect/*` (~20 files; `app/platform-restricted/` -
      device-tier - untouched).
- [x] **Wave 5 - Smart entry + onboarding + Day-1 home: COMPLETE + verified.**
  - _Backend:_ `ConnectProfile.onboardedAt` · `getEntryState` /
    `completeOnboarding` / `getFeaturedWorkshops` service methods ·
    `GET /me/connect/profile/entry` · `POST /me/connect/profile/onboarding` ·
    `ConnectFeaturedController` → `@Public GET /connect/featured-workshops` ·
    `CompleteOnboardingDto`. **44 backend tests green; scoped `tsc` clean.**
  - _Web:_ `/connect/home` smart-entry (server component - coming-soon /
    onboarding-redirect / Day-1 home) · `/connect/onboarding` (4 intent cards,
    `OnboardingClient`) · `Day1Home` (checklist hero + featured workshops + feed
    placeholder) · `ConnectComingSoon` · `profile.types`/`actions` extended.
  - _Route collision:_ `next build` caught `/connect` already being the public
    marketing landing (`app/(marketing)/connect/`). Owner-decided resolution:
    `/connect` stays marketing; the app is `/connect/home` (+ `/onboarding`,
    `/profile`); the marketing page redirects a signed-in member to `/connect/home`.
  - `connect.home` + `connect.onboarding` i18n × 4 locales (parity-clean) ·
    `OnboardingClient` test. **72 web tests green; web `tsc` + eslint + `next build`
    clean.**
- [x] **Wave 6 - Hardening + verify: COMPLETE.** Empty/loading/error states + i18n
      (4 locales) + component tests were folded into Waves 3–5 (per the sub-plan
      execution order). This wave: `/connect/home` `loading.tsx`; PostHog analytics - `connect.profile_updated` + `connect.onboarding_completed` on the backend
      write endpoints; WCAG self-audit (semantic landmarks, heading hierarchy, aria
      on interactive + decorative elements - clean). **Final verification: backend
      44 vitest + scoped `tsc`; web 72 vitest + `tsc` + eslint + `next build` - all
      green.** Playwright E2E + native-speaker i18n review → owner-review checkpoint
      (need a live stack + fixtures).

## Phase 2 progress

Sub-plan: `phases/phase-2-network.md`. Waves 1–4 committed (`origin/zari360-connect`);
Waves 5–6 uncommitted (owner stages + commits).

- [x] **Wave 1 - `connect/network` backend** (B1–B3) - three schemas: `Connection`
      (one canonical row, id-pair sorted low→high - dedups the symmetric edge),
      `ConnectionRequest` (`pending|accepted|ignored|withdrawn` + optional note),
      `Follow` (asymmetric; `followeeType` reserves `companyPage` for Phase 6). ·
      `NetworkService` - send / respond / withdraw, list invitations (received /
      sent / archive), connections + remove, follow / unfollow / list,
      `mutualConnections`, `getRelationship`, counts; guards (no self-request, no
      duplicate pending, no request to an existing connection). · `NetworkController` - `/me/connect/network/*` (`JwtAuthGuard`, not subscription-gated) · DTOs ·
      PostHog (`connect.connection_requested` / `_accepted` / `connect.followed`) ·
      OTel. Commit `895910c`.
- [x] **Wave 2 - Network UI** (F1–F4, F8, F9) - `/connect/network` route +
      `ModuleTabs` (URL `?tab=`, shell does not remount) · Invitations / Connections
      / Following tabs (Accept / Ignore / Withdraw / Remove / Unfollow, request
      note, filter-within) · `connect/people` batch lookup (`getPeopleByIds`) +
      `hydratePeople` so list endpoints' raw ids resolve to people cards (BE
      `a7a74cf`) · `useNetworkBadge` → pending-request count on the nav (F9) ·
      reuses `PersonCard`. Web `818d09c`.
- [x] **Fix - App-Lock × Connect 423** - a PIN-locked admin hitting a Connect
      Server Component saw "coming soon" (SSR fetch 423'd before the client lock
      gate). Fixed: `locked` classification → `ConnectLockedEntry` +
      `LockOverlay.onUnlocked` reload. Web `d630aef`.
- [x] **Wave 3 - Suggestions** (B4 + F5) - `SuggestionService`: ERP-weighted "people
      you may know" - weighted score over shared workspace (×5), mutual connections
      (×2), skill overlap (×3); excludes self / hidden / already-edged. **No
      community or religion input - no such field exists (structural guard).** ·
      `SuggestionsTab` + area / skills / mutuals filter pills. BE `96061fb`, Web
      `40ab240`.
- [x] **Wave 4 - Search** (B5 + F6) - `connect/search` module: env-gated
      `MeiliClient` (`MEILI_HOST` unset → safe no-op) + Mongo-regex fallback so the
      phase ships before Meilisearch is provisioned · `people` index over
      `public`-visibility profiles, event-driven indexer (`connect.profile.changed`)
      · `GET /connect/search` · `/connect/search?q=` results page wired to
      `ConnectSearchBar`, people results carry the ERP-linked badge. BE `02d6ebd`,
      Web `21d08a8`.
- [x] **Wave 5 - Profile Connect/Follow** (F7) - `RelationshipState` (+`self`) +
      `GET /me/connect/network/relationship/:userId` · `ProfileConnectActions` (a
      small state machine - connected / incoming / requested / connect, plus a
      follow toggle) · `ProfileView` gained an `actions` slot · `/u/[userId]` wires
      it for a signed-in non-owner viewer (logged-out shows none). F9's nav count
      shipped in Wave 2. `connect.profile.actions.*` i18n × 4 locales (#18-clean) ·
      `ProfileConnectActions` test (9 cases). Uncommitted.
- [x] **Wave 6 - Hardening + verify** (B6 + F10 + B7) - empty/loading/error states,
      i18n (4 locales), component tests folded into Waves 2–5. This wave: PostHog
      events verified on the network writes · `seed:connect` extended with network
      edges (Meera↔Rajesh connection, Anand→Rajesh pending request, Anand follows
      Meera - so all four Network tabs demo non-empty) · WCAG self-audit (tab roles,
      `aria-label`s on badges / filters / icon-only controls - clean). **Final
      verification: backend 75 vitest + scoped `tsc` (`NO_CONNECT_ERRORS`); web 63
      connect-feature vitest (10 files) + `tsc` + eslint clean.** Playwright E2E
      (request→accept→connections, search) + native-speaker i18n review →
      owner-review checkpoint (need a live stack + fixtures). Uncommitted.

## Phase 3 progress

Sub-plan: `phases/phase-3-feed.md` (owner-approved 2026-05-19). Uncommitted - owner
stages + commits.

- [x] **Wave 1 - Infra + schemas** (B1 + B2) - `connect/feed` module. Four schemas:
      `Post` (5 kinds; `media[]` + `audio` sub-docs; denormalized `authorErpLinked`
      / `authorSkills` ranking signals; soft-delete), `Reaction` (one `like` per
      user per post), `Comment` (one-level threads, soft-delete), `FeedEntry` (the
      thin, **score-free** fan-out index - `ownerId` / `postId` / `authorId` /
      `postedAt`). `ConnectFeedModule` registers the schemas + the
      `connect-feed-fanout` BullMQ queue (the global Bull connection already
      exists) and is wired into `app.module.ts`. BullMQ + `ioredis` were already
      repo deps; the Socket.IO deps are deferred to Wave 5 (the gateway). **Backend
      scoped `tsc` + eslint clean.**
- [x] **Wave 2 - Feed service + endpoints** (B3 + B4 + B5) - `FeedService`
      (create post - kind↔payload validation, hashtag parse, denormalized author
      signals; soft-delete; windowed feed read - `Following` chronological,
      `For You` ranked at read time: recency + ERP-linked boost + log-damped
      engagement + the rule-based persona term; "You're caught up" sentinel) ·
      `FeedFanoutProcessor` (BullMQ - idempotent `bulkWrite` upsert of follower
      `FeedEntry` rows, batched) · `ReactionService` (idempotent like toggle,
      `$inc` tally) · `CommentService` (one-level threads, soft-delete) ·
      `FeedController` (`/me/connect/feed/*`) + `FeedPublicController`
      (`@Public GET /connect/posts/:id`) · feed DTOs · audit + PostHog
      (`connect.post_created` / `_reacted` / `_commented`) · OTel spans ·
      `ConnectProfileService.getRankingSignals` + `NetworkService.listFollowerIds`
      added. **Backend scoped `tsc` + eslint clean; 75 connect vitest green.**
- [x] **Wave 3 - Feed UI** (F1–F4) - `/connect/feed` route (server component -
      loads the active tab's first page + the right-rail suggestions) ·
      `FeedScreen` (mobile-first 3-column layout - the feed column alone below
      `xl`, rails at `xl`; `Following` / `For You` tabs via `ModuleTabs`, URL
      `?tab=`) · `FeedList` (`useInfiniteQuery` seeded with the server page +
      `useWindowVirtualizer` row windowing + `postedAt`-cursor paging + a
      "You're caught up" end) · `PostCard` (all five kinds - text / photo grid /
      video / document / voice player + transcript; ERP-linked badge; a wired
      optimistic Like; comment count; `wa.me` share) · left-rail quick links +
      right-rail "people to follow" (reuses `PersonCard` + the Phase-2
      suggestions) · `feed.types` / `feed.actions` (`getFeed` author-hydrated,
      `reactToPost` / `unreactFromPost`) · `connect.feed.*` i18n ×4 ·
      `/design-system` PostCard entry · `@tanstack/react-virtual` added. **Web
      `tsc` + eslint clean; 118 connect web vitest green.** The From-your-ERP
      left-rail callout is deferred to Wave 5 - it needs the B7 ERP-summary
      endpoint.
- [x] **Wave 4 - Composer + comments UI** (F5–F7) - `Composer` (modal sheet -
      text + photo modes; the post `kind` derives from whether photos are
      attached) · `MediaUploadGrid` (multi-photo upload, per-tile progress,
      emits the completed URLs) · `PostComments` (one-level comment thread -
      `useQuery` load, add / reply / delete-own) wired into `PostCard`'s comment
      button · `FeedScreen` composer trigger (`router.refresh()` on a new post) ·
      `feed.actions` (`createPost` / `listComments` / `addComment` /
      `deleteComment`) + `feed.types` · `viewerId` threaded page → screen → list
      → card → thread (via `getMe()`) · `connect.feed.composer` / `comments` /
      `media` i18n ×4 · `/design-system` Composer + MediaUploadGrid entries.
      **Web `tsc` + eslint clean; 125 connect web vitest green.** Video /
      document / voice composer modes are deferred to Wave 5 (they need their
      `uploads` categories); the photo mode reuses `connect-portfolio`.
- [x] **Wave 5A - Voice + composer modes + uploads** - `VoiceNoteRecorder`
      (`MediaRecorder` record / playback / upload, live timer + level
      animation) · `MediaUploadGrid` extended to photo / video / document
      (`mediaKind` prop) · `Composer` reworked mode-based (text / photo / video
      / document / voice) · `uploads` `connect-posts` + `connect-audio`
      categories (backend `validateCategory` + web `upload.service`) ·
      `connect.feed.voice` + `composer.mode` i18n ×4 · `/design-system`
      VoiceNoteRecorder entry. **Web `tsc` + eslint + `next build`; backend
      scoped `tsc` clean; connect web vitest green.** Auto-transcription stays
      provider-gated (PAID - off by default; the audio always posts).
- [x] **Wave 5B - Socket.IO realtime + ERP callout** (B6 + F9 + B7) -
      `ConnectFeedGateway` (Socket.IO `/connect`; short-lived **socket-ticket**
      handshake - `aud: 'connect-socket'`, never replayable as an API token;
      bad ticket → disconnect) · `user:<id>` push + `post:<id>` watch rooms ·
      `POST /me/connect/feed/realtime/ticket` mints it · `RedisIoAdapter`
      (env-gated, `main.ts`; in-memory fallback - a single instance needs no
      Redis) · emit wiring - fan-out → `feed:new-post`, reaction / comment →
      `post:activity` · `useConnectSocket` (`useFeedRealtime` + `usePostRealtime`;
      ticket re-fetched per (re)connect; silent degrade if the gateway is down) ·
      FeedList live "new posts" pill · PostCard live reaction / comment counts ·
      `ErpLinkService.getErpSummary` + `GET /me/connect/feed/erp-summary` + the
      From-your-ERP left-rail callout · `connect.feed.newPosts` i18n ×4.
      **Backend scoped + adapter `tsc` + eslint + 75 vitest; web `tsc` + eslint +
      127 connect vitest + `next build` - all green.** Notification persistence +
      §12.3 batching fold into the Phase 7 notifications centre - Phase 3's
      realtime push rides this gateway.
- [x] **Wave 6 - Hardening + verify** (B8) - backend feed service tests -
      `reaction` / `comment` / `feed` `*.vitest.ts`, 15 cases: like-toggle
      idempotency, the one-level-reply guard, post kind↔payload guards, fan-out
      enqueue, the windowed Following read · `seed:connect` extended with feed
      demo data (Meera's photo post + Rajesh's hiring post, fan-out `FeedEntry`
      rows, a like + a comment - so `/connect/feed` demos non-empty) · WCAG
      self-audit (semantic `article` / landmarks, labelled controls,
      `aria-hidden` decoration - clean) · analytics (`connect.post_*`) + i18n
      (4 locales) + empty / loading / error states + component tests were
      folded into Waves 2–5. **Backend scoped `tsc` + eslint (0 errors) + 90
      connect vitest green; web verified at Wave 5B (`tsc` + eslint + 127
      vitest + `next build`).** The connect `*.vitest.ts` files carry
      `no-unsafe-*` warnings (the established `any`-mock test convention - all
      prior connect test files too); production code is eslint-clean.

## Connect-first milestone progress

Spec §13 items 3–8. Ran in parallel to Phases 1–3 as a series of ad-hoc
owner-prompted sessions. The wave-numbered plan docs in `plans/` are stamped
SHIPPED - do not re-execute them; this section is the canonical record.

- [x] **Wave 0 - Foundation fixes.**
      Part A: `User.connectEnabled` default-on + one-time backfill so every existing
      user can reach Connect without an admin flip. Part B: PIN-loop family-claim
      fix (a previously-claimed mobile no longer dead-ends a re-signup).
- [x] **Wave A - Signup & Entry.**
      Person-only signup refactor (drop forced workspace); entry-marker routing
      (Connect-entry vs ERP-entry) + guided post-signup workspace step for the
      workshop-owner intent; dual-policy backend (`connectPolicyAcceptedAt`,
      `erpPolicyAcceptedAt`, `User.dismissedHints[]`) with per-product accept
      endpoints + `PolicyGate` web component mounted in `app/connect/layout.tsx`.
      Terms stubs at `/terms/connect` and `/terms/erp`.
- [x] **Wave B - Browse-first onboarding.**
      `/connect/home` retired (redirect stub → `/connect/feed`); profile-completion
      full-page checklist replaced by dismissible `FeedProfileCard` atop the feed.
      Onboarding triggers move to first **participatory action**: composer trigger,
      reaction toggle, comment submit, reply - each gated on `onboarded` and routed
      to `/connect/onboarding`. SignupMode policy consent checkbox active.
- [x] **Wave C - Cross-sell + nudge + switcher.**
      Backend `ConnectProfile.onboardingIntent` persisted by `completeOnboarding`.
      `ConnectErpCrossSell` (intent-driven) atop the feed for workshop-owner-intent
      users who lack a workspace. `ConnectNudge` (ERP→Connect) in `Sidebar.tsx` with
      **backend-persisted** dismissal (`User.dismissedHints` + `POST /me/dismiss-hint`)
      so it survives a logout/login. `ModeSwitcher` present in both shells.
- [x] **2026-05-20 polish pass.** Connect keyboard shortcuts (sidebar footer entry
  - `Shift+?` cheat-sheet + `g>f/n/p` chords + `/` search focus); shared
    `<ConnectPage>` width container (wide 1180 / standard 960) replacing ad-hoc
    per-screen max-widths; cross-shell `AppLockSettingsModal` in the top-header
    account menu so Connect-only users can manage their PIN without an ERP shell
    flip; `DsAvatar` falls back to a person glyph instead of the literal "?" when
    initials are empty.

## Phase checklist

- [x] **Phase 0 - Foundation** ✅
- [~] Phase 1 - Identity (Profile + Onboarding) - code complete + verified, pending owner review
- [~] Phase 2 - Network - code complete + verified, pending owner review
- [~] Phase 3 - Feed - code complete + verified, pending owner review
- [ ] Phase 4 - Marketplace
- [ ] Phase 5 - Jobs
- [ ] Phase 6 - Company Pages
- [ ] Phase 7 - Cross-cutting (Inbox / Notifications / Search)
- [ ] Phase 8 - Launch hardening

## Phase 0 - delivered

**Frontend** (`crewroster-web/zari360-connect`):

- [x] `--cn-*` design tokens (`globals.css` `:root` + `@theme`)
- [x] `lib/connect/flags.ts` - 3-layer feature flags; `QueryProvider`; `env.connectPhase`
- [x] `connect.*` i18n namespace - 4 locales, parity-clean
- [x] 4 primitives - `TrustBadgeRow`, `WhatsAppCTA`, `ConnectEmptyState`, `ConnectErrorBoundary`
- [x] Connect shell - `ConnectModuleNav`, `ConnectMobileTabBar`, `ConnectSearchBar`;
      wired into `ModeSidebar` / `TopHeader` / `DashboardLayout`; placeholder `ConnectSidebar` removed
- [x] `/design-system` gallery route (dev-only)
- [x] Public route group `app/(connect-public)/layout.tsx`
- [x] Vitest config + jsdom polyfills + `test-utils/render` + 8 test files - **29 tests green**
- [x] Verified: `tsc` clean · eslint clean · `next build` exit 0

**Backend** (`crewroster-backend/zari360-connect`):

- [x] `BACKEND-REUSE-AUDIT.md` - notifications/uploads/users/workspaces = EXTEND
      (deferred to their phases); audit/subscriptions = REUSE AS-IS
- [x] `src/modules/connect/profile/` - `ConnectProfile` schema, `ErpLinkService`
      (ERP-linked moat derivation - §9.1 thresholds, payroll-run aggregation,
      posted-only invoices, OTel + Sentry + graceful degradation)
- [x] `ConnectProfileModule` registered in `app.module.ts`; `AppModule.CONNECT` enum
- [x] **24 backend tests green**; connect module **scoped `tsc` clean**

## Next task

Connect-first milestone (spec §13 items 3–8) - **code-complete + verified**.
Phases 1 + 2 + 3 + the Connect-first milestone are all on disk; owner review
checkpoints listed at the foot. Next planned milestone is Phase 4 - Marketplace
(write its sub-plan via the `WORKFLOW.md` PLAN step). Alternative: finish
Phase 2's Meilisearch provisioning (the env-gated client is already wired; only
the self-hosted instance + index seed is left).
The Status block is the canonical resume pointer; per-wave detail is above.

## Decision log

| Decision                       | Choice                                                                               | Rationale                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Build strategy                 | Full-stack vertical slices                                                           | No mocks/stubs                                                                                                                            |
| Mobile                         | Responsive web + PWA, mobile-first                                                   | Native app out of scope                                                                                                                   |
| Real-time                      | Socket.IO at Phase 3                                                                 | Redis arrives then for BullMQ                                                                                                             |
| Identity                       | One `User` + layered `ConnectProfile`, derived ERP-linked                            | `IDENTITY-MODEL.md`                                                                                                                       |
| Rollout                        | Feature-flagged: module config + `connectEnabled` + PostHog cohorts                  | Closed beta → GA                                                                                                                          |
| Routes                         | Public SEO tree + authenticated `/platform/*`                                        | SEO for company/store/detail                                                                                                              |
| `ConnectTopBar`                | Not built - reuse shared `TopHeader`, inject `ConnectSearchBar`                      | Avoid duplicating notifications/user-menu/locale                                                                                          |
| Shell nav icons                | `@ant-design/icons`                                                                  | ERP-shell consistency; lucide used for in-content components                                                                              |
| Sitemap / robots               | Repo already has `/robots.txt` + `/sitemap.xml`; Connect entity URLs added per-phase | Don't scaffold empty                                                                                                                      |
| `seed:connect`                 | **Deferred to Phase 1**                                                              | Phase 0 has no Connect UI that renders a `ConnectProfile` - seeding into a void. Lands with Profile screens                               |
| "Payroll run" (ErpLinkService) | Distinct `(month, year)` of `Salary` rows created in-window                          | No `PayrollRun` collection; `Payment` rows would double-count                                                                             |
| Invoice signal                 | `state: 'posted'` only, `voucherType: 'sale_invoice'`                                | §9.1 "real operational data, not a self-claim"; allow-list is forward-safe                                                                |
| `contactPreference`            | New `ConnectProfile` field (W4)                                                      | Backs the already-scoped Phase-1 `ContactPreferenceSelector` (F5); display-only, never exposes mobile. Logical change - flagged for owner |
| Public ERP-link                | Separate `GET /connect/profiles/:userId/erp-link`                                    | Mirrors the `/me` endpoint split; returns `linked`+`since` only - raw activity signals stay private (§9.1)                                |
| Profile edit form              | AntD `Form` (not react-hook-form)                                                    | ENGINEERING-STANDARDS #5/#6 - reuse the ERP-wide form system; zod still validates the outgoing payload                                    |

## Open items / flagged for owner

- **Connect logical change (Wave 4) - flag for owner review:** `ConnectProfile`
  gained a `contactPreference` field (`whatsapp`/`phone`/`dm`, default `whatsapp`).
  Added autonomously - it backs `ContactPreferenceSelector`, an already-scoped
  Phase-1 F5 component; display-only, never exposes the mobile number. Touches the
  schema, `UpdateConnectProfileDto`, service `UPDATABLE_FIELDS` + the web types. No
  data migration needed (defaulted). Phase-1 sub-plan's only prior flagged change
  was `connectEnabled`.
- **`tsconfig.connect-check.json`** (backend) - scoped type-check config added so
  Connect code is `tsc`-verifiable without the full-`tsc` OOM. Run
  `pnpm exec tsc -p tsconfig.connect-check.json`.
- **Connect logical changes (Wave 4.5 / 5) - flag for owner review:** (1) `proxy.ts`
  middleware behaviour - `/u` is now public, and `/connect/*` + `/u/*` are exempt
  from the `mobile_only` device-tier redirect. (2) New `ConnectProfile.onboardedAt`
  field (defaulted `null`; no migration). (3) The Connect app route moved
  `/platform/*` → `/connect/*`, app index at `/connect/home` (owner-approved;
  `/connect` itself is the marketing landing).
- **Marketing site not logged-out-accessible (pre-existing, NOT Connect):** the
  `(marketing)` routes (`/connect`, `/erp`, `/about`, `/pricing`, `/contact`) are
  absent from `proxy.ts` `PUBLIC_PATHS`, so a logged-out visitor is bounced to
  `/auth`. The Wave-5 design treats `/connect` as a public marketing landing - for
  it to render logged-out, the marketing routes need whitelisting. Marketing-site
  middleware scope, not Connect - flagged for the owner.
- **Pre-existing repo issues (NOT Connect, not absorbed):**
  - Full backend `tsc` **OOMs** even at 8 GB heap - known infra issue. Connect code
    verified via a **scoped** `tsc` (clean). Flag for an owner infra fix (project
    references / `tsc --build`, or split tsconfig).
  - `check:i18n` fails on pre-existing `auth.*` / `profile.*` missing keys → `pnpm build`
    (prebuild gate) red repo-wide. Connect's own `connect.*` keys are parity-clean;
    frontend verified via `next build` directly.
  - `package-lock.json` stale beside `pnpm-lock.yaml` - recommend deleting it.
  - `app/layout.tsx:88` `console.trace` - pre-existing eslint warning.
    (The `TopHeader.tsx` unused `currentWorkspaceId` destructure was cleaned in
    the 2026-05-20 polish pass.)
- **Non-English Connect translations** (`gu`, `gu-en`, `hi-en`) assistant-authored -
  flag for a native-speaker review pass before GA.
- **Paid (decide when the phase arrives):** WhatsApp BSP (P7), GST/Udyam API (P1/P6),
  voice transcription (P3), cloud telephony (P5).
- **Ops track:** provision Redis + Meilisearch before Phase 2–3.

## Owner review checkpoint - Phase 0

Phase 0 is on disk, uncommitted, verified. Review surfaces:

- `/design-system` route - every shared component in isolation.
- `docs/connect/` - plan, standards, workflow, identity model, this tracker.
- `BACKEND-REUSE-AUDIT.md` - backend reuse verdicts.
  The owner stages + commits (assistant runs zero git ops). Approve → Phase 1 planning.

## Owner review checkpoint - Phase 1

Phase 1 (Identity) is code-complete + verified, on disk. Waves 0–4 are committed +
pushed (`origin/zari360-connect`); Waves 4.5–6 are uncommitted. Review surfaces:

- **Acceptance criteria - all 5 met:** a `connectEnabled` user hits `/connect/home`
  and smart-entry routes them (coming-soon / onboarding / Day-1 home) · a completed
  profile renders (own + public, 4 locales, 380/desktop) · `/u/[userId]` is SSR +
  indexable + works logged-out with a Join CTA · workshop-owner profiles show the
  derived ERP-linked badge, no-workspace users don't · the Day-1 home shows the
  setup checklist + featured workshops.
- **Walkthrough:** run `pnpm seed:connect` (backend) - 3 demo personas (master
  karigar, day-1 karigar, workshop owner); sign in with the mobile + dev mock OTP.
- `docs/connect/phases/phase-1-wave-5-design.md` - the auth-alignment design.
- **Logical changes** (see "Open items"): `proxy.ts` behaviour; `ConnectProfile`
  `contactPreference` + `onboardedAt`; the `/platform`→`/connect` route move.

Remaining for the owner / CI (need a live stack):

- **Playwright E2E** for onboarding→profile→public-view - the unit + integration
  layer is done (116 tests green); E2E needs the running stack + a `connectEnabled`
  fixture user.
- **Native-speaker review** of the `gu` / `gu-en` / `hi-en` Connect translations.
- Manual 380/768/1280px pass; `next build` SEO/sitemap spot-check.
- The marketing-routes-not-public middleware gap (see "Open items").

The owner stages + commits (assistant runs zero git ops). Approve → Phase 2 (Network).

## Owner review checkpoint - Phase 2

Phase 2 (Network) is code-complete + verified, on disk. Waves 1–4 are committed +
pushed (`origin/zari360-connect`); Waves 5–6 are uncommitted. Review surfaces:

- **Acceptance criteria - all 5 met:** a member sends a connection request, the
  recipient sees it in Invitations · Received and Accept makes each appear in the
  other's Connections · a follow is asymmetric (no approval) and Unfollow reverses
  it · Suggestions rank by ERP-linked workspace / skill / mutual-connection overlap,
  never community or religion (no such field - structural guard) · search returns
  typo-tolerant people results carrying the ERP-linked badge, `visibility`-aware ·
  the four Network tabs swap via the URL `?tab=` without remounting the shell.
- **Walkthrough:** `pnpm seed:connect` (backend) now also seeds network edges - sign
  in as Rajesh (`9100000003`) to see a connection (Meera) + a pending invitation
  (Anand); as Anand (`9100000002`) to see Following (Meera) + a sent invitation.
- **Logical changes - approve here:** three new collections - `Connection`,
  `ConnectionRequest`, `Follow` + their indexes (all-new, no migration). New infra:
  **Meilisearch** - free / open-source, **not a paid dependency**; the search code
  ships env-gated with a Mongo-regex fallback, so Phase 2 runs before it is
  provisioned.

Remaining for the owner / CI (need a live stack):

- **Playwright E2E** - request→accept→connections, and search - the unit + service
  layer is done (backend 75 vitest, web 63 connect-feature vitest); E2E needs the
  running stack + `connectEnabled` fixture users.
- **Native-speaker review** of the new `gu` / `gu-en` / `hi-en` Connect strings
  (`connect.network.*`, `connect.profile.actions.*`).
- Manual 380 / 768 / 1280px pass on the four tabs + search + the `/u/[id]` actions.
- **Ops:** provision Meilisearch (Docker, like Redis) before search goes to GA.
- **Decision:** the Day-1 home "workshops to follow" row stays a curated stub until
  Phase 6 (`CompanyPage`) - the Phase-2 plan's "switch to `SuggestionService`" does
  not apply (that service returns people, surfaced on the Suggestions tab). Confirm.

The owner stages + commits (assistant runs zero git ops). Approve → Phase 3 (Feed).

## Owner review checkpoint - Phase 3

Phase 3 (Feed) is code-complete + verified, on disk. Waves 1–4 are committed +
pushed (`origin/zari360-connect`); Waves 5A / 5B / 6 are uncommitted. Sub-plan:
`phases/phase-3-feed.md`. Review surfaces:

- **Acceptance criteria:**
  1. ✅ A member posts (text + up to 8 photos) - it appears in their own feed
     instantly and fans out to followers' feeds (BullMQ `FeedEntry` fan-out).
  2. ⚠️ **Partly met** - reaction / comment **counts update live** over
     Socket.IO (`post:activity`); the §12.3 _batched notification_ ("X and N
     others") is deferred to Phase 7 with the notifications centre (Phase 3 has
     no notifications screen to surface it). The realtime push rides this
     phase's gateway.
  3. ✅ A karigar records a voice-note post - live timer + level animation,
     playable inline audio. Auto-transcription is provider-gated (off by
     default; the audio always posts).
  4. ✅ Strictly-chronological `Following` + persona-ranked `For You`,
     window-paginated with a "You're caught up" end (no endless scroll).
  5. ✅ A workshop owner sees the From-your-ERP left-rail callout; a member
     with no workspace does not.
- **Walkthrough:** `pnpm seed:connect` (backend) now also seeds feed content -
  sign in as Anand (`9100000002`) and open `/connect/feed`: Meera's photo post
  (she is followed) shows with a like + a comment.
- **Logical changes - approve here:** four new collections - `Post`,
  `Reaction`, `Comment`, `FeedEntry` (all-new, no migration). New infra: Redis
  (BullMQ fan-out + the Socket.IO adapter) + the Socket.IO gateway. New deps -
  backend `bullmq` / `@nestjs/websockets` / `socket.io` / `@socket.io/redis-adapter`,
  web `socket.io-client` / `@tanstack/react-virtual` (all free / OSS). The
  socket-ticket auth pattern (a ~120s `aud`-scoped JWT) is the owner-approved
  realtime decision.

Remaining for the owner / CI / ops:

- **Ops - provision Redis** before Phase 3 GA: the BullMQ fan-out worker needs
  it; the Socket.IO gateway uses it for multi-instance fan-out (single instance
  works on the in-memory adapter).
- **PAID - pick the voice-transcription provider** (Sarvam AI recommended for
  Gujarati / Hindi). Phase 3 ships voice posts provider-gated - record / play /
  upload work now; the transcript appears once a provider is wired.
- **Feature flag** - bump `connectPhase` to `3` (env) to surface the feed nav
  item + module to beta users.
- **Playwright E2E** - post → fan-out → react → comment, and a voice-note post;
  the unit layer is done (backend 90 vitest, web 127 connect vitest).
- **Native-speaker review** of the new `gu` / `gu-en` / `hi-en` `connect.feed.*`
  strings.
- Manual 380 / 768 / 1280px pass on `/connect/feed` + the composer.
- **Deferred (flagged, no migration owed):** notification persistence + §12.3
  batching → Phase 7 (notifications centre) · video transcoding / HLS (Phase 3
  uploads + plays raw) · translate-inline (needs a translation provider) ·
  saved / bookmarked posts.

The owner stages + commits (assistant runs zero git ops). Approve → Phase 4
(Marketplace).
