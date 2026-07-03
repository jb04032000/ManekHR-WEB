# Design Doc: Inbox Context Cards → Inline Message Cards (One Chat Per Person)

**Status:** Proposal — needs owner approval (logical/architectural change)
**Date:** 2026-06-14
**Decision needed:** Approve approach (B1 recommended) + answer 1–3 open questions before implementation.

> Builds on `2026-06-14-connect-inbox-context-cards-application-quote-design.md` (the shipped pinned-card work). This proposes moving those cards INLINE into one per-person conversation.

---

## 1. Goal

The owner's words, restated: contexts should be **messages**, not a pinned banner. **One chat per person.** When the same person and I have several things going on (an inquiry, a job application, an accepted quote, plus plain chat), those should **stack inside that one conversation** in time order — no awkward pinned card.

Collapse the per-subject conversations between two people into a **single WhatsApp-style thread**, where each subject (product inquiry, job application, RFQ quote) shows up as a **rich inline card-message** in the flow, and ordinary chat flows around it.

---

## 2. Current model — and why the pin exists

Today the inbox stores **one thread per (pair × channel × context)**.

- A `Thread` row carries two participant ids (sorted), a unique `pairKey`, a `channelType` (`dm`/`inquiry`/`application`/`quote`/`system`), and a nullable REFERENCE to the context entity. It does not store the card — only a pointer.
- `pairKey`: plain chat → `a:b:dm`; a subject → `a:b:<channel>:<contextEntityId>`.
- So a buyer + seller with an inquiry + a job application + a DM = **three separate thread rows** → three list rows → three pinned cards, filtered by the channel chips.
- The card is never persisted. At read time `hydrateContexts` resolves the live entity (inquiry→listing, application→job+company+employer-only applicant snapshot, quote→RFQ) and renders it — always fresh, viewer-role-gated, leak-guarded.
- Each thread has its OWN message counter (`seq`) — the sort key, paging cursor, and "what's new since" cursor.

**Why the pin exists:** each thread IS exactly one subject, so the natural place for "what is this about" is one fixed card above the log. The owner finds it awkward because it can't stack: three subjects with one person = three separate screens, each with a lonely pinned card.

---

## 3. Industry benchmark (cited)

- **Inline card bubbles, not a banner.** WhatsApp interactive messages, Telegram bot cards, Fiverr custom offers, Upwork direct offers render a structured object AS a message in the flow — thumbnail/kind label, title, key fields, buttons docked at the bottom.
- **Multiples stack in time order.** Stale cards grey out; updates post as a new card rather than mutating the old one.
- **Actions live on the card, gated by role + state**, and flip the card to a terminal greyed-out state once fired.
- **"What is this about" — hybrid wins:** inline cards per object PLUS a lightweight sticky "active subject" chip.

Sources: WhatsApp Cloud API messages; Telegram bot features; Fiverr custom offers; Upwork direct offers; Alibaba RFQ; Facebook Marketplace messaging.

**Benchmark recommendation:** a _many-objects-per-thread_ model — inline cards per subject, role/state-gated buttons, slim pinned "active subject" chip. Maps cleanly onto our existing `ContextCard` (already per-kind, role-gated, snapshot, inline actions).

---

## 4. The two approaches

Both deliver the same UX. They differ in WHERE the merge happens — at read time (view layer) or in the database.

### B1 — View-layer merge _(recommended)_

Keep one thread per context in the DB. Merge them into one timeline only when reading. The server gathers all of a pair's threads, emits one synthetic "context-card" timeline item per context thread (reusing `hydrateContexts`), interleaves them with each thread's messages sorted by `createdAt`, and returns one merged stream. The DB is untouched.

**Pros:** No migration, no schema change, additive endpoint, fully reversible behind a flag. Preserves the live viewer-role-gated hydration + applicant-snapshot leak guard exactly (computed from `meId` at read time). Realtime works with zero socket change (events already arrive per-thread; the pane routes by `threadId`). Unread already sums across threads. **Strict stepping stone to B2** later.

**Cons / honest limits:** `seq` is per-thread, not global → cross-subject ordering relies on wall-clock `createdAt` (exact within a subject; timestamp-good across subjects). Catch-up + mark-read are per-thread (N small calls, not one). Send-target ambiguity is the one genuinely new design decision (§5.3).

**Risk: Low** (read-path only, flag-gated, no data touched). **Effort: Medium.**

### B2 — Data-model rebuild

Collapse to one thread per pair; make "context" a message kind; migrate all existing data. `pairKey` → `a:b`; drop `inquiry`/`application`/`quote` channels; `Message` gains `contextEntityType`/`contextEntityId` + a `'context'` kind; hydration moves per-message; card renders inline.

**Pros:** Truly one thread — globally monotonic `seq`, one cursor, one catch-up, one mark-read, no send-target ambiguity. Channel-filter machinery deleted.

**Cons / honest risk:** Existing-data migration is the hard, near-irreversible part — for every multi-thread pair: pick canonical thread, synthesize a context message at each old thread's creation time, **re-sequence every message into one global `seq`** (old per-thread seqs collide), recompute unread + read cursors, recompute `lastMessage`/`lastActivityAt`, delete emptied threads. Two correctness landmines on live data: `clientMsgId` is unique per-thread (merge collides identical ids → must re-namespace); re-sequencing/recompute can silently reorder or double-count. The inquiry status-sync signal must move onto the context message (cross-module).

**Risk: High** (schema + live-data migration + correctness-critical re-sequencing). **Effort: High.**

### Recommendation: **B1.**

B1 and B2 produce the SAME screen. B2's only real upside is a globally-comparable `seq` — which we don't need: the unified timeline sorts by `createdAt`, the only ordering a human perceives. Against that thin upside, B2 carries a high-risk, hard-to-reverse migration with two correctness landmines on live conversations. B1 ships the owner's exact vision with no migration, an additive endpoint, and a kill-switch — and is a strict stepping stone to B2 if ever wanted.

---

## 5. Recommended approach (B1) — concrete changes

### 5.1 Backend (read-path only, additive)

- **New read endpoint / mode** (`GET /connect/inbox/person/:userId` or a `groupByPerson` flag): finds all of the pair's threads (dm + 3 context channels; excludes `system`); emits one synthetic `context-card` item per context thread (reusing `hydrateContexts`, keyed at that thread's `createdAt`); merges all messages sorted by `createdAt`, keeping each item's `threadId` + `seq` for in-thread paging.
- **Paging/catch-up stays per-thread** (N small catch-ups keyed by `threadId + seq`). No global cursor invented; never pretend `seq` is global.
- **Hydration unchanged** — role-gating + employer-only snapshot leak guard stay request-scoped off `meId`.
- **Notifications + status-sync unchanged** — they still fire on the underlying context thread, which still exists.

### 5.2 Web

- **New `UnifiedConversationPane`** (or a `mode` on `ConversationPane`): interleaves context-card items + message bubbles in one scroll; subscribes once and routes socket events by `threadId`; runs N per-thread catch-ups + mark-reads.
- **`ContextCard` becomes an inline renderer** — reuse existing per-kind visuals, applicant snapshot, role-gated inline actions, `patchThreadStatus`. Only placement changes (inline bubble vs pinned banner). After an action fires, card flips to a terminal greyed-out state; status changes post as an update where feasible.
- **`MessageBubble` gains a `context` branch** delegating to the `ContextCard` renderer. (Under B1 the context item is a SYNTHETIC read-time item, not a persisted message — do NOT add a stored `context` message kind.)
- **Context items are ungroupable** (like `system` today).
- **`ThreadList` groups by person** — one row per party; preview = latest activity across their threads; unread = sum across their threads.
- **`InboxProvider` / `inbox-cache.ts`** gain person-keyed cache entries alongside per-thread keys (coexist behind the flag).

### 5.3 Replies / send-target (the one new design decision)

- **Default:** free-text replies go to the **DM thread** (`a:b:dm`), created lazily if absent — the "just chatting" lane; avoids attaching banter to a subject.
- **Subject-scoped replies:** a composer affordance — "Reply about ‹subject›" — targets a specific context thread, defaulting to the most-recent active context when replying directly under a card.
- A sticky **"active subject" chip** in the composer makes the current target explicit (the answer to "what is this about" without a pin).
- Every message stays attached to a REAL existing thread → notifications, status-sync, unread keep working.

### 5.4 Chips / unread / notifications / deleted-entity

- **Channel chips: repurposed, not deleted** → optional "filter by subject" within the person view. Marketplace `?channel=` deep-links still work.
- **Unread:** header shows the sum across the person's threads. Mark-read applies to each visible thread's newest message.
- **Notifications:** unchanged (per underlying thread).
- **Deleted-entity:** live-hydrated, so a deleted/withdrawn subject yields no entity → inline render a graceful "this ‹subject› is no longer available" placeholder (greyed, no actions), preserving chronology + messages. Reuses today's hydration-miss handling.

---

## 6. Migration / backward-compat

**B1 needs no data migration** — the headline. Existing threads + messages stay put; the unified view just reads + interleaves. `clientMsgId`/`seq`/cursors/unread keep per-thread semantics. Whole feature sits behind a flag (`INBOX_UNIFIED_PERSON_VIEW`): off → current per-thread list + pinned card; on → unified pane. No data state to roll back. Forward path to B2 preserved (run later with the UI already proven).

---

## 7. Phasing (each phase shippable + reversible)

- **P1 — Read endpoint (server).** Person-grouped/unified read reusing `hydrateContexts`. No UI change; verifiable via API.
- **P2 — Unified pane + inline card-message (web), flag-off.** `UnifiedConversationPane`, `MessageBubble` context branch, per-thread catch-up/mark-read, socket routing. Dark behind `INBOX_UNIFIED_PERSON_VIEW`.
- **P3 — Composer send-target + sticky active-subject chip.**
- **P4 — Person-grouped list + chips repurposed to in-view subject filter + i18n** (4-locale parity).
- **P5 — Flip flag on + polish** (deleted-entity placeholder, greyed terminal cards, empty/loading/error, keyboard nav, a11y AA).

**Out of scope for v1:** B2 data-model collapse / any migration; a global merged `seq`; a stored `'context'` message kind; group chats; merging `system` threads into the person view.

---

## 8. Open questions for the owner (irreducible product choices)

1. **Where do plain replies go by default?** Plain-chat lane _(recommended)_ vs attach to the most recent active subject.
2. **Keep a "filter by subject" control?** Keep chips, repurposed + secondary _(recommended)_ vs hide entirely for a pure WhatsApp look.
3. **When a subject ends** (inquiry closed / applicant hired / quote fulfilled): grey the card in place + a one-line "‹subject› closed" update _(recommended)_ vs grey only.

---

## 9. Edge cases + testing

**Edge cases:** deleted/withdrawn/expired subject → greyed "no longer available" placeholder, messages preserved; role-gated content must not leak in the unified path (hydration stays request-scoped off `meId`); same-millisecond `createdAt` → stable tie-break (`createdAt`, then `threadId`, then `seq`); realtime for a not-yet-loaded thread → route by `threadId`, else re-hydrate; mark-read covers every visible thread's newest; lazy DM creation on first plain reply; bound N catch-ups; composer target falls back to DM when active subject goes terminal.

**Testing:** BE — merge endpoint ordering by `createdAt`, `system` excluded, role-gating/leak-guard preserved, hydration-miss placeholder, multi/single/DM-only pairs, notifications + status-sync regression. Web — inline cards + bubbles in order, `MessageBubble` context branch matches old visuals, context items never group, send-target routing, summed unread + per-thread mark-read, socket routing, flag-off renders legacy pane unchanged. i18n 4-locale parity; a11y AA.

**Bottom line:** B1 gives the WhatsApp-style "contexts are stacked inline messages in one chat per person, no pin" experience, reusing the existing `ContextCard` visuals/snapshot/actions inline — no migration, additive endpoint, kill-switch — while keeping the door open to a future B2 collapse.
