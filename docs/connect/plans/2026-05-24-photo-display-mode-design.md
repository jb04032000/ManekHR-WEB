# Connect - Author-chosen photo display mode (grid vs slideshow)

**Status:** Implemented + verified (web typecheck / eslint / check:i18n parity / backend 47 vitest / web 172 vitest / ECC typescript-reviewer pass with fixes applied). Uncommitted. Pending: live Playwright smoke + native-speaker review of the new gu / gu-en / hi-en strings.
**Date:** 2026-05-24.
**Phase:** Feed (Phase 3) follow-on. Builds on the shipped multi-photo upload + the
just-shipped AntD lightbox (`Image.PreviewGroup`) on `PostPhotoGrid`.
**Worktrees:** web `.worktrees/crewroster-web/zari360-connect`, backend
`.worktrees/crewroster-backend/zari360-connect`. Zero git ops by the assistant -
the owner stages + commits.

---

## 1. Goal

Let a post author with **2 or more photos** choose how they render in the feed:

- **`grid`** - the current default (1 = full-width, 2-4 = 2-col, 5+ = "+N" tile). Unchanged.
- **`carousel`** - one photo per slide, swipe / arrows / dots / "N of M" counter.

Default stays `grid`. This is a work-showcase network (textile / embroidery), so the
carousel exists to show one piece at a time, in full, without cropping.

## 2. Owner decisions (2026-05-24)

| #   | Decision                       | Choice                                                                                                                                                                                                        |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| D1  | Carousel implementation        | **CSS scroll-snap** (zero new deps, native swipe, no slide-cloning, SSR-safe, full ARIA control). AntD Carousel (react-slick) rejected - clone-double-registers images in the lightbox, weak a11y, SSR flash. |
| D2  | Editable after publishing      | **Yes** - `mediaLayout` is editable in the existing Edit Post modal (display-only flip on existing media, no re-upload).                                                                                      |
| D3  | Public mirror + repost embed   | **Static grid** - `PublicPostView` stays a zero-client-JS Server Component. Carousel is in-app only.                                                                                                          |
| D4  | Field name                     | `mediaLayout` (groups with `media`), values `'grid'                                                                                                                                                           | 'carousel'`, default `'grid'`. |
| D5  | When the composer toggle shows | Photo mode **and** `>= 2` photos attached. A single photo has no layout choice.                                                                                                                               |

`mediaLayout` is a **logical schema change** (Engineering Standard #13) - surfaced and
greenlit; the feature itself was pre-approved ("should we" = yes).

## 3. Research summary (traceable per build philosophy)

**Competitor multi-photo rendering.** LinkedIn is the clearest _author-chosen_ precedent
(a grid post vs a swipeable carousel-document are separate composer choices). Instagram
always carousels 2+ photos; X and Facebook auto-tile a grid (X max 4; FB "Choose Layout").
Most platforms decide layout automatically; only LinkedIn + FB give the author control.
Nearly all **crop-to-fill** the in-feed tile and rely on a **lightbox** for the full image.
Instagram's most-complained-about behavior is **locking every slide to the first slide's
aspect ratio** and silently cropping the rest.

**Decisive insight for a textile work-showcase:** never auto-crop the artisan's work in
the carousel - letterbox (`object-fit: contain`) on a neutral frame and do **not** force a
uniform aspect across mixed slides. The grid teaser may crop (it is a teaser); the carousel
is the "show the work properly" mode.

**Carousel a11y (W3C ARIA APG carousel pattern).** Container
`aria-roledescription="carousel"` + label; each slide `role="group"`
`aria-roledescription="slide"` labelled "N of M"; dot controls are buttons (active =
`aria-current`); keyboard arrows + Home/End; **no auto-rotation** (sidesteps WCAG 2.2.2
Pause/Stop/Hide entirely and respects `prefers-reduced-motion`); on lightbox close, return
focus to the originating slide.

**AntD Carousel technical (why D1 = scroll-snap).** AntD v6.3.2 `Carousel` wraps
react-slick; `infinite` defaults `true` and **clones** the first/last slides into duplicate
DOM. An `<Image>` inside a cloned slide **double-registers in `Image.PreviewGroup`**,
corrupting the lightbox count/order. Mitigations (`infinite={false}` + an explicit
`items` array) are possible, but slick still ships weak a11y (no carousel landmark roles -
hand-patched either way), an SSR first-render flash, and non-native swipe. A CSS
scroll-snap scroller (`overflow-x:auto` + `scroll-snap-align`) gives native mobile swipe,
zero cloning, trivial SSR, and full ARIA ownership for ~40 lines of arrow/dot/counter JS -
and matches the existing custom-CSS `PostPhotoGrid` house pattern. Confirmed stack:
`antd ^6.3.2`, `react 19.2.3`, `next 16.1.6`.

Sources: w3.org/WAI/ARIA/apg/patterns/carousel; ant.design/components/carousel +
/image; github.com/ant-design/ant-design#25289 (slide cloning);
developer.chrome.com/blog/carousels-with-css; nolanlawson.com (scroll-snap carousel).

## 4. Backend changes (`src/modules/connect/feed/`)

1. **`schemas/post.schema.ts`**
   - `export const POST_MEDIA_LAYOUTS = ['grid', 'carousel'] as const;`
   - `export type PostMediaLayout = (typeof POST_MEDIA_LAYOUTS)[number];`
   - `@Prop({ type: String, enum: POST_MEDIA_LAYOUTS, default: 'grid' }) mediaLayout: PostMediaLayout;`
   - No migration - defaulted; existing posts read back as `grid`.

2. **`dto/feed.dto.ts`**
   - `CreatePostDto` + `EditPostDto` each gain
     `@IsOptional() @IsIn(POST_MEDIA_LAYOUTS) mediaLayout?: PostMediaLayout;`
   - Import `POST_MEDIA_LAYOUTS` / `PostMediaLayout` from the schema.

3. **`feed.service.ts`**
   - `createPost` (the `postModel.create({...})` block, ~line 235): add
     `mediaLayout: dto.kind === 'photo' ? (dto.mediaLayout ?? 'grid') : 'grid'`.
     Non-photo posts always store `grid` (harmless, keeps the field total).
   - `editPost`: when `dto.mediaLayout` is supplied **and** the post is a photo post,
     set it; otherwise ignore (never carousel a non-photo post).
   - **Read path:** confirm the feed-read serialization (the `FeedPost` shape returned by
     `GET /me/connect/feed`, the post-detail read, and the activity reads) carries
     `mediaLayout`. If it projects an explicit field set, add `mediaLayout`; if it returns
     the lean doc, it flows for free. **Verify during impl** (task BE-4).

4. Tests - extend `feed/__tests__/feed.service.vitest.ts`: default `grid`; photo + carousel
   stored; non-photo forced `grid`; edit updates it; edit ignored on non-photo.

## 5. Web changes

1. **`features/connect/feed.types.ts`**
   - `export type PostMediaLayout = 'grid' | 'carousel';`
   - `FeedPost` gains `mediaLayout: PostMediaLayout;`
   - `CreatePostInput` + `EditPostInput` gain `mediaLayout?: PostMediaLayout;`

2. **`components/connect/Composer.tsx`**
   - State `mediaLayout: PostMediaLayout` (default `'grid'`); reset on `reset()` /
     `pickMode()`.
   - Render an AntD `Segmented` (Grid | Slideshow, lucide icons + labels) **only when**
     `mode === 'photo' && mediaUrls.length >= 2`.
   - Include `mediaLayout` in the `createPost` payload only for the photo branch.

3. **`features/connect/feed/EditPostModal.tsx`** (D2)
   - Same `Segmented`, shown when `post.kind === 'photo' && post.media.length >= 2`,
     seeded from `post.mediaLayout`; thread into the `editPost` payload.

4. **`components/connect/PostCard.tsx`**
   - Photo branch: `post.mediaLayout === 'carousel' && post.media.length >= 2 ?
<PhotoCarousel .../> : <PostPhotoGrid .../>`. `PostPhotoGrid` untouched.

5. **NEW `components/connect/PhotoCarousel.tsx`** - see §6.

6. **`app/design-system/DesignSystemGallery.tsx`** - render `PhotoCarousel` in isolation
   (Standard #11) + a carousel-mode `PostCard` example.

7. **i18n** - `app/messages/{en,gu,gu-en,hi-en}.json` (see §7).

8. Tests - `PhotoCarousel` (slides, dots, counter, ARIA, keyboard); `PostCard` branch on
   `mediaLayout`; `Composer` toggle visibility + payload. `*.test.tsx` (web vitest).

**Out of scope (D3):** `PublicPostView.tsx`, the embedded repost original, `ActivityCard`

- all stay static grid.

## 6. `PhotoCarousel` component spec

**Props:** `{ media: PostMedia[]; altText: string; counterLabel: (i, n) => string;
prevLabel: string; nextLabel: string; dotLabel: (i) => string }`.

**Structure / a11y (WCAG-AA):**

- Root `<div role="region" aria-roledescription="carousel" aria-label={...}>`.
- A scroll track: `overflow-x:auto; scroll-snap-type:x mandatory; display:flex;`.
  **Single fixed viewport height for all slides** (so a swipe never shifts layout - no
  per-slide `adaptiveHeight`); height tuned in impl (portrait-friendly, capped ~460px on
  desktop). Each slide `scroll-snap-align:center; flex:0 0 100%;` wrapping an AntD `<Image>`
  with `style={{ objectFit: 'contain' }}` centered on a neutral backdrop (no crop -
  letterbox), `role="group"` `aria-roledescription="slide"` `aria-label={counterLabel(i, n)}`.
- **Lightbox:** wrap the track in `<Image.PreviewGroup items={urls}>` where `urls` is the
  explicit `media.map(m => ({ src, alt }))` array, so the preview set is independent of the
  rendered DOM (clone/SSR-safe, full-photo order preserved). A slide tap opens the AntD
  lightbox; AntD returns focus to the trigger on close.
- **Controls:** prev/next `<button>` (visible on desktop hover/focus; reachable by keyboard
  always); a dot row of `<button aria-label={dotLabel(i)} aria-current={i===active}>`; a
  small numeric **"N / M"** counter (wordless orientation for low-literacy users).
- **Peek:** slight horizontal padding so the next slide's edge shows - a wordless "more".
- **Active tracking:** `IntersectionObserver` on slides updates `active` (counter + dot
  `aria-current`) - no scroll-event debounce.
- **Keyboard:** ArrowLeft/Right + Home/End scroll to the target slide via
  `scrollIntoView`/`scrollTo`; focus stays on the control. **Bounded** (no wrap).
- **Reduced motion:** `prefers-reduced-motion: reduce` → `behavior:'auto'` (instant) instead
  of `'smooth'`; **no autoplay** anywhere.

## 7. i18n keys (×4 locales, no em-dash)

Under `connect.feed.composer`:

- `layout.label` ("Photo layout"), `layout.grid` ("Grid"), `layout.slideshow`
  ("Slideshow"), `layout.help` (one-line plain explanation, Standard #17).

Under `connect.feed.post`:

- `carousel.region` ("Photo slideshow"), `carousel.slide` ("Photo {current} of {total}"),
  `carousel.counter` ("{current} / {total}"), `carousel.prev` ("Previous photo"),
  `carousel.next` ("Next photo"), `carousel.goTo` ("Go to photo {index}").

`en` authored; `gu` / `gu-en` / `hi-en` assistant-authored → **flag for native-speaker
review** before GA. `pnpm run check:i18n` must pass (4-locale parity).

## 8. Verification

- **web:** `pnpm typecheck` · `pnpm exec eslint <changed files>` ·
  `pnpm exec vitest run connect` · `pnpm run check:i18n`.
- **backend:** scoped `pnpm exec tsc -p tsconfig.connect-check.json` (NOT whole-project tsc
  - it OOMs) · `pnpm exec vitest run --no-file-parallelism feed` (touched module only).
- **ECC:** run `ecc:typescript-reviewer` over the changed files at the end.
- **Live:** drive the seeded stack (localhost:3001) with Playwright at 380 / 768 / 1280px -
  compose a 3-5 photo post, toggle slideshow, swipe + arrows + dots + keyboard, open the
  lightbox, edit-flip the layout. Extend `scripts/seed-connect.ts` to give a persona a
  3-5 photo post (currently Meera has 2).

## 9. Open items / flags

- **Logical change:** `Post.mediaLayout` schema field (defaulted; no migration). Standard #13.
- **Native-speaker i18n review** of the new gu / gu-en / hi-en strings.
- **Read-path projection** (BE-4) - verify `mediaLayout` reaches the client across feed /
  post-detail / activity reads.
- **Seed extension** - a 3-5 photo post for live carousel testing (inline SVG data-URI
  swatches; ObjectId FKs per `project_connect_seed_objectid_fix`).
- **Zero git ops** - owner stages + commits.

## 10. File-by-file task list

- BE-1 `post.schema.ts` - enum + type + prop.
- BE-2 `dto/feed.dto.ts` - Create + Edit DTO field.
- BE-3 `feed.service.ts` - create + edit threading.
- BE-4 `feed.service.ts` / read path - projection verify + fix.
- BE-5 `feed.service.vitest.ts` - tests.
- W-1 `feed.types.ts` - type + 3 interfaces.
- W-2 `Composer.tsx` - Segmented toggle + payload.
- W-3 `EditPostModal.tsx` - Segmented toggle + payload.
- W-4 `PostCard.tsx` - branch.
- W-5 `PhotoCarousel.tsx` - new component.
- W-6 `DesignSystemGallery.tsx` - gallery entries.
- W-7 `app/messages/*.json` ×4 - i18n keys.
- W-8 web tests - PhotoCarousel + PostCard + Composer.
- V-1 seed extension; V-2 verification suite; V-3 ECC reviewer pass.
