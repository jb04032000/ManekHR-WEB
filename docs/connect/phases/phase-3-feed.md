# Phase 3 - Feed (Posts + Composer + Reactions + Real-time)

Sub-plan. Per `WORKFLOW.md`: owner reviews this, then build. Master scope:
`connect-build-plan.md` → Phase 3 row. Wireframes: `source/connect-feed.jsx`,
`source/connect-composer.jsx`. Design doc: §7 (voice), §9.4 (From-your-ERP),
§12.3 (batching), §14 (anti-patterns), §16 (analytics).

## Goal

A Connect member opens Home and sees a living feed - posts from the people and
workshops they follow, plus a ranked discovery tab. They post in their own words
(text, photos, video, document, or a **voice note** for the low-literacy path),
react, and comment - and everyone watching sees it update live. This is the
engagement surface: it turns the network edges from Phase 2 into daily reasons to
return, and it brings the real-time spine (Redis · BullMQ · Socket.IO) online for
every later phase.

## Acceptance criteria (owner checks against these)

1. A member writes a post (text + up to 8 photos) from the composer; it appears at
   the top of their own feed immediately and, within seconds, in the feed of
   everyone who follows them - in their locale, at 380px and desktop.
2. A member reacts to and comments on a post; the counts update **live** for other
   viewers with no reload (Socket.IO); the post author's reactions arrive as one
   batched notification ("X and N others"), never one ping per reaction.
3. A low-literacy karigar records a **voice-note post** - waveform + duration shown
   while recording - and posts it with playable inline audio. An auto-transcript
   appears when a transcription provider is configured (off → audio still posts).
4. The feed has a strictly chronological **Following** tab and a ranked **For You**
   tab whose mix visibly reflects the viewer's intent (a karigar and a buyer get a
   different ordering of the same posts); it window-paginates and shows "You're
   caught up" at a healthy stop - never an endless scroll (design doc §14).
5. A workshop owner sees the **From your ERP** callout on the feed left rail with
   their live karigar count + this month's payroll; a member with no workspace
   does not.

## Scope

**In:** `connect/feed` module - `Post`, `Reaction`, `Comment`, `FeedEntry`
(fan-out index) · post create (text / photo-carousel / video / document / voice) ·
reactions + threaded-one-level comments · **fan-out-on-write** via BullMQ (a
`FeedEntry` per follower) · feed read - **Following** (chronological) + **For You**
(lightweight ranked), window-paginated with a "You're caught up" stop · **Socket.IO
gateway** (live post prepend, live reaction / comment counts) · Connect notification
events + real-time push (the notifications _centre_ screen is P7) · From-your-ERP
left-rail callout · `/connect/feed` 3-column layout · `Composer` (feed modes) ·
`PostCard` · `VoiceNoteRecorder` · `MediaUploadGrid` · right rail (reuses Phase-1/2
components) · `uploads` `audio` + `video` categories · **Redis + BullMQ + Socket.IO
online** · feed-list virtualization · i18n (4 locales) · tests.

**Out (later phases):** product / job composer modes - P4 / P5 build their own
modes into the shared `Composer`; the feed _renders_ their embed cards once those
phases ship · notifications **centre** screen + per-module preferences (P7) · DM /
messaging (P7) · Trending-designs row + hashtag pages (§14 - hashtags are search
signals only) · Live-RFQs right-rail card (P4) · saved / bookmarked posts (thin
convenience - deferred, flagged) · video transcoding / HLS (Phase 3 uploads + plays
raw) · translate-inline (needs a translation provider - flagged) · a reaction
sticker set beyond a single "like" (§17 - P4).

## Backend tasks (`crewroster-backend/zari360-connect`)

- **B1 - Infra.** Confirm / wire Redis (the `redis:start` script + `prestart` hook
  already exist). Add `bullmq` + `@nestjs/bullmq`; a `connect/feed` BullMQ queue for
  fan-out. Add `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` +
  `@socket.io/redis-adapter`. **Logical / infra change - approve in this review.**
- **B2 - Schemas (`connect/feed`).** `Post` - `authorId`, `kind:
text|photo|video|document|voice`, `body`, `media[]` {url, type, caption?},
  `audio?` {url, durationSec, transcript?, transcriptLang?}, `hashtags[]`,
  `tags[]` (open-to-style), `visibility`, counters `reactionCount` /
  `commentCount`, `createdAt`, plus **denormalized author signals** so the ranker
  needs no join - `authorErpLinked`, `authorSkills[]`. `Reaction` (`postId`,
  `userId`, `type: 'like'`; unique pair). `Comment` (`postId`, `authorId`,
  `body`, `createdAt`). `FeedEntry` - a **thin, viewer-agnostic** fan-out
  membership index (`ownerId`, `postId`, `authorId`, `createdAt`; compound index
  for the windowed read). **No score is stored** - ranking is a read-time
  function, so a viewer's feed re-personalises the instant their intent changes
  and a future learned ranker is a swap with no migration. **Logical change -
  approve.**
- **B3 - `FeedService`.** Create post (validates kind ↔ payload), delete own post,
  single-post read, "caught up" sentinel. List feed = fetch a bounded recent
  `FeedEntry` candidate window for the viewer, then: **Following** = sort by
  `createdAt`; **For You** = score each candidate **at read time** and sort. The
  score is a transparent additive function, **no ML** - recency + ERP-linked-author
  boost + engagement + a **rule-based persona-relevance term**: the viewer's
  `openTo` / intent / `skills` matched against the post's `kind` / `tags` /
  `authorSkills` (a viewer open to hiring is lifted toward availability + requirement
  posts; a buyer toward product posts; a karigar toward showcase posts in their
  skills). Every input already exists, so the term needs no engagement data and
  works from day one. Window-paginate (`score`,`_id` cursor). Guards: post size /
  media count caps, visibility honoured.
- **B4 - Fan-out worker.** On `post.created`, enqueue a BullMQ job that writes a
  `FeedEntry` for the author + every follower (`Follow` from Phase 2). Idempotent,
  batched inserts. The author's own entry is written inline so their post is
  instant; followers' entries ride the queue.
- **B5 - `ReactionService` + `CommentService` + `FeedController`.** React / unreact,
  comment / delete-own-comment, counters kept on `Post`. `/me/connect/feed/*`
  (`JwtAuthGuard`, not subscription-gated) + a `@Public` single-post read for
  shareable posts. DTOs, `AuditService`, PostHog (`connect.post_created` /
  `connect.post_reacted` / `connect.post_commented` - snake_case, per the shipped
  Phase-2 convention), OTel spans.
- **B6 - `ConnectFeedGateway` (Socket.IO).** Redis-adapter-backed so it is
  multi-instance-safe. JWT-handshake auth. Rooms: per-user (push) + per-post (live
  reaction / comment counts). Emits on post fan-out, reaction, comment. Empty-Redis
  / disabled → the gateway no-ops and the UI degrades to its TanStack-Query poll.
- **B7 - Notifications + ERP callout + uploads.** Connect notification events
  (someone you follow posted · your post got reactions / comments) through the
  existing `notifications` module + Socket.IO push; **reaction notifications batch**
  (§12.3) via a debounced BullMQ job. `uploads`: add `audio` + `video` categories.
  A `FeedService` method returns the From-your-ERP summary (active-karigar count +
  month payroll) for the owner's workspace.
- **B8 - Tests** - service unit (`*.vitest.ts`): feed read / ranking, fan-out,
  reactions, comments; gateway auth + the no-Redis fallback; ranking-formula spec.

## Frontend tasks (`crewroster-web/zari360-connect`)

- **F1 - `/connect/feed` route** - 3-column layout (desktop ≥1280px), single-column
  mobile-first. Server component loads the first feed window; TanStack Query owns
  pagination + live merge. Wireframe: `source/connect-feed.jsx`.
- **F2 - `PostCard`** (JIT) - header (author, ERP-linked badge, time, overflow
  menu), body, media grid, hashtag / tag pills, footer (react · comment · share ·
  WhatsApp). Renders all five post kinds; voice kind embeds the audio player +
  transcript. `React.memo`, stable callbacks.
- **F3 - Feed list** - Following + For You tabs (URL `?tab=`, shell does not
  remount), **TanStack Virtual** windowing, "You're caught up" end state, empty /
  loading / error states.
- **F4 - Right rail + left rail** - left: profile mini-card + From-your-ERP callout
  (owner only) + quick links (render only modules that exist); right: Karigars-near-
  you (reuses Phase-2 suggestions) + footer. Trending / Live-RFQs are later phases.
- **F5 - `Composer`** (JIT) - modal sheet shell (header eyebrow + title, scroll
  body, sticky footer) reused by P4 / P5. Phase-3 modes: text, photo-carousel,
  video, document. Framer Motion sheet transition.
- **F6 - `MediaUploadGrid`** (JIT) - 4–8 image / video tiles, reorder, caption,
  progress; wraps the existing `FileUpload` + the new `uploads` categories.
- **F7 - Reactions + comments UI** - like toggle (optimistic), comment thread
  (one level), live count merge from the Socket.IO client.
- **F8 - `VoiceNoteRecorder`** (JIT) - record (waveform + running duration),
  stop, playback, re-record, upload; the auto-transcript box (editable) shows when
  a provider is configured. Drives the composer voice mode + reused by P5 / P7.
- **F9 - Socket.IO client** - a `useConnectSocket` hook: connect with the auth
  cookie, join the user room + visible-post rooms, prepend live posts, merge live
  counts. Disabled / disconnected → silent fall back to the Query poll.
- **F10 - JIT components on `/design-system`**, empty / loading / error states,
  i18n (4 locales, #18 em-dash gate), component tests.

## Decisions (made - research-grounded, not owner-blocking)

- **Fan-out-on-write.** A `FeedEntry` per follower, written by a BullMQ worker -
  feed reads become one indexed query. Correct for an early-stage network; a
  hybrid fan-out-on-read for very-high-follower accounts is a documented
  scale-time revisit, not Phase 3.
- **Ranking is a read-time function over a fan-out candidate window** - not a score
  baked at fan-out time. `FeedEntry` stays a thin, viewer-agnostic membership index;
  the scorer runs at read with the viewer's live profile in hand. Cleaner fan-out,
  no stale scores, and the scorer is hot-swappable.
- **Following = strictly chronological; For You = a transparent additive score.**
  Design doc §14 bans an algorithm-only feed - the chronological tab ships from day
  one. For You = recency + ERP-linked-author boost + engagement + a **rule-based
  persona-relevance term** (viewer intent / `openTo` / skills × post kind / tags /
  author skills). Deterministic, needs no engagement data - so a karigar's and a
  buyer's For You differ from launch. **Learned / engagement-personalised ranking
  is a deliberate later enhancement** (its own wave in a future phase, once real
  interaction data exists) - premature now: cold start, nothing to tune against.
- **Endless feed is banned (§14).** Window pagination + an explicit "You're caught
  up" stop.
- **One reaction type (`like`) in v1.** §17 defers an industry sticker set to P4.
  Reaction notifications batch (§12.3) - "X and N others", never one-per-event.
- **`Composer` is a modal sheet, not a route** - a shared shell; Phase 3 builds the
  feed post modes, P4 / P5 add product / job modes.
- **Voice posts ship without transcription.** Record / playback / upload are free
  and ship now; transcription is provider-gated behind an env flag (build-plan PAID
  item 3) - the feature works fully without it, the transcript box simply appears
  when a provider is wired.
- **Socket.IO over the Redis adapter** so it is multi-instance-safe - it rides the
  Redis that BullMQ already requires. No Redis → gateway no-ops, UI polls.
- **PostHog events snake_case** (`connect.post_created` …) - matches the shipped
  Phase-2 events; the design doc §16 dotted names are notation only.

## Open - flag for owner

- **New schemas (B2)** - `Post`, `Reaction`, `Comment`, `FeedEntry` + indexes.
  Logical change - **approve in this sub-plan review.** All-new collections, no
  migration.
- **New infra - Redis (required).** Unlike Meilisearch (Phase 2, env-gated
  fallback), BullMQ fan-out + the Socket.IO adapter genuinely need Redis to run.
  Backend tooling already exists (`scripts/start-redis.ps1` + the `prestart` hook),
  so local dev is covered; **ops must provision a managed Redis before Phase 3
  GA.** Free / open-source - not a paid dependency.
- **New dependencies** - backend: `bullmq`, `@nestjs/bullmq`, `@nestjs/websockets`,
  `@nestjs/platform-socket.io`, `socket.io`, `@socket.io/redis-adapter`; web:
  `socket.io-client`, `@tanstack/react-virtual`. All free / OSS.
- **PAID - voice-note transcription provider.** Whisper API · Google STT · **Sarvam
  AI** (best Gujarati / Hindi coverage - the recommendation, owner decides). Phase 3
  ships the provider behind an interface + env flag; the live call is the owner's
  go / no-go. Voice posts work fully without it.
- **Translate-inline** (design doc §1.1) - multilingual posts want a "Translate"
  option; that needs a translation provider. Deferred / provider-gated - flag for a
  later phase.
- **From-your-ERP callout with multiple workspaces** - post entity-reframe a User
  may own / work at more than one workspace. Phase 3 shows the most-active one;
  confirm that is the desired rule.
- **Video** - Phase 3 uploads + plays raw video (no transcoding / HLS). Flag for an
  ops / perf follow-up if large videos become common.
- **Saved / bookmarked posts** - the wireframe shows a Save action + a "Saved posts"
  quick-link. Deferred from Phase 3 core to keep the phase bounded; small, can land
  as a fast-follow. Confirm.

## Verification

Per-phase: backend scoped `tsc` + `vitest` green · web `tsc` / eslint / `next
build` · `check:i18n` connect-keys parity (+ the #18 em-dash gate) · all 5
acceptance criteria demonstrably met · screens at 380 / 768 / 1280px ·
`/design-system` renders the new components · Playwright E2E for
post→fan-out→react→comment and a voice-note post · real-time path checked with the
gateway both on and off (graceful poll fallback) · per-phase hardening sub-checklist
(analytics, WCAG-AA, i18n, perf / virtualization, seed data, demo note).

## Execution order (waves)

1. **B1 + B2** - infra (Redis · BullMQ · Socket.IO deps + scaffold) + the four
   schemas.
2. **B3 + B4 + B5** - feed service, fan-out worker, reaction / comment services,
   `FeedController` + PostHog + OTel.
3. **F1 + F2 + F3 + F4** - `/connect/feed`, `PostCard`, virtualized feed list +
   tabs, left / right rails.
4. **F5 + F6 + F7** - `Composer` (feed modes), `MediaUploadGrid`, reactions +
   comments UI.
5. **B6 + B7 + F8 + F9** - Socket.IO gateway + client, notification events +
   batched push, `VoiceNoteRecorder` + voice-note posts (transcription
   provider-gated), uploads `audio` / `video`, From-your-ERP callout.
6. **B8 + F10** - tests, states, i18n, `/design-system` entries → verify → owner
   review checkpoint.
