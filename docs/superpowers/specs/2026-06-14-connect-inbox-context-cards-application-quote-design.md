# Connect Inbox — Context Card Enrichment (Application & Quote Parity)

**Spec date:** 2026-06-14
**Status:** BUILT (Option A + Option B/§9), verified, UNCOMMITTED — owner to review + commit + smoke.
**Option A** (shipped): rich clickable cards for inquiry/application/quote + status chips + no duplicate party name + 4-locale i18n.
**Option B/§9** (now also shipped): EMPLOYER-only applicant snapshot on the job card (headline + matched skills + district + past-applicant flag; BE+FE viewerRole-gated, leak-guarded, never to the applicant) + role-gated inline card actions (employer Shortlist/Accept/Reject, buyer Accept/Decline/Shortlist, supplier Update-quote link + Withdraw) reusing the existing jobs/rfq server actions, with inline confirm on consequential actions + optimistic thread-cache patch. HONEST DEVIATION: no fabricated "years of experience" number (ConnectProfile has no such field) — the real `headline` carries it.
**Verification:** BE SWC build clean + lint clean + 27/27 inbox vitest (incl. employer snapshot, matched-skills, past-applicant, leak-guard, viewer-role, batching). Web typecheck clean (only a pre-existing unrelated salary error) + lint clean + 40/40 inbox vitest. i18n parity complete + dash-free for all new keys across en/gu/gu-en/hi-en (gu/gu-en/hi-en need owner native review). The repo's i18n gate is RED on a pre-existing/concurrent ~248-key backlog + em-dashes in OTHER connect copy (rfq/jobs/storefront) — none from this change.
**Supersedes / completes:** the deferred "I4" follow-up flagged in `docs/superpowers/specs/2026-06-01-connect-inquiry-inbox-unification-design.md`
**Touched repos:** `crewroster-backend` (read-path only), `crewroster-web`

> Research-backed: backend data availability audited field-by-field, web entry points + link routes mapped, and best-in-industry patterns surveyed (IndiaMART, Alibaba, Indeed, LinkedIn Recruiter, Upwork, Fiverr, Facebook Marketplace, WhatsApp Business, Etsy). Sources at the bottom.

---

## 1. Problem

In the Connect inbox, the bar pinned at the top of an open conversation — the **context card** — is supposed to say _what this chat is about_. It works for one channel and is broken for two others.

The card is rendered by `features/connect/inbox/ContextCard.tsx`. It has exactly two visual paths, decided by a single condition: `if (thread.context)` (line 34).

- **`thread.context` present** → rich product card: 46×46 thumbnail, gold "Product inquiry" eyebrow, listing title, price, and a clickable `View product` link to `/connect/marketplace/listing/${ctx.listingId}` (lines 34–87).
- **`thread.context` null** → "lean fallback": a flat icon tile + a one-word eyebrow label + `thread.party.name`, wrapped in a non-interactive `<div role="note">` (lines 94–131).

The backend only ever populates `thread.context` for **inquiry** threads. The hydration lives in `crewroster-backend/src/modules/connect/inbox/inbox.service.ts`, in the private `hydrateContexts(threads)` method (~lines 954–1014), with a single branch for `contextEntityType === 'Inquiry'`. For **application** and **quote** threads, `thread.context` arrives `null` even though `contextEntityType` (`'JobApplication'` / `'Quote'`) and `contextEntityId` are populated on the thread.

So a job-application chat or an RFQ-quote chat falls into the lean branch and shows:

> **JOB APPLICATION**
> zaritestuser01

Three separate defects:

1. **Redundant.** The conversation header directly above the card (`ConversationPane.tsx`, the `identity` block ~line 349) already renders avatar + party name + `@handle`. The lean card re-prints the _same_ `thread.party.name` one row lower.
2. **No detail.** It does not name the job, role, RFQ subject, quoted amount, or status. Two application threads with the same recruiter are pixel-identical.
3. **Not clickable.** The whole thing is a static `div`. No way to jump from the chat to the job post or the RFQ.

An unused i18n key `context.withParty` (`"{label} with {name}"`, `app/messages/en.json` ~line 14511) hints at an earlier intent to at least merge label+name onto one line — `ContextCard` never uses it; it stacks them on two lines, which _is_ the duplication.

---

## 2. How many things are like this (channel-by-channel state)

Five inbox channel types (`INBOX_CHANNEL_TYPES`, `inbox.types.ts` line 8). Three carry a context entity; two do not.

| Channel         | `contextEntityType` | Entry points                                                                                  | Card today                                              | State                   |
| --------------- | ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------- |
| **inquiry**     | `Inquiry`           | `SendInquiryModal.tsx` on listing detail                                                      | Rich: thumbnail, title, price, `View product` deep-link | **DONE** (the template) |
| **application** | `JobApplication`    | `JobDetailScreen.tsx` — employer applicant card (~L1192) + applicant's own card (~L1270)      | Lean: icon + "Job application" + party name             | **BROKEN**              |
| **quote**       | `Quote`             | `RfqDetailScreen.tsx` — ~L573 + ~L638, gated to accepted quotes                               | Lean: icon + "Quote" + party name                       | **BROKEN**              |
| **dm**          | — (none)            | `IntentCards.tsx`, `PersonCard.tsx`, `CompanyCard.tsx`, `CompanyCardRow.tsx` → `startInboxDm` | Renders nothing (correct)                               | **OK by design**        |
| **system**      | — (none)            | platform notices                                                                              | Muted icon + "System notices from Zari360", no name     | **OK**                  |

**Net:** of the three context-bearing channels, **1 is correct and 2 are broken**. The two broken ones are _structurally identical_ — same lean branch, same three defects — so the fix is one shared pattern applied twice.

A secondary, lower-priority instance of the same data gap exists in the **thread-list row**: `ThreadRow.tsx` → `threadPreview()` in `inbox-format.ts` shows `Inquiry: {title}` for an empty inquiry thread but has **no** equivalent `Application: …` / `Quote: …` preview. The row does _not_ duplicate the party name, so it has only the "missing context" half of the problem. In-scope but **Phase 3**.

---

## 3. Root cause

**This was deliberately deferred.** The 2026-06-01 inbox-unification spec shipped inquiry-only context hydration and left application/quote enrichment as a named follow-up. The product-inquiry card is the _template_ the other two were always meant to copy. This plan executes that follow-up.

The root cause is **in the data model, not just the view**:

1. **Backend hydration is single-branch.** `hydrateContexts` only resolves the `Inquiry → Listing` hop and emits `{kind:'inquiry', …}`. Applications and quotes are never resolved, so their `context` is `null`.
2. **The context type is a single shape, not a union.** `InboxThreadContext` (`inbox.types.ts` L34–42) is hardcoded to `kind: 'inquiry'` with listing-only fields. Because the type can only _be_ an inquiry, the card's only honest fallback for the other two channels is "label + party name."

The **header/card redundancy** is a direct consequence: with no real subject to show, the lean branch reaches for `thread.party.name` — which the header already owns. Fix the data model and the redundancy disappears, because the card will have a real subject to show instead of the name.

**Key fact that makes the fix cheap:** the thread already stores `contextEntityType` + `contextEntityId`. The parent objects (`Job`, `Rfq`) and their rich fields already exist. This is a **read-time resolution** problem, not a schema or write-path problem. Nothing new is _stored_.

---

## 4. Industry benchmark (what good looks like)

Across the strongest B2B-marketplace, jobs, and freelance apps, the "what this chat is about" header converges on one tight pattern: **one square thumbnail + one bold title line + one money/spec line + one status chip, and the whole card is a tappable deep-link to the canonical object.** It reflects _live_ state, never a frozen snapshot.

| Context             | Benchmark behavior                                                                                                                                                                                                                                                                                                                                                                                                                     | Sources                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Product inquiry** | WhatsApp Business "Single Product Message" renders a live product card (image, name, price, link) generated in real time. Facebook Marketplace anchors every buyer-seller thread to the listing (thumbnail + title + price + location). Alibaba "Contact Supplier" ties the chat to the product. IndiaMART surfaces the buyer's stated requirement + MOQ as a first-class qualifier.                                                   | WhatsApp Business catalog docs; FB Marketplace 2025 update; Alibaba; IndiaMART Lead Manager |
| **Job application** | LinkedIn Recruiter shows a candidate context panel: job title + company + location + `jobPostLink`, plus applicant snapshot (skill/experience match, past-applicant, open-to-work) and pipeline stage. Indeed makes candidate **Status** (New → Reviewing → Contacting → Interviewing → Hired/Rejected) the spine of the conversation. Upwork keeps a context rail linking the original job post + proposal with an activity timeline. | LinkedIn Recruiter help; Indeed employer messaging; Upwork                                  |
| **RFQ quote**       | Alibaba RFQ ties the chat to a quote-against-request object. Upwork shows proposal→contract state in an activity timeline. Fiverr's Custom Offer card carries selected gig, price, delivery time, expiry. The lifecycle (Open → Quoted → Negotiating → Accepted/Declined/Expired) is the spine; show buyer budget vs supplier quote side by side.                                                                                      | Alibaba RFQ; Upwork; Fiverr Custom Offers                                                   |

**Distilled rules we adopt:** one identity line + one numbers line + one status chip; the number (price/wage/budget/quote) is the second-most-prominent thing after the title; a real thumbnail/logo when we have one; whole card is a single tap to the canonical object; reflect live state; two audiences, one card — gate by what data we _actually have_.

---

## 5. The fix — per-context rich card spec

**Universal rules (all three cards):**

- **Layout:** one row — `[thumb/logo 46×46] [eyebrow + title + one numbers line] [status chip] [deep-link]`. Same card chrome as today's inquiry card.
- **Clickable:** the **whole card** is the primary tap target (a Next `<Link>` wrapping the card). Keep a visible trailing affordance (`View job` / `View RFQ` / `View product`) as the keyboard-focusable anchor. Focus-visible ring + AA contrast.
- **Status chip:** small right-aligned pill, color-keyed by state, live (resolved at read time).
- **Remove the redundant name:** the card **never** prints `thread.party.name` for inquiry/application/quote. Identity belongs to the header; the card shows the _subject_.
- **Deleted-entity fallback:** backend omits the thread from the context map (exact inquiry contract). The card renders a **minimal** fallback: channel eyebrow only, **no party name**, not clickable. Strictly better than today. Thread must always still open — never throw.

### 5a. Product inquiry — `kind: 'inquiry'` (already works; small additive polish only)

Keep everything that ships today. Optional additive enhancements (all from the already-joined `Listing` — no new query):

- Add **MOQ + unit** to the numbers line when present (`Rs 145 / metre · MOQ 50`).
- Add an **Inquiry status chip** (`Sent` / `Viewed` / `Replied`) from `Inquiry.status`.
- Make the **whole card** clickable. Deep-link → `/connect/marketplace/listing/${listingId}`.

### 5b. Job application — `kind: 'application'` (NEW)

**Subject:** the **job**, not the applicant (the applicant is already the header). One card, two audiences; ship the **shared-fact union** safe for both sides.

| Element      | Source                                                                                                                                                                  | Notes                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Thumb / logo | `Job.companyPageId → CompanyPage.logo`, else a `Briefcase` glyph tile                                                                                                   | optional join; absent → glyph               |
| Eyebrow      | i18n `context.application` ("Job application")                                                                                                                          |                                             |
| Title        | `Job.title`                                                                                                                                                             | bold, 1 line, truncate                      |
| Numbers line | wage: `Job.wageType` + `Job.wageMin/Max` (`Rs 18,000 – 24,000 / month`) · `Job.location.district`                                                                       | format like inquiry price                   |
| Status chip  | `JobApplication.status` (applied/shortlisted/accepted/declined/withdrawn) + `Viewed` sub-signal from `viewedAt`; if `Job.status` closed/filled, muted "Job closed" note | the spine of the thread                     |
| Deep-link    | `/connect/jobs/${jobId}` — **id-based** (Job has no slug; no per-application route)                                                                                     | `jobId` resolved via `JobApplication.jobId` |

**Explicitly OFF the card (leak guard):** `resumeUrl`, `voiceNoteUrl` (private-bucket media — belong in the application-review surface), and any applicant PII beyond `party`. Deferred: a richer employer-only **applicant snapshot** (needs additional backend data + role-aware shaping; see §9). Ship the shared job card first.

### 5c. RFQ quote — `kind: 'quote'` (NEW)

**Subject:** the **RFQ**, with the quoted amount as the standout number.

| Element      | Source                                                                                                                                                    | Notes                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Thumb        | `Quote.sampleUrls[0]` if present (public bucket — safe both sides), else `ReceiptText` glyph tile                                                         |                                    |
| Eyebrow      | i18n `context.quote` ("Quote")                                                                                                                            |                                    |
| Title        | `Rfq.title`                                                                                                                                               | bold, 1 line, truncate             |
| Numbers line | quoted total `Quote.price` (headline); secondary: requested `Rfq.quantity` + `Rfq.unit` and/or buyer budget `Rfq.budgetMin/Max` · `Rfq.location.district` | quote price is the standout        |
| Status chip  | `Quote.status` (sent/shortlisted/accepted/declined/withdrawn); if `Rfq.status` closed/awarded, muted note                                                 | quote lifecycle is the spine       |
| Deep-link    | `/connect/rfq/${rfqId}` — **id-based** (Rfq has no slug; no per-quote route)                                                                              | `rfqId` resolved via `Quote.rfqId` |

**Leak guard:** show only **this thread's** quote + the RFQ's already-public `lowestQuotePrice` / `quotesCount` (buyer-side, optional). Never surface other sellers' quotes.

---

## 6. Backend work (`inbox.service.ts` + `inbox.module.ts`)

**Classification: read-time-only, additive. NOT a schema or logical change.** No thread-schema migration, no new endpoints, no write-path change. The thread schema's `contextEntityType` enum already includes `'JobApplication'` and `'Quote'`. _(Stays inside the polish / read-path boundary per `feedback_polish_only`; flag to owner as courtesy, no design decision owed.)_

**6.1 — Widen the `ThreadContext` union** (top of `inbox.service.ts`) into a discriminated union:

```ts
type ThreadContext =
  | {
      kind: 'inquiry';
      listingId;
      title;
      coverImage;
      priceType;
      priceMin;
      priceMax;
      moq?;
      unit?;
      status?;
    }
  | {
      kind: 'application';
      jobId;
      title;
      companyName?;
      companyLogo?;
      wageType;
      wageMin;
      wageMax;
      location?;
      status;
      viewedAt?;
      jobStatus;
    }
  | {
      kind: 'quote';
      rfqId;
      title;
      sampleImage?;
      price?;
      quantity?;
      unit?;
      budgetMin?;
      budgetMax?;
      location?;
      status;
      rfqStatus;
    };
```

`ThreadListItem.context` stays `ThreadContext | null`.

**6.2 — Extend `hydrateContexts(threads)` with two new batched branches** (mirror the inquiry batching — **no per-thread queries**):

- **Application branch:** collect `JobApplication` thread ids → `jobApplicationModel.find({_id:{$in}}).select('jobId status viewedAt')` → `jobModel.find({_id:{$in}}).select('title role category wageType wageMin wageMax openings location skills employmentType shift status companyUserId companyPageId')` → optional `companyPageModel.find` for `name slug logo` → emit `{kind:'application', …}`.
- **Quote branch:** collect `Quote` thread ids → `quoteModel.find({_id:{$in}}).select('rfqId price leadTimeDays sampleUrls status')` → `rfqModel.find({_id:{$in}}).select('title category quantity unit budgetMin budgetMax neededBy location status lowestQuotePrice quotesCount buyerUserId')` → emit `{kind:'quote', …}`.

**Cost:** at most ~2 extra batched finds per thread page (+1 optional company-page find), only when those channels appear. Reads stay constant w.r.t. page size.

**6.3 — Register read-only model tokens on `inbox.module.ts`** via `MongooseModule.forFeature` with schema-only imports (no service imports → no cycle), as `Inquiry`/`Listing` are today: `JobApplication`, `Job`, `CompanyPage` (optional); `Quote`, `Rfq`.

**6.4 — Deleted-entity contract (identical to inquiry):** missing entity or parent → omit thread from the returned `Map` → FE minimal fallback. Never throw.

**6.5 — Data-leak / permission guards (binding):**

- Both participants are legitimately party to the entity, so shared entity facts (title, wage/budget/quote amounts, location, status) are safe for either side.
- Do **not** surface counterpart PII beyond `party`, nor admin/moderation-only fields.
- **Application:** keep `resumeUrl` / `voiceNoteUrl` (private-bucket) **off the card entirely**.
- **Quote:** `sampleUrls` public → thumbnail safe; quote `price` + Rfq budget visible to both already → safe. Never leak other sellers' quotes.

---

## 7. Frontend work (`crewroster-web`)

**7.1 — Widen the type mirror** `inbox.types.ts`: replace single-shape `InboxThreadContext` with the §6.1 union.

**7.2 — Rewrite `ContextCard.tsx` as a typed per-kind renderer.** Replace the truthiness branch with `switch (ctx.kind)`:

- `inquiry` → existing card + §5a polish (whole-card link, optional MOQ + status chip).
- `application` → §5b card; whole card wrapped in `<Link href={/connect/jobs/${ctx.jobId}}>`; status chip; **no party name**.
- `quote` → §5c card; whole card wrapped in `<Link href={/connect/rfq/${ctx.rfqId}}>`; status chip; **no party name**.
- no `context` (deleted) → minimal eyebrow-only fallback, **no party name**, not clickable.
- `dm` → `null`; `system` → unchanged.
- Extract a shared `StatusChip` + `CardShell`. Keyboard-focusable link card, visible focus ring, AA contrast on chips. Reuse `formatRupees`; add a tiny wage/budget range formatter (single / range / "Negotiable") shared across application + quote.

**7.3 — Thread-list preview** (`inbox-format.ts` `threadPreview()` + `ThreadRow.tsx`): extend the empty-thread context fallback so an empty application thread reads `Application: {jobTitle}` and an empty quote thread reads `Quote: {rfqTitle}`, mirroring `Inquiry: {title}`. Consumes the now-hydrated `thread.context` — no extra fetch.

**7.4 — Conversation empty-state intro lines** (`ConversationPane.tsx`): add per-channel intros parallel to `conversation.inquiryEmptyTitle` — application ("This chat is about the job above") and quote ("This chat is about the request above").

**7.5 — i18n across all four locales** (`app/messages/{en,gu,gu-en,hi-en}.json`), under `connect.inbox`:

- `context.*`: `applicationStatus.{…}`, `quoteStatus.{…}`, `inquiryStatus.{…}`, `viewJob`, `viewRfq`, `viewed`, `jobClosed`, `rfqAwarded`, `moq`.
- `preview.application` = `"Application: {title}"`, `preview.quote` = `"Quote: {title}"`.
- `conversation.applicationEmptyTitle/Body`, `conversation.quoteEmptyTitle/Body`.
- Remove or stop relying on `context.withParty` (card no longer prints the party name).

**7.6 — Code comments (binding, per `crewroster-web/CLAUDE.md`).** Every touched file gets the 3-line comment (what / cross-module link / gotcha).

**7.7 — No new route, no `loading.tsx`.** Card renders inside the already-loaded inbox route; deep-link targets already exist.

---

## 8. Phasing (each phase independently shippable)

| Phase                                | Scope                                                                                                                                 | Shippable result                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **P1 — BE hydration**                | §6: widen union, add application + quote batched branches, register read-only models, deleted-entity omission, leak guards, BE tests. | `thread.context` populated for application/quote. FE still lean (harmless) until P2. No user-visible change yet. |
| **P2 — FE typed card**               | §7.1, §7.2, §7.6 + en.json keys.                                                                                                      | Core complaint fixed: application/quote cards show real subject, clickable, no duplicate name.                   |
| **P3 — List preview + empty intros** | §7.3, §7.4.                                                                                                                           | List rows + empty chats name the job/RFQ, matching inquiry.                                                      |
| **P4 — i18n parity**                 | §7.5 for gu / gu-en / hi-en; remove dead `context.withParty`; fold in §5a inquiry polish.                                             | Full four-locale parity. Done.                                                                                   |

Gates per phase: BE `nest build` + vitest; web `tsc` + lint + i18n parity + relevant vitest. Per `feedback_no_git_ops`, the owner commits each phase.

---

## 9. Open questions / owner decisions

Almost everything is an autonomous engineering call backed by §4. Only two minor items are genuinely not the assistant's to decide:

1. **Employer-side applicant snapshot — ship now or defer?** The shared job card (§5b) is safe. A richer _employer-only_ applicant snapshot (skill-match ribbon, years exp, "past applicant") needs additional backend data + role-aware shaping and risks PII over-exposure if rushed. **Recommendation: ship the shared job card now (P2); treat the employer snapshot as a separate later enhancement.** Not blocking.
2. **Inline role-gated actions on the card (Move stage / Accept quote / Send quote)?** Benchmarks put primary actions on the card; our cards deep-link to the surfaces that already host those actions. **Recommendation: deep-link only for v1; revisit inline actions after the read-only card lands.** Not blocking.

---

## 10. Edge cases + testing

**Edge cases:** deleted parent (Job/Rfq) → omit → minimal fallback, thread still opens; deleted context entity → same; withdrawn/closed lifecycle → chip + muted note still render; missing optionals (no company page / no sample / no wage) → glyph tile, omit numbers gracefully (no "Rs NaN"); long titles → one-line ellipsis; mixed page (inquiry+application+quote+dm) → each batch runs once, no N+1; permission/leak → assert no `resumeUrl`/`voiceNoteUrl`/counterpart PII, only this thread's quote; header non-duplication → assert card does not render `party.name`.

**Backend tests:** `hydrateContexts` emits correct `{kind:'application'}` / `{kind:'quote'}`; batched fixed-count finds (not N); deleted parent/entity → absent from map, no throw; select-projection excludes private fields; inquiry path regression.

**Frontend tests:** renders each kind with status chip + correct `href`; null-context → minimal fallback, no name, not a link; `dm` → nothing; `system` → unchanged; `threadPreview()` returns `Application:` / `Quote:` for empty hydrated threads; i18n parity across four locales; no `withParty` references remain if removed.

**Honesty note:** every field on the application/quote cards maps to a concrete confirmed source field (`Job.*`, `JobApplication.*`, `Rfq.*`, `Quote.*`, optional `CompanyPage.*`). The two items NOT backed by the current 2-hop hydration — employer applicant snapshot (§5b) and inline actions (§9) — are called out as "needs additional backend work" and deferred, not assumed.

---

## Sources (industry benchmark)

IndiaMART Lead Manager + MOQ docs; Alibaba RFQ / TradeManager; Upwork messaging help; LinkedIn Recruiter candidate context; Indeed employer messaging / candidate status; Facebook Marketplace 2025 update; Fiverr Custom Offers; WhatsApp Business catalog/product messages; Etsy buyer messages. (Full URLs retained in the investigation workflow output.)
