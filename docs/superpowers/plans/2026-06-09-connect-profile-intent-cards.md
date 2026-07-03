# Connect Profile - "Open to" Intent Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Connect profile's flat "open to" pills into rich, audience-scoped, actionable intent cards wired to Jobs / RFQ / Inquiry / Inbox, plus an avatar status ribbon, an "Open to" manage button, and a profile-views stat.

**Architecture:** Additive only on the backend - keep the four `openTo` booleans (search / feed-ranking / mobile read them unchanged) and add a parallel `openToDetails` field (detail + audience per intent). Extend the existing view-counter with a `profile` target type for the views stat, add one person-level public open-jobs read for the Hiring card, and trim `network`-scoped intents server-side in the public profile read. The web `ProfileView` (shared by `/connect/profile` and `/u/[slug]`) renders a new `IntentCards` block and an avatar ribbon; the edit modal's `openTo` section gains a detail input + audience select per intent.

**Tech Stack:** NestJS + Mongoose + class-validator + Vitest (backend); Next.js App Router + AntD v6 + Tailwind cr- tokens + next-intl + Vitest/RTL (web).

**Conventions (binding):**

- Backend: no `process.env` outside `src/config/env.ts`; every endpoint has `JwtAuthGuard`/`@Public()` + DTO + throttle; OTel span on reads, PostHog on writes; tests colocated `*.vitest.ts`; typecheck via `nest build` (NOT whole-project tsc); run module-scoped vitest with `--no-file-parallelism`.
- Web: every data route ships a matching `loading.tsx`; AntD v6 APIs only (no `visible=`, `overlay=`, `addonAfter=`, `destroyOnClose`, etc.); 4-locale parity (en/gu/gu-en/hi-en); no em-dash anywhere; short "what/links/gotchas" comment on every non-trivial block.
- **Zero git ops by assistant.** Owner stages + commits. The "Commit" steps below are written for the owner to run; the agent stages nothing.

---

## File Structure

**Backend (`crewroster-backend/src/modules/connect`)**

- Modify `profile/schemas/connect-profile.schema.ts` - add `ConnectOpenToDetail` + `ConnectOpenToDetails` sub-schemas and the `openToDetails` field.
- Modify `profile/dto/update-connect-profile.dto.ts` - add `OpenToDetailDto` + `OpenToDetailsDto`, wire optional `openToDetails`.
- Modify `profile/connect-profile.service.ts` - add `openToDetails` to `UPDATABLE_FIELDS`; add optional `viewerUserId` + audience trim to `getPublicByUserId`/`getPublicBySlug`; inject the network connection check.
- Modify `profile/connect-profile.controller.ts` - pass `req.user?.sub` into the public read.
- Modify `views/schemas/connect-view-daily.schema.ts` - add `'profile'` to `ConnectViewTargetType` + `CONNECT_VIEW_TARGET_TYPES`.
- Modify `views/services/connect-view.service.ts` - add `profileViewSummary(ownerUserId)`.
- Modify `views/controllers/connect-view.controller.ts` - add `GET connect/views/profile/summary`.
- Modify `jobs/jobs.service.ts` + `jobs/jobs.controller.ts` - add `listOpenJobsByUser(userId)` + `GET connect/jobs/by-user/:userId/open` (public).
- Tests: `profile/__tests__/connect-profile.service.vitest.ts` (extend), `views/__tests__/connect-view.service.vitest.ts` (extend), `jobs/__tests__/*` (extend or add).

**Web (`crewroster-web`)**

- Modify `features/connect/profile.types.ts` - `ConnectOpenToDetail`, `ConnectOpenToDetails`, add to `ConnectProfile`/`ConnectProfileBody`/`UpdateConnectProfileInput`.
- Modify `features/connect/profile.actions.ts` - `recordProfileView`, `getMyProfileViews`, `getPublicOpenJobs`.
- Modify `features/connect/profile/profile-edit-schema.ts` - `openToDetails` zod.
- Create `features/connect/profile/IntentCards.tsx` - the card block (owner + visitor + logged-out).
- Create `features/connect/profile/AvatarStatusRibbon.tsx` - the photo ribbon.
- Create `features/connect/profile/IntentCards.test.tsx`, `AvatarStatusRibbon.test.tsx`.
- Modify `features/connect/profile/ProfileView.tsx` - mount `IntentCards` + ribbon + views stat + manage button + edit-cover; add `profileViews`, `viewerIsConnection`, `openJobs` props.
- Modify `features/connect/profile/EditSectionModal.tsx` - `openTo` section: per-intent detail input + audience select.
- Modify `app/connect/profile/OwnProfileClient.tsx` + `app/connect/profile/page.tsx` - load own profile-views.
- Modify `app/(connect-public)/u/[slug]/page.tsx` - record a profile view + load that person's open jobs + pass `viewerIsConnection`.
- Modify `app/connect/profile/loading.tsx` + `app/(connect-public)/u/[slug]/loading.tsx` (create if missing) - add intent-card + views skeletons.
- Modify `app/messages/{en,gu,gu-en,hi-en}.json` - `connect.profile.intents.*`, `connect.profile.counts.profileViews`, edit-modal audience labels.

---

## Phase A - Backend (additive data + endpoints)

### Task A1: `openToDetails` schema

**Files:**

- Modify: `crewroster-backend/src/modules/connect/profile/schemas/connect-profile.schema.ts`
- Test: `crewroster-backend/src/modules/connect/profile/__tests__/connect-profile.schema.vitest.ts`

- [ ] **Step 1: Write the failing test** - append to the schema vitest:

```ts
it('defaults openToDetails to an empty object and accepts a detail entry', () => {
  const model = mongoose.model('ConnectProfileA1Test', ConnectProfileSchema);
  const doc = new model({ userId: new Types.ObjectId() });
  expect(doc.openToDetails).toEqual({});
  doc.set('openToDetails', { hiring: { detail: 'Aari karigars', audience: 'network' } });
  expect(doc.openToDetails.hiring?.detail).toBe('Aari karigars');
  expect(doc.openToDetails.hiring?.audience).toBe('network');
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd crewroster-backend && npx vitest run src/modules/connect/profile/__tests__/connect-profile.schema.vitest.ts --no-file-parallelism`
Expected: FAIL (`openToDetails` is undefined).

- [ ] **Step 3: Implement** - add above `ConnectOpenTo` (do NOT touch `ConnectOpenTo`):

```ts
/** Audience for a rich "open to" card. `all` = anyone; `network` = first-degree only. */
export const CONNECT_OPEN_TO_AUDIENCES = ['all', 'network'] as const;
export type ConnectOpenToAudience = (typeof CONNECT_OPEN_TO_AUDIENCES)[number];

/**
 * Rich detail for one "open to" intent. ADDITIVE companion to the `openTo`
 * booleans (which stay the on/off gate read by search + feed ranking). The
 * boolean turns the card on; this carries the card's blurb + who may see it.
 * Keep in sync with web `ConnectOpenToDetail` + the profile intent cards.
 */
@Schema({ _id: false })
export class ConnectOpenToDetail {
  @Prop({ type: String, trim: true, maxlength: 160 })
  detail?: string;

  @Prop({ type: String, enum: CONNECT_OPEN_TO_AUDIENCES, default: 'all' })
  audience: ConnectOpenToAudience;
}
export const ConnectOpenToDetailSchema = SchemaFactory.createForClass(ConnectOpenToDetail);

/** Per-intent rich details, keyed to the four `openTo` booleans. */
@Schema({ _id: false })
export class ConnectOpenToDetails {
  @Prop({ type: ConnectOpenToDetailSchema }) work?: ConnectOpenToDetail;
  @Prop({ type: ConnectOpenToDetailSchema }) hiring?: ConnectOpenToDetail;
  @Prop({ type: ConnectOpenToDetailSchema }) deals?: ConnectOpenToDetail;
  @Prop({ type: ConnectOpenToDetailSchema }) customOrders?: ConnectOpenToDetail;
}
export const ConnectOpenToDetailsSchema = SchemaFactory.createForClass(ConnectOpenToDetails);
```

Then add the field on `ConnectProfile` directly after the `openTo` `@Prop`:

```ts
/**
 * ADDITIVE rich data for the "open to" cards (detail + audience per intent).
 * The `openTo` booleans above stay the gate; this is empty `{}` for every
 * legacy document, so no migration is needed. Read by the profile intent cards.
 */
@Prop({ type: ConnectOpenToDetailsSchema, default: () => ({}) })
openToDetails: ConnectOpenToDetails;
```

- [ ] **Step 4: Run it, verify PASS** - same command as Step 2.

- [ ] **Step 5: Commit (owner)**

```bash
git add src/modules/connect/profile/schemas/connect-profile.schema.ts src/modules/connect/profile/__tests__/connect-profile.schema.vitest.ts
git commit -m "feat(connect): add additive openToDetails to ConnectProfile schema"
```

---

### Task A2: PATCH DTO + service field wiring

**Files:**

- Modify: `crewroster-backend/src/modules/connect/profile/dto/update-connect-profile.dto.ts`
- Modify: `crewroster-backend/src/modules/connect/profile/connect-profile.service.ts:28-40` (`UPDATABLE_FIELDS`)
- Test: `crewroster-backend/src/modules/connect/profile/__tests__/connect-profile.service.vitest.ts`

- [ ] **Step 1: Write the failing test** - append:

```ts
it('persists openToDetails on update', async () => {
  // (use the suite's existing service + in-memory model setup)
  const updated = await service.update(userId, {
    openTo: { hiring: true },
    openToDetails: { hiring: { detail: 'Multi-head operators', audience: 'all' } },
  } as any);
  expect(updated.openTo.hiring).toBe(true);
  expect(updated.openToDetails.hiring?.detail).toBe('Multi-head operators');
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd crewroster-backend && npx vitest run src/modules/connect/profile/__tests__/connect-profile.service.vitest.ts --no-file-parallelism`
Expected: FAIL (`openToDetails` not in `UPDATABLE_FIELDS`, dropped on update).

- [ ] **Step 3: Implement** - in the DTO, after `OpenToDto`:

```ts
import { IsIn } from 'class-validator'; // already imported; ensure present
import { CONNECT_OPEN_TO_AUDIENCES } from '../schemas/connect-profile.schema';

class OpenToDetailDto {
  @IsOptional() @IsString() @MaxLength(160) detail?: string;
  @IsOptional() @IsIn(CONNECT_OPEN_TO_AUDIENCES) audience?: string;
}
class OpenToDetailsDto {
  @IsOptional() @ValidateNested() @Type(() => OpenToDetailDto) work?: OpenToDetailDto;
  @IsOptional() @ValidateNested() @Type(() => OpenToDetailDto) hiring?: OpenToDetailDto;
  @IsOptional() @ValidateNested() @Type(() => OpenToDetailDto) deals?: OpenToDetailDto;
  @IsOptional() @ValidateNested() @Type(() => OpenToDetailDto) customOrders?: OpenToDetailDto;
}
```

Add to `UpdateConnectProfileDto`:

```ts
@IsOptional()
@ValidateNested()
@Type(() => OpenToDetailsDto)
openToDetails?: OpenToDetailsDto;
```

In `connect-profile.service.ts`, add `'openToDetails'` to the `UPDATABLE_FIELDS` array (after `'openTo'`). Leave `computeStrength` unchanged (details do not affect strength).

- [ ] **Step 4: Run it, verify PASS** - same command.

- [ ] **Step 5: Commit (owner)**

```bash
git add src/modules/connect/profile/dto/update-connect-profile.dto.ts src/modules/connect/profile/connect-profile.service.ts src/modules/connect/profile/__tests__/connect-profile.service.vitest.ts
git commit -m "feat(connect): accept openToDetails in profile PATCH"
```

---

### Task A3: views `profile` target type

**Files:**

- Modify: `crewroster-backend/src/modules/connect/views/schemas/connect-view-daily.schema.ts:8-9`

- [ ] **Step 1: Implement** (trivial enum widen - covered by A4's test):

```ts
export type ConnectViewTargetType = 'storefront' | 'listing' | 'profile';
export const CONNECT_VIEW_TARGET_TYPES: ConnectViewTargetType[] = [
  'storefront',
  'listing',
  'profile',
];
```

`RecordViewDto` already validates `targetType` against `CONNECT_VIEW_TARGET_TYPES`, so `'profile'` is now an accepted body value automatically.

- [ ] **Step 2: Commit (owner)** - fold into A4's commit.

---

### Task A4: profile-views summary read

**Files:**

- Modify: `crewroster-backend/src/modules/connect/views/services/connect-view.service.ts`
- Modify: `crewroster-backend/src/modules/connect/views/controllers/connect-view.controller.ts`
- Test: `crewroster-backend/src/modules/connect/views/__tests__/connect-view.service.vitest.ts`

- [ ] **Step 1: Write the failing test** - append:

```ts
it('profileViewSummary sums profile views for the owner', async () => {
  const owner = new Types.ObjectId().toString();
  await service.recordView(new Types.ObjectId().toString(), 'profile', owner);
  await service.recordView(new Types.ObjectId().toString(), 'profile', owner); // distinct viewer
  const summary = await service.profileViewSummary(owner);
  expect(summary.total).toBeGreaterThanOrEqual(2);
  expect(summary.views30d).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd crewroster-backend && npx vitest run src/modules/connect/views/__tests__/connect-view.service.vitest.ts --no-file-parallelism`
Expected: FAIL (`profileViewSummary` not a function).

- [ ] **Step 3: Implement** - add to `ConnectViewService` (reuses `utcDay`/`dayList`):

```ts
export interface ProfileViewSummary {
  views7d: number;
  views30d: number;
  total: number;
}

/**
 * Owner-scoped profile-view totals for the header stat. Profile views are
 * recorded with targetType 'profile' + targetId = the viewed person's User id
 * (see ConnectViewController.record from the public /u/[slug] page). 30d/7d come
 * from the daily rollup; `total` is the all-time sum for that profile.
 */
async profileViewSummary(ownerUserId: string): Promise<ProfileViewSummary> {
  const tId = new Types.ObjectId(ownerUserId);
  const today = new Date();
  const windowStart = dayList(today, 30)[0];
  const rows = await this.daily
    .find({ targetType: 'profile', targetId: tId, date: { $gte: windowStart } })
    .lean()
    .exec();
  const views30d = rows.reduce((s, r) => s + r.count, 0);
  const start7 = dayList(today, 7)[0];
  const views7d = rows.filter((r) => r.date >= start7).reduce((s, r) => s + r.count, 0);
  const allRows = await this.daily
    .find({ targetType: 'profile', targetId: tId })
    .select('count')
    .lean()
    .exec();
  const total = allRows.reduce((s, r) => s + r.count, 0);
  return { views7d, views30d, total };
}
```

Add the controller route (the viewer is always `req.user.sub`; summary is implicitly self-scoped - a user reads only their OWN profile's views):

```ts
/** The caller's own profile-view totals (header stat). */
@Get('profile/summary')
profileSummary(@Req() req: AuthedRequest) {
  return this.views.profileViewSummary(req.user.sub);
}
```

Self-view exclusion: the public page records the view with the SIGNED-IN viewer as `viewerUserId`; add a guard in the page action (Task B2/C5) to skip recording when `viewer === subject`. The dedupe key already prevents double counting per viewer/day.

- [ ] **Step 4: Run it, verify PASS** - same command.

- [ ] **Step 5: Commit (owner)**

```bash
git add src/modules/connect/views/schemas/connect-view-daily.schema.ts src/modules/connect/views/services/connect-view.service.ts src/modules/connect/views/controllers/connect-view.controller.ts src/modules/connect/views/__tests__/connect-view.service.vitest.ts
git commit -m "feat(connect): count profile views + owner summary"
```

---

### Task A5: audience trim in the public profile read

**Files:**

- Modify: `crewroster-backend/src/modules/connect/profile/connect-profile.service.ts`
- Modify: `crewroster-backend/src/modules/connect/profile/connect-profile.controller.ts`
- Test: `crewroster-backend/src/modules/connect/profile/__tests__/connect-profile.service.vitest.ts`

> Connection check: the network module exposes a connection lookup. During the task, confirm the exact provider/method via `query_graph` / grep in `src/modules/connect/network` (e.g. `ConnectionService.areConnected(a, b)`). Inject it `@Optional()` into `ConnectProfileService` (mirror the `@Optional() reviews` pattern) so unit tests construct without it; when absent, treat every viewer as NOT connected (safe default -> network cards hidden).

- [ ] **Step 1: Write the failing test** - append:

```ts
it('hides network-scoped intents from a non-connection in the public read', async () => {
  // seed a public profile with openTo.hiring=true, openToDetails.hiring.audience='network'
  // service constructed WITHOUT the connection provider => viewer treated as non-connection
  const pub = await service.getPublicByUserId(subjectHex, /* viewerUserId */ otherHex);
  expect(pub.openTo.hiring).toBe(false);
  expect(pub.openToDetails.hiring).toBeUndefined();
});

it('keeps all-scoped intents visible to anyone', async () => {
  // openTo.deals=true, audience 'all' (or no detail entry)
  const pub = await service.getPublicByUserId(subjectHex, otherHex);
  expect(pub.openTo.deals).toBe(true);
});
```

- [ ] **Step 2: Run it, verify FAIL** - `getPublicByUserId` does not accept a viewer arg / does not trim.

- [ ] **Step 3: Implement** - change the signature + add the trim helper:

```ts
async getPublicByUserId(
  userId: string,
  viewerUserId?: string,
): Promise<ConnectProfile & { verified: boolean; rating?: RatingAggregate }> {
  // ... existing lookup unchanged ...
  const trimmed = await this.trimByAudience(profile, userId, viewerUserId);
  const { verifiedBadge } = await this.allowances.getAllowances(userId);
  const rating = await this.reviews?.getAggregate(userId);
  return { ...trimmed, verified: verifiedBadge, ...(rating && rating.ratingCount > 0 ? { rating } : {}) };
}

async getPublicBySlug(slug: string, viewerUserId?: string) {
  const userId = await this.resolveSlugToUserId(slug);
  return this.getPublicByUserId(userId, viewerUserId);
}

/**
 * Suppress `network`-audience intents for a viewer who is not a first-degree
 * connection of the subject. Self + connections see everything. Mutates a copy
 * of the lean object: zeroes the boolean AND drops the detail so the response
 * never leaks a hidden intent. The owner's own screen uses /me/connect/profile
 * (untrimmed), so this only affects the public read.
 */
private async trimByAudience(
  profile: ConnectProfile,
  subjectUserId: string,
  viewerUserId?: string,
): Promise<ConnectProfile> {
  const isSelf = !!viewerUserId && viewerUserId === subjectUserId;
  const isConnection =
    isSelf ||
    (!!viewerUserId && (await this.connections?.areConnected(subjectUserId, viewerUserId)) === true);
  if (isConnection) return profile;
  const keys = ['work', 'hiring', 'deals', 'customOrders'] as const;
  const openTo = { ...(profile.openTo as Record<string, boolean>) };
  const details = { ...(profile.openToDetails as Record<string, { audience?: string }>) };
  for (const k of keys) {
    if (details[k]?.audience === 'network') {
      openTo[k] = false;
      delete details[k];
    }
  }
  return { ...profile, openTo, openToDetails: details } as ConnectProfile;
}
```

In `connect-profile.controller.ts`, pass the viewer id into the public read (the route is `@Public()` so `req.user` may be absent - pass `req.user?.sub`). Confirm the exact handler name/signature when editing; the change is `getPublicBySlug(slug)` -> `getPublicBySlug(slug, req.user?.sub)`.

- [ ] **Step 4: Run it, verify PASS** - same command.

- [ ] **Step 5: Commit (owner)**

```bash
git add src/modules/connect/profile/connect-profile.service.ts src/modules/connect/profile/connect-profile.controller.ts src/modules/connect/profile/__tests__/connect-profile.service.vitest.ts
git commit -m "feat(connect): trim network-scoped open-to intents in public profile read"
```

---

### Task A6: person-level public open-jobs read (Hiring card)

**Files:**

- Modify: `crewroster-backend/src/modules/connect/jobs/jobs.service.ts`
- Modify: `crewroster-backend/src/modules/connect/jobs/jobs.controller.ts`
- Test: `crewroster-backend/src/modules/connect/jobs/__tests__/jobs.service.vitest.ts` (create if absent)

- [ ] **Step 1: Write the failing test**:

```ts
it('listOpenJobsByUser returns only that user open jobs with applicant tally', async () => {
  const u = new Types.ObjectId();
  await jobModel.create({
    companyUserId: u,
    title: 'A',
    category: 'embroidery',
    status: 'open',
    applicationsCount: 3,
  });
  await jobModel.create({ companyUserId: u, title: 'B', category: 'embroidery', status: 'closed' });
  const res = await service.listOpenJobsByUser(u.toString());
  expect(res.count).toBe(1);
  expect(res.applicants).toBe(3);
  expect(res.jobs[0].title).toBe('A');
});
```

- [ ] **Step 2: Run it, verify FAIL** - method missing.

Run: `cd crewroster-backend && npx vitest run src/modules/connect/jobs/__tests__/jobs.service.vitest.ts --no-file-parallelism`

- [ ] **Step 3: Implement** - service method (match the file's existing query/return style; `Job` is `connect_jobs`):

```ts
/**
 * A person's OPEN jobs for their public profile Hiring card. Person-centric:
 * keyed on companyUserId (the owning User), status 'open' only, newest first.
 * Returns a small summary (count + total applicants) plus the job cards so the
 * profile can render "N roles, M applicants" and link to apply.
 */
async listOpenJobsByUser(userId: string): Promise<{ count: number; applicants: number; jobs: Job[] }> {
  const jobs = await this.jobModel
    .find({ companyUserId: new Types.ObjectId(userId), status: 'open' })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean<Job[]>()
    .exec();
  const applicants = jobs.reduce((s, j) => s + (j.applicationsCount ?? 0), 0);
  return { count: jobs.length, applicants, jobs };
}
```

Controller route - public (a logged-out visitor on `/u/[slug]` must see it). Use `@Public()` and a `@Throttle` tier consistent with the other public board reads in the file:

```ts
/** Public: a person open jobs for their profile Hiring card. */
@Public()
@Get('by-user/:userId/open')
openByUser(@Param('userId') userId: string) {
  return this.jobs.listOpenJobsByUser(userId);
}
```

Place it BEFORE the `@Get(':id')` route so `by-user` is not captured as an `:id`.

- [ ] **Step 4: Run it, verify PASS** - same command.

- [ ] **Step 5: Verify the whole backend compiles**

Run: `cd crewroster-backend && npm run build`
Expected: nest build succeeds (SWC typecheck, no OOM).

- [ ] **Step 6: Commit (owner)**

```bash
git add src/modules/connect/jobs/jobs.service.ts src/modules/connect/jobs/jobs.controller.ts src/modules/connect/jobs/__tests__/jobs.service.vitest.ts
git commit -m "feat(connect): public open-jobs-by-user read for profile hiring card"
```

---

## Phase B - Web data layer

### Task B1: web types

**Files:**

- Modify: `crewroster-web/features/connect/profile.types.ts`

- [ ] **Step 1: Implement** - add after `ConnectOpenTo`:

```ts
export type ConnectOpenToAudience = 'all' | 'network';

/** Rich detail for one "open to" intent (mirrors backend ConnectOpenToDetail). */
export interface ConnectOpenToDetail {
  detail?: string;
  audience: ConnectOpenToAudience;
}

/** Per-intent rich details, keyed to the openTo booleans. */
export interface ConnectOpenToDetails {
  work?: ConnectOpenToDetail;
  hiring?: ConnectOpenToDetail;
  deals?: ConnectOpenToDetail;
  customOrders?: ConnectOpenToDetail;
}
```

Add `openToDetails: ConnectOpenToDetails;` to `ConnectProfile` (after `openTo`) and `openToDetails?: ConnectOpenToDetails;` to `UpdateConnectProfileInput`. `ConnectProfileBody` derives from `ConnectProfile` so it picks the field up automatically.

Add the open-jobs summary shape:

```ts
/** A person open-jobs summary for the profile Hiring card (GET by-user/:id/open). */
export interface ProfileOpenJobs {
  count: number;
  applicants: number;
  jobs: { _id: string; title: string; role?: string | null }[];
}

/** Owner profile-view totals (GET connect/views/profile/summary). */
export interface ProfileViewSummary {
  views7d: number;
  views30d: number;
  total: number;
}
```

- [ ] **Step 2: Verify typecheck of the file**

Run: `cd crewroster-web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep profile.types || echo OK`
Expected: `OK` (no errors referencing the file).

- [ ] **Step 3: Commit (owner)**

```bash
git add features/connect/profile.types.ts
git commit -m "feat(connect-web): openToDetails + profile views/open-jobs types"
```

---

### Task B2: web server actions

**Files:**

- Modify: `crewroster-web/features/connect/profile.actions.ts`

- [ ] **Step 1: Implement** - append actions (follow the file's `ActionResult` + `serverHttp`/`unwrapServer` pattern):

```ts
import type { ProfileOpenJobs, ProfileViewSummary } from './profile.types';

/** Record a profile view (deduped per viewer/day server-side). Best-effort:
 *  callers ignore the result. Skips self-views at the call site. */
export async function recordProfileView(subjectUserId: string): Promise<void> {
  try {
    const http = await serverHttp();
    await http.post('/connect/views', { targetType: 'profile', targetId: subjectUserId });
  } catch {
    // non-fatal: a missed view must never break the page render
  }
}

/** The caller own profile-view totals for the header stat. */
export async function getMyProfileViews(): Promise<ActionResult<ProfileViewSummary>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/views/profile/summary');
    return { ok: true, data: unwrapServer<ProfileViewSummary>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** A person open jobs for the profile Hiring card (public). */
export async function getPublicOpenJobs(userId: string): Promise<ActionResult<ProfileOpenJobs>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/jobs/by-user/${encodeURIComponent(userId)}/open`);
    return { ok: true, data: unwrapServer<ProfileOpenJobs>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

- [ ] **Step 2: Commit (owner)**

```bash
git add features/connect/profile.actions.ts
git commit -m "feat(connect-web): profile-view + open-jobs server actions"
```

---

### Task B3: edit-schema for openToDetails

**Files:**

- Modify: `crewroster-web/features/connect/profile/profile-edit-schema.ts`
- Test: `crewroster-web/features/connect/profile/profile-edit-schema.test.ts`

- [ ] **Step 1: Write the failing test** - append:

```ts
it('accepts openToDetails with a 160-char detail and audience', () => {
  const r = connectProfileUpdateSchema.safeParse({
    openToDetails: { hiring: { detail: 'x'.repeat(160), audience: 'network' } },
  });
  expect(r.success).toBe(true);
});
it('rejects an over-long detail', () => {
  const r = connectProfileUpdateSchema.safeParse({
    openToDetails: { hiring: { detail: 'x'.repeat(161), audience: 'all' } },
  });
  expect(r.success).toBe(false);
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd crewroster-web && npx vitest run features/connect/profile/profile-edit-schema.test.ts`
Expected: FAIL (unknown key stripped or no validation).

- [ ] **Step 3: Implement** - add to the schema (match the file's zod import + style):

```ts
const openToDetailSchema = z.object({
  detail: z.string().trim().max(160).optional(),
  audience: z.enum(['all', 'network']).default('all'),
});
const openToDetailsSchema = z
  .object({
    work: openToDetailSchema.optional(),
    hiring: openToDetailSchema.optional(),
    deals: openToDetailSchema.optional(),
    customOrders: openToDetailSchema.optional(),
  })
  .optional();
```

Add `openToDetails: openToDetailsSchema` to the object passed to `connectProfileUpdateSchema`.

- [ ] **Step 4: Run it, verify PASS** - same command.

- [ ] **Step 5: Commit (owner)**

```bash
git add features/connect/profile/profile-edit-schema.ts features/connect/profile/profile-edit-schema.test.ts
git commit -m "feat(connect-web): validate openToDetails in profile edit schema"
```

---

## Phase C - Web UI

### Task C1: AvatarStatusRibbon

**Files:**

- Create: `crewroster-web/features/connect/profile/AvatarStatusRibbon.tsx`
- Create: `crewroster-web/features/connect/profile/AvatarStatusRibbon.test.tsx`

- [ ] **Step 1: Write the failing test**:

```tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import AvatarStatusRibbon from './AvatarStatusRibbon';

const msgs = {
  connect: { profile: { intents: { ribbon: { hiring: 'HIRING', work: 'OPEN TO WORK' } } } },
};
const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={msgs}>
      {ui}
    </NextIntlClientProvider>,
  );

it('shows the highest-priority active intent', () => {
  wrap(
    <AvatarStatusRibbon openTo={{ work: true, hiring: true, deals: false, customOrders: false }} />,
  );
  expect(screen.getByText('HIRING')).toBeInTheDocument(); // hiring outranks work
});
it('renders nothing when no intent is active', () => {
  const { container } = wrap(
    <AvatarStatusRibbon
      openTo={{ work: false, hiring: false, deals: false, customOrders: false }}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd crewroster-web && npx vitest run features/connect/profile/AvatarStatusRibbon.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**:

```tsx
'use client';

/**
 * AvatarStatusRibbon - a small status tag pinned to the profile photo (the
 * "HIRING" ribbon in the reference). Picks ONE intent by priority so the photo
 * never carries more than one badge. Reads only the openTo booleans; labels
 * live under connect.profile.intents.ribbon.*. Used by ProfileView header.
 */
import { useTranslations } from 'next-intl';
import type { ConnectOpenTo } from '../profile.types';

// hiring first: a workshop owner advertising roles is the highest-intent signal.
const PRIORITY: (keyof ConnectOpenTo)[] = ['hiring', 'work', 'customOrders', 'deals'];

export default function AvatarStatusRibbon({ openTo }: { openTo: ConnectOpenTo }) {
  const t = useTranslations('connect.profile.intents.ribbon');
  const active = PRIORITY.find((k) => openTo[k]);
  if (!active) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase"
      style={{
        padding: '2px 8px',
        borderRadius: 'var(--cr-radius-full)',
        background: 'var(--cr-primary)',
        color: '#ffffff',
      }}
    >
      {t(active)}
    </span>
  );
}
```

- [ ] **Step 4: Run it, verify PASS** - same command.

- [ ] **Step 5: Commit (owner)**

```bash
git add features/connect/profile/AvatarStatusRibbon.tsx features/connect/profile/AvatarStatusRibbon.test.tsx
git commit -m "feat(connect-web): avatar status ribbon"
```

---

### Task C2: IntentCards

**Files:**

- Create: `crewroster-web/features/connect/profile/IntentCards.tsx`
- Create: `crewroster-web/features/connect/profile/IntentCards.test.tsx`

Component contract:

```ts
interface IntentCardsProps {
  openTo: ConnectOpenTo;
  openToDetails: ConnectOpenToDetails;
  isOwner: boolean;
  /** Logged-in non-owner viewer? false for logged-out. Drives CTA routing. */
  isSignedIn?: boolean;
  /** Subject share token for CTA links (handle or id). */
  userId: string;
  /** Subject canonical User id for inbox/inquiry/quote targets. */
  subjectUserId?: string;
  /** Live hiring numbers for the Hiring card (from getPublicOpenJobs). */
  openJobs?: ProfileOpenJobs;
  /** Owner-only: open the openTo edit modal. */
  onEdit?: () => void;
}
```

Behavior:

- Render a card for each `key` where `openTo[key]` is true, in display order `hiring, customOrders, deals, work`.
- Card shows: icon + title (`intents.<key>.title`), the detail line from `openToDetails[key]?.detail` (or `intents.<key>.fallback`), and a CTA:
  - `hiring`: label `intents.hiring.cta` with `{count, applicants}` -> link `/connect/jobs?employer=<userId>` (visitor apply view) or `/connect/profile/jobs` style owner-manage. Use the existing jobs board employer filter param if present; otherwise link to `/u/<userId>` jobs. Owner CTA: `intents.manage` -> `onEdit`.
  - `customOrders`: `intents.customOrders.cta` ("Request a quote") -> `/connect/rfq/new?to=<subjectUserId>` (confirm the RFQ create route during the task; fall back to `/connect/rfq`).
  - `deals`: `intents.deals.cta` -> the person storefront/marketplace inquiry (link to `/u/<userId>` shop section or `/connect/marketplace?seller=<subjectUserId>`; confirm route).
  - `work`: `intents.work.cta` ("Message") -> inbox DM start (reuse the same target `ProfileConnectActions` uses; confirm helper). Owner sees rate-card hint -> `onEdit`.
- Owner: every active card shows a small audience hint (`intents.audience.<all|network>`) + a pencil that calls `onEdit`.
- Owner with NO active intents: a single dashed prompt (`intents.emptyOwner`) + a button calling `onEdit`.
- Logged-out / non-connection: cards already trimmed server-side; CTAs needing auth route through `/connect` (join) - gate with `isSignedIn`.

- [ ] **Step 1: Write the failing test** (representative cases):

```tsx
it('owner with no intents shows the add prompt', () => {
  // render with all openTo false, isOwner
  expect(screen.getByText(/add what you/i)).toBeInTheDocument();
});
it('hiring card shows roles + applicants and an apply CTA for a visitor', () => {
  // openTo.hiring true, openJobs={count:2,applicants:14}, isOwner=false, isSignedIn
  expect(screen.getByText(/2/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /apply|show roles/i })).toBeInTheDocument();
});
it('shows the detail blurb when present', () => {
  // openToDetails.hiring.detail = 'Aari karigars'
  expect(screen.getByText('Aari karigars')).toBeInTheDocument();
});
```

(Provide the `NextIntlClientProvider` wrapper with an `intents` message tree mirroring Task C6 keys.)

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd crewroster-web && npx vitest run features/connect/profile/IntentCards.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the component per the contract above. Use AntD-free primitives (divs + `DsButton`/`Link`) and cr- tokens, matching the existing card styling in `ProfileView.tsx` (`--cr-surface`, `--cr-border`, `--cr-radius-lg`). Icons from `lucide-react` (`Briefcase`, `Sparkles`, `Handshake`, `UserPlus`). Each card is a `<section>` with an `<h3>` title for a11y. Add the required "what/links/gotchas" header comment naming the Jobs / RFQ / inbox cross-links.

- [ ] **Step 4: Run it, verify PASS** - same command.

- [ ] **Step 5: Commit (owner)**

```bash
git add features/connect/profile/IntentCards.tsx features/connect/profile/IntentCards.test.tsx
git commit -m "feat(connect-web): rich open-to intent cards"
```

---

### Task C3: ProfileView integration

**Files:**

- Modify: `crewroster-web/features/connect/profile/ProfileView.tsx`
- Modify: `crewroster-web/features/connect/profile/ProfileView.test.tsx`

- [ ] **Step 1: Add props** to `ProfileViewProps`:

```ts
/** Owner profile-view total for the header stat (own screen only). */
profileViews?: number;
/** Live hiring numbers for the Hiring intent card. */
openJobs?: import('../profile.types').ProfileOpenJobs;
/** Logged-in non-owner viewer (drives CTA auth routing). Default false. */
isSignedIn?: boolean;
```

- [ ] **Step 2: Replace the open-to pill block** (lines ~577-609, the `activeOpenTo` block) with the `IntentCards` mount. Keep it in the header card body:

```tsx
<div className="mt-4">
  <IntentCards
    openTo={profile.openTo}
    openToDetails={profile.openToDetails}
    isOwner={isOwner}
    isSignedIn={isSignedIn}
    userId={userId}
    subjectUserId={subjectUserId}
    openJobs={openJobs}
    onEdit={() => onEdit?.('openTo')}
  />
</div>
```

Remove the now-dead `OPEN_TO_META` / `activeOpenTo` code.

- [ ] **Step 3: Add the avatar ribbon** - inside the avatar wrapper (the `-mt-12` span), overlay `<AvatarStatusRibbon openTo={profile.openTo} />` pinned bottom-center (absolute within a `relative` wrapper), matching the reference photo ribbon.

- [ ] **Step 4: Add the profile-views stat** - in the `stats` row (line ~525-536), append when `profileViews != null`:

```tsx
<span aria-hidden style={{ color: 'var(--cr-text-4)' }}>·</span>
<span>{t('counts.profileViews', { count: profileViews })}</span>
```

- [ ] **Step 5: Add the "Open to" manage button (owner)** - in the header action cluster, before Edit, when `isOwner`:

```tsx
<DsButton
  dsVariant="primary"
  dsSize="sm"
  icon={<Plus size={14} aria-hidden />}
  onClick={() => onEdit?.('openTo')}
>
  {t('intents.manageButton')}
</DsButton>
```

- [ ] **Step 6: Add "Edit cover" (owner)** - a small button overlaid top-right on the banner div (absolute), `onClick={() => onEdit?.('header')}`, label `t('edit.coverSection')`, only when `isOwner`. Wrap the banner div in a `relative` container.

- [ ] **Step 7: Update existing tests** in `ProfileView.test.tsx` that asserted on the old pills; assert on intent cards / ribbon instead. Add a test that `profileViews` renders in the stats row.

- [ ] **Step 8: Run the profile tests**

Run: `cd crewroster-web && npx vitest run features/connect/profile/ProfileView.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit (owner)**

```bash
git add features/connect/profile/ProfileView.tsx features/connect/profile/ProfileView.test.tsx
git commit -m "feat(connect-web): mount intent cards, ribbon, views stat, manage + edit-cover"
```

---

### Task C4: EditSectionModal openTo upgrade

**Files:**

- Modify: `crewroster-web/features/connect/profile/EditSectionModal.tsx`

- [ ] **Step 1: Implement** - replace `OpenToFields` so each of the four intents has: the enable `Switch` (existing), a detail `Input` (max 160, shown when enabled), and an audience `Select` (Everyone / My network). Field names use the `openToDetails` path:

```tsx
function OpenToFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('openTo.help')}
      </p>
      {OPEN_TO_KEYS.map((key) => (
        <div
          key={key}
          className="flex flex-col gap-2 p-3"
          style={{ border: '1px solid var(--cr-border)', borderRadius: 'var(--cr-radius-md)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
              {t(`openTo.${key}`)}
            </span>
            <Form.Item name={['openTo', key]} valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>
          <Form.Item name={['openToDetails', key, 'detail']} noStyle>
            <Input maxLength={160} showCount placeholder={t(`intents.${key}.detailPlaceholder`)} />
          </Form.Item>
          <Form.Item name={['openToDetails', key, 'audience']} noStyle initialValue="all">
            <Select
              options={[
                { value: 'all', label: t('intents.audience.all') },
                { value: 'network', label: t('intents.audience.network') },
              ]}
            />
          </Form.Item>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Seed initial values** - in `extractInitialValues`, `case 'openTo'` add:

```ts
openToDetails: {
  work: { detail: profile.openToDetails?.work?.detail ?? '', audience: profile.openToDetails?.work?.audience ?? 'all' },
  hiring: { detail: profile.openToDetails?.hiring?.detail ?? '', audience: profile.openToDetails?.hiring?.audience ?? 'all' },
  deals: { detail: profile.openToDetails?.deals?.detail ?? '', audience: profile.openToDetails?.deals?.audience ?? 'all' },
  customOrders: { detail: profile.openToDetails?.customOrders?.detail ?? '', audience: profile.openToDetails?.customOrders?.audience ?? 'all' },
},
```

- [ ] **Step 3: Build the payload** - in `buildSectionPayload`, `case 'openTo'` also return `openToDetails`, trimming empty details to `undefined` (keep audience):

```ts
const det =
  (values.openToDetails as Record<string, { detail?: string; audience?: string }> | undefined) ??
  {};
const pickDetail = (k: string) => ({
  detail: det[k]?.detail?.trim() || undefined,
  audience: (det[k]?.audience as 'all' | 'network') ?? 'all',
});
return {
  openTo: {
    work: !!open.work,
    hiring: !!open.hiring,
    deals: !!open.deals,
    customOrders: !!open.customOrders,
  },
  openToDetails: {
    work: pickDetail('work'),
    hiring: pickDetail('hiring'),
    deals: pickDetail('deals'),
    customOrders: pickDetail('customOrders'),
  },
};
```

- [ ] **Step 4: Typecheck**

Run: `cd crewroster-web && npx tsc --noEmit 2>&1 | grep EditSectionModal || echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit (owner)**

```bash
git add features/connect/profile/EditSectionModal.tsx
git commit -m "feat(connect-web): per-intent detail + audience in openTo editor"
```

---

### Task C5: wire data into the pages

**Files:**

- Modify: `crewroster-web/app/connect/profile/page.tsx` (load own views) + `OwnProfileClient.tsx` (pass `profileViews`).
- Modify: `crewroster-web/app/(connect-public)/u/[slug]/page.tsx` (record view + open jobs + viewer-connection).

- [ ] **Step 1: Own screen** - in `app/connect/profile/page.tsx`, add `getMyProfileViews()` to the server load and pass `profileViews` into `OwnProfileClient`; thread it to `ProfileView` (`profileViews={views?.total}`). For the owner, the Hiring card uses `listMyJobs()` summarized to `{count, applicants}` (reuse the existing action) or simply omit `openJobs` and show the manage CTA.

- [ ] **Step 2: Public screen** - in `app/(connect-public)/u/[slug]/page.tsx`:
  - After resolving `profile`, fire-and-forget `recordProfileView(profile.userId._id)` ONLY when a signed-in viewer exists and `viewer !== subject` (guard with the auth context available server-side; if the viewer id is not readily available server-side, record via a tiny client effect component instead - confirm during the task).
  - Add `getPublicOpenJobs(profile.userId._id)` to the `Promise.all`; pass the result as `openJobs`.
  - Pass `isSignedIn={!!relationship}` (relationship resolves only for a signed-in viewer) and let the server-trimmed `openTo`/`openToDetails` drive which cards show. `viewerIsConnection` is already reflected by the trim, so the visitor view needs no extra flag.

- [ ] **Step 3: Manual smoke (local)**

Run: `cd crewroster-web && npm run dev` then open `/connect/profile` and a public `/u/<handle>` in another account.
Expected: owner sees cards + manage + views count; visitor sees allowed cards with working CTAs; network-scoped cards hidden from a non-connection.

- [ ] **Step 4: Commit (owner)**

```bash
git add app/connect/profile/page.tsx app/connect/profile/OwnProfileClient.tsx "app/(connect-public)/u/[slug]/page.tsx"
git commit -m "feat(connect-web): wire profile views + open jobs into profile pages"
```

---

### Task C6: i18n (4 locales)

**Files:**

- Modify: `crewroster-web/app/messages/en.json`, `gu.json`, `gu-en.json`, `hi-en.json`

- [ ] **Step 1: Implement** - under `connect.profile`, add (English shown; translate the other three, no em-dash):

```json
"counts": { "profileViews": "{count, plural, one {# profile view} other {# profile views}}" },
"intents": {
  "manageButton": "Open to",
  "manage": "Manage",
  "emptyOwner": "Tell people what you are open to",
  "ribbon": { "hiring": "HIRING", "work": "OPEN TO WORK", "deals": "OPEN TO DEALS", "customOrders": "TAKING ORDERS" },
  "audience": { "all": "Everyone", "network": "My network only", "labelAll": "Visible to everyone", "labelNetwork": "Visible to your network" },
  "hiring": { "title": "Hiring", "fallback": "Hiring now", "cta": "Show roles and {applicants} applicants", "detailPlaceholder": "What roles, where" },
  "work": { "title": "Open to work", "fallback": "Open to work", "cta": "Message", "detailPlaceholder": "What work you want" },
  "deals": { "title": "Open to deals", "fallback": "Open to buy and sell", "cta": "Send inquiry", "detailPlaceholder": "What you trade" },
  "customOrders": { "title": "Open to job-work", "fallback": "Taking custom orders", "cta": "Request a quote", "detailPlaceholder": "What orders you take" }
}
```

Keep the existing `connect.profile.openTo.*` keys (the edit toggles + help still use them).

- [ ] **Step 2: Verify key parity across locales**

Run: `cd crewroster-web && node -e "for (const l of ['en','gu','gu-en','hi-en']) { const m=require('./app/messages/'+l+'.json'); if(!m.connect.profile.intents) throw new Error('missing intents in '+l); } console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit (owner)**

```bash
git add app/messages/en.json app/messages/gu.json app/messages/gu-en.json app/messages/hi-en.json
git commit -m "feat(connect-web): i18n for profile intent cards (4 locales)"
```

---

### Task C7: loading skeletons

**Files:**

- Modify: `crewroster-web/app/connect/profile/loading.tsx`
- Create/Modify: `crewroster-web/app/(connect-public)/u/[slug]/loading.tsx`

- [ ] **Step 1: Implement** - add an intent-card skeleton row (2-3 `SkeletonCard`s) and a views-stat `SkeletonLine` to each, mirroring the new header layout. Server-only, `aria-hidden`, compose `components/connect/Skeleton.tsx` primitives imported directly (not via the barrel). Reference: `app/connect/company/[slug]/loading.tsx`.

- [ ] **Step 2: Verify the route renders** - `npm run dev`, hard-refresh `/connect/profile`; the skeleton should match the loaded layout with no shift.

- [ ] **Step 3: Commit (owner)**

```bash
git add app/connect/profile/loading.tsx "app/(connect-public)/u/[slug]/loading.tsx"
git commit -m "feat(connect-web): loading skeletons for profile intent cards"
```

---

## Phase D - Full verification

### Task D1: backend

- [ ] **Step 1:** `cd crewroster-backend && npx vitest run src/modules/connect/profile src/modules/connect/views src/modules/connect/jobs --no-file-parallelism` - all PASS.
- [ ] **Step 2:** `cd crewroster-backend && npm run build` - nest build clean.

### Task D2: web

- [ ] **Step 1:** `cd crewroster-web && npx vitest run features/connect/profile` - all PASS.
- [ ] **Step 2:** `cd crewroster-web && npx tsc --noEmit` - clean on changed files.
- [ ] **Step 3:** lint changed files: `cd crewroster-web && npx eslint features/connect/profile app/connect/profile "app/(connect-public)/u/[slug]"` - no new errors; confirm zero banned AntD v6 forms in changed files (the rg self-check in the web CLAUDE.md).

### Task D3: owner smoke checklist (hand to owner)

- [ ] Owner profile: cards render, "Open to" manage button opens the editor, detail + audience save, views count shows.
- [ ] Avatar ribbon shows the top active intent.
- [ ] Visitor (connection vs non-connection vs logged-out): network-scoped cards hidden appropriately; Hiring card shows live roles + applicants and apply CTA; Request-a-quote opens RFQ; Message opens inbox.
- [ ] All four locales render the new copy.

---

## Self-Review

**Spec coverage:**

- §5 four intents + wiring -> C2 (cards), A6 (hiring data), CTAs to Jobs/RFQ/Inquiry/Inbox.
- §6 additive `openToDetails` -> A1/A2/B1/B3/C4.
- §7.1 profile views -> A3/A4/B2/C3/C5. §7.2 open-jobs read -> A6/B2. §7.3 no new flows -> CTAs are links.
- §8 components -> C1/C2/C3/C4; loading -> C7; empty/owner states -> C2.
- §9 visitor perspective -> A5 server trim + C2 `isSignedIn` routing.
- §10 i18n -> C6. §11 a11y -> C1/C2 (sections, headings, aria-label ribbon, labelled select). §12 testing -> tests in A1/A2/A4/A5/A6/B3/C1/C2/C3 + D.

**Placeholder scan:** Open routing details flagged for in-task confirmation (RFQ create route, marketplace seller param, inbox DM helper, network connection provider) are real lookups, not invented APIs - each names the concrete file to confirm against and a safe fallback. No "TODO"/"handle edge cases" filler.

**Type consistency:** `openToDetails` / `ConnectOpenToDetail.audience` / `ProfileOpenJobs{count,applicants,jobs}` / `ProfileViewSummary{views7d,views30d,total}` used identically across backend and web tasks. `listOpenJobsByUser` returns the same `{count,applicants,jobs}` shape the web `ProfileOpenJobs` expects.

**Known in-task confirmations (not owner decisions):** network connection-check provider name (A5); RFQ-create + marketplace-seller + inbox-DM route targets (C2); whether profile-view recording is server- or client-side on `/u/[slug]` (C5).
