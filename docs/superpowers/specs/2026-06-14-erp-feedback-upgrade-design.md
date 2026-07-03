# ERP Feedback Widget Upgrade — Design

Date: 2026-06-14
Status: Approved in principle (owner), pending spec review → implementation plan
Scope: `crewroster-web` (primary) + `crewroster-backend` (support). ERP only.

---

## 1. Problem & goal

Every ERP page shows a small "Feedback" affordance in the breadcrumb row
(`components/ui/FeedbackButton.tsx`, mounted via
`components/ui/HeaderRightActions.tsx` from `components/layout/TopHeader.tsx`).
Today it opens a centered AntD `Modal` with: a 1–5 star `Rate`, a category
`Select` (general / feature_request / bug_report), and a 2000-char message box.

Limitations:

- No way to attach photos / screenshots.
- The current page is captured behind the scenes (`getModuleFromPath`) but never
  surfaced to the user, and no page/device context is stored for triage.
- The widget strings are hardcoded English (no `useTranslations`) — fails the
  4-locale bar (en / gu / gu-en / hi-en).
- No admin surface exists to read feedback. The backend has
  `feedback-admin.controller.ts` (`GET /admin/feedback`,
  `PATCH /admin/feedback/:id/status`) but nothing on the web consumes it.

Goal: rebuild the feedback experience to the best-in-industry bar — fast to send,
photo attachments with sane limits, an explicit "this page vs general" choice,
automatic page/device context, and an admin console to actually use the data.

## 2. Owner decisions (2026-06-14)

1. Build the **full upgrade** (quick redesign + photos + this-page/general toggle
   - auto-context), and admins can view it all. **Approved.**
2. **Include** "Capture this screen" with a blur/redaction tool. **Approved.**
3. **No user-facing feedback-history page** this pass. But store everything
   (status + lifecycle) in the DB so a "my feedback" view can be switched on
   later with no rework.
4. **ERP only.** The Connect shell keeps its current setup (it does not render
   the breadcrumb feedback row today, so this is naturally scoped).

Logical changes (schema / endpoint / new upload category / new admin page / new
FE dependency) were surfaced and approved in principle. Per repo rules the
assistant does **no git operations** — the owner stages and commits.

## 3. Research — best-in-industry in-app feedback (2026)

Surveyed Sentry User Feedback, Usersnap, Marker.io, Userback, Hotjar, Zonka,
Qualaroo/Usabilla.

Synthesis (the union of the best ideas):

- **Low-friction quick entry.** Open → pick sentiment → one line → send. Extras
  (category, photos, capture) are progressive, never required.
- **Visual feedback.** Screenshot capture + on-image annotation (boxes / arrows /
  blur) is the single most-requested bug-report capability (Userback, Marker.io,
  Hotjar, Zonka). Blur doubles as redaction — important for an ERP that shows
  payroll / PII.
- **Attachment limits.** Sentry recommends keeping screenshots < ~2 MB; tools
  cap a handful of images. We pick 3 images × 5 MB (pre-compression) with
  client-side WebP downscale, which lands well under that in practice.
- **Automatic context capture** (the biggest triage win most teams under-use):
  URL/route, app version, browser, OS, viewport — captured silently so reporters
  never have to answer "where were you / what device?" (Marker.io, Usersnap,
  Sentry).
- **Contextual vs general.** Let the reporter say whether this is about the
  current screen or the product overall; pre-select the contextual option.

Sources:

- https://docs.sentry.io/platforms/javascript/user-feedback/
- https://docs.sentry.io/concepts/data-management/size-limits
- https://marker.io/features
- https://usersnap.com/blog/feedback-widget/
- https://userback.io/blog/in-app-feedback-tools-for-saas-applications/
- https://ruttl.com/blog/website-feedback-widget/

## 4. UX design

### 4.1 Trigger & placement (unchanged)

The "Feedback" chip stays in the breadcrumb row via `HeaderRightActions`. Only
its behavior changes (opens the new panel instead of the old modal).

### 4.2 Panel (quick-first, progressive disclosure)

Desktop: a controlled AntD `Popover` panel (~380px) anchored to the chip. Mobile
(`< 768px`): a bottom `Drawer` (sheet). The panel does not close while an upload
or submit is in flight.

> Fallback (flagged): if the `Popover` proves finicky for a form with uploads
> (focus, outside-click while uploading), fall back to a compact centered
> `Modal` (~420px). Same content either way. Decision deferred to implementation;
> not a blocker.

Content, top to bottom:

1. **Title** "Send feedback" + close.
2. **Scope segmented control:** `This page · <PageName>` (default) | `General`.
   `<PageName>` is the header's already-computed `currentTitle`.
3. **Sentiment row:** 5 mood faces → maps to `rating` 1–5. Optional (see §5,
   rating becomes optional). Nothing pre-selected; sending without a mood is
   allowed (e.g. a pure bug report or general note).
4. **Category chips:** General / Idea / Problem (existing 3 categories,
   relabeled in copy only).
5. **Message** textarea (required), `maxLength` 2000, `showCount`.
6. **Attachments row:** "Add photos" (file picker) + "Capture screen". Thumbnail
   tiles with per-tile remove + upload progress. Helper: "Up to 3 images · 5 MB
   each · JPG, PNG".
7. **Auto-context note:** a quiet info line — "We'll attach this page and your
   device details so issues are faster to fix." (No raw values shown; this is the
   transparency line, not a debug dump.)
8. **Footer:** Cancel | Send.

After send: success state ("Thanks — feedback received") then auto-close.

Quick path = open → tap face → type one line → Send (~3s). Everything else is
optional.

### 4.3 Screen capture + blur (isolated unit)

A "Capture this screen" action snapshots the main app container to a PNG via the
`html-to-image` library (new dependency — smaller / fewer quirks than
`html2canvas`). It opens a dedicated capture `Modal` with the image on a canvas
and a single **blur-rectangle** tool: the user drags rectangles over sensitive
regions (salary figures, PAN/Aadhaar, bank details) to redact before attaching.
"Attach" adds the redacted image to the attachments list through the normal
upload pipeline; "Discard" cancels. Capture is always user-initiated, previewed,
redactable, and removable before send.

Isolated in its own component (`FeedbackScreenCapture.tsx`) so the core panel
stays small and testable.

## 5. Data model changes (backend)

`crewroster-backend/src/modules/feedback/schemas/feedback.schema.ts`:

- `rating` → **optional** (`required: false`; keep `min: 1, max: 5` when
  present). Backward compatible; existing rows keep their value.
- `scope: 'page' | 'general'` (new, default `'page'`).
- `attachments: string[]` (new, default `[]`) — canonical `r2-private://<key>`
  refs (never public URLs). Cap length 3.
- `context` (new sub-object, all optional): `path` (pathname only, no query
  string), `module`, `pageLabel`, `appVersion`, `locale`, `userAgent`,
  `viewport { w, h }`, `screen { w, h }`. No new PII beyond standard diagnostics;
  `workspaceId` / `userId` already live on the doc.

`status` (already present, default `'new'`) is unchanged — it is the field that
makes a future "my feedback" history view free. No history endpoint / page is
built now.

DTO (`dto/create-feedback.dto.ts`):

- `rating` → `@IsOptional()`.
- `scope?: 'page' | 'general'` (`@IsOptional @IsEnum`).
- `attachments?: string[]` — `@IsOptional @IsArray @ArrayMaxSize(3)`, each a
  string (validated as an `r2-private://` ref or https URL), bounded length.
- `context?` nested DTO — `@IsOptional @ValidateNested`, all optional strings /
  numbers with `@MaxLength` caps; whitelist + forbid-non-whitelisted so unknown
  keys are stripped.

Submit service (`feedback.service.ts`): persist the new fields; keep the existing
`AuditService.logEvent`; add a server PostHog event
`feedback.feedback_submitted` (distinct-id = userId, props: workspaceId, module,
scope, category, rating-present, attachment-count) per the repo PostHog
convention. Keep throttle at 5/60s.

## 6. Uploads — new private category

`crewroster-backend/src/modules/uploads/upload-policies.ts` — add
`erp-feedback-media` to `UPLOAD_CATEGORIES` + `CATEGORY_POLICIES`:

```
'erp-feedback-media': {
  maxBytes: 5 * MB,
  mimeTypes: IMAGE_MIME,            // jpeg / png / webp
  compression: { maxWidth: 1600, maxHeight: 1600, quality: 0.82, format: 'image/webp' },
  visibility: 'private',           // feedback may capture payroll / PII
},
```

Single-source workflow (binding): edit the backend file →
`npm run export:upload-policies` (regen `upload-policies.generated.json`) → in
`crewroster-web` `npm run sync:upload-policies` (regen `lib/upload-policies.ts`)
→ commit all three together. The web mirror is generated, never hand-edited; the
parity test (`upload-policies.parity.vitest.ts`) guards drift.

Web upload: photos go through the existing
`uploadService.uploadSingle(file, { category: 'erp-feedback-media' })`. For a
private category the response `url` is the canonical `r2-private://` ref; that ref
is what we store in `attachments`. Count (max 3) enforced in the FE panel + the
BE DTO.

## 7. Admin console (new)

`adminList` + `adminUpdateStatus` exist on the backend but have no web UI.

Backend (`feedback-admin.service.ts`):

- `list`: add optional filters (`status`, `module`, `scope`); expose
  `attachmentCount` / `hasAttachments` per row (do not decorate full signed URLs
  in the list — keep it light).
- New `getOne(id)`: returns the full doc with `attachments` decorated into
  short-lived signed URLs via `PrivateMediaService` (same read-path pattern as
  chat / job-application files). Controller gets a `GET /admin/feedback/:id`.

Web (`app/admin/feedback/page.tsx` + `loading.tsx` + detail drawer):

- English / AntD (admin surfaces are English, matching
  `app/admin/connect/entitlements`). The 4-locale rule applies to the
  user-facing panel, not the admin console.
- List: date, user, workspace, module, scope, category, mood, status,
  photo-count; search + status/scope filters.
- Row → detail drawer: message, mood, category, scope, the context block (page,
  device), photo thumbnails (signed URLs) with a lightbox; status update + admin
  notes (reuse `adminUpdateStatus`).
- Add an admin-nav entry for "Feedback".
- `loading.tsx` mirrors the list (binding skeleton rule).

Web server actions (`lib/actions/feedback.actions.ts`): extend the submit payload
(scope / attachments / context) and add admin `listFeedback`, `getFeedback`,
`updateFeedbackStatus` wrappers over the existing endpoints (+ a new
`adminGetOne` endpoint entry in `lib/api/endpoints.ts`).

## 8. Context plumbing

`TopHeader.tsx` already computes `currentTitle` (the human page name). Pass it
down: `HeaderRightActions` gains a `pageLabel` prop → forwarded to the feedback
component. The component derives the rest of `context` client-side at submit time
(pathname without query, `getModuleFromPath`, `z360_locale` cookie,
`navigator.userAgent`, `window.innerWidth/Height`, `screen.width/height`,
build-time app version if exposed). `scope === 'general'` still records the page
context (harmless, aids triage); only the top-level intent differs.

## 9. i18n

New `feedback.*` namespace in all four locale files
(`app/messages/{en,gu,gu-en,hi-en}.json`) for every user-facing string in the
panel + capture modal (title, scope labels, mood aria-labels, category labels,
placeholder, helper text, context note, buttons, toasts, errors). The current
hardcoded English strings are replaced with `useTranslations`. A
locale-parity test asserts key parity across the four files.

## 10. Analytics

Client (`lib/analytics-events.ts` + `track`): keep
`feedback.submit.success` / `feedback.submit.error`; add `feedback.open`,
`feedback.scope_changed`, `feedback.photo_added`, `feedback.screen_captured`.
Keyless = no-op (existing behavior). Server: `feedback.feedback_submitted` (§5).

## 11. Components / units (isolation map)

Backend:

1. `upload-policies.ts` — add `erp-feedback-media` (+ regen + web sync).
2. `feedback.schema.ts` — `rating` optional, `scope`, `attachments`, `context`.
3. `dto/create-feedback.dto.ts` — match the schema; nested `context` DTO.
4. `feedback.service.ts` — persist new fields + PostHog event.
5. `feedback-admin.service.ts` + `feedback-admin.controller.ts` — list filters,
   `getOne` with signed-URL decoration.

Web:

6. `lib/api/endpoints.ts` — add `adminGetOne`.
7. `lib/actions/feedback.actions.ts` — extended submit + admin actions.
8. `components/ui/FeedbackPanel.tsx` — new quick-first panel (replaces the modal
   body inside `FeedbackButton.tsx`; the trigger button stays).
9. `components/ui/FeedbackAttachments.tsx` — thumbnails / add / remove / progress
   over `uploadService`.
10. `components/ui/FeedbackScreenCapture.tsx` — capture + blur (isolated).
11. `components/ui/HeaderRightActions.tsx` + `components/layout/TopHeader.tsx` —
    thread `pageLabel`.
12. `app/admin/feedback/page.tsx` + `loading.tsx` + detail drawer + admin nav.
13. `app/messages/*.json` — `feedback.*` keys (4 locales).
14. New dep: `html-to-image`.

## 12. Privacy & security

- Attachments are **private-bucket** only; served to the admin via short-lived
  signed URLs. No public feedback URLs anywhere.
- Screen capture is user-initiated, previewed, redactable (blur), removable.
- `context` stores standard diagnostics only (UA / viewport / route without
  query). No extra PII.
- Submit endpoint keeps `JwtAuthGuard` + tenant scope + DTO + throttle. Admin
  endpoints keep the admin guard. All admin writes audited.

## 13. Testing & success criteria

Backend (`*.vitest.ts`):

- Submit persists `scope` / `attachments` (≤3) / `context`; rating-optional path
  works; `attachments` > 3 is rejected by the DTO.
- `getOne` decorates `r2-private://` refs into signed URLs; list returns
  `attachmentCount` and honors status/scope/module filters.
- `upload-policies.generated.vitest.ts` passes (JSON regenerated).

Web:

- `FeedbackPanel`: quick path (mood + message → Send) submits with `scope:'page'`
  - context; scope toggle flips to `general`; sending with no mood is allowed;
    empty message is blocked.
- `FeedbackAttachments`: 4th image is blocked with the limit message; remove
  works; oversize file shows the friendly pre-check error.
- `upload-policies.parity.vitest.ts` passes (mirror synced).
- Locale-parity test passes for `feedback.*`.
- `tsc` + lint clean; admin route ships `loading.tsx`.

Definition of done: a user can send feedback in ~3s; can mark page-vs-general;
can attach up to 3 photos and/or a redacted screen capture; page+device context
is stored automatically; an admin can list, filter, open (with photos via signed
URLs), and set status; all user-facing strings exist in 4 locales; all gates
green. No git operations performed by the assistant.

## 14. Out of scope (this pass)

- User-facing "my feedback" history page (data model supports it; deferred by
  owner — switch on later).
- Connect-shell feedback (ERP only).
- Per-tenant upload limits / storage-quota accounting (separate deferred work).
- Two-way PM-tool sync (Jira/Linear) — not relevant; admin console + audit cover
  the need.
