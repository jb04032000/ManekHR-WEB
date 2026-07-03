# Inquiry ↔ Inbox unification (the deferred "I4") - design

Date: 2026-06-01
Status: Approved (design, full scope); implementation pending
Repos: `crewroster-backend` (Connect), `crewroster-web` (Connect), branch `zari360-connect`

## Problem (from the audit)

A buyer inquiry creates an Inbox thread + a seller bell notification, but the
product-context layer was explicitly deferred ("I4") and never built, so the
feature feels half-wired:

1. **ContextCard is a stub.** `features/connect/inbox/ContextCard.tsx` renders the
   channel label ("PRODUCT INQUIRY") + the counterpart name, NOT the product. Its
   own comment defers "full entity hydration + a View-product deep link" to I4.
2. **Threads open empty ("No messages yet").** `InquiryService.seedInboxThread`
   only seeds a chat message when the buyer typed a body (`if (body)`). An
   inquiry with no note creates a thread with zero messages and no context.
3. **Storefront Inquiry rows are not clickable.** `ManageStorefrontScreen`'s
   `InquiryRow` is a plain `<li>`; the seller cannot open the specific thread.
   `InquiryListItem` carries no `threadId` to link with.
4. **Notifications fire but do not deep-link.** `connect.inquiry_received` lights
   the seller's bell but does not jump to the thread.

The plumbing exists (thread schema carries `contextEntityType` + `contextEntityId`;
the inbox is URL-driven via `?thread=<id>`); only the context/product layer and
the cross-surface links are missing.

## Goal

Complete the unification so an inquiry behaves like a best-in-industry product
chat (WhatsApp Business product message / Etsy listing-attached message / IndiaMART
lead): the conversation always shows WHICH product it is about (a live product
card), is never empty, and is reachable in one tap from every surface.

## Non-goals (deliberate)

- Application / quote context hydration (jobs / RFQ). The context plumbing is
  generalized, but only the `inquiry` -> listing card is built now; application /
  quote cards are a follow-up.
- Buyer-side requirement fields (qty / target price structured form). v1 keeps the
  free-text note; structured RFQ already exists separately.
- Real-time typing indicators / read receipts beyond what the inbox already has.

## Data model + backend

### 1. Thread context hydration (the product card source)

The thread already stores `contextEntityType` + `contextEntityId`. Add a hydrated,
read-time `context` object to the thread API shape (NEVER persisted - hydrated on
read so it always reflects the live listing):

```
context: {
  kind: 'inquiry',            // mirrors channelType
  listingId: string,
  title: string,
  coverImage: string | null,
  price: { type, min, max } | null,   // for the card's price line
} | null
```

- `InboxService` thread serialization (list + single) resolves an `inquiry`
  context: `Inquiry(contextEntityId)` -> `Listing` -> `{ listingId, title,
coverImage, price }`. One extra lookup per inquiry thread; batch across the
  thread list (collect inquiry ids -> one Inquiry find -> one Listing find).
- A listing that was deleted resolves to `context: null` (the card hides; the
  thread still works as a plain chat).

### 2. Never-empty thread (FE-rendered intro - no backend system seed)

The buyer's note (if any) stays the only seeded MESSAGE. "Never empty" is achieved
on the web, so all user-facing text stays localized (no backend-stored copy):

- The conversation pane ALWAYS pins the product card (from `thread.context`).
- When an inquiry thread has no real messages yet, the pane shows the product card
  - a localized intro line ("{buyer} is interested in this product. Reply to start
    the conversation.") instead of "No messages yet".
- The thread LIST preview: when `lastMessage` is empty, an inquiry thread renders a
  context-derived preview ("Inquiry: {product title}") on the web instead of
  "No messages yet" - again localized, no backend copy.

Keeping the buyer-note seed idempotent stays as-is (`inquiry-<id>` `clientMsgId`).
No extra seeded message is introduced, so there is nothing new to dedupe.

### 3. Storefront row -> thread link

Add `threadId: string | null` to `InquiryListItem` (the seller-inbox row shape).
The inquiry list query resolves each inquiry's context thread id (one batched
`Thread.find({ contextEntityType: 'Inquiry', contextEntityId: { $in } })` ->
map). The web row links to `/connect/inbox?thread=<threadId>`.

### 4. Notification deep-link + reorder

In `InquiryService.create`, seed the inbox thread BEFORE dispatching the bell, so
the dispatch can carry the thread deep-link. Extend the `connect.inquiry_received`
notification with a `link: /connect/inbox?thread=<threadId>` (or the existing
notification link field) so the bell opens the conversation.

### 5. Inquiry status sync

Tie the inquiry lifecycle to the conversation:

- Seller opens the thread (marks messages read) -> if the inquiry is `sent`,
  move it to `viewed`.
- Seller sends a message in an `inquiry` thread -> move the inquiry to `replied`.

Implementation: the inbox already emits message-sent / thread-read paths. Add a
light hook: `InboxService` (or an event) notifies `InquiryService.onThreadActivity`
when a thread with `contextEntityType: 'Inquiry'` is read / replied by the seller,
which updates the inquiry status (+ the storefront "New" badge derives from it).
Self-catching + non-fatal (mirrors the seed).

## Frontend

### A. ContextCard -> product card (`features/connect/inbox/ContextCard.tsx`)

Upgrade the stub to render the live product card from `thread.context`:

- Thumbnail (coverImage or a placeholder), title (1-2 lines), price line
  (Negotiable / amount / range), and a "View product" link to
  `/connect/marketplace/listing/<listingId>`.
- Keep the small channel eyebrow ("Product inquiry"). Pinned at the top of the
  conversation, like WhatsApp's product message.
- A `dm` thread still renders nothing; an `inquiry` thread with `context: null`
  (deleted listing) falls back to the current lean label.

### B. Conversation empty state

When an inquiry thread has only the system intro (no buyer/seller text yet), the
pane shows the product card + the intro line + a hint ("Reply to start the
conversation"), NOT a bare "No messages yet".

### C. Quick-reply chips (inquiry threads)

Above the composer, for `inquiry` threads, show 3 tap-to-send chips:
`Available` / `Share your requirement` / `Send price`. Each inserts a localized
message into the composer (editable before send) - not auto-sent.

### D. Storefront Inquiries tab (`ManageStorefrontScreen` InquiryRow)

- Make each row a link to `/connect/inbox?thread=<threadId>` (fallback to
  `/connect/inbox?channel=inquiry` when `threadId` is null).
- Show the product thumbnail + title on the row (the listing summary is already
  on `InquiryListItem`), so the seller sees the product before opening.

### E. Notification deep-link

The `connect.inquiry_received` bell item opens `/connect/inbox?thread=<id>`.

### i18n

New keys across en / gu / gu-en / hi-en (all FE-rendered, so fully localized): the
context-card price line reuses the listing price helpers; `connect.inbox.context.*`
(product card label + "View product"), the inquiry intro line, the thread-list
context preview, the empty-state hint, the 3 quick-reply chips, and the storefront
row aria. gu / gu-en / hi-en need owner native review.

## Edge cases

- Listing deleted after the inquiry: `context: null` -> card hides, chat still
  works; the storefront row shows the stored title.
- Buyer and seller both on the thread: the product card is identical for both
  (buyer sees what they asked about; seller sees what was asked).
- Re-running the seed (self-heal): `clientMsgId` dedupe prevents duplicate intro /
  note messages.
- A paused / unpublished listing: the card still hydrates for the existing thread
  (the inquiry predates the pause); "View product" 404s gracefully to the seller's
  own preview (owner) or not-found (buyer) - acceptable, the chat is the point.

## Testing

- Backend: thread context hydration (inquiry -> listing card, deleted -> null,
  batched), `InquiryListItem` carries threadId, status sync (viewed on read,
  replied on seller message), notification carries the thread link.
- Web: ContextCard renders the product card from context (+ null fallback),
  conversation empty state shows card + localized intro, thread-list preview from
  context when lastMessage is empty, quick-reply chips insert text, storefront
  InquiryRow links to the thread, notification deep-link.

## Phasing (for the implementation plan)

1. Backend: thread `context` hydration + `InquiryListItem.threadId` + notification
   deep-link + status sync + tests.
2. Web inbox: ContextCard product card + empty-state intro + thread-list preview +
   quick-reply chips + tests.
3. Web storefront + notifications: clickable InquiryRow (with thumbnail) +
   notification deep-link + tests.
4. i18n x4 woven through each phase.
