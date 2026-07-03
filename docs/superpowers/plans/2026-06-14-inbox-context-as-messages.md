# Inbox: Contexts as Inline Messages (One Chat Per Person) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a person's job applications, inquiries, and quotes as inline card-messages inside ONE per-person conversation (WhatsApp style), instead of separate threads each with a pinned card — behind an on/off flag, with NO data migration.

> **STATUS 2026-06-14: ALL 5 PHASES BUILT, behind `NEXT_PUBLIC_INBOX_UNIFIED_PERSON_VIEW` (default off = legacy untouched). UNCOMMITTED. Verified: BE build + 29 vitest + lint clean; web typecheck + lint clean + 41 inbox vitest + i18n parity. Deferred to a polish follow-up (noted in P5): in-cache realtime append (currently refetch), voice/photo in the unified composer, greyed terminal cards + an explicit deleted-entity inline placeholder (a deleted subject currently just omits its card).**

**Architecture:** Approach **B1 (view-layer merge)** from `docs/superpowers/specs/2026-06-14-inbox-context-as-messages-design.md`. The DB keeps one thread per (pair × context) exactly as today. A new read-path builds a **unified per-person timeline** by gathering all of a pair's threads, emitting one synthetic `context-card` item per context thread (reusing the existing `hydrateContexts`), and interleaving them with every thread's messages sorted by `createdAt`. The web renders that timeline in a `UnifiedConversationPane`, reusing the existing `ContextCard` visuals as inline bubbles. Everything sits behind `INBOX_UNIFIED_PERSON_VIEW`; off = today's behavior, byte-for-byte.

**Tech Stack:** NestJS + Mongoose (backend), Next.js + React + react-query + next-intl (web), vitest (both). Env via `src/config/env.ts` (BE) and `NEXT_PUBLIC_*` (web).

**Binding repo rules:** zero git ops by assistant (owner commits); 3-line code comments on every touched file; i18n parity across en/gu/gu-en/hi-en; AntD v6 APIs; reversible/flag-gated.

**Reference (do NOT re-derive):** current model is `inbox.service.ts` — `findOrCreateContextThread` (~L347), `upsertThread` (~L811, the only creator), `hydrateContexts` (per-kind batched), `listThreads`/`hydrateThreads(threads, meId)`, `getThread`. Threads keyed `a:b:dm` / `a:b:<channel>:<contextEntityId>`. Messages have per-thread `seq` + per-thread-unique `clientMsgId`.

---

## File Structure

**Backend (`crewroster-backend`)**

- `src/config/env.ts` — add `inbox.unifiedPersonView` flag (modify).
- `src/modules/connect/inbox/inbox.service.ts` — add `buildPersonTimeline(meId, otherId)` read method + a `PersonTimelineItem` type (modify).
- `src/modules/connect/inbox/inbox.controller.ts` — add `GET /connect/inbox/person/:userId` (modify).
- `src/modules/connect/inbox/__tests__/inbox.service.vitest.ts` — timeline merge tests (modify).

**Web (`crewroster-web`)**

- `features/connect/inbox/inbox.types.ts` — `PersonTimelineItem` mirror + `INBOX_UNIFIED` flag read (modify).
- `features/connect/inbox/inbox.actions.ts` — `getPersonTimeline(userId)` action (modify).
- `features/connect/inbox/ContextCardInline.tsx` — thin wrapper that renders `ContextCard` content as an inline bubble (create; reuses ContextCard internals).
- `features/connect/inbox/UnifiedConversationPane.tsx` — the merged timeline pane (create).
- `features/connect/inbox/MessageBubble.tsx` — no change in P2 (inline cards are rendered by the pane, not MessageBubble) — see Task 2.3 note.
- `features/connect/inbox/InboxScreen.tsx` — route to UnifiedConversationPane when flag on (modify, P5).
- `features/connect/inbox/ThreadList.tsx` / `ThreadRow.tsx` / `ChannelChips.tsx` — person grouping + chip repurpose (modify, P4).
- `features/connect/inbox/inbox-cache.ts` — person-keyed cache key (modify, P2).
- `app/messages/{en,gu,gu-en,hi-en}.json` — new strings (modify, P4).

---

## PHASE 1 — Backend unified read endpoint (additive, flag-independent read)

The endpoint is harmless to add even before the flag is consumed (nothing calls it yet).

### Task 1.1: Add the env flag

**Files:** Modify `src/config/env.ts`

- [ ] **Step 1:** Find the `inbox` (or nearest connect) config block in `env.ts`. Add a boolean read from `INBOX_UNIFIED_PERSON_VIEW` (default `false`), following the existing env-read pattern in that file. Comment: `// Unified per-person inbox timeline (contexts as inline messages). Off = legacy per-thread + pinned card. Read-path only, reversible.`
- [ ] **Step 2:** Verify it compiles: `npm run build` → expect SWC success.
- [ ] **Step 3:** Commit. `feat(inbox): add INBOX_UNIFIED_PERSON_VIEW env flag`

### Task 1.2: `PersonTimelineItem` type + `buildPersonTimeline` service method

**Files:** Modify `src/modules/connect/inbox/inbox.service.ts`, `__tests__/inbox.service.vitest.ts`

The method gathers the pair's non-system threads, hydrates each context thread's card (reuse `hydrateContexts`), pulls a bounded page of each thread's messages, and merges into one `createdAt`-sorted list. Each item is tagged with its source `threadId` + `seq` so the web can page/mark-read per thread.

- [ ] **Step 1: Write the failing test.** Add to `inbox.service.vitest.ts` a `describe('InboxService.buildPersonTimeline')`. Construct the service via the existing `build()` helper; inject `threadModel.find` to return two threads for the pair (one `dm`, one `application`), `messageModel` to return messages per thread, and the context models so `hydrateContexts` resolves the application card. Assert the returned `items` are sorted by `createdAt`, that there is exactly one `{ type: 'context', threadId, context }` item for the application thread, and that `system` threads are excluded.

```ts
// shape under test
type PersonTimelineItem =
  | {
      type: 'context';
      threadId: string;
      context: ThreadContext;
      createdAt: string;
      channelType: InboxChannelType;
    }
  | {
      type: 'message';
      threadId: string;
      message: ReturnType<InboxService['toMessageDto']>;
      createdAt: string;
    };
```

- [ ] **Step 2: Run it, expect FAIL** (`buildPersonTimeline` undefined). `npx vitest run src/modules/connect/inbox/__tests__/inbox.service.vitest.ts`
- [ ] **Step 3: Implement `buildPersonTimeline(meId, otherId)`** in `inbox.service.ts`:
  1. `sortPair(meId, otherId)` → `[a,b]`; `threads = threadModel.find({ participantIds: { $all: [a,b] }, channelType: { $ne: 'system' } })` (lean).
  2. `contextByThread = await this.hydrateContexts(threads, meId)` (UNCHANGED method — keeps role-gating + leak guard).
  3. For each context thread present in `contextByThread`, push a `context` item at `thread.createdAt` (fallback `lastActivityAt`), carrying `channelType`.
  4. For each thread, fetch the latest page of messages (reuse the existing message-list query path; bound to `INBOX_MESSAGE_PAGE_SIZE`), map via the existing message serializer, push a `message` item per message at its `createdAt`.
  5. Sort all items by `createdAt`, tie-break `threadId` then `seq`. Return `{ items, threads: [{ threadId, channelType, newestSeq }] }` (the per-thread cursor list for the web).
     Add the 3-line comment: what it does (per-person merged timeline), cross-module (reuses hydrateContexts; consumed by web UnifiedConversationPane), watch (seq is per-thread — never present a global seq; sort by createdAt).
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5:** Lint changed file: `npx eslint src/modules/connect/inbox/inbox.service.ts` → clean.
- [ ] **Step 6:** Commit. `feat(inbox): buildPersonTimeline merges a pair's threads into one timeline`

### Task 1.3: Controller endpoint

**Files:** Modify `src/modules/connect/inbox/inbox.controller.ts`

- [ ] **Step 1:** Add `GET /connect/inbox/person/:userId` guarded like the other inbox routes (`JwtAuthGuard`), validating `userId` is a Mongo id; call `inboxService.buildPersonTimeline(req.user.id, userId)`. 3-line comment.
- [ ] **Step 2:** `npm run build` → success.
- [ ] **Step 3:** Manual smoke (optional): hit the route in REST client with two seeded users; expect a merged `items` array.
- [ ] **Step 4:** Commit. `feat(inbox): GET /connect/inbox/person/:userId unified timeline`

---

## PHASE 2 — Web unified pane, dark-launched behind the flag

Renders the merged timeline; the legacy pane stays the default. Nothing user-visible changes until P5 flips the flag.

### Task 2.1: Types mirror + flag

**Files:** Modify `features/connect/inbox/inbox.types.ts`

- [ ] **Step 1:** Add the `PersonTimelineItem` union (mirror of BE) + `PersonTimeline` (`{ items, threads }`). Add `export const INBOX_UNIFIED_PERSON_VIEW = process.env.NEXT_PUBLIC_INBOX_UNIFIED_PERSON_VIEW === 'true';`. 3-line comment (keep in sync with BE `PersonTimelineItem`).
- [ ] **Step 2:** `npm run typecheck` → no new inbox errors.
- [ ] **Step 3:** Commit. `feat(inbox-web): PersonTimeline types + unified-view flag`

### Task 2.2: Fetch action

**Files:** Modify `features/connect/inbox/inbox.actions.ts`

- [ ] **Step 1:** Add `getPersonTimeline(userId): Promise<ActionResult<PersonTimeline>>` calling `GET /connect/inbox/person/${userId}` (mirror the existing action wrappers).
- [ ] **Step 2:** `npm run typecheck` → clean.
- [ ] **Step 3:** Commit. `feat(inbox-web): getPersonTimeline server action`

### Task 2.3: Inline context-card renderer

**Files:** Create `features/connect/inbox/ContextCardInline.tsx`

Note: the existing `ContextCard` reads `thread.context`. Extract its per-kind body so it can render from a bare `ThreadContext` + a `thread`-like object. Simplest non-invasive path: `ContextCardInline` builds a minimal `InboxThread`-shaped object `{ _id: threadId, channelType, contextEntityId, context, party, ... }` from the timeline item and renders `<ContextCard thread={...} />` unchanged, wrapped so it sits as a left/standalone inline bubble (not pinned).

- [ ] **Step 1: Write the failing test** (`ContextCardInline.test.tsx`): given an `application` context item, it renders the job title + status chip (reuses ContextCard) and sits in an inline wrapper (not the pinned frame margins). Wrap in `QueryClientProvider` + `NextIntlClientProvider` (mock next/link + jobs/rfq actions like `ContextCard.test.tsx`).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `ContextCardInline({ item }: { item: Extract<PersonTimelineItem,{type:'context'}> })`: reconstruct the thread-shaped object, render `<ContextCard thread={...} />`, wrap in `<div style={{ alignSelf: 'flex-start', maxWidth: 'min(86%, 520px)', margin: '10px 0 2px' }}>`. 3-line comment (reuses ContextCard visuals/actions; placement only).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5:** Commit. `feat(inbox-web): ContextCardInline renders a context as an inline bubble`

### Task 2.4: UnifiedConversationPane

**Files:** Create `features/connect/inbox/UnifiedConversationPane.tsx`

- [ ] **Step 1: Write the failing test** (`UnifiedConversationPane.test.tsx`): given a `PersonTimeline` with [context(application), message("hi", mine), message("ok", theirs)] it renders the inline card + both bubbles in `createdAt` order; "mine" right, "theirs" left (reuse `MessageBubble`). Mock `getPersonTimeline` to return the fixture.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the pane: `useQuery(['connect-inbox-person', otherId], () => getPersonTimeline(otherId))`; render the same centered cream column as `ConversationPane` (reuse the column layout); map `items`: `type==='context'` → `<ContextCardInline>`, `type==='message'` → `<MessageBubble message={item.message} viewerId={viewerId} />`; day separators by `createdAt`; scroll-to-bottom on mount. Realtime: subscribe via `InboxProvider`'s socket and on an inbox event for any of `threads[].threadId`, refetch the person query (P2 keeps it simple — refetch; optimize to in-cache append in P5). Mark-read: on open, call `markInboxRead(threadId, newestSeq)` for EACH thread in `timeline.threads`. 3-line comment.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5:** typecheck + eslint changed files → clean.
- [ ] **Step 6:** Commit. `feat(inbox-web): UnifiedConversationPane renders the merged person timeline`

### Task 2.5: Cache key

**Files:** Modify `features/connect/inbox/inbox-cache.ts`

- [ ] **Step 1:** Add `person: (userId: string) => ['connect-inbox-person', userId] as const` to `inboxKeys`. Comment.
- [ ] **Step 2:** typecheck → clean. Commit. `feat(inbox-web): person-keyed react-query cache key`

---

## PHASE 3 — Composer send-target + active-subject chip (flag-gated)

A reply in the unified pane needs a target thread. Default = the DM lane; a chip lets the user aim at a subject.

### Task 3.1: Send-target resolver + composer wiring

**Files:** Modify `features/connect/inbox/UnifiedConversationPane.tsx`, reuse `MessageComposer.tsx`

- [ ] **Step 1: Write the failing test:** typing + send with no active subject calls `sendInboxMessage` against the DM thread id (lazily created via `startInboxDm` if `timeline.threads` has no `dm`). With an active subject selected, it sends against that subject's `threadId`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `resolveSendTarget(activeSubjectThreadId, timeline)`: returns the active subject thread if set, else the `dm` thread id, else `null` → on first send, `startInboxDm(otherId)` to create it, then send. Render a small sticky **"active subject" chip** above the composer showing the current target (default "Chat"); tapping a context card sets it as active; an "x" resets to DM. After a successful send, append to the person query cache (or refetch). 3-line comment.
- [ ] **Step 4: Run, expect PASS.** typecheck/eslint clean.
- [ ] **Step 5:** Commit. `feat(inbox-web): unified composer send-target (DM default + active-subject chip)`

---

## PHASE 4 — Person-grouped list + chips repurposed + i18n (flag-gated)

### Task 4.1: Group the thread list by person

**Files:** Modify `features/connect/inbox/inbox-format.ts`, `ThreadList.tsx`, `ThreadRow.tsx`

- [ ] **Step 1: Write failing test** (`inbox-format` test): a new `groupThreadsByPerson(threads)` returns one entry per other-party `userId`, with `unread = sum`, `lastActivityAt = max`, and a `latestPreview` from the most-recent thread.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `groupThreadsByPerson`. In `ThreadList`, when `INBOX_UNIFIED_PERSON_VIEW`, render grouped rows linking to `?person=<userId>` instead of `?thread=<id>`; else legacy rows. `ThreadRow` shows the person + summed unread. 3-line comments.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5:** Commit. `feat(inbox-web): person-grouped thread list (flag-gated)`

### Task 4.2: Repurpose channel chips to in-conversation subject filter

**Files:** Modify `features/connect/inbox/ChannelChips.tsx`, `UnifiedConversationPane.tsx`

- [ ] **Step 1:** When unified, render the chips INSIDE the pane as an optional "filter by subject" (All / Inquiries / Applications / Quotes) that filters the timeline's context items + their messages. Keep the legacy top-level chips when flag off. 3-line comment.
- [ ] **Step 2:** typecheck/eslint clean. Commit. `feat(inbox-web): chips become in-conversation subject filter when unified`

### Task 4.3: i18n (4 locales)

**Files:** Modify `app/messages/{en,gu,gu-en,hi-en}.json`

- [ ] **Step 1:** Add under `connect.inbox`: `unified.chatLane` ("Chat"), `unified.replyAbout` ("Reply about {subject}"), `unified.subjectClosed` ("{subject} closed"), `unified.subjectUnavailable` ("This {kind} is no longer available"), `unified.filterAll`/`filterInquiries`/`filterApplications`/`filterQuotes`. Translate all four locales (gu = Gujarati script; gu-en/hi-en romanized) — flag gu/gu-en/hi-en for owner native review. NO dashes/em-dashes in `connect.*` strings.
- [ ] **Step 2:** `node scripts/check-i18n.js` → no NEW missing keys for these (pre-existing backlog unrelated).
- [ ] **Step 3:** Commit. `feat(inbox-web): unified-view i18n across 4 locales`

---

## PHASE 5 — Flip flag, route, polish

### Task 5.1: Route to the unified pane

**Files:** Modify `features/connect/inbox/InboxScreen.tsx`, `app/connect/inbox/page.tsx`

- [ ] **Step 1:** When `INBOX_UNIFIED_PERSON_VIEW`, the `?person=<userId>` param selects a `UnifiedConversationPane`; legacy `?thread=` still works for deep-links (resolve the thread's other party → `?person=`). Keep the legacy `ConversationPane` import for flag-off. 3-line comment.
- [ ] **Step 2:** Commit. `feat(inbox-web): route unified pane behind the flag`

### Task 5.2: Polish

**Files:** `UnifiedConversationPane.tsx`, `ContextCardInline.tsx`

- [ ] **Step 1:** Deleted-entity inline placeholder (greyed "no longer available", no actions) reusing the existing hydration-miss path. Terminal/greyed card after an action fires. Empty/loading/error states for the person query (mirror `ConversationPane`). Realtime: switch from refetch to in-cache append keyed by `threadId`. a11y: focus order across merged log, AA contrast on greyed cards.
- [ ] **Step 2:** Full gates: BE `npm run build` + vitest; web `npm run typecheck` + eslint + inbox vitest + `check-i18n`. All green.
- [ ] **Step 3:** Commit. `feat(inbox): polish unified person view + flip default when ready`
- [ ] **Step 4:** Flip `INBOX_UNIFIED_PERSON_VIEW=true` in the dev env, smoke test, then owner decides production rollout.

---

## Self-review notes

- **Spec coverage:** P1 = §5.1; P2 = §5.2; P3 = §5.3; P4 = §5.4 + i18n; P5 = §5.4 deleted-entity + §9 edge cases. ✓
- **Reversibility:** every phase flag-gated; flag-off = legacy untouched. ✓
- **No data migration:** confirmed — read-path only. ✓
- **Leak guard preserved:** `hydrateContexts(threads, meId)` reused unchanged in `buildPersonTimeline`. ✓
- **Known follow-up (not v1):** B2 data-model collapse; in-cache realtime append is P5 (P2 uses refetch); bounding N catch-ups for a person with very many subjects.
