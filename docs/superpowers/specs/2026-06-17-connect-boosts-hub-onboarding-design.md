# Connect Boosts hub + wallet — simpler, self-explanatory onboarding

Date: 2026-06-17
Surface: `/connect/boosts` (`BoostsManagerScreen`) + `/connect/boost/wallet` (`WalletPanel`)
Scope: web + one new backend read endpoint (logical change, gated)
Person-centric: JWT `req.user.sub`, no workspaceId, no ERP `<Can>`.

---

## Goal

Make the Boosts hub immediately understandable to a non-expert SMB owner: what a
boost is, how it works, and how to start one without leaving the page, while
keeping the page uncluttered. Plus two real bugs (wallet preset, tabs scrollbar).

---

## Research — competitor onboarding patterns (synthesized)

Surveyed Meta Boost Post, LinkedIn Promote, Etsy Ads, Amazon Sponsored Products,
and Indian SMB tools (Meesho/Flipkart). Best-in-class synthesis:

- **Start from an object you already have, never "create campaign."** (Meta) A
  novice can point at a product/job/post; they cannot author a campaign cold.
- **The product picks promising candidates for you.** (LinkedIn "boost what's
  performing") Rank quick-start items by recent organic views.
- **Manage promotable items as a capped list + "see all", not a wall.** (Etsy)
  3-4 per type on the landing surface; the full filterable list lives behind a
  link.
- **Exactly 3 steps, plain outcome language.** (Amazon) "Pick something →
  Set budget → Go live & track."
- **Two reassurances at every decision point:** _you only pay when someone taps_
  and _we never spend more than your budget._ (Etsy cap + Indian pay-per-click)
- **Add credits = slide-over drawer**, not a modal and not a separate page —
  keeps balance + campaigns in view.
- **Empty state is the #1 conversion surface:** friendly illustration, outcome
  headline, one reassurance line, ONE primary CTA that lands on the quick-start.
- **Preset chips and the amount input are ONE bound value** with a live itemized
  summary underneath; the confirm button restates the number.
- **Persist onboarding-dismiss server-side** ideally (Indian owners log in from
  phone + shared shop desktop). We use localStorage now + auto-collapse on
  activity (see decision below); server flag flagged as a follow-up.

---

## Backend facts (verified by code read)

- Boostable sources + their boost-eligibility gates (must mirror to avoid dead
  quick-start cards):
  - **Listing**: `ListingService.listMine(ownerUserId)`; eligible when
    `moderationStatus === 'approved'` AND no in-flight boost
    (`boostCampaignId` campaign not in pending_review/active/paused).
  - **Job**: `JobsService.listMine(companyUserId)`; eligible when
    `status === 'open'` AND no in-flight boost.
  - **Post**: no `listMine` yet (pattern: `find({ authorId, visibility:'public',
deletedAt:null })`); eligible when public + live + no in-flight boost.
- Profile intents live on `ConnectProfile.openTo`:
  `{ work, hiring, deals, customOrders }` (all boolean). There is NO composer for
  an intent — a boost always needs a concrete listing/job/post id.
- Min budget / low-balance threshold: `ConnectPricingConfig.boostMinBudget`
  (default 99), already exposed via `GET /connect/ads/pricing`.

## GST / invoices — BLOCKER (verified)

`WalletTopupCheckoutService.createOrder` charges the **face amount**
(`amountPaise = amountRupees * 100`) and `confirmPayment` credits the **same
face amount** in rupees. **No 18% GST is added or broken out, and no tax invoice
is generated** (`buildReceipt` only makes a Razorpay receipt string id). The
current screen copy ("An 18% GST applies. A tax invoice is issued for each
top-up.") is factually wrong on both counts.

Consequence: I will NOT render an invented "incl. 18% GST ₹Y" split or an
"invoices" link that points at nothing — that would fabricate tax math the
system does not perform. Owner decision required (see Decisions).

---

## Decisions — RESOLVED with owner (2026-06-17)

1. **GST / invoice handling** → **honest structure now, payments last.** Owner:
   online payment-gateway integration is the last phase; build only the structure
   now. So:
   - The top-up summary shows the truthful "You'll add ₹X to your wallet" today.
   - Remove the false "18% GST applies / a tax invoice is issued" copy; do NOT add
     an invoices/receipts link (nothing to link to yet).
   - Keep one forward-looking, honest note that GST + tax invoice apply once online
     payments are enabled, and structure the summary component so the GST line +
     receipts link slot in then. No fabricated tax math now.
   - Flagged: real GST collection + tax-invoicing is part of the future payment
     integration, not this pass.

2. **New backend read endpoint** → **approved, with posts excluded.** Owner:
   **general posts are NOT boostable.** So the endpoint and quick-start surface
   ONLY listings + jobs (+ intents). Existing post-boost composer/manager path is
   left untouched in this pass (flagged separately).
   - `GET /connect/ads/boostable` (JWT-scoped). Response:
     ```ts
     interface BoostableItem {
       id: string;
       kind: 'boost_listing' | 'boost_job';
       title: string;
       image?: string | null; // listing cover; null for job
       recentViews?: number; // ranking + "getting attention" caption
     }
     interface BoostableSummary {
       listings: BoostableItem[]; // eligible only, ranked by recentViews, capped 3
       jobs: BoostableItem[]; // "
       counts: { listings: number; jobs: number }; // total eligible -> "See all (N)"
       intents: { work: boolean; hiring: boolean; deals: boolean; customOrders: boolean };
     }
     ```
   - Eligibility filters mirror the composer gates exactly (no dead cards):
     listing `moderationStatus==='approved'` + no in-flight boost; job
     `status==='open'` + no in-flight boost.
   - Intents render as contextual nudge cards only when the intent is on AND there
     is no eligible item of its matching type (avoids redundancy with the rails):
     `hiring` → jobs, `deals`/`customOrders` → listings. `work` (open to work) has
     no boostable target (posts excluded) so it is not surfaced as a boost nudge.

---

## Build plan (after decisions)

1. **Bug — wallet preset** (`WalletPanel.tsx`): bind the displayed amount to the
   resolved value (preset or custom), add a live summary block above Add credits,
   keep min + custom logic. (Summary content depends on Decision 1.)
2. **Bug — tabs scrollbar** (`BoostsManagerScreen.tsx`): hide scrollbar chrome on
   the tablist (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`) while
   keeping horizontal scroll on small screens.
3. **Inline wallet strip** on the hub (balance + reserved + Add-credits) opening a
   slide-over drawer that reuses `purchaseWalletTopup`; low-balance nudge when
   balance < `boostMinBudget`; keep `/connect/boost/wallet` as the full page.
4. **"How boosting works"** dismissible 3-step strip; prominent at zero activity,
   collapses to a "How it works" link once `boosts.length > 0`; dismiss persists
   (localStorage).
5. **"Boost something" quick-start** from the new endpoint; capped 2-3/type with
   per-type "See all (N)"; hide empty types; intent nudges as above.
6. **Empty state**: primary "Start a boost" CTA that lands on the quick-start.

All new strings across en/gu/gu-en/hi-en; WCAG AA (keyboard + SR); loading/empty/
error states; co-located `loading.tsx` updated if the route's content changes.
No em-dash. Code comments per the web CLAUDE.md add/modify rule.
