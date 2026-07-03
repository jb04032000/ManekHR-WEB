# Username-slug URLs - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL - `superpowers:subagent-driven-development`
> (or `superpowers:executing-plans` for inline). Steps use checkbox (`- [ ]`).
>
> **Spec:** `docs/connect/specs/2026-05-20-username-slug-design.md` - owner-approved
> before this plan executes.
>
> **Git:** the owner runs ALL git commits. "Checkpoint" = a commit point;
> assistant runs no `git`.

**Goal:** Every Connect-enabled User gets a unique, human-readable URL slug
("handle"). Public profile URLs become `/u/<handle>`. Old ObjectId URLs keep
working via a dual-resolver. Users edit their handle from `/account/profile`.

**Architecture:** New `User.handle` field with a unique case-insensitive
sparse index. Auto-generated from `name` at signup via slugify + collision
suffix. Backend `me-profile` controller exposes availability + claim
endpoints. Web `/u/[slug]` route resolves handle first, ObjectId fallback.
One-time backfill migration generates handles for every existing User.

**Tech Stack:** NestJS, Mongoose (collation index), Next.js 16 (App Router),
AntD v6, next-intl, vitest. Backend `.worktrees/crewroster-backend/zari360-connect`;
web `.worktrees/crewroster-web/zari360-connect`.

**Verification per task:** backend - `eslint` on changed files + `vitest run
src/modules/users --no-file-parallelism`; do NOT run full `tsc` (OOMs); use
`npx nest build` (SWC) for type-check. Web - `npx tsc --noEmit`, `npx eslint`
on touched, `node scripts/check-i18n.js`, `npm run build`.

---

## File structure

**Backend** (`.worktrees/crewroster-backend/zari360-connect`)

| File                                                               | Change                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/users/schemas/user.schema.ts`                         | Add `handle?: string \| null`, `handleChangedAt?: Date \| null`. Add schema-level case-insensitive unique sparse index.                                                                                                  |
| `src/modules/users/utils/handle.util.ts`                           | **New** - `slugifyName`, `RESERVED_HANDLES`, `HANDLE_FORMAT_RE`, `HANDLE_MIN_LEN`, `HANDLE_MAX_LEN`, `validateHandleFormat(value): \| { ok: true } \| { ok: false; reason: 'format' \| 'reserved' }`.                    |
| `src/modules/users/users.service.ts`                               | New methods: `isHandleAvailable(value, excludeUserId?)`, `generateHandleForUser(userId)` (idempotent - no-op if user already has one), `claimHandle(userId, value)` (validates + collation-aware uniqueness + cooldown). |
| `src/modules/users/dto/claim-handle.dto.ts`                        | **New** - `class-validator` body validator (string, lowercased, format regex).                                                                                                                                           |
| `src/modules/users/me-profile.controller.ts`                       | **New** - `GET /me/profile/handle/available?value=`, `PATCH /me/profile/handle`. Both `JwtAuthGuard`.                                                                                                                    |
| `src/modules/connect/profile/connect-profile-public.controller.ts` | Add `GET /connect/profiles/by-handle/:handle` (`@Public`). Mirrors the existing `getByUserId` payload shape.                                                                                                             |
| `src/modules/users/users.module.ts`                                | Register `MeProfileController`.                                                                                                                                                                                          |
| `src/modules/auth/auth.service.ts`                                 | After `User` creation in `register` + `verifyOtp` (mobile + email), call `generateHandleForUser(user._id)`. Best-effort: a failed handle generation does NOT block signup (the user can set one later from settings).    |
| `src/modules/users/__tests__/users.service.handle.vitest.ts`       | **New** - covers `slugifyName`, `validateHandleFormat`, `isHandleAvailable`, `claimHandle` (rate-limit, format reject, reserved reject, taken reject, success).                                                          |
| `scripts/migrate-connect-handles.ts` (backend)                     | **New** - one-time backfill. Reads every User with `handle == null && name`. Builds candidate via slugify + collision suffix loop. Marker doc in `migrations` collection prevents concurrent runs.                       |

**Web** (`.worktrees/crewroster-web/zari360-connect`)

| File                                       | Change                                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/index.ts`                           | `User.handle?: string \| null`, `User.handleChangedAt?: string \| null`.                                                                                                         |
| `features/connect/profile.types.ts`        | The populated public-profile User type gains `handle?: string \| null` so the page renders canonical URLs.                                                                       |
| `features/connect/profile.actions.ts`      | `getPublicConnectProfileBySlug(slug)` - tries handle endpoint, falls back to ObjectId. `claimHandle(value)`, `checkHandleAvailable(value)`.                                      |
| `app/(connect-public)/u/[userId]/page.tsx` | Rename dir to `app/(connect-public)/u/[slug]/page.tsx`; resolver tries handle first; emit `<link rel="canonical">` when the slug was an ObjectId but resolved user has a handle. |
| `features/connect/profile/ProfileView.tsx` | `shareUrl` prefers `profile.handle`, falls back to `userId` (no breaking change while users without a handle exist). Pass `handle?` prop.                                        |
| `app/account/profile/page.tsx`             | Already exists - add the "Profile URL" section (input + live availability + Save).                                                                                               |
| `components/account/HandleEditor.tsx`      | **New** - client component for the editor card, debounced availability check, format / reserved / taken inline errors, cooldown info, save handler.                              |
| `app/messages/{en,gu,gu-en,hi-en}.json`    | New `connect.profile.handle.*` keys (label, description, format, cooldown, cooldownActive, available, unavailable.\*, saved, saveFailed).                                        |
| `lib/api/endpoints.ts`                     | Add `handleAvailable: 'me/profile/handle/available'`, `handleClaim: 'me/profile/handle'`, `profilesByHandle: 'connect/profiles/by-handle'`.                                      |

---

## Task 1: Backend - schema + handle utility + format validator

**Files:** `user.schema.ts`, `utils/handle.util.ts`

- [ ] **Step 1: Schema field + index**

In `user.schema.ts`, add (near the other identity fields):

```ts
/**
 * Public profile slug - the human-readable identifier in `/u/<handle>`.
 * Lowercase 3–30 chars `[a-z0-9-]`. Auto-generated at signup; user-editable
 * from /account/profile (cooldown 30 days). `null` for pre-backfill or
 * placeholder users - the `/u/[slug]` resolver falls back to ObjectId.
 */
@Prop({ type: String, default: null })
handle?: string | null;

/**
 * When `handle` was last claimed by this user. Used to enforce the
 * 30-day cooldown on changes; null on auto-generated handles.
 */
@Prop({ type: Date, default: null })
handleChangedAt?: Date | null;
```

At the bottom of the file (after `SchemaFactory.createForClass`):

```ts
UserSchema.index(
  { handle: 1 },
  { unique: true, sparse: true, collation: { locale: 'en', strength: 2 } },
);
```

- [ ] **Step 2: handle.util.ts**

New file `src/modules/users/utils/handle.util.ts` exporting:

- `HANDLE_FORMAT_RE = /^[a-z](?:[a-z0-9]|-(?!-))*[a-z0-9]$/`
- `HANDLE_MIN_LEN = 3` · `HANDLE_MAX_LEN = 30`
- `RESERVED_HANDLES = new Set(['admin','api','connect','dashboard','account','auth','me','u','system','feed','network','marketplace','jobs','companies','inbox','notifications','profile','settings','search','onboarding','support','help','about','privacy','terms'])`
- `slugifyName(name: string): string` - lowercases, replaces non-`[a-z0-9]` runs with `-`, trims leading/trailing `-`, collapses `--` to `-`, ASCII-folds (use `name.normalize('NFKD')` + strip combining marks)
- `validateHandleFormat(value: string)` returning `{ ok: true } | { ok: false; reason: 'format' | 'reserved' }`

- [ ] **Step 3: Test the util**

`src/modules/users/__tests__/users.service.handle.vitest.ts` - start with util-level cases:

- `slugifyName('Jayesh Bambhaniya') === 'jayesh-bambhaniya'`
- `slugifyName('Meera Patel - Karigar') === 'meera-patel-karigar'`
- `slugifyName('   spaces   ') === 'spaces'`
- `validateHandleFormat('ab') → { ok: false, reason: 'format' }` (too short)
- `validateHandleFormat('admin') → { ok: false, reason: 'reserved' }`
- `validateHandleFormat('jayesh-bambhaniya') → { ok: true }`
- `validateHandleFormat('-jayesh') → { ok: false, reason: 'format' }` (leading hyphen)

Run: `pnpm exec vitest run src/modules/users --no-file-parallelism`.

- [ ] **Step 4: Checkpoint** - owner commits: `feat(users): handle field + slugify + format validator`

---

## Task 2: Backend - service methods (isAvailable / generate / claim)

**Files:** `users.service.ts`

- [ ] **Step 1: `isHandleAvailable`**

```ts
async isHandleAvailable(
  value: string,
  excludeUserId?: string,
): Promise<{ available: true } | { available: false; reason: 'format' | 'reserved' | 'taken' }> {
  const fmt = validateHandleFormat(value);
  if (!fmt.ok) return { available: false, reason: fmt.reason };
  const filter: FilterQuery<User> = { handle: value };
  if (excludeUserId) filter._id = { $ne: new Types.ObjectId(excludeUserId) };
  const taken = await this.userModel
    .findOne(filter)
    .collation({ locale: 'en', strength: 2 })
    .lean<{ _id: Types.ObjectId }>()
    .exec();
  return taken ? { available: false, reason: 'taken' } : { available: true };
}
```

- [ ] **Step 2: `generateHandleForUser` (idempotent)**

Called from `auth.service.register` + verifyOtp after the User row exists.
No-ops if `user.handle` is already set. Otherwise: slugifyName → reserved
→ collision loop → save. Catches duplicate-key (E11000) on save and retries
with an incremented suffix (defensive against a race between two near-
simultaneous signups landing the same handle in the window between the
loop's availability check and the save).

- [ ] **Step 3: `claimHandle` (user-initiated change)**

Validates format → checks `excludeSelf` availability → enforces cooldown
(30 days since `handleChangedAt`) → saves with E11000 retry → returns
`{ handle, handleChangedAt }`. Throws `BadRequestException` on format / reserved,
`ConflictException` on taken, `ForbiddenException` on cooldown.

- [ ] **Step 4: Tests** - extend `users.service.handle.vitest.ts`:
- `isHandleAvailable` happy path
- `isHandleAvailable` returns `taken` for an existing collation-equal handle
- `generateHandleForUser` is no-op when user already has a handle
- `generateHandleForUser` appends `-2` on first collision
- `claimHandle` rejects on cooldown
- `claimHandle` rejects on reserved
- `claimHandle` succeeds + stamps `handleChangedAt`

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run src/modules/users --no-file-parallelism` - expect green.
Run: `npx nest build` - type-check the module compiles.

- [ ] **Step 6: Checkpoint** - owner commits: `feat(users): handle availability + generate + claim`

---

## Task 3: Backend - endpoints + module wiring

**Files:** `me-profile.controller.ts` (new), `dto/claim-handle.dto.ts` (new),
`users.module.ts`, `connect-profile-public.controller.ts`

- [ ] **Step 1: DTO** - `ClaimHandleDto` with class-validator (`@IsString`,
      `@Matches(HANDLE_FORMAT_RE)`, `@MinLength(3)`, `@MaxLength(30)`).

- [ ] **Step 2: `MeProfileController`** - `GET .../handle/available`,
      `PATCH .../handle`. PostHog event on successful claim
      (`profile.handle_claimed`).

- [ ] **Step 3: Public lookup** - extend `connect-profile-public.controller.ts`
      with `GET /connect/profiles/by-handle/:handle` - `@Public`, returns the same
      payload shape as `getByUserId` (populated User + profile + erp-link).

- [ ] **Step 4: Register the controller** in `users.module.ts`.

- [ ] **Step 5: Verify** - `pnpm exec eslint` on touched + `pnpm exec vitest
run src/modules/users` + `npx nest build`.

- [ ] **Step 6: Checkpoint** - owner commits: `feat(users): /me/profile/handle endpoints`

---

## Task 4: Backend - auth-flow integration

**Files:** `auth.service.ts`

- [ ] **Step 1:** After each User creation site (web combined-signup
      `register`, SMS-OTP `verifyOtp` first creation, email-OTP `register`-via-OTP),
      call `usersService.generateHandleForUser(user._id)`. Wrap in a `try/catch`
      that logs but does not throw - handle generation failure must NOT block
      signup (the user can set one later from settings).

- [ ] **Step 2: Test** - add a vitest case asserting
      `generateHandleForUser` is called once per new-user signup path.

- [ ] **Step 3: Verify** - `pnpm exec vitest run src/modules/auth` (any
      affected suites green).

- [ ] **Step 4: Checkpoint** - owner commits: `feat(auth): generate handle on signup`

---

## Task 5: Backend - backfill migration script

**Files:** `scripts/migrate-connect-handles.ts`, `package.json` (web - the
script lives in web for runner-convention parity; it imports the backend's
mongoose models via a fresh connection)

Actually re-decide: lives in the **backend** worktree (it talks to Mongo
directly with the backend's Mongoose models). Path:
`crewroster-backend/.../scripts/migrate-connect-handles.ts` + a `pnpm
migrate:connect-handles` script.

- [ ] **Step 1:** Single-process marker doc on a `migrations` collection.
      Insert `{ name: 'connect-handles', startedAt }` with a unique index on `name` - if already exists, the script exits with "already running / completed."
      Cleared by a `--reset` flag for re-runs in dev.

- [ ] **Step 2:** Iterate `User.find({ handle: null, name: { $ne: '' } })`
      in a cursor. For each:
- Build base via `slugifyName(user.name)`.
- If `< 3 chars`, append `-u<last4 of _id>`.
- Truncate base to leave room for `-NN` suffix.
- Loop with attempt = 1: if `isHandleAvailable(candidate)` → save → break;
  else `attempt++; candidate = base + '-' + attempt`.
- Save without setting `handleChangedAt` (this is auto-generation, not a
  user change → no cooldown applies).

- [ ] **Step 3:** Log a count summary at end: `seen / handled / skipped`.

- [ ] **Step 4: Dry-run flag** - `--dry-run` prints the candidate handles
      without saving. Default to dry-run; require `--commit` to actually write.

- [ ] **Step 5: Verify** - manual dev run with the `seed:connect` users
      present. Count matches expectation. Re-run is a no-op.

- [ ] **Step 6: Checkpoint** - owner commits: `chore(users): backfill migration for handles`

---

## Task 6: Web - type + actions + endpoint constants

**Files:** `types/index.ts`, `features/connect/profile.types.ts`,
`features/connect/profile.actions.ts`, `lib/api/endpoints.ts`

- [ ] **Step 1:** Type additions (`handle?: string | null`,
      `handleChangedAt?: string | null`).

- [ ] **Step 2:** Endpoint constants under `auth` or a new `me.profile`
      namespace (whichever the codebase prefers - match existing pattern).

- [ ] **Step 3:** Actions -
- `getPublicConnectProfileBySlug(slug)` - tries `/connect/profiles/by-handle/<slug>`
  first; on 404 falls back to ObjectId path (if `slug` matches `/^[a-f0-9]{24}$/`).
- `checkHandleAvailable(value)` - debounced caller's responsibility; this
  action just hits the endpoint and returns `{available, reason?}`.
- `claimHandle(value)` - posts to PATCH endpoint.

- [ ] **Step 4: Verify** - `npx tsc --noEmit`, `npx eslint` on touched.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(connect): handle types + server actions`

---

## Task 7: Web - public profile resolver + canonical URL

**Files:** `app/(connect-public)/u/[userId]/page.tsx` → rename to
`app/(connect-public)/u/[slug]/page.tsx`

- [ ] **Step 1:** Rename the dynamic segment + update the prop type
      (`params: Promise<{ slug: string }>`).

- [ ] **Step 2:** Replace `loadProfile(userId)` with
      `loadProfile(slug)` calling the dual-resolver `getPublicConnectProfileBySlug`.

- [ ] **Step 3:** `<link rel="canonical">` - emit when the requested slug was
      the ObjectId form but the resolved user has a handle:

```tsx
{
  wasObjectId && profile.userId.handle && (
    <link rel="canonical" href={`/u/${profile.userId.handle}`} />
  );
}
```

(Inside `generateMetadata` returning the `alternates.canonical` URL is the
Next.js idiomatic path - use that, not a raw `<link>` in the body.)

- [ ] **Step 4: Verify** - manual: an ObjectId URL still renders + sets
      canonical; a handle URL renders; bogus slug → 404.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(connect): /u/[slug] dual-resolver + canonical`

---

## Task 8: Web - `/account/profile` Handle editor

**Files:** `app/account/profile/page.tsx`, `components/account/HandleEditor.tsx`
(new)

- [ ] **Step 1:** New `HandleEditor.tsx` - client component, AntD `Input`
      prefix-styled with the host (`zari360.app/u/`), debounced availability check
      (200ms), inline error/success affordances, Save button gated on
      `isValid && isAvailable && !cooldownActive`.

- [ ] **Step 2:** Render the editor inside the profile-settings page.

- [ ] **Step 3:** On successful save, optimistically update the auth-store
      user (`updateUser({ handle, handleChangedAt })`) so the share URL flips
      immediately.

- [ ] **Step 4: Verify** - `npx tsc --noEmit`, `npx eslint`, `npm run build`.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(account): profile-URL editor`

---

## Task 9: Web - ProfileView share-URL upgrade

**Files:** `features/connect/profile/ProfileView.tsx`,
`app/connect/profile/OwnProfileClient.tsx`, `app/(connect-public)/u/[slug]/page.tsx`

- [ ] **Step 1:** Add a `handle?: string | null` prop to `ProfileViewProps`.

- [ ] **Step 2:** In `ProfileView`, `shareUrl` becomes
      `${origin}/u/${handle ?? userId}` - the handle wins when present, ObjectId
      fallback for pre-backfill / placeholder users.

- [ ] **Step 3:** Callers pass `handle`:
- `OwnProfileClient` - from auth store `user.handle`.
- Public profile page - from `profile.userId.handle`.

- [ ] **Step 4: Verify** - share menu now copies / emails / WhatsApp's the
      slug URL.

- [ ] **Step 5: Checkpoint** - owner commits: `feat(connect): share URL prefers handle`

---

## Task 10: i18n + full verification

**Files:** `app/messages/{en,gu,gu-en,hi-en}.json`

- [ ] **Step 1:** Add `connect.profile.handle.*` keys per the spec's i18n
      section. Real translations per locale - `en` / `gu` (native) / `gu-en`
      (romanized) / `hi-en` (romanized). No em-dashes (Connect Standard #18).

- [ ] **Step 2: Full-wave verification**
- `npx tsc --noEmit` - 0 errors
- `npx eslint <touched files>` - 0 errors
- `node scripts/check-i18n.js` - 4-locale parity intact
- `npm run build` - passes
- Manual smoke: signup creates a handle, share URL uses it, ObjectId URL
  redirects-via-canonical to the handle URL, an existing user post-backfill
  sees their handle on the settings page.

- [ ] **Step 3: Checkpoint** - owner commits: `chore(connect): handle-feature i18n + verify`

---

## Self-review (completed during planning)

- **Spec coverage:** every spec item maps to a task - schema (T1), util (T1),
  service (T2), endpoints (T3), auth integration (T4), backfill (T5),
  web type/action (T6), resolver (T7), settings editor (T8), share URL (T9),
  i18n (T10).
- **Placeholders:** none - exact code shapes for the schema, util, service
  signatures, endpoint paths, resolver branching, share-URL fallback, i18n
  key names.
- **Type consistency:** `User.handle` (backend) ↔ `User.handle` (web type) ↔
  `ConnectProfile.handle` populated field ↔ `ProfileView` prop ↔ `shareUrl`
  builder. Stays `string | null` the whole way.
- **No breaking changes:** ObjectId URLs continue resolving forever (dual
  resolver). Old `/u/[userId]` external links don't 404.

---

## Out of scope (deferred)

- Reserved-handle list admin UI (the static list lives in code; expansion is
  a separate admin-panel pass).
- Handle history / vanity domains.
- Public profile slug for `CompanyPage` / `Storefront` (Phase 6 / 4 - these
  entities will get their own `slug` field via similar but independent
  modules).
