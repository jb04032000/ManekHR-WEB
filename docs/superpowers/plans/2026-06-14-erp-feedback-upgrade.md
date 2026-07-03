# ERP Feedback Widget Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the ERP "Feedback" widget into a quick-first panel with photo attachments (≤3 × 5 MB, private), a this-page/general scope toggle, automatic page/device context, a screen-capture+blur tool, full 4-locale i18n, and a new admin console to read it all.

**Architecture:** Backend first (uploads category → schema/DTO/service → admin read with signed-URL decoration), then web (regenerate the upload-policy mirror → shared plumbing → user panel → admin console). Photos go to the existing PRIVATE R2 bucket via `uploadService.uploadSingle({ category: 'erp-feedback-media' })`; the stored value is the canonical `r2-private://` ref. The admin read path mints 1-hour signed URLs via `PrivateMediaService`. The current page name (`currentTitle`) is threaded from the header into the panel for the scope chip; the rest of the context is collected client-side at submit.

**Tech Stack:** NestJS + Mongoose + class-validator + PostHog (backend); Next.js 16 (App Router) + React 19 + AntD v6 + next-intl + `html-to-image` (new dep) + Tailwind/CSS-vars (web). Tests: vitest both repos.

---

## Git policy (binding — read first)

- The assistant/executor performs **NO git operations** (`feedback_no_git_ops`). Every task ends with a **Commit checkpoint** that lists the files for the **owner** to stage + commit. Do **not** run `git add`/`commit`/`branch`.
- **No new branch** — all work on the current branch.
- Run build / test / lint / the codegen scripts freely (those are not git).

## Prerequisites (Phase 0)

- [ ] **P0.1** Confirm `R2_PRIVATE_BUCKET_NAME` is set in the backend env (already provisioned for `connect-inbox-media` / `connect-job-*`). Without it, every `erp-feedback-media` upload throws 500. Owner-supplied; no code.
- [ ] **P0.2** Note the dual-lockfile situation (`package-lock.json` is the live npm lockfile — updated today; `pnpm-lock.yaml` is two weeks stale). Use **npm**. Flag to owner as a separate cleanup (out of scope here).
- [ ] **P0.3** Global Nest `ValidationPipe` runs with `transform: true` (repo-wide) — required for nested DTO instantiation. Do not override per-controller. No change; just confirm.

---

## PHASE 1 — Backend: private upload category

### Task 1: Add the `erp-feedback-media` private upload category

**Files:**

- Modify: `crewroster-backend/src/modules/uploads/upload-policies.ts` (2 edits)
- Modify: `crewroster-backend/src/modules/uploads/__tests__/private-media.policy.vitest.ts:18`
- Regenerate: `crewroster-backend/upload-policies.generated.json`
- Regenerate (web mirror, Phase 4): `crewroster-web/lib/upload-policies.ts`

- [ ] **Step 1: Add the category name to `UPLOAD_CATEGORIES`.** After `'documents',` (the ERP block, ~line 35) insert:

```ts
  // ERP — Feedback widget photo attachments (private). Image-only, 1600px WebP
  // compressed client-side, lands on the PRIVATE bucket (a feedback screenshot
  // may show another user's data, so it is never world-readable; read paths sign
  // it via PrivateMediaService). Links to: src/modules/feedback.
  'erp-feedback-media',
```

- [ ] **Step 2: Add the policy to `CATEGORY_POLICIES`.** After the `documents` entry (~line 202) insert:

```ts
  // ERP — Feedback widget photo attachments. Image-only, 5MB cap, 1600px WebP
  // compression client-side (a feedback screenshot does not need full res).
  // PRIVATE — a screenshot can contain another user's data; the upload response
  // is a canonical `r2-private://` ref and read paths mint a 1-hour signed URL
  // via PrivateMediaService. Mirrors the `connect-inbox-media` private pattern,
  // but image-only + ERP-prefixed (no Connect per-user quota). The 3-attachment
  // cap is enforced by the feedback DTO (ArrayMaxSize), not here (per-file policy).
  'erp-feedback-media': {
    maxBytes: 5 * MB,
    mimeTypes: IMAGE_MIME,
    compression: { maxWidth: 1600, maxHeight: 1600, quality: 0.82, format: 'image/webp' },
    visibility: 'private',
  },
```

- [ ] **Step 3: Keep the private-category test exhaustive.** In `private-media.policy.vitest.ts` line 18, add the new category to the hard-coded `PRIVATE` list:

```ts
const PRIVATE = [
  'connect-inbox-media',
  'connect-job-resume',
  'connect-job-voice',
  'erp-feedback-media',
] as const;
```

- [ ] **Step 4: Regenerate the committed JSON artifact.** Run from the backend repo root:

Run: `npm run export:upload-policies`
Expected: rewrites `crewroster-backend/upload-policies.generated.json` (now contains `erp-feedback-media`).

- [ ] **Step 5: Verify the staleness + private-policy tests pass.**

Run: `npx vitest run src/modules/uploads/__tests__/upload-policies.generated.vitest.ts src/modules/uploads/__tests__/private-media.policy.vitest.ts`
Expected: PASS (the generated JSON matches the source; every non-PRIVATE category still has `visibility` undefined).

- [ ] **Step 6: Type-check the backend.**

Run: `npm run build`
Expected: compiles (the `Record<UploadCategory, UploadPolicy>` total record is satisfied).

- [ ] **Step 7: Commit checkpoint (owner).** Stage + commit together: `src/modules/uploads/upload-policies.ts`, `upload-policies.generated.json`, `src/modules/uploads/__tests__/private-media.policy.vitest.ts`. (The web mirror regenerates in Phase 4 — committed with that phase.)

---

## PHASE 2 — Backend: feedback data model + submit

### Task 2: Extend the feedback schema

**Files:**

- Modify: `crewroster-backend/src/modules/feedback/schemas/feedback.schema.ts`

- [ ] **Step 1: Add the scope enum** next to `FEEDBACK_CATEGORIES`:

```ts
export const FEEDBACK_SCOPES = ['page', 'general'] as const;
export type FeedbackScope = (typeof FEEDBACK_SCOPES)[number];
```

- [ ] **Step 2: Add the embedded context sub-schema** above the `@Schema({ timestamps: true })` class (mirrors `maintenance/schemas/service-log.schema.ts` `_id:false` pattern; every `@Prop` carries explicit `type` per the Mongoose 8.23 autocast guard):

```ts
// Auto-captured diagnostics attached to each feedback (no extra PII; userId +
// workspaceId already live on the parent doc). Embedded, _id-less subdoc.
// Populated client-side by the feedback panel; read by the admin console.
@Schema({ _id: false })
export class FeedbackContext {
  @Prop({ type: String, default: null }) path: string | null; // route, no query
  @Prop({ type: String, default: null }) locale: string | null;
  @Prop({ type: String, default: null }) userAgent: string | null;
  @Prop({ type: String, default: null }) viewport: string | null; // "1440x900"
  @Prop({ type: String, default: null }) appVersion: string | null;
}
export const FeedbackContextSchema = SchemaFactory.createForClass(FeedbackContext);
```

- [ ] **Step 3: Make `rating` optional and add `scope` / `attachments` / `context`.** Change the existing `rating` prop and add three props inside the `Feedback` class:

```ts
  // Rating is now OPTIONAL (general feedback / pure bug reports need no score).
  // Existing rows already carry a value; new rows may store null.
  @Prop({ type: Number, required: false, default: null, min: 1, max: 5 })
  rating: number | null;

  // Whether this is about the current page or the product overall. Drives the
  // admin filter. The page is still recorded in `context` either way.
  @Prop({ type: String, enum: FEEDBACK_SCOPES, default: 'page' })
  scope: FeedbackScope;

  // Canonical `r2-private://erp-feedback-media/...` refs (never public URLs).
  // Cap of 3 enforced by CreateFeedbackDto (ArrayMaxSize), not the schema.
  @Prop({ type: [String], default: [] })
  attachments: string[];

  // Auto-captured page/device diagnostics (see FeedbackContext).
  @Prop({ type: FeedbackContextSchema, default: null })
  context: FeedbackContext | null;
```

- [ ] **Step 4: Type-check.** Run: `npm run build` — Expected: compiles.

- [ ] **Step 5: Commit checkpoint (owner).** `feedback.schema.ts`.

### Task 3: Extend the create DTO (private-ref attachment validation)

**Files:**

- Modify: `crewroster-backend/src/modules/feedback/dto/create-feedback.dto.ts`

- [ ] **Step 1: Replace the DTO file contents** (rating optional; nested context; attachments validated as private refs **pinned to the feedback category** — NOT `@IsUrl`, because these are `r2-private://` refs, not https URLs):

```ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SCOPES,
  type FeedbackCategory,
  type FeedbackScope,
} from '../schemas/feedback.schema';

// Auto-captured diagnostics. All optional; bounded lengths so a malicious
// client can't bloat the doc. Instantiated by the global ValidationPipe
// (transform:true) via @Type below.
class FeedbackContextDto {
  @IsOptional() @IsString() @MaxLength(512) path?: string;
  @IsOptional() @IsString() @MaxLength(256) locale?: string;
  @IsOptional() @IsString() @MaxLength(512) userAgent?: string;
  @IsOptional() @IsString() @MaxLength(64) viewport?: string;
  @IsOptional() @IsString() @MaxLength(128) appVersion?: string;
}

// A feedback photo ref MUST be a private ref in OUR feedback bucket. Pinning the
// category prefix blocks a client from smuggling a public URL or a ref into
// another private category. Filenames are timestamp+random (uploads.service),
// so guessing another user's object is impractical.
const FEEDBACK_REF = /^r2-private:\/\/erp-feedback-media\/[A-Za-z0-9._\-/]+$/;

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  module: string;

  // Optional now (mood is not required to send feedback).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsEnum(FEEDBACK_CATEGORIES)
  category?: FeedbackCategory;

  @IsOptional()
  @IsEnum(FEEDBACK_SCOPES)
  scope?: FeedbackScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(FEEDBACK_REF, { each: true, message: 'Invalid attachment reference.' })
  @ArrayMaxSize(3)
  attachments?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackContextDto)
  context?: FeedbackContextDto;
}
```

- [ ] **Step 2: Type-check.** Run: `npm run build` — Expected: compiles.

- [ ] **Step 3: Commit checkpoint (owner).** `dto/create-feedback.dto.ts`.

### Task 4: Persist new fields + emit PostHog event

**Files:**

- Modify: `crewroster-backend/src/modules/feedback/feedback.service.ts`

- [ ] **Step 1: Inject `PostHogService`** (it is `@Global()` — no module import needed). Add the import and constructor arg:

```ts
import { PostHogService } from '../../common/posthog/posthog.service';
```

```ts
  constructor(
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<Feedback>,
    private readonly audit: AuditService,
    private readonly postHog: PostHogService,
  ) {}
```

- [ ] **Step 2: Persist the new fields** in `create()` (extend the `feedbackModel.create({...})` call):

```ts
const doc = await this.feedbackModel.create({
  workspaceId: new Types.ObjectId(workspaceId),
  userId: new Types.ObjectId(userId),
  module: dto.module,
  rating: dto.rating ?? null,
  message: dto.message,
  category: dto.category ?? 'general',
  scope: dto.scope ?? 'page',
  attachments: dto.attachments ?? [],
  context: dto.context ?? null,
});
```

- [ ] **Step 3: Emit the PostHog write event** after the audit block (snake-case `<module>.<verb>_<noun>`; capture swallows internally, keyless = no-op):

```ts
// Product analytics: one write event per submission. distinct-id = userId;
// counts/booleans only (no message text / image data). Read-only admin list
// stays event-free (OTel only) per the observability convention.
this.postHog.capture({
  distinctId: userId,
  event: 'feedback.feedback_submitted',
  properties: {
    workspaceId,
    module: dto.module,
    scope: dto.scope ?? 'page',
    category: dto.category ?? 'general',
    hasRating: dto.rating != null,
    attachmentCount: dto.attachments?.length ?? 0,
  },
});
```

- [ ] **Step 4: Type-check.** Run: `npm run build` — Expected: compiles.

- [ ] **Step 5: Commit checkpoint (owner).** `feedback.service.ts`.

### Task 5: Unit test the extended submit

**Files:**

- Create: `crewroster-backend/src/modules/feedback/__tests__/feedback.service.v2.vitest.ts`

- [ ] **Step 1: Write the failing test** (constructs the service with a mock model + audit + postHog; asserts new fields persist + event emits):

```ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { FeedbackService } from '../feedback.service';

describe('FeedbackService — v2 fields', () => {
  let feedbackModel: any;
  let audit: { logEvent: ReturnType<typeof vi.fn> };
  let postHog: { capture: ReturnType<typeof vi.fn> };
  let svc: FeedbackService;

  const wsId = new Types.ObjectId().toHexString();
  const userId = new Types.ObjectId().toHexString();

  beforeEach(() => {
    feedbackModel = {
      create: vi
        .fn()
        .mockImplementation((doc: any) => Promise.resolve({ _id: new Types.ObjectId(), ...doc })),
    };
    audit = { logEvent: vi.fn().mockResolvedValue(undefined) };
    postHog = { capture: vi.fn() };
    svc = new FeedbackService(feedbackModel, audit as any, postHog as any);
  });

  it('persists scope, attachments, context and optional null rating', async () => {
    await svc.create(wsId, userId, {
      module: 'attendance',
      message: 'Edit screen confusing.',
      scope: 'page',
      attachments: [
        'r2-private://erp-feedback-media/1-a.webp',
        'r2-private://erp-feedback-media/2-b.webp',
      ],
      context: { path: '/dashboard/attendance', locale: 'gu', viewport: '1440x900' },
    } as any);
    const persisted = feedbackModel.create.mock.calls[0][0];
    expect(persisted.scope).toBe('page');
    expect(persisted.attachments).toHaveLength(2);
    expect(persisted.rating).toBeNull();
    expect(persisted.context.path).toBe('/dashboard/attendance');
  });

  it('defaults scope=page and attachments=[] when omitted', async () => {
    await svc.create(wsId, userId, { module: 'team', rating: 4, message: 'ok' } as any);
    const persisted = feedbackModel.create.mock.calls[0][0];
    expect(persisted.scope).toBe('page');
    expect(persisted.attachments).toEqual([]);
  });

  it('emits feedback.feedback_submitted to PostHog', async () => {
    await svc.create(wsId, userId, {
      module: 'salary',
      rating: 5,
      message: 'love it',
      scope: 'general',
    } as any);
    expect(postHog.capture).toHaveBeenCalledTimes(1);
    expect(postHog.capture.mock.calls[0][0]).toMatchObject({
      distinctId: userId,
      event: 'feedback.feedback_submitted',
      properties: { workspaceId: wsId, module: 'salary', scope: 'general', hasRating: true },
    });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (service constructor not yet 3-arg if Task 4 incomplete; otherwise PASS). Run: `npx vitest run src/modules/feedback/__tests__/feedback.service.v2.vitest.ts`
- [ ] **Step 3: Make it pass** (Task 4 implements it). Re-run — Expected: PASS.
- [ ] **Step 4: Commit checkpoint (owner).** the new test file.

---

## PHASE 3 — Backend: admin read with signed-URL photos

### Task 6: Admin `getOne` + list filter + signed-URL decoration

**Files:**

- Modify: `crewroster-backend/src/modules/feedback/feedback.module.ts`
- Modify: `crewroster-backend/src/modules/feedback/feedback-admin.service.ts`
- Modify: `crewroster-backend/src/modules/feedback/feedback-admin.controller.ts`

- [ ] **Step 1: Wire `MediaOwnershipModule`** (it exports `PrivateMediaService`; do NOT import `UploadsModule`) into the feedback module imports:

```ts
import { MediaOwnershipModule } from '../uploads/media-ownership.module';
// in @Module({ imports: [ ...existing, MediaOwnershipModule ] })
```

- [ ] **Step 2: Inject `PrivateMediaService`** into `FeedbackAdminService` and add a `scope` filter + `attachmentCount` to `list()`. Add the import + constructor arg:

```ts
import { PrivateMediaService } from '../uploads/services/private-media.service';
```

```ts
  constructor(
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<Feedback>,
    private readonly audit: AuditService,
    private readonly privateMedia: PrivateMediaService,
  ) {}
```

In `list()`, add a scope filter branch (exact match, not the regex `$or`) and an `attachmentCount` on each row. After building `filter` and before the query, add:

```ts
// Optional exact-match scope filter (enum, not free-text — keep it out of $or).
if (query.scope === 'page' || query.scope === 'general') {
  filter.scope = query.scope;
}
```

Map the returned `items` to add a light `attachmentCount` (do NOT sign URLs in the list — keep it cheap):

```ts
const rows = items.map((it) => ({
  ...it,
  attachmentCount: Array.isArray(it.attachments) ? it.attachments.length : 0,
}));
return { items: rows, total, page, limit, pages: Math.ceil(total / limit) || 1 };
```

> `query` is `AdminPaginationDto`. If it has no `scope` field, add `@IsOptional() @IsString() scope?: string;` to that DTO, OR read it via a separate `@Query('scope')` in the controller. Simplest: add the optional field to `AdminPaginationDto` (`crewroster-backend/src/modules/admin/dto/admin.dto.ts`).

- [ ] **Step 3: Add `getOne(id)`** to `FeedbackAdminService` (decorates attachments → 1-hour signed URLs; sign once via `signMany`, resolve per ref; public/empty values pass through):

```ts
  // Single feedback for the admin detail drawer. Decorates the private
  // attachment refs into fresh 1h signed URLs (sign once, resolve per ref).
  // Read path only — the DB always stores raw r2-private:// refs.
  async getOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Feedback not found');
    }
    const doc = await this.feedbackModel.findById(id).lean().exec();
    if (!doc || doc.isDeleted) throw new NotFoundException('Feedback not found');

    const refs = Array.isArray(doc.attachments) ? doc.attachments : [];
    const signed = await this.privateMedia.signMany(refs);
    const attachments = refs.map((r) => this.privateMedia.resolve(r, signed));
    return { ...doc, attachments };
  }
```

- [ ] **Step 4: Add the controller route.** In `feedback-admin.controller.ts`, keep the existing guard trio (`@UseGuards(JwtAuthGuard, IsAdminGuard)` + `@LegacyUnclassified()`), and add:

```ts
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.feedbackAdminService.getOne(id);
  }
```

(Add `Get` + `Param` to the `@nestjs/common` import if missing.)

- [ ] **Step 5: Type-check + build.** Run: `npm run build` — Expected: compiles (no import cycle — `MediaOwnershipModule` avoids `UploadsService`).

- [ ] **Step 6: Commit checkpoint (owner).** `feedback.module.ts`, `feedback-admin.service.ts`, `feedback-admin.controller.ts`, and `admin/dto/admin.dto.ts` if edited.

### Task 7: Unit test admin decoration + scope filter

**Files:**

- Create: `crewroster-backend/src/modules/feedback/__tests__/feedback-admin.getone.vitest.ts`

- [ ] **Step 1: Write the test** (mock model `findById().lean().exec()`; mock `privateMedia.signMany`/`resolve`; assert refs become signed URLs):

```ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { FeedbackAdminService } from '../feedback-admin.service';

describe('FeedbackAdminService.getOne — photo decoration', () => {
  let model: any;
  let audit: any;
  let privateMedia: any;
  let svc: FeedbackAdminService;
  const id = new Types.ObjectId().toHexString();

  beforeEach(() => {
    model = {
      findById: vi.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: id,
              attachments: ['r2-private://erp-feedback-media/1-a.webp'],
              isDeleted: false,
            }),
        }),
      }),
    };
    audit = { logEvent: vi.fn() };
    privateMedia = {
      signMany: vi
        .fn()
        .mockResolvedValue(
          new Map([['r2-private://erp-feedback-media/1-a.webp', 'https://signed/a']]),
        ),
      resolve: vi
        .fn()
        .mockImplementation((ref: string, map: Map<string, string>) => map.get(ref) ?? ref),
    };
    svc = new FeedbackAdminService(model, audit, privateMedia);
  });

  it('returns signed URLs for attachments', async () => {
    const out = await svc.getOne(id);
    expect(out.attachments).toEqual(['https://signed/a']);
    expect(privateMedia.signMany).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — expect PASS** after Task 6. Run: `npx vitest run src/modules/feedback/__tests__/feedback-admin.getone.vitest.ts`
- [ ] **Step 3: Full backend suite for the module.** Run: `npx vitest run src/modules/feedback` — Expected: PASS.
- [ ] **Step 4: Commit checkpoint (owner).** the new test file.

---

## PHASE 4 — Web: regenerate mirror + shared plumbing

### Task 8: Sync the upload-policy web mirror

**Files:**

- Regenerate: `crewroster-web/lib/upload-policies.ts` (GENERATED — never hand-edit)

- [ ] **Step 1: Sync.** Run from the web repo root: `npm run sync:upload-policies`
      Expected: `lib/upload-policies.ts` now includes `'erp-feedback-media'` in the `UploadCategory` union + `CATEGORY_POLICIES`.
- [ ] **Step 2: Verify parity.** Run: `npx vitest run lib/upload-policies.parity.vitest.ts` — Expected: PASS.
- [ ] **Step 3: Commit checkpoint (owner).** `lib/upload-policies.ts` (commit alongside the backend Task 1 files if not already).

### Task 9: Endpoints + extended submit payload + admin actions

**Files:**

- Modify: `crewroster-web/lib/api/endpoints.ts`
- Modify: `crewroster-web/lib/actions/feedback.actions.ts`
- Create: `crewroster-web/features/admin/feedback/feedback.types.ts`
- Create: `crewroster-web/features/admin/feedback/feedback.actions.ts`

- [ ] **Step 1: Add the admin detail endpoint.** In `endpoints.ts`, extend the `feedback` block:

```ts
  feedback: {
    submit: (wsId: string) => `workspaces/${wsId}/feedback`,
    adminList: 'admin/feedback',
    adminGetOne: (id: string) => `admin/feedback/${id}`,
    adminUpdateStatus: (id: string) => `admin/feedback/${id}/status`,
  },
```

- [ ] **Step 2: Extend the user submit payload.** In `lib/actions/feedback.actions.ts`, widen `FeedbackPayload` + `FeedbackRecord` (add the new optional fields; submit signature unchanged):

```ts
export type FeedbackScope = 'page' | 'general';

export interface FeedbackContext {
  path?: string;
  locale?: string;
  userAgent?: string;
  viewport?: string;
  appVersion?: string;
}

export interface FeedbackPayload {
  module: string;
  rating?: number; // now optional
  message: string;
  category?: FeedbackCategory;
  scope?: FeedbackScope; // new
  attachments?: string[]; // new — r2-private:// refs
  context?: FeedbackContext; // new
}
```

(Leave `submitFeedback` body as-is — it forwards the whole payload.)

- [ ] **Step 3: Admin types.** Create `features/admin/feedback/feedback.types.ts`:

```ts
// Admin feedback console types. Backed by admin/feedback (feedback-admin.controller.ts).
import type {
  FeedbackCategory,
  FeedbackScope,
  FeedbackContext,
} from '@/lib/actions/feedback.actions';

export type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix';

export interface AdminFeedbackRow {
  _id: string;
  workspaceId: string;
  userId: string;
  module: string;
  rating: number | null;
  message: string;
  category: FeedbackCategory;
  scope: FeedbackScope;
  status: FeedbackStatus;
  attachmentCount: number;
  adminNotes: string | null;
  createdAt: string;
}

// getOne returns the full row with attachments already signed (https URLs).
export interface AdminFeedbackDetail extends AdminFeedbackRow {
  attachments: string[];
  context: FeedbackContext | null;
}

export interface AdminFeedbackListResult {
  items: AdminFeedbackRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
```

- [ ] **Step 4: Admin actions** (English/AntD admin convention; `ActionResult<T>` try/catch pattern). Create `features/admin/feedback/feedback.actions.ts`:

```ts
'use server';

// Admin feedback console server actions. Wrap admin/feedback endpoints
// (feedback-admin.controller.ts). Never throw — return ActionResult so the
// client renders inline errors. Admin id comes from the JWT on the BE.
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { ActionResult } from '@/features/connect/profile.types';
import type {
  AdminFeedbackListResult,
  AdminFeedbackDetail,
  FeedbackStatus,
} from './feedback.types';

const E = ApiEndpoints.feedback;

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export async function listFeedback(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  scope?: string;
}): Promise<ActionResult<AdminFeedbackListResult>> {
  try {
    const http = await serverHttp();
    const res = await http.get(E.adminList, { params });
    return { ok: true, data: unwrapServer<AdminFeedbackListResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function getFeedback(id: string): Promise<ActionResult<AdminFeedbackDetail>> {
  try {
    const http = await serverHttp();
    const res = await http.get(E.adminGetOne(id));
    return { ok: true, data: unwrapServer<AdminFeedbackDetail>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  adminNotes?: string,
): Promise<ActionResult<AdminFeedbackDetail>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(E.adminUpdateStatus(id), { status, adminNotes });
    return { ok: true, data: unwrapServer<AdminFeedbackDetail>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

- [ ] **Step 5: Type-check.** Run: `npx tsc --noEmit` — Expected: clean.
- [ ] **Step 6: Commit checkpoint (owner).** the four files.

### Task 10: Install dep, add capture-root id, thread `pageLabel`

**Files:**

- Modify: `crewroster-web/package.json` (+ `package-lock.json`)
- Modify: `crewroster-web/components/layout/DashboardLayout.tsx`
- Modify: `crewroster-web/components/ui/HeaderRightActions.tsx`
- Modify: `crewroster-web/components/layout/TopHeader.tsx`

- [ ] **Step 1: Install `html-to-image`.** Run from the web repo root: `npm install html-to-image`
      Expected: added to `dependencies`; `package-lock.json` updated.

- [ ] **Step 2: Add a stable capture target id** (logical/shared-layout change — flag for owner). In `DashboardLayout.tsx`, add `id="z360-capture-root"` to the page-content div (the `max-w-[1400px]` wrapper, ~line 776):

```tsx
            <div id="z360-capture-root" className="animate-fade-in mx-auto max-w-[1400px]">
```

- [ ] **Step 3: Thread `pageLabel` through `HeaderRightActions`.** Add the prop + forward it to the feedback component:

```ts
export interface HeaderRightActionsProps {
  module: string;
  moduleLabel?: string;
  pageLabel?: string; // human page name for the feedback "This page" chip
  hide?: { plan?: boolean; guide?: boolean; shortcuts?: boolean; feedback?: boolean };
  extras?: ReactNode;
}
```

```tsx
{
  !hide?.feedback && <FeedbackButton module={module} pageLabel={pageLabel} />;
}
```

- [ ] **Step 4: Pass `currentTitle` from `TopHeader`.** At the `HeaderRightActions` render site (~line 943) add `pageLabel={currentTitle}`:

```tsx
<HeaderRightActions
  module={getModuleFromPath(pathname)}
  pageLabel={currentTitle}
  hide={{ guide: !hasModuleGuide(getModuleFromPath(pathname)) }}
/>
```

- [ ] **Step 5: Type-check** (FeedbackButton will accept `pageLabel` after Task 14; if doing this before Task 14, temporarily allow it). Run: `npx tsc --noEmit`.
- [ ] **Step 6: Commit checkpoint (owner).** `package.json`, `package-lock.json`, `DashboardLayout.tsx`, `HeaderRightActions.tsx`, `TopHeader.tsx`.

---

## PHASE 5 — Web: the user feedback panel

### Task 11: Screen-capture + blur utility

**Files:**

- Create: `crewroster-web/lib/services/feedback-capture.ts`

Reuses the `toBlob` → `File` pattern from `image-compress.ts` / `video-poster.ts`. Output `File` declares `image/png` matching the encoded bytes (BE sniffs magic bytes). Canvas round-trip strips EXIF/GPS (privacy-positive).

- [ ] **Step 1: Write the util:**

```ts
// Feedback screen capture + redaction. Snapshots the ERP content root
// (#z360-capture-root in DashboardLayout) to a PNG via html-to-image, then lets
// the caller paint opaque redaction rectangles over sensitive regions before
// turning the result into an upload-ready File. Black-box redaction is
// irreversible (no pixels survive) — preferred over reversible CSS blur for an
// ERP that shows payroll/PII. Links to: FeedbackScreenCapture.tsx (UI).
import { toPng } from 'html-to-image';

export const CAPTURE_ROOT_ID = 'z360-capture-root';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Capture the content root to an HTMLImageElement (decoded, ready to draw).
// Returns null if the root is missing or capture fails (cross-origin taint etc.)
// so the caller can fall back to manual photo upload.
export async function captureContentRoot(): Promise<HTMLImageElement | null> {
  if (typeof document === 'undefined') return null;
  const node = document.getElementById(CAPTURE_ROOT_ID);
  if (!node) return null;
  try {
    const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 1 });
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode failed'));
      img.src = dataUrl;
    });
    return img;
  } catch {
    return null;
  }
}

// Draw the image + opaque redaction rectangles to a canvas and emit a PNG File.
export async function renderRedactedFile(
  img: HTMLImageElement,
  rects: Rect[],
): Promise<File | null> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#111111';
  for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) return null;
  return new File([blob], `feedback-screen-${Date.now()}.png`, { type: 'image/png' });
}
```

(`Date.now()` is fine in app code; only Workflow scripts forbid it.)

- [ ] **Step 2: Type-check.** Run: `npx tsc --noEmit` — Expected: clean.
- [ ] **Step 3: Commit checkpoint (owner).** `lib/services/feedback-capture.ts`.

### Task 12: `FeedbackAttachments` component

**Files:**

- Create: `crewroster-web/components/ui/FeedbackAttachments.tsx`

Mirrors the `MediaUploadGrid` tile/progress/remove pattern, simplified to max 3 images, category `erp-feedback-media`. **Emits completed refs from a `useEffect` (never inside a `setTiles` updater)** to survive StrictMode. Shows local blob previews (the stored value is the private ref, not directly viewable).

- [ ] **Step 1: Write the component:**

```tsx
'use client';

// Feedback photo attachments — up to 3 images to the private erp-feedback-media
// bucket. Mirrors MediaUploadGrid's tile/progress/remove, trimmed to images +
// cap 3. Emits completed r2-private:// refs to the parent via onChange from a
// useEffect (StrictMode-safe). Also accepts externally-added Files (screen
// capture) via the `addFile` ref handle. Links to: FeedbackPanel.tsx,
// FeedbackScreenCapture.tsx, upload.service.ts.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadService } from '@/lib/services/upload.service';
import { preCheckUpload } from '@/lib/upload-policies.helpers';

const CATEGORY = 'erp-feedback-media' as const;
const MAX = 3;

interface Tile {
  id: string;
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  url?: string;
}

export interface FeedbackAttachmentsHandle {
  addFile: (file: File) => void;
  count: () => number;
}

export interface FeedbackAttachmentsProps {
  onChange: (refs: string[]) => void;
  onLimit?: () => void;
}

export const FeedbackAttachments = forwardRef<FeedbackAttachmentsHandle, FeedbackAttachmentsProps>(
  function FeedbackAttachments({ onChange, onLimit }, ref) {
    const t = useTranslations('feedback.attachments');
    const [tiles, setTiles] = useState<Tile[]>([]);
    const tilesRef = useRef<Tile[]>(tiles);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    });

    const patchTile = useCallback((id: string, patch: Partial<Tile>) => {
      setTiles((prev) => prev.map((tile) => (tile.id === id ? { ...tile, ...patch } : tile)));
    }, []);

    // Emit completed refs whenever tiles change (effect, not updater).
    useEffect(() => {
      tilesRef.current = tiles;
      const done = tiles.filter((tl) => tl.status === 'done' && tl.url);
      onChangeRef.current(done.map((tl) => tl.url!));
    }, [tiles]);

    const startUpload = useCallback(
      (file: File) => {
        const violation = preCheckUpload(file, CATEGORY);
        if (violation) return; // friendly pre-check; BE re-validates
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}`;
        const previewUrl = uploadService.getFilePreviewUrl(file);
        setTiles((prev) => [...prev, { id, previewUrl, status: 'uploading', progress: 0 }]);
        void uploadService
          .uploadSingle(file, {
            category: CATEGORY,
            onProgress: (p) => patchTile(id, { progress: p }),
          })
          .then((res) => patchTile(id, { status: 'done', progress: 100, url: res.url }))
          .catch(() => patchTile(id, { status: 'error' }));
      },
      [patchTile],
    );

    const addFiles = useCallback(
      (files: FileList | File[] | null) => {
        if (!files) return;
        const room = MAX - tilesRef.current.length;
        if (room <= 0) {
          onLimit?.();
          return;
        }
        Array.from(files).slice(0, room).forEach(startUpload);
        if (Array.from(files).length > room) onLimit?.();
      },
      [onLimit, startUpload],
    );

    useImperativeHandle(
      ref,
      () => ({
        addFile: (file: File) => addFiles([file]),
        count: () => tilesRef.current.length,
      }),
      [addFiles],
    );

    const removeTile = useCallback((id: string) => {
      const target = tilesRef.current.find((tl) => tl.id === id);
      if (target) {
        if (target.url) void uploadService.deleteFile(target.url);
        uploadService.revokePreviewUrl(target.previewUrl);
      }
      setTiles((prev) => prev.filter((tl) => tl.id !== id));
    }, []);

    const inputRef = useRef<HTMLInputElement>(null);
    const atLimit = tiles.length >= MAX;

    return (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tiles.map((tile) => (
            <div
              key={tile.id}
              style={{
                position: 'relative',
                width: 56,
                height: 56,
                borderRadius: 'var(--cr-radius-md)',
                overflow: 'hidden',
                background: 'var(--cr-surface-2)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={tile.previewUrl}
                alt=""
                decoding="async"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: tile.status === 'uploading' ? 0.5 : 1,
                }}
              />
              {tile.status === 'uploading' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    background: 'rgba(14,24,68,0.45)',
                  }}
                >
                  {tile.progress}%
                </div>
              )}
              {tile.status === 'error' && (
                <div
                  role="alert"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    textAlign: 'center',
                    color: 'var(--cr-error)',
                    background: 'var(--cr-error-bg)',
                  }}
                >
                  {t('uploadFailed')}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeTile(tile.id)}
                aria-label={t('remove')}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 20,
                  height: 20,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
        />
        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{ marginTop: 8, fontSize: 13 }}
          >
            {t('add')}
          </button>
        )}
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--cr-text-3)' }}>
          {t('hint', { max: MAX, maxMb: 5 })}
        </div>
      </div>
    );
  },
);

export default FeedbackAttachments;
```

- [ ] **Step 2: Write a focused test.** Create `components/ui/FeedbackAttachments.test.tsx`: mock `uploadService.uploadSingle` to resolve `{ url: 'r2-private://erp-feedback-media/x.webp' }`; pick a file; assert `onChange` is called with the ref; pick a 4th and assert `onLimit` fires. (Mirror the mocking in `MediaUploadGrid.test.tsx`.)
- [ ] **Step 3: Run.** `npx vitest run components/ui/FeedbackAttachments.test.tsx` — Expected: PASS.
- [ ] **Step 4: Commit checkpoint (owner).** component + test.

### Task 13: `FeedbackScreenCapture` modal (capture + blur)

**Files:**

- Create: `crewroster-web/components/ui/FeedbackScreenCapture.tsx`

A controlled AntD `Modal` (v6: `open`, `destroyOnHidden`) that captures via `captureContentRoot()`, shows the image scaled to fit, lets the user drag redaction rectangles over it (pointer events on an overlay), then emits a redacted PNG `File` via `renderRedactedFile()`.

- [ ] **Step 1: Write the component:**

```tsx
'use client';

// Screen capture + redaction modal. Captures the ERP content root, lets the
// user drag opaque rectangles over sensitive regions, and returns a redacted
// PNG File to the parent (which feeds it to FeedbackAttachments). Black-box
// redaction is irreversible. Links to: feedback-capture.ts, FeedbackPanel.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, App as AntApp } from 'antd';
import { useTranslations } from 'next-intl';
import { captureContentRoot, renderRedactedFile, type Rect } from '@/lib/services/feedback-capture';

export interface FeedbackScreenCaptureProps {
  open: boolean;
  onClose: () => void;
  onAttach: (file: File) => void;
}

export default function FeedbackScreenCapture({
  open,
  onClose,
  onAttach,
}: FeedbackScreenCaptureProps) {
  const t = useTranslations('feedback.capture');
  const { message } = AntApp.useApp();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [drawing, setDrawing] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // Capture once when the modal opens.
  useEffect(() => {
    if (!open) {
      setImg(null);
      setRects([]);
      return;
    }
    let cancelled = false;
    void captureContentRoot().then((res) => {
      if (cancelled) return;
      if (!res) {
        message.error(t('failed'));
        onClose();
        return;
      }
      setImg(res);
    });
    return () => {
      cancelled = true;
    };
  }, [open, message, t, onClose]);

  // Map a pointer event to natural-image coords (the displayed image is scaled).
  const toNatural = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const box = boxRef.current;
      if (!box || !img) return null;
      const rect = box.getBoundingClientRect();
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    },
    [img],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const p = toNatural(e.clientX, e.clientY);
      if (!p) return;
      startRef.current = p;
      setDrawing({ x: p.x, y: p.y, w: 0, h: 0 });
    },
    [toNatural],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const p = toNatural(e.clientX, e.clientY);
      if (!p) return;
      const s = startRef.current;
      setDrawing({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      });
    },
    [toNatural],
  );

  const onPointerUp = useCallback(() => {
    if (drawing && drawing.w > 4 && drawing.h > 4) setRects((prev) => [...prev, drawing]);
    setDrawing(null);
    startRef.current = null;
  }, [drawing]);

  const attach = useCallback(async () => {
    if (!img) return;
    setBusy(true);
    const file = await renderRedactedFile(img, rects);
    setBusy(false);
    if (!file) {
      message.error(t('failed'));
      return;
    }
    onAttach(file);
    onClose();
  }, [img, rects, onAttach, onClose, message, t]);

  // Scale factor for rendering rects over the displayed image.
  const scale = img && boxRef.current ? boxRef.current.clientWidth / img.naturalWidth : 1;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('title')}
      width={720}
      destroyOnHidden
      footer={[
        <Button key="reset" onClick={() => setRects([])} disabled={!rects.length || busy}>
          {t('reset')}
        </Button>,
        <Button key="discard" onClick={onClose} disabled={busy}>
          {t('discard')}
        </Button>,
        <Button key="attach" type="primary" loading={busy} disabled={!img} onClick={attach}>
          {t('attach')}
        </Button>,
      ]}
    >
      <p style={{ fontSize: 13, color: 'var(--cr-text-3)', marginBottom: 8 }}>
        {t('instructions')}
      </p>
      {img && (
        <div
          ref={boxRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            position: 'relative',
            width: '100%',
            cursor: 'crosshair',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- captured data URL */}
          <img src={img.src} alt="" style={{ width: '100%', display: 'block' }} />
          {[...rects, ...(drawing ? [drawing] : [])].map((r, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: r.x * scale,
                top: r.y * scale,
                width: r.w * scale,
                height: r.h * scale,
                background: '#111',
                opacity: 0.92,
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check.** `npx tsc --noEmit` — Expected: clean.
- [ ] **Step 3: Commit checkpoint (owner).** the component.

### Task 14: `FeedbackPanel` + rewrite `FeedbackButton`

**Files:**

- Create: `crewroster-web/components/ui/FeedbackPanel.tsx`
- Rewrite: `crewroster-web/components/ui/FeedbackButton.tsx`

`FeedbackButton` keeps the trigger button and owns open-state + the responsive Popover (desktop) / Drawer (mobile) shell. `FeedbackPanel` is the form body (scope toggle, mood faces, category chips, message, attachments, capture, context note, submit). Mood maps to `rating` 1–5 (optional). Context is collected at submit.

- [ ] **Step 1: Write `FeedbackPanel.tsx`:**

```tsx
'use client';

// Feedback form body (quick-first). Scope toggle (this-page/general) + mood
// faces (-> rating 1-5, optional) + category chips + message + photo
// attachments + screen capture + an auto-context note. Submits via
// submitFeedback with page/device context. Rendered inside FeedbackButton's
// Popover (desktop) / Drawer (mobile). Links to: feedback.actions.ts,
// FeedbackAttachments.tsx, FeedbackScreenCapture.tsx.
import { useCallback, useMemo, useRef, useState } from 'react';
import { App as AntApp, Button, Input } from 'antd';
import { FrownOutlined, MehOutlined, SmileOutlined, CameraOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
  submitFeedback,
  type FeedbackCategory,
  type FeedbackScope,
} from '@/lib/actions/feedback.actions';
import { useWorkspaceStore } from '@/lib/store';
import { track } from '@/lib/analytics';
import FeedbackAttachments, { type FeedbackAttachmentsHandle } from './FeedbackAttachments';
import FeedbackScreenCapture from './FeedbackScreenCapture';

const CATEGORIES: FeedbackCategory[] = ['general', 'feature_request', 'bug_report'];
const MOODS = [1, 2, 3, 4, 5] as const;

function moodIcon(n: number) {
  if (n <= 2) return <FrownOutlined />;
  if (n === 3) return <MehOutlined />;
  return <SmileOutlined />;
}

export interface FeedbackPanelProps {
  module: string;
  pageLabel?: string;
  onDone: () => void;
}

export default function FeedbackPanel({ module, pageLabel, onDone }: FeedbackPanelProps) {
  const t = useTranslations('feedback');
  const { message: msg } = AntApp.useApp();
  const pathname = usePathname();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);

  const [scope, setScope] = useState<FeedbackScope>('page');
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const attachRef = useRef<FeedbackAttachmentsHandle>(null);

  const buildContext = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const locale = document.cookie.match(/z360_locale=([^;]+)/)?.[1];
    return {
      path: pathname,
      locale,
      userAgent: navigator.userAgent.slice(0, 512),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
    };
  }, [pathname]);

  const submit = useCallback(async () => {
    if (!workspaceId) {
      msg.error(t('toast.needWorkspace'));
      return;
    }
    if (text.trim().length === 0) {
      msg.error(t('toast.needMessage'));
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback(workspaceId, {
        module,
        rating: rating ?? undefined,
        message: text.trim(),
        category,
        scope,
        attachments,
        context: buildContext(),
      });
      track('feedback.submit.success', {
        module,
        scope,
        rating,
        category,
        photoCount: attachments.length,
      });
      msg.success(t('toast.success'));
      onDone();
    } catch {
      track('feedback.submit.error', { module, scope, category });
      msg.error(t('toast.error'));
    } finally {
      setSubmitting(false);
    }
  }, [
    workspaceId,
    text,
    module,
    rating,
    category,
    scope,
    attachments,
    buildContext,
    msg,
    t,
    onDone,
  ]);

  const scopeBtn = (val: FeedbackScope, label: string) => (
    <button
      type="button"
      onClick={() => {
        setScope(val);
        track('feedback.scope_changed', { module, scope: val });
      }}
      style={{
        flex: 1,
        padding: '6px 8px',
        fontSize: 13,
        borderRadius: 6,
        border: scope === val ? '1px solid var(--cr-primary)' : '1px solid var(--cr-border-light)',
        background: scope === val ? 'var(--cr-primary-light)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ width: 340, maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {scopeBtn('page', pageLabel ? t('scope.pageWith', { page: pageLabel }) : t('scope.page'))}
        {scopeBtn('general', t('scope.general'))}
      </div>

      <div style={{ fontSize: 13, color: 'var(--cr-text-2)', marginBottom: 6 }}>
        {t('mood.label')}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, fontSize: 24 }}>
        {MOODS.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t(`mood.${n}` as 'mood.1')}
            aria-pressed={rating === n}
            onClick={() => setRating(n)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: rating === n ? 'var(--cr-primary)' : 'var(--cr-text-3)',
              padding: 0,
            }}
          >
            {moodIcon(n)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            style={{
              fontSize: 12,
              padding: '4px 11px',
              borderRadius: 14,
              cursor: 'pointer',
              border:
                category === c ? '1px solid var(--cr-primary)' : '1px solid var(--cr-border-light)',
              background: category === c ? 'var(--cr-primary-light)' : 'transparent',
            }}
          >
            {t(`category.${c}` as 'category.general')}
          </button>
        ))}
      </div>

      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('message.placeholder')}
        rows={4}
        maxLength={2000}
        showCount
        style={{ marginBottom: 12 }}
      />

      <FeedbackAttachments
        ref={attachRef}
        onChange={setAttachments}
        onLimit={() => msg.warning(t('attachments.limit', { max: 3 }))}
      />

      <Button
        size="small"
        icon={<CameraOutlined />}
        onClick={() => {
          if ((attachRef.current?.count() ?? 0) >= 3) {
            msg.warning(t('attachments.limit', { max: 3 }));
            return;
          }
          setCaptureOpen(true);
          track('feedback.screen_captured', { module });
        }}
        style={{ marginTop: 8 }}
      >
        {t('attachments.capture')}
      </Button>

      <div
        style={{
          display: 'flex',
          gap: 7,
          alignItems: 'flex-start',
          background: 'var(--cr-surface-2)',
          borderRadius: 'var(--cr-radius-md)',
          padding: '8px 10px',
          margin: '12px 0',
          fontSize: 12,
          color: 'var(--cr-text-2)',
        }}
      >
        {t('context.note')}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onDone} disabled={submitting}>
          {t('actions.cancel')}
        </Button>
        <Button type="primary" loading={submitting} onClick={submit}>
          {t('actions.send')}
        </Button>
      </div>

      <FeedbackScreenCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onAttach={(file) => attachRef.current?.addFile(file)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `FeedbackButton.tsx`** (keep the trigger; responsive Popover/Drawer; opens the panel; fires `feedback.open`):

```tsx
'use client';

// Breadcrumb-row "Feedback" trigger. Keeps the same chip; opens the upgraded
// FeedbackPanel in a Popover (desktop) / bottom Drawer (mobile). Page name
// (pageLabel) comes from TopHeader's currentTitle for the "This page" chip.
import { useState, useSyncExternalStore } from 'react';
import { Popover, Drawer, Tooltip } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { track } from '@/lib/analytics';
import FeedbackPanel from './FeedbackPanel';

export interface FeedbackButtonProps {
  module: string;
  pageLabel?: string;
}

const MOBILE_Q = '(max-width: 767.98px)';
function subMobile(notify: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const mq = window.matchMedia(MOBILE_Q);
  mq.addEventListener('change', notify);
  return () => mq.removeEventListener('change', notify);
}
function getMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_Q).matches;
}

export function FeedbackButton({ module, pageLabel }: FeedbackButtonProps) {
  const t = useTranslations('feedback');
  const [open, setOpen] = useState(false);
  const isMobile = useSyncExternalStore(subMobile, getMobile, () => false);

  const openPanel = () => {
    setOpen(true);
    track('feedback.open', { module });
  };
  const close = () => setOpen(false);

  const trigger = (
    <Tooltip title={t('title')}>
      <button
        type="button"
        onClick={openPanel}
        aria-label={t('title')}
        className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-gray-700 transition-colors hover:text-blue-700"
      >
        <MessageOutlined />
        <span>{t('trigger')}</span>
      </button>
    </Tooltip>
  );

  const panel = <FeedbackPanel module={module} pageLabel={pageLabel} onDone={close} />;

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          open={open}
          onClose={close}
          placement="bottom"
          size="large"
          destroyOnHidden
          title={t('title')}
        >
          {panel}
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      trigger="click"
      placement="bottomRight"
      title={t('title')}
      content={open ? panel : null}
    >
      {trigger}
    </Popover>
  );
}

export default FeedbackButton;
```

- [ ] **Step 3: Write a panel test.** Create `components/ui/FeedbackPanel.test.tsx`: mock `submitFeedback` + `useWorkspaceStore` (returns an id) + `next-intl` (passthrough); render the panel; type a message; click Send; assert `submitFeedback` called with `{ module, message, scope:'page', rating: undefined }` + a `context`. Then test: empty message blocks submit (error toast, no call). (Mirror existing `*.test.tsx` setup in the repo.)
- [ ] **Step 4: Run.** `npx vitest run components/ui/FeedbackPanel.test.tsx` — Expected: PASS.
- [ ] **Step 5: Type-check + lint.** `npx tsc --noEmit` && `npm run lint` — Expected: clean (no banned AntD v6 props: `open`/`size`/`destroyOnHidden` used; no `visible`/`width`/`destroyOnClose`).
- [ ] **Step 6: Commit checkpoint (owner).** `FeedbackPanel.tsx`, `FeedbackButton.tsx`, panel test.

### Task 15: i18n — `feedback.*` namespace (4 locales)

**Files:**

- Modify: `crewroster-web/app/messages/en.json`, `gu.json`, `gu-en.json`, `hi-en.json`

- [ ] **Step 1: Add the `feedback` namespace to `en.json`** (source of truth):

```json
"feedback": {
  "trigger": "Feedback",
  "title": "Send feedback",
  "scope": { "page": "This page", "general": "General", "pageWith": "This page · {page}" },
  "mood": { "label": "How is this page working for you?", "1": "Very unhappy", "2": "Unhappy", "3": "Okay", "4": "Happy", "5": "Very happy" },
  "category": { "label": "Type", "general": "General", "feature_request": "Idea", "bug_report": "Problem" },
  "message": { "label": "Your feedback", "placeholder": "What's working, what's missing, what would help?" },
  "attachments": { "add": "Add photos", "capture": "Capture screen", "hint": "Up to {max} images · {maxMb} MB each · JPG, PNG", "remove": "Remove", "uploadFailed": "Upload failed", "limit": "You can attach up to {max} photos." },
  "context": { "note": "We'll attach this page and your device details so issues are faster to fix." },
  "capture": { "title": "Capture & redact", "instructions": "Drag over anything sensitive to blur it before attaching.", "reset": "Clear marks", "attach": "Attach", "discard": "Discard", "failed": "Couldn't capture the screen. Please add a photo instead." },
  "actions": { "cancel": "Cancel", "send": "Send" },
  "toast": { "success": "Thanks — feedback received.", "error": "Could not send feedback. Please try again.", "needMessage": "Tell us a bit more before sending.", "needWorkspace": "Select a workspace before sending feedback." }
}
```

- [ ] **Step 2: Add the same key tree to `gu.json`** (Gujarati script — best-effort, owner reviews):

```json
"feedback": {
  "trigger": "પ્રતિસાદ",
  "title": "પ્રતિસાદ મોકલો",
  "scope": { "page": "આ પાનું", "general": "સામાન્ય", "pageWith": "આ પાનું · {page}" },
  "mood": { "label": "આ પાનું તમારા માટે કેવું કામ કરે છે?", "1": "ખૂબ નાખુશ", "2": "નાખુશ", "3": "ઠીક", "4": "ખુશ", "5": "ખૂબ ખુશ" },
  "category": { "label": "પ્રકાર", "general": "સામાન્ય", "feature_request": "વિચાર", "bug_report": "સમસ્યા" },
  "message": { "label": "તમારો પ્રતિસાદ", "placeholder": "શું સારું છે, શું ખૂટે છે, શું મદદ કરશે?" },
  "attachments": { "add": "ફોટા ઉમેરો", "capture": "સ્ક્રીન કેપ્ચર કરો", "hint": "વધુમાં વધુ {max} ફોટા · દરેક {maxMb} MB · JPG, PNG", "remove": "દૂર કરો", "uploadFailed": "અપલોડ નિષ્ફળ", "limit": "તમે વધુમાં વધુ {max} ફોટા જોડી શકો છો." },
  "context": { "note": "સમસ્યા ઝડપથી ઉકેલવા માટે અમે આ પાનું અને તમારા ઉપકરણની વિગતો જોડીશું." },
  "capture": { "title": "કેપ્ચર અને છુપાવો", "instructions": "જોડતા પહેલા સંવેદનશીલ ભાગ પર ખેંચીને ઝાંખું કરો.", "reset": "નિશાન ભૂંસો", "attach": "જોડો", "discard": "રદ કરો", "failed": "સ્ક્રીન કેપ્ચર થઈ શક્યું નહીં. કૃપા કરી ફોટો ઉમેરો." },
  "actions": { "cancel": "રદ કરો", "send": "મોકલો" },
  "toast": { "success": "આભાર — પ્રતિસાદ મળ્યો.", "error": "પ્રતિસાદ મોકલી શકાયો નહીં. ફરી પ્રયાસ કરો.", "needMessage": "મોકલતા પહેલા થોડું વધુ જણાવો.", "needWorkspace": "પ્રતિસાદ મોકલતા પહેલા વર્કસ્પેસ પસંદ કરો." }
}
```

- [ ] **Step 3: Add to `gu-en.json`** (Gujlish/latin — best-effort):

```json
"feedback": {
  "trigger": "Pratisaad",
  "title": "Pratisaad moklo",
  "scope": { "page": "Aa paanu", "general": "Saamanya", "pageWith": "Aa paanu · {page}" },
  "mood": { "label": "Aa paanu tamara mate kevu kaam kare chhe?", "1": "Khub nakhush", "2": "Nakhush", "3": "Thik", "4": "Khush", "5": "Khub khush" },
  "category": { "label": "Prakaar", "general": "Saamanya", "feature_request": "Vichaar", "bug_report": "Samasya" },
  "message": { "label": "Tamaro pratisaad", "placeholder": "Shu saru chhe, shu khute chhe, shu madad karshe?" },
  "attachments": { "add": "Fota umero", "capture": "Screen capture karo", "hint": "Vadhuma vadhu {max} fota · darek {maxMb} MB · JPG, PNG", "remove": "Dur karo", "uploadFailed": "Upload nishfal", "limit": "Tame vadhuma vadhu {max} fota jodi shako chho." },
  "context": { "note": "Samasya zadpathi ukelva mate ame aa paanu ane tamara device ni vigato jodishu." },
  "capture": { "title": "Capture ane chhupavo", "instructions": "Jodta pehla sanvedansheel bhaag par khenchine zaankhu karo.", "reset": "Nishaan bhunso", "attach": "Jodo", "discard": "Radd karo", "failed": "Screen capture thai shakyu nahi. Krupa kari photo umero." },
  "actions": { "cancel": "Radd karo", "send": "Moklo" },
  "toast": { "success": "Aabhar — pratisaad malyo.", "error": "Pratisaad mokli shakayo nahi. Fari prayaas karo.", "needMessage": "Mokalta pehla thodu vadhu janavo.", "needWorkspace": "Pratisaad mokalta pehla workspace pasand karo." }
}
```

- [ ] **Step 4: Add to `hi-en.json`** (Hinglish/latin — best-effort):

```json
"feedback": {
  "trigger": "Feedback",
  "title": "Feedback bhejein",
  "scope": { "page": "Yeh page", "general": "General", "pageWith": "Yeh page · {page}" },
  "mood": { "label": "Yeh page aapke liye kaisa kaam kar raha hai?", "1": "Bahut naakhush", "2": "Naakhush", "3": "Theek", "4": "Khush", "5": "Bahut khush" },
  "category": { "label": "Prakaar", "general": "General", "feature_request": "Idea", "bug_report": "Samasya" },
  "message": { "label": "Aapka feedback", "placeholder": "Kya achha hai, kya kami hai, kya madad karega?" },
  "attachments": { "add": "Photo jodein", "capture": "Screen capture karein", "hint": "Adhik se adhik {max} photo · pratyek {maxMb} MB · JPG, PNG", "remove": "Hatayein", "uploadFailed": "Upload fail", "limit": "Aap adhik se adhik {max} photo jod sakte hain." },
  "context": { "note": "Samasya jaldi theek karne ke liye hum yeh page aur aapke device ki details jodenge." },
  "capture": { "title": "Capture aur chhupayein", "instructions": "Jodne se pehle sanvedansheel hisse par drag karke blur karein.", "reset": "Nishaan mitayein", "attach": "Jodein", "discard": "Radd karein", "failed": "Screen capture nahi ho saka. Kripya photo jodein." },
  "actions": { "cancel": "Radd karein", "send": "Bhejein" },
  "toast": { "success": "Dhanyavaad — feedback mil gaya.", "error": "Feedback nahi bhej sake. Kripya phir koshish karein.", "needMessage": "Bhejne se pehle thoda aur batayein.", "needWorkspace": "Feedback bhejne se pehle workspace chunein." }
}
```

- [ ] **Step 5: Verify parity.** Run: `npx vitest run app/messages/locale-parity.vitest.ts` — Expected: PASS (en ⊆ each locale; no blanks).
- [ ] **Step 6: Commit checkpoint (owner).** the 4 message files. (Note: owner reviews gu/gu-en/hi-en wording — matches the standing translation-review owe.)

---

## PHASE 6 — Web: admin feedback console

### Task 16: Admin console component

**Files:**

- Create: `crewroster-web/features/admin/feedback/AdminFeedbackConsole.tsx`

English/AntD only. Table (date, user, module, scope, category, rating, status, photos) + filters (status, scope, search) + a detail `Drawer` (message, context, photo `Image.PreviewGroup` from signed URLs, status update + admin notes).

- [ ] **Step 1: Write the component** (key structure — `Table`, `Drawer` with v6 `open`/`size`/`destroyOnHidden`, `Image.PreviewGroup`, `message.useMessage()` + `{ctx}`, optimistic status update via `updateFeedbackStatus`):

```tsx
'use client';

// Admin feedback console (English/AntD only). Lists feedback, filters by
// status/scope/search, opens a detail Drawer with the context block + signed
// photo URLs, and updates status + admin notes. Backed by admin/feedback
// (feedback-admin.controller.ts) via feedback.actions.ts. Double-gated: client
// here, IsAdminGuard on the BE.
import { useCallback, useState } from 'react';
import { Table, Tag, Drawer, Select, Input, Button, Image, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { listFeedback, getFeedback, updateFeedbackStatus } from './feedback.actions';
import type { AdminFeedbackRow, AdminFeedbackDetail, FeedbackStatus } from './feedback.types';

const STATUSES: FeedbackStatus[] = ['new', 'reviewed', 'in_progress', 'resolved', 'wont_fix'];
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  new: 'blue',
  reviewed: 'cyan',
  in_progress: 'gold',
  resolved: 'green',
  wont_fix: 'default',
};

export default function AdminFeedbackConsole({
  initial,
}: {
  initial: { items: AdminFeedbackRow[]; total: number };
}) {
  const [rows, setRows] = useState<AdminFeedbackRow[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<AdminFeedbackDetail | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  const reload = useCallback(
    async (page = 1) => {
      setLoading(true);
      const res = await listFeedback({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter,
        scope: scopeFilter,
      });
      setLoading(false);
      if (res.ok) {
        setRows(res.data.items);
        setTotal(res.data.total);
      } else {
        msgApi.error(res.error);
      }
    },
    [search, statusFilter, scopeFilter, msgApi],
  );

  const openDetail = useCallback(
    async (id: string) => {
      const res = await getFeedback(id);
      if (res.ok) setDetail(res.data);
      else msgApi.error(res.error);
    },
    [msgApi],
  );

  const setStatus = useCallback(
    async (status: FeedbackStatus) => {
      if (!detail) return;
      setSavingStatus(true);
      const res = await updateFeedbackStatus(detail._id, status, detail.adminNotes ?? undefined);
      setSavingStatus(false);
      if (res.ok) {
        msgApi.success('Status updated.');
        setDetail(res.data);
        setRows((prev) => prev.map((r) => (r._id === res.data._id ? { ...r, status } : r)));
      } else {
        msgApi.error(res.error);
      }
    },
    [detail, msgApi],
  );

  const columns: ColumnsType<AdminFeedbackRow> = [
    { title: 'Date', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: 'Module', dataIndex: 'module' },
    { title: 'Scope', dataIndex: 'scope' },
    { title: 'Category', dataIndex: 'category' },
    { title: 'Rating', dataIndex: 'rating', render: (v: number | null) => v ?? '—' },
    { title: 'Photos', dataIndex: 'attachmentCount' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: FeedbackStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: '',
      key: 'open',
      render: (_, row) => (
        <Button size="small" onClick={() => openDetail(row._id)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <>
      {ctx}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Search message / module"
          allowClear
          onSearch={(v) => {
            setSearch(v);
            void reload(1);
          }}
          style={{ width: 260 }}
        />
        <Select
          placeholder="Status"
          allowClear
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            void reload(1);
          }}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Select
          placeholder="Scope"
          allowClear
          style={{ width: 140 }}
          value={scopeFilter}
          onChange={(v) => {
            setScopeFilter(v);
            void reload(1);
          }}
          options={[
            { value: 'page', label: 'This page' },
            { value: 'general', label: 'General' },
          ]}
        />
      </Space>

      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ total, pageSize: 20, onChange: (p) => void reload(p) }}
      />

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        size="large"
        destroyOnHidden
        title="Feedback detail"
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Tag color={STATUS_COLOR[detail.status]}>{detail.status}</Tag>
              <span style={{ marginLeft: 8 }}>
                {detail.module} · {detail.scope} · {detail.category}
              </span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{detail.message}</p>

            {detail.attachments.length > 0 && (
              <Image.PreviewGroup>
                <Space wrap>
                  {detail.attachments.map((url, i) => (
                    <Image
                      key={i}
                      src={url}
                      width={84}
                      height={84}
                      style={{ objectFit: 'cover' }}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            )}

            {detail.context && (
              <div style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
                <div>Page: {detail.context.path}</div>
                <div>Locale: {detail.context.locale}</div>
                <div>Viewport: {detail.context.viewport}</div>
                <div style={{ wordBreak: 'break-all' }}>Device: {detail.context.userAgent}</div>
              </div>
            )}

            <Input.TextArea
              rows={3}
              placeholder="Admin notes"
              value={detail.adminNotes ?? ''}
              onChange={(e) => setDetail({ ...detail, adminNotes: e.target.value })}
            />
            <Space>
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  type={detail.status === s ? 'primary' : 'default'}
                  loading={savingStatus && detail.status !== s}
                  onClick={() => void setStatus(s)}
                >
                  {s}
                </Button>
              ))}
            </Space>
          </div>
        )}
      </Drawer>
    </>
  );
}
```

- [ ] **Step 2: Type-check + lint.** `npx tsc --noEmit` && `npm run lint` — Expected: clean.
- [ ] **Step 3: Commit checkpoint (owner).** the component.

### Task 17: Admin route page + loading skeleton

**Files:**

- Create: `crewroster-web/app/admin/feedback/page.tsx`
- Create: `crewroster-web/app/admin/feedback/loading.tsx`

- [ ] **Step 1: Page (server shell, pre-fetches list):**

```tsx
import type { Metadata } from 'next';
import { listFeedback } from '@/features/admin/feedback/feedback.actions';
import AdminFeedbackConsole from '@/features/admin/feedback/AdminFeedbackConsole';

// /admin/feedback - read user feedback (message, mood, scope, photos, context)
// and set status. Guarded by AdminLayout (client) + IsAdminGuard (BE).
// Backed by admin/feedback (feedback-admin.controller.ts).
export const metadata: Metadata = { title: 'Feedback' };

export default async function AdminFeedbackPage() {
  const res = await listFeedback({ page: 1, limit: 20 });
  const initial = res.ok
    ? { items: res.data.items, total: res.data.total }
    : { items: [], total: 0 };
  return (
    <div>
      <header style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
          Feedback
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--cr-text-3)' }}>
          User feedback across the app — with photos, page and device context. Set status to track
          it.
        </p>
      </header>
      <AdminFeedbackConsole initial={initial} />
    </div>
  );
}
```

- [ ] **Step 2: Loading skeleton (binding rule; server-only, `aria-hidden`):**

```tsx
// Route skeleton for /admin/feedback. Mirrors header + filter row + table.
export default function Loading() {
  return (
    <div aria-hidden>
      <div style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <div
          className="skeleton"
          style={{ height: 26, width: 160, borderRadius: 6, marginBottom: 8 }}
        />
        <div className="skeleton" style={{ height: 16, width: 460, borderRadius: 6 }} />
      </div>
      <div
        className="skeleton"
        style={{ height: 36, width: 560, borderRadius: 8, marginBottom: 16 }}
      />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 44, width: '100%', borderRadius: 6, marginBottom: 8 }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit checkpoint (owner).** page + loading.

### Task 18: Admin nav entry

**Files:**

- Modify: `crewroster-web/components/layout/AdminLayout.tsx`

- [ ] **Step 1: Import an icon** in the icon import block (lines 6–23): add `CommentOutlined`.
- [ ] **Step 2: Add to the `NAV` array** (after `localization` or before `settings`):

```tsx
  { key: '/admin/feedback', icon: <CommentOutlined />, label: 'Feedback' },
```

- [ ] **Step 3: Add to `BREADCRUMB_MAP`:**

```tsx
  '/admin/feedback': 'Feedback',
```

- [ ] **Step 4: Type-check + lint.** `npx tsc --noEmit` && `npm run lint` — Expected: clean.
- [ ] **Step 5: Commit checkpoint (owner).** `AdminLayout.tsx`.

---

## PHASE 7 — Final verification

### Task 19: Full gates, both repos

- [ ] **Step 1: Backend** — Run (from backend root): `npm run build` && `npm run lint` && `npx vitest run src/modules/feedback src/modules/uploads/__tests__/upload-policies.generated.vitest.ts src/modules/uploads/__tests__/private-media.policy.vitest.ts`
      Expected: build clean, lint clean, all specs PASS.
- [ ] **Step 2: Web** — Run (from web root): `npx tsc --noEmit` && `npm run lint` && `npx vitest run components/ui/FeedbackPanel.test.tsx components/ui/FeedbackAttachments.test.tsx app/messages/locale-parity.vitest.ts lib/upload-policies.parity.vitest.ts`
      Expected: all clean / PASS.
- [ ] **Step 3: Banned-AntD self-check** (web changed files) — Run: `rg -n "<Drawer[^>]*width=|destroyOnClose|<Modal[^>]*visible=|<Drawer[^>]*visible=|overlayStyle=|popupStyle=" components/ui features/admin/feedback app/admin/feedback`
      Expected: zero matches.
- [ ] **Step 4: Manual smoke (owner / executor with the app running).**
  - Open any ERP page → click Feedback → panel opens (Popover desktop / Drawer mobile).
  - Quick path: tap a mood, type a line, Send → success toast; admin console shows the row with page + device context.
  - Add 2 photos + 1 screen capture (draw a blur box) → 3 tiles; a 4th is blocked with the limit toast.
  - Open the admin detail drawer → photos render via signed URLs (valid ~1h); set status → row updates.
  - Switch locale (gu/gu-en/hi-en) → all panel strings translate.
- [ ] **Step 5: Final commit checkpoint (owner).** Any remaining files. Confirm no `.skip`/TODO/stub introduced.

---

## Self-review (spec coverage)

- Photos ≤3 × 5 MB, private → Task 1 (category), Task 12 (FE cap), Task 3 (DTO cap + ref validation). ✓
- Quick-first panel + scope toggle + mood + category + message → Task 14. ✓
- Screen capture + blur → Task 11 (util) + Task 13 (modal). ✓
- Auto page/device context → Task 2 (schema) + Task 3 (DTO) + Task 14 (collection). ✓
- Admin console (none existed) with signed photos + status → Tasks 6, 16, 17, 18. ✓
- Full 4-locale i18n (was hardcoded English) → Task 15. ✓
- Store everything for future "my feedback" history → status field retained (Task 2), no user history page built (out of scope). ✓
- Analytics events → Task 14 (raw `track` strings) + Task 4 (server event). ✓
- ERP only → no Connect surface touched. ✓
- Loading skeleton for the new admin route → Task 17. ✓

## Notes / flags for the owner

- **Logical changes** (approved in principle, surfaced here): feedback schema additions + `rating` made optional; new admin detail endpoint; new private upload category; new `id` on the ERP content wrapper; new dependency `html-to-image`.
- **Env prerequisite:** `R2_PRIVATE_BUCKET_NAME` must be set (already is for chat/job files).
- **Translation review:** gu/gu-en/hi-en wording in Task 15 is best-effort — owner reviews (matches the standing translation-review owe).
- **Dual lockfile** (`package-lock.json` live, `pnpm-lock.yaml` stale) is a pre-existing cleanup, not part of this work.
- **Deferred hardening (documented):** attachment ownership is enforced via the DTO's category-pinned private-ref regex + random object keys + the private bucket. A stricter `MediaOwnershipService.assertOwnedMedia` check on submit (as Connect write paths do) can be added later; not required for v1.
