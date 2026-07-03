# Username-slug URLs for Connect Profiles - Design Spec

> **Status:** Draft for owner review · 2026-05-20
> **Scope:** Logical change (per ENGINEERING-STANDARDS #13) - User schema gains
> a new field with a unique index, existing users get a one-time backfill.
> Surfaced for explicit owner approval before implementation.

---

## Problem

Today the public Connect profile URL is `/u/<ObjectId>` - e.g.
`/u/6a0abe3486227747be0860cc`. Three real costs:

1. **Not shareable.** A 24-character hex string reads as machine noise. Owners
   sharing their profile (in DMs, on a business card, in WhatsApp status)
   expect a human-readable link - the LinkedIn / GitHub norm
   (`linkedin.com/in/jayesh-bambhaniya`).
2. **Not memorable.** A user typing their own URL into a browser, or quoting
   it verbally, has no chance against an ObjectId.
3. **Leaks the internal id shape.** ObjectIds expose the database choice +
   approximate document age (the first 4 bytes encode a timestamp). Not a
   security issue, but a leak of internal model.

**Fix:** every Connect-enabled User gets a unique URL slug (a "handle") that
the public profile resolves under. ObjectId URLs keep working as a fallback
(no migration of external links).

---

## Decisions locked

| #   | Decision                    | Choice                                                                                                                                                                    |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Where does the handle live? | `User.handle` (canonical identity field, alongside `name` / `email` / `mobile`). NOT on `ConnectProfile` (the body type) - handles are identity, not Connect-specific.    |
| 2   | Format                      | `[a-z0-9-]{3,30}`, lowercase, must start with a letter, hyphens allowed but never leading / trailing / doubled.                                                           |
| 3   | Uniqueness                  | Unique sparse index, **case-insensitive** (collation `{locale:'en', strength:2}`).                                                                                        |
| 4   | Auto-generation at signup   | Yes. Derive from `name` (slugify Latin + transliterate Gujarati/Hindi via existing lib) + collision-suffix loop (`jayesh`, `jayesh-2`, `jayesh-3`, …).                    |
| 5   | User-editable               | Yes. From `/account/profile` settings. Each successful change shifts the canonical URL but the previous ObjectId URL still resolves. Rate-limited (1 change per 30 days). |
| 6   | Reserved handles            | Yes. Static deny-list: `admin`, `api`, `connect`, `dashboard`, `account`, `auth`, `me`, `u`, `system`, plus the existing Connect module names.                            |
| 7   | Resolver                    | `/u/[slug]` tries handle (case-insensitive lookup) first, falls back to ObjectId. If neither matches → `notFound()`.                                                      |
| 8   | Canonical URL               | The handle URL is canonical. The ObjectId URL renders the same content but emits `<link rel="canonical" href="/u/<handle>">` so search engines consolidate.               |
| 9   | Backfill                    | One-time migration script, idempotent, runs from `pnpm migrate:connect-handles`. Generates handles for every existing User from `name`.                                   |
| 10  | Anonymous / no-name users   | Skip during backfill. They get a handle the first time they edit their profile name + at signup (forward-only).                                                           |

---

## Schema

### Backend - `User`

```ts
@Schema({ timestamps: true })
class User {
  // ── existing fields ──────────────────────────────────────────────
  // name, email, mobile, profilePicture, hasWorkspace, connectEnabled, …

  /**
   * Public profile slug - the human-readable identifier in the canonical
   * profile URL (`/u/<handle>`). Lowercase, 3–30 chars, `[a-z0-9-]` only.
   * Unique case-insensitively (Mongo collation `strength: 2`). Auto-generated
   * from `name` at signup; user-editable from /account/profile.
   *
   * Nullable - pre-backfill rows / placeholder users with no name may not
   * have one yet. Resolution falls back to the ObjectId URL in that case.
   */
  @Prop({ type: String, default: null })
  handle?: string | null;
}
```

Schema-level index (added once):

```ts
UserSchema.index(
  { handle: 1 },
  { unique: true, sparse: true, collation: { locale: 'en', strength: 2 } },
);
```

### Validation rules

Format regex: `/^[a-z](?:[a-z0-9]|-(?!-))*[a-z0-9]$/` (length 3–30 enforced
separately so the regex stays readable). Reads as:

- starts with a letter
- one or more body chars
- ends with letter / digit
- internal hyphens allowed, never consecutive

---

## Resolution rules

`/u/[slug]` server component:

1. If `slug` is exactly 24 hex chars **and** matches `ObjectId.isValid` →
   treat as ObjectId, look up by `_id`. Emit `<link rel="canonical"
href="/u/<handle>">` when the resolved user has a handle.
2. Otherwise → look up `findOne({ handle: slug })` with the case-insensitive
   collation. If found → render. The URL is already canonical (handles are
   stored lowercase).
3. Neither match → `notFound()`.

This dual path means **every external link that ever pointed at an ObjectId
URL keeps working** - handles are an additive surface, not a breaking change.

---

## Backfill migration

Script: `scripts/migrate-connect-handles.ts` (web worktree) - runnable via
`pnpm migrate:connect-handles`.

Algorithm:

```
for user in users where handle is null and name is not empty:
  base = slugify(user.name)           // 'Jayesh Bambhaniya' → 'jayesh-bambhaniya'
  if base.length < 3: base = base + '-' + user._id.toString().slice(-4)
  base = base.slice(0, 30 - 5)        // reserve room for the suffix
  if base in RESERVED: base = base + '-u'
  candidate = base
  attempt = 1
  loop:
    if no user matches (case-insensitive) candidate → claim it, break
    attempt += 1
    candidate = base + '-' + attempt
  user.handle = candidate
  user.save()
```

Idempotent: runs only on users where `handle` is null. Re-running is safe.
Single-process: lock acquired via a small marker doc (`migrations` collection)
so two devs running the script simultaneously don't collide.

---

## Endpoints

| Method  | Path                                        | Purpose                                                                                                                                                                                                                                               |
| ------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/me/profile/handle/available?value=<slug>` | Live availability check for the settings form. Returns `{ available: boolean, reason?: 'format'\|'reserved'\|'taken' }`.                                                                                                                              |
| `PATCH` | `/me/profile/handle`                        | Claim a new handle for the caller. Body: `{ handle: string }`. Validates format + reserved + uniqueness, rate-limits to **1 per 30 days** per user (`User.handleChangedAt` tracks the last successful change). Returns `{ handle, handleChangedAt }`. |
| `GET`   | `/connect/profiles/by-handle/<slug>`        | Public profile lookup by handle. Mirrors the existing `/connect/profiles/<userId>` shape - returns the same `ConnectProfile + populated User`. **`@Public`** - the public profile page calls this when resolving slug routes.                         |

All three pass through the standard guards (JwtAuthGuard for `/me/*`,
`@Public` for the public lookup) and validation pipes.

---

## Web

### Type changes

- `types/index.ts` - `User.handle?: string | null`.
- `features/connect/profile.types.ts` - populated-User type returned by
  `getPublicConnectProfile` gains `handle?: string | null` so the page can
  emit the canonical URL.

### Route changes

- `app/(connect-public)/u/[userId]/page.tsx` → rename param to `[slug]`. The
  resolver runs the dual-path lookup. Canonical-URL `<link>` emits when the
  resolved user has a handle and the requested slug was an ObjectId.
- `getPublicConnectProfile(slug)` (server action) tries handle-route then
  ObjectId-route. Web-side caching unchanged.

### Settings UI

`/account/profile` gains a new section:

```
┌────────────────────────────────────────────────────────┐
│ Profile URL                              [Save]        │
│                                                        │
│ zari360.app/u/[jayesh-bambhaniya              ]        │
│                                                        │
│ Lowercase letters, numbers, hyphens. 3–30 characters.  │
│ You can change this once every 30 days.                │
└────────────────────────────────────────────────────────┘
```

- Debounced live availability check (200ms after typing stops) → green
  check or red error.
- Save disabled until the form is valid + available.
- Next-change-allowed-at line shows the cooldown if applicable.

### Share URL builder

`ProfileView` already centralises the URL via `shareUrl`. Update to:

```ts
const slug = profile.handle ?? userId; // fallback for pre-handle users
const shareUrl = `${origin}/u/${slug}`;
```

Every share path (Copy / WhatsApp / Email) inherits the upgrade for free.

---

## i18n (× 4 locales)

New keys under `connect.profile.handle.*`:

- `label` - "Profile URL"
- `description` - short helper line under the label
- `format` - "Lowercase letters, numbers, hyphens. 3–30 characters."
- `cooldown` - "You can change this once every 30 days."
- `cooldownActive` - "Next change available {date}."
- `available` - "Available"
- `unavailable.format` - "Invalid format. Use lowercase letters, numbers, and hyphens."
- `unavailable.reserved` - "This name is reserved."
- `unavailable.taken` - "Taken - try another."
- `saved` - "Profile URL updated."
- `saveFailed` - "Could not update profile URL."

`en` / `gu` (native script) / `gu-en` (romanized) / `hi-en` (romanized).

---

## Out of scope (explicitly)

- **Reserved-handle list management UI.** Static list in code; admin
  expansion lives in a future admin-panel pass.
- **Handle history.** No `previousHandles[]` audit log; the cooldown +
  cascading ObjectId fallback give a reasonable safety net.
- **Vanity domains.** Custom `*.zari360.app` subdomains per user - out of
  scope; we use the path-style `/u/<handle>` exclusively.
- **Migration of the 24-hex slug case to ObjectId** - handled by simple
  pattern match, no extra metadata needed.

---

## Risk register

| Risk                                              | Likelihood                     | Mitigation                                                                       |
| ------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| Two users in the backfill race to the same handle | Low (script is single-process) | Migration marker doc prevents concurrent runs; loop re-checks before saving      |
| User picks an offensive handle                    | Medium                         | Reserved-list deny + future admin moderation panel + report-handle endpoint (P7) |
| Rate-limit bypass via direct PATCH                | Low                            | Backend enforces cooldown via `handleChangedAt`, ignores client claims           |
| Old ObjectId URLs break                           | None - by design               | Dual-resolver keeps every ObjectId URL functional                                |
| Case-collision (`JaYesh` vs `jayesh`)             | None - by design               | Storage is always lowercase; collation strength 2 catches any drift              |

---

## Acceptance criteria

1. A new signup gets a handle auto-generated from their name; the profile is
   reachable at `/u/<handle>` immediately after `/auth/verify-otp` succeeds.
2. An existing user (post-backfill) sees a populated "Profile URL" field on
   `/account/profile` matching `/u/<handle>` resolution.
3. A user can change their handle, sees the new URL in the share menu within
   the same session, and the previous handle resolves only via ObjectId.
4. ObjectId URLs from the pre-handle era continue resolving + canonical-link
   to the slug URL.
5. A second user attempting to claim a taken handle gets the `unavailable.taken`
   error inline before submit.
