# Connect @Mentions (Tagging) - Design Spec

Date: 2026-06-16
Status: Draft for owner review (brainstorming output; not yet planned/built)
Scope: web + backend only. NO mobile app work (standing rule).
Surfaces approved by owner: posts AND comments.
Mentionable types approved by owner: people, company pages, storefronts.
Tagging reach approved by owner: anyone on public posts (with per-post cap + block
protection), AND a careful "who can tag whom" matrix (owner emphasis).

---

## 1. Goal

Let a user type `@`, get a live dropdown of matching **people, company pages, and
storefronts**, pick one, and have it render as a **clickable chip** in the published
post or comment that links to that entity's page. The tagged person (or a page's /
storefront's owner) gets a "you were tagged" alert they can switch off.

This is an **additive** feature. The codebase is well-prepared: hashtag parsing,
the notification pipeline, public entity routes, federated search, and the
block/visibility/anti-spam guardrails already exist and are reused.

### Verifiable success criteria (definition of done)

1. Typing `@` + >= 2 chars in the post or comment box shows a ranked dropdown of
   matching people / pages / storefronts quickly enough to feel live.
2. Selecting an item inserts a visible chip; the published post/comment renders the
   chip as a clickable link to the correct public page.
3. The tagged user (or page/storefront owner) receives exactly **one** alert per tag
   edge, can open it to the tagging post/comment, and can turn the alert type off.
4. The "who can tag whom" rules (Section 5) are enforced server-side and covered by
   tests: blocked -> rejected; non-connection into a connections-only post ->
   rejected; hidden profile -> not taggable; self-tag -> no self-alert; over-cap ->
   rejected.
5. All four locales (en/gu/gu-en/hi-en) carry every new string; the i18n parity gate
   stays green.
6. Backend + web tests, typecheck, lint, and i18n gates pass for every sub-feature.

---

## 2. Research findings

### 2.1 Competitor survey (industry baseline)

- **LinkedIn**: `@` typeahead over connections + people + pages; mention renders as a
  link; mentioned party is notified; mentions allowed in posts and comments. Tagging
  is broad (not restricted to 1st-degree only), with notification controls.
- **Facebook**: tag anyone; tagged party can review/remove tags of themselves; tags
  notify; per-post tagging is uncapped but spam-throttled.
- **Twitter/X**: `@handle` is the canonical token; render links to profile; reply
  auto-prefixes participants.
- **Instagram**: tag people and (business) accounts; tag is a link; notifies.

**Synthesis (best-of, not matching one):** broad reach (tag anyone on public posts)

- display-name picker (not raw handles) + clickable chip + a dedicated "you were
  tagged" alert with opt-out + a hard safety floor (blocks, visibility, per-post cap).
  This is what the owner selected.

### 2.2 Codebase audit (9-agent read-only audit, 2026-06-16)

Strong enablers found in-code:

- **Hashtag pipeline is a near-identical precedent.** The post body is already
  scanned for `#` tokens (Unicode regex, lowercased, deduped, capped at 10) and
  stored in a separate `hashtags` array, parsed on create and re-parsed on edit.
  `@` mentions mirror this (different trigger + entity resolution).
- **Notification system extends cleanly.** A centralized dispatch already does
  batching, multi-channel fan-out, per-category user preferences, and a best-effort
  "never break the write" pattern. The comment/reply notification is a working
  template for a new "mentioned" category.
- **All three mentionable types already exist with public routes.** People (by unique
  handle), company pages (by slug, with a business/institute kind), and storefronts
  (by slug). The post record even already carries a company-page reference field,
  proving entity-attribution plumbing.
- **A federated search backend exists** (fast multi-index search + Gujarati
  transliteration + per-viewer block filtering) - reusable for the picker, but it
  returns large hydrated objects and is too heavy for keystroke-speed typeahead.
- **Privacy guardrails are production-ready:** bidirectional user blocks (global,
  applied to feed reads + messaging), post visibility (public vs connections-only),
  profile visibility (public/connections/hidden), and per-(user,post) comment rate
  limits + a global engagement throttle.

Gaps (all greenfield, none structural):

- No place to store who is tagged on a post/comment.
- No `@` parser/resolver; no DTO fields for tags.
- No lightweight typeahead endpoint tuned for keystroke latency.
- No "you were tagged" alert category or opt-out preference.
- No composer typeahead UI and no chip rendering (bodies are plain text today; this
  introduces the first clickable in-body content -> render only as in-app links, never
  raw HTML).

---

## 3. Scope

### In scope (v1)

- Tagging **people, company pages, storefronts** in **posts and comments**.
- `@` typeahead picker (dedicated lightweight endpoint).
- Chip rendering in: feed post card, logged-out public post view, comment list,
  profile activity comment list.
- One "you were tagged" alert per tag edge, with an opt-out preference.
- Full "who can tag whom" enforcement (Section 5).
- i18n (4 locales), analytics events, audit logging, observability, tests.

### Out of scope (v1; deferred, documented)

- **Mobile app** (separate later pass).
- **"Mentions of me" search/tab** and a dedicated reverse-index collection
  (the on-record tag array covers render + notify; a reverse index can be backfilled
  later if that surface is greenlit).
- **Multi-admin page notifications** (pages/storefronts are single-owner today;
  notify the owner only until an admin roster exists).
- **`@everyone` / group mentions.**
- **Tagging inside direct messages** (this spec is feed posts + comments only).
- **Per-user "who may tag me" setting** (owner chose "anyone on public posts"; users
  can still opt out of the notification, and the block + visibility floor still
  applies. A per-user allow-list can be added later without rework.)

---

## 4. Data model

Store tags as a structured array on both the post and the comment records. Mirror the
shape so render + parse + notify logic is shared.

```
Mention = {
  type:    'profile' | 'company' | 'storefront',
  refId:   ObjectId,        // stable id of the tagged entity
  display: string,          // snapshot of name at tag time (fallback if entity later
                            // deleted/renamed/hidden)
  href:    string,          // precomputed public route, e.g. /connect/u/<handle>
}
```

- `post.mentions: Mention[]` (default `[]`), `comment.mentions: Mention[]` (default `[]`).
- The body stays a **plain-text string** that literally contains `@<display>` for each
  tag, in order. (No numeric character offsets stored - see ADR in Section 12 for why
  order-matching beats offsets for a robust v1.)
- The mentions array may contain repeats by `refId` (same entity tagged twice in one
  body, each its own chip); the **notification recipient set is deduped** by
  `(type, refId)`.
- Optional cheap index `{ 'mentions.refId': 1, createdAt: -1 }` to keep a future
  "mentions of me" query fast (additive; no migration of existing rows needed - old
  posts simply have no `mentions`).

---

## 5. Who can tag whom (permission + visibility matrix) - owner emphasis

A tag is **accepted and notified** only if ALL gates pass. Enforced **server-side**
on create and edit; the picker also pre-filters so disallowed targets rarely appear.

**Gate A - Existence:** target exists and is not soft-deleted. (If it is deleted
_later_, render degrades to the stored `display` text with no link; no new alert.)

**Gate B - Block (bidirectional):** if a block exists in EITHER direction between the
tagger and the target person, the tag is **rejected at compose time**. For a company
page / storefront target, the block check is against the entity's **owner**. Tagging
is treated as an outreach action, same contract as messaging.

**Gate C - Reach / visibility (depends on post visibility):**

| Post/comment visibility | Tag a PERSON                                                                                                                                                         | Tag a PAGE / STOREFRONT                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public**              | Allowed if person profile is public (or connections-visible to the tagger). Hidden profiles are not taggable.                                                        | Allowed (public entities).                                                                                                                              |
| **Connections-only**    | Allowed only if the tagged person can SEE the post (mutual connection of the author). Else rejected: "You can only tag your connections on a connections-only post." | Allowed only if the owner can see the post (mutual connection). This prevents leaking a private post's existence/snippet to an owner who can't open it. |

(Comments inherit the visibility of their parent post.)

**Gate D - Self-tag:** allowed in text; produces **no self-notification**.

**Gate E - Per-body cap:** at most **10 tags** per post and per comment (aligns with
the existing hashtag cap; configurable). 11th tag -> rejected: "You can tag up to 10
people or pages."

**Gate F - Rate limits:** existing per-(user,post) comment limits and the global
engagement throttle apply unchanged. No new per-mention daily limit in v1 (the cap +
block + existing throttles cover spam); revisit if abused.

**Hidden profiles:** excluded from the picker (search already returns public profiles
only) and rejected server-side if forced.

---

## 6. Tag resolution flow (create / edit)

1. Web composer sends `body` (plain text containing `@<display>` tokens) + an ordered
   `mentions[]` of `{type, refId}` the user actually picked (the picker is the source
   of truth, not a regex over free text - this avoids ambiguity and `@randomtext`
   false positives).
2. Server validates, in order, that each `@<display>` for the picked entity actually
   appears in the body (sequential match), then runs Gates A-F per entity.
3. Server snapshots `display` + computes `href` from the live entity, dedupes the
   recipient set, stores `mentions[]` on the record.
4. After the write succeeds (best-effort, never blocks the post), dispatch one "you
   were tagged" alert per **newly added** recipient (see Section 8).

**Edit semantics:** re-resolve `mentions[]` from the new payload (mirrors hashtags
re-parsing on edit). Notify only recipients **newly added** since the last version
(diff against the previously stored set) so editing never re-pings existing tags.
Removed tags lose their chip; their past alert is left as historical.

**Delete semantics:** soft-delete leaves past alerts in place; opening one leads to a
graceful "this post is no longer available" rather than an error.

---

## 7. Typeahead picker endpoint

A **dedicated lightweight** endpoint (NOT the heavy federated search), because the
federated endpoint returns ~150 hydrated objects per query - too slow for typing.

- Input: query text + scope (`people`, `companies`, `storefronts`, any subset).
- Output: compact `{ type, id, display, href, avatar }`, ~5-8 per type.
- Reuses the **same search indexes, Gujarati transliteration, and per-viewer block
  filter** the federated search already has - it is a thin new response shape +
  scoped fan-out, not new infrastructure.
- Its own throttle tier (typing fires many requests) + a per-viewer short cache.
- Request-cancellation friendly (ignore stale in-flight responses).
- Pre-filters by the reach rules in Section 5 where cheaply possible (e.g. on a
  connections-only post, scope people to connections).

---

## 8. Notifications

- New alert category: **"you were tagged"** (one for people, reusing the same category
  for page/storefront owners), added to the user-toggleable preferences with a sane
  default (on).
- Recipient resolution: person tag -> that user; page tag -> page owner; storefront
  tag -> storefront owner. (Single owner today; multi-admin deferred.)
- Dedupe: same entity tagged multiple times in one body -> one alert.
- Deep link: the alert opens the tagging post/comment.
- Delivered via the existing in-platform channel (bell + notification center + live
  push); mobile/browser push stay inert exactly as they are for all categories today.
- Best-effort dispatch: a notification failure never breaks the post/comment write.

---

## 9. Composer UX (web)

- Keep the existing text box; add an overlay typeahead that triggers on `@` and reads
  the caret position to place the dropdown.
- On select: insert `@<Display Name>` and record the chip `{type, refId}`.
- **Chips are atomic:** editing inside a chip's text removes the whole chip (and its
  entry from `mentions[]`), so the stored body always contains the exact `@<display>`
  for every live tag. This is what makes order-matching (Section 4) robust without
  numeric offsets.
- Keyboard accessible: arrow keys + enter to choose, escape to dismiss, full
  screen-reader labelling (WCAG AA).
- Mirror the same component in the post composer and the comment box.

## 10. Rendering

- A shared renderer walks the plain-text body and the ordered `mentions[]`, replacing
  each `@<display>` occurrence with an in-app **Link chip** to `href`.
- Rendered as sanitized in-app link components only - **never raw HTML** (bodies were
  plain text before; this is the first clickable in-body content, so XSS discipline is
  explicit). Defend against `@`-token bypass tricks.
- Applies in: feed post card, public (logged-out) post view, comment list, profile
  activity comment list. Preserves existing line-break handling.
- Deleted/renamed/hidden target -> render the stored `display` as plain text (no
  broken link).

---

## 11. Cross-cutting conventions (must land per sub-feature)

- **i18n:** add all new strings under a `connect.mentions.*` namespace to en first,
  then gu/gu-en/hi-en (non-empty); parity gate must stay green.
- **Analytics:** typed events under `connect.mentions.*` (e.g. tag created, picker
  opened) following the existing catalog; PII-safe (ids/shapes, never raw content).
- **Audit:** log tag writes under the existing CONNECT module with clear action
  strings; no new module enum needed.
- **Observability:** wrap writes in the module's tracing span; emit a write-only
  analytics event, per the module playbook.
- **Code comments:** every touched file gets the 3-part comment (intent / cross-module
  links / gotchas) per the binding repo rule.
- **Loading skeletons:** any new data-fetch route ships a co-located skeleton.
- **Env:** any new config via the single env loader only.

---

## 12. ADR: storage shape (order-matched plain text vs numeric offsets)

**Decision:** store a plain-text body containing literal `@<display>` tokens + an
ordered `mentions[]` of resolved refs; render by sequential match. Do NOT store
numeric character offsets in v1.

**Alternatives considered:**

- _Numeric offsets_ `{start, len}` per tag: most precise highlight, but offsets drift
  as the user edits surrounding text and require careful composer bookkeeping +
  server bounds-validation. Higher fragility for no v1 benefit.
- _Bare `@handle` re-parse_ (hashtag-style, no picker source of truth): smallest
  backend change, but forces in-body tokens to be slugs/handles, not display names -
  less LinkedIn-like, and ambiguous on rename/collision.

**Why order-matched wins for v1:** keeps the body a plain string, no offset drift,
robust because chips are atomic (the body always contains the exact `@<display>`),
delivers the true display-name experience, and degrades gracefully on delete. A future
upgrade to a structured rich-text editor (offsets) is possible without changing the
stored contract much.

---

## 13. Risks + mitigations

- **Composer state with atomic chips** is the trickiest UX; mitigated by treating each
  chip as atomic and validating the body server-side. A rich-text editor is a future
  hardening, not v1.
- **Typeahead latency / throttle exhaustion** -> dedicated lightweight endpoint with
  its own throttle + per-viewer cache (Section 7).
- **Notification spam** -> per-body cap, self-skip, recipient dedupe, edit-diff
  (no re-ping).
- **Privacy leaks** -> the Section 5 matrix is enforced server-side, not just in the
  picker.
- **First in-body clickable content = XSS surface** -> render only sanitized in-app
  links.
- **Stale search index** after a just-renamed entity -> acceptable for v1 (note for
  QA); the cache TTL masks most of it.

---

## 14. Rollout

- Built directly on the current branch (no feature branch, per owner rule). Owner
  stages + commits.
- A flag-gated rollout is optional (the feature is additive and safe-by-default);
  recommend shipping behind a simple on/off so it can be dark-launched and verified
  before announcement.
- Suggested build order (each a gated sub-feature): (1) data model + parser/resolver +
  who-can-tag-whom rules + tests; (2) typeahead endpoint; (3) notifications + opt-out;
  (4) composer typeahead UI; (5) chip rendering across the four surfaces; (6) i18n +
  analytics + audit polish + final gates.

---

## 15. Open questions for owner (only if any differ from the defaults above)

These are already answered by sensible defaults; flag only if you disagree:

- Per-post tag cap = 10 (matches hashtags). OK?
- "You were tagged" alert default = ON (user can turn off). OK?
- Ship behind an on/off flag for a safe dark launch. OK?
