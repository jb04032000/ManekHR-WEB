# Connect Analytics Events

This is the product-funnel event map for Zari360 Connect (the network /
marketplace / jobs layer). It is written so a marketer or analyst can read it
without touching code.

Every event below flows through one helper, `trackEvent(...)`, which fans out to
PostHog (product analytics + session replay) and Google Analytics 4 (marketing
attribution). **If the analytics keys are not configured in a deploy, every event
is a silent no-op** - nothing is sent, nothing breaks. Keys can be added later
with zero code changes.

- Typed catalog (source of truth): [`lib/analytics-events.ts`](../lib/analytics-events.ts)
- Underlying sink: [`lib/analytics.ts`](../lib/analytics.ts)

These events are the **product mirror** of activity. For ads, the billing system
keeps its own authoritative impression/click counts (with fraud filtering). The
analytics events here are sampled and best-effort by comparison - great for
funnels and trends, but **never used for billing or money math**.

---

## The events

Naming is consistent: `connect.<area>.<thing_that_happened>`, lower-case, words
joined by underscores.

### Feed

| Event                          | When it fires                                                                                                   | Properties                                                     | Where        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------ |
| `connect.feed.post_impression` | A post is genuinely seen: at least half of it on screen for at least 1 second. Counted once per post per visit. | `postId`, `position` (slot in the feed), `tab` (which feed)    | Connect feed |
| `connect.feed.post_click`      | Someone clicks into a post.                                                                                     | `postId`, `target` (`media` / `comments` / `profile` / `link`) | Connect feed |

> Feed impressions can be very high volume. There is a sample-rate dial
> (`FEED_IMPRESSION_SAMPLE_RATE`, default = 1.0 = count everything) that can be
> turned down later to reduce volume, with no other code change.

### Ads (promoted units)

| Event                   | When it fires                                                                                             | Properties                                                                                        | Where                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------ |
| `connect.ad.impression` | A promoted unit becomes viewable (same 50%-for-1s rule). Rides along with the existing ad billing beacon. | `placement`, `kind` (`boost` = our own promotion / `adsense` = Google), `campaignId` (boost only) | Feed + marketplace rails |
| `connect.ad.click`      | A promoted unit is clicked. Rides along with the billing click beacon.                                    | `placement`, `kind`, `campaignId` (boost only)                                                    | Feed + marketplace rails |

> Google AdSense units carry only the placement (there is no first-party
> campaign id to attach).

### Boost (promoting your own post / listing / job)

| Event                        | When it fires                                                                                  | Properties                                                          | Where                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| `connect.boost.cta_clicked`  | Someone clicks a "Boost" button to start.                                                      | `subject` (`post` / `listing` / `job`)                              | Post, listing manager, job pages |
| `connect.boost.flow_started` | The boost setup screen opens.                                                                  | `subject`                                                           | Boost composer                   |
| `connect.boost.submitted`    | A boost is submitted for review.                                                               | `subject`, `budgetBucket` (a spend band, not the exact amount)      | Boost composer                   |
| `connect.boost.activated`    | The boost is approved and goes live - the moment money is committed. **Sent from the server.** | `kind` (`post` / `listing` / `job`), `budgetBucket`, `durationDays` | Backend (ad approval)            |

### Wallet

| Event                            | When it fires                | Properties                                    | Where                   |
| -------------------------------- | ---------------------------- | --------------------------------------------- | ----------------------- |
| `connect.wallet.topup_started`   | A top-up checkout is opened. | `amountBucket` (a band, not the exact amount) | Wallet / boost checkout |
| `connect.wallet.topup_completed` | A top-up succeeds.           | `amountBucket`                                | Wallet / boost checkout |

### Marketplace listings

| Event                             | When it fires                                     | Properties                                                    | Where          |
| --------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | -------------- |
| `connect.listing.viewed`          | A listing detail page is opened (by a non-owner). | `listingId`, `source` (`feed` / `search` / `grid` / `direct`) | Listing detail |
| `connect.listing.inquiry_started` | The "Contact seller" message box opens.           | `listingId`                                                   | Listing detail |
| `connect.listing.inquiry_sent`    | The inquiry is sent.                              | `listingId`                                                   | Listing detail |

### RFQ (request for quote) board

| Event                         | When it fires                 | Properties | Where      |
| ----------------------------- | ----------------------------- | ---------- | ---------- |
| `connect.rfq.viewed`          | An RFQ detail page is opened. | `rfqId`    | RFQ detail |
| `connect.rfq.quote_started`   | The quote form opens.         | `rfqId`    | RFQ detail |
| `connect.rfq.quote_submitted` | A quote is submitted.         | `rfqId`    | RFQ detail |

### Search

| Event                      | When it fires                      | Properties                                                                                                                 | Where          |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `connect.search.performed` | A search runs and returns results. | `queryLength` (how many characters, **not** the words), `vertical` (people / posts / listings / jobs / all), `resultCount` | Connect search |

### Video

| Event                | When it fires                   | Properties                                                     | Where                          |
| -------------------- | ------------------------------- | -------------------------------------------------------------- | ------------------------------ |
| `connect.video.play` | A Connect video starts playing. | `surface` (`feed` / `listing` / `profile` / `company` / `job`) | Wherever Connect video appears |

---

## What we deliberately do NOT collect (PII review)

We send the _shape_ of behavior, not its private contents. The catalog enforces
most of this at compile time, so the omissions cannot be undone by accident.

- **No raw search text.** `connect.search.performed` carries the query _length_
  and the chosen vertical, never the words typed. Search terms can contain names,
  phone numbers, or commercially sensitive intent, so they stay off analytics
  entirely. (Adding a raw `query` field to the event is a typecheck error.)
- **No exact money amounts.** Boost budgets and wallet top-ups are reported as
  coarse bands (for example "1k-2.4k"), never the precise rupee figure. Exact
  amounts live only in the billing/wallet systems.
- **No viewer identity on ad events.** Ad impression/click events carry the
  placement and campaign, not who saw them, beyond PostHog's own
  anonymous/identified id. We do not attach names, emails, or any custom
  person attributes to ad events.
- **No author identity on feed impressions.** A post impression carries the post
  id, its position, and the feed tab, not the author.
- **Billing is the source of truth for ad counts**, not analytics. Analytics is a
  sampled, lossy mirror by design and is never reconciled against or used to bill.

If you need to add a property that could identify a person or reveal exact spend
or query content, update this section first and discuss before shipping.
