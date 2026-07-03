# Connect Boosts: auto-activate + admin post-moderation (design)

**Date:** 2026-06-19
**Status:** Approved (owner), pending implementation plan
**Owner decisions captured:**

- B: boosts go **live instantly** on launch (no pre-publish admin review).
- Admin can see **all live boosts** (listing / job / RFQ / profile / spotlight) and **take any down** with a **custom reason**.
- Take-down **refunds the leftover (unspent) budget minus a flat ₹25 admin review fee** (never below ₹0). No extra/goodwill refund of already-spent credits.
- The advertiser **sees the reason** on that boost and is **notified**; they may **fix and relaunch** (no hard block in v1).

This is the standard **publish-then-moderate** model.

---

## 1. Context

Today a launched boost is created `pending_review` and only serves after an admin
approves it on the admin ad-review screen (`approve(creativeId)` /
`reject(creativeId, reason)` in `AdsAdminService`). The owner wants the opposite
flow: publish immediately, moderate after the fact. The reject-with-reason path,
budget release, the `rejected` campaign state, and the admin credit tools already
exist — so this is mostly **auto-activate on create** + **surfacing a live-boosts
moderation list** + **deducting the review fee** + **showing the reason to the
advertiser**.

## 2. Lifecycle (new)

```
Launch ─▶ active (serving immediately)
                │  admin opens "Live boosts" in admin panel
                ▼
         Take down + reason ─▶ rejected (stops serving)
                │  refund = max(0, unspent − reviewFee)   (reviewFee default ₹25)
                │  notify advertiser with the reason
                ▼
         Advertiser sees "Taken down: <reason>" on the boost; may edit + relaunch
```

Untouched: `paused`/`resume` (advertiser self-pause) and `completed` (natural end).

## 3. Backend changes (crewroster-backend, `modules/connect/ads`)

1. **Auto-activate on create** — `boost.service.ts buildBundleAndReserve`: create the
   campaign with `status: 'active'` (was `'pending_review'`) and the creative
   `reviewStatus: 'approved'` (was `'pending'`) so it enters the auction immediately.
   Keep emitting `connect.boost.activated`.
2. **Review fee config (admin-tunable)** — add `moderationReviewFee` (number, default
   **25**, min 0) to `ConnectPricingConfig` schema + `CONNECT_PRICING_DEFAULTS` +
   `ConnectPricingView` + `connect-pricing-config.service` (toView + validateWithinGuardrails)
   - `GUARDRAILS` (e.g. max 500) + the admin pricing editor (`AdminPricingEditor.tsx`).
3. **Take-down** — extend the existing `AdsAdminService.reject(creativeId, adminUserId, reason)`
   (or a thin `takeDown` wrapper) so it works on a **live (active/paused)** campaign too:
   - creative.reviewStatus → `rejected`, `rejectionReason` → reason, reviewedBy.
   - campaign.status → `rejected`.
   - `unspent = max(0, totalBudget − budgetSpent)`; `refund = max(0, unspent − reviewFee)`;
     release `refund` to the wallet (the retained `min(unspent, reviewFee)` is the fee).
   - unlink the source's `boostCampaignId` (so the advertiser can relaunch).
   - **notify the advertiser** (new): a Connect notification "Your boost was taken down: <reason>".
   - audit `creative_rejected` (exists) + record the fee withheld in the audit meta.
4. **Admin list of live boosts** — add `AdsAdminService.listLive()` (campaigns in
   `active`/`paused`, newest first) returning the same per-kind view the pending list
   uses (title/kind/owner + spotlight flag + spend/budget). Add an admin controller route.

## 4. Frontend changes (crewroster-web)

1. **Admin "Live boosts"** — in the admin ads area (alongside the existing pending review
   screen): a list of running boosts with kind, advertiser, spend/budget, spotlight badge,
   and a **"Take down"** button → a modal with a required **reason** textarea → calls the
   take-down action → row updates to "Taken down".
2. **Advertiser side — show the reason** — `list()` / `status()` already know the campaign
   is `rejected`; surface `rejectionReason`:
   - `BoostsManagerScreen` rejected row: show **"Taken down: <reason>"** (today it only
     shows a "Rejected" pill).
   - `BoostResults`: a clear "Taken down" banner with the reason + the refunded amount.
3. **Notification** — the advertiser gets a Connect notification with the reason, linking to
   the boost.
4. **i18n** — new keys across en / gu / gu-en / hi-en for: take-down modal, "Taken down:
   {reason}", the refund/fee note, admin live-boosts labels, the notification text.

## 5. Reused vs new

- **Reused:** reject-with-reason + budget release + `rejected` state + `rejectionReason`
  field + admin credit-adjust + the pending-review admin screen scaffolding.
- **New:** auto-activate on create · `moderationReviewFee` config + fee deduction in refund ·
  `listLive()` + admin live-boosts UI + take-down modal · advertiser-facing reason display ·
  the take-down notification.

## 6. Edge cases / rules

- `reviewFee` ≥ leftover → refund **₹0** (never negative; never claws back spent credits).
- Take-down on an already-`completed`/`rejected` boost is a no-op (idempotent).
- Relaunch allowed (existing "edit & resubmit"); no per-item or per-account block in v1
  (revisit if repeat abuse appears).
- Self-pause/resume unaffected by moderation.
- All admin actions JWT-admin-guarded + audit-logged.

## 7. Testing

- BE vitest: auto-activate (campaign `active` + creative `approved` on create); take-down
  refund math (`unspent − fee`, floored at 0; fee ≥ unspent → 0); take-down sets rejected +
  unlinks source + emits notification; `listLive` returns only active/paused; fee config
  guardrail.
- Web: admin live-boosts render + take-down modal (reason required); advertiser rejected
  row + results banner show the reason; i18n parity.

## 8. Out of scope (v1)

- Goodwill/partial refund of spent credits.
- Per-account strikes / hard block on repeat offenders.
- Automated (ML) vulgarity detection — this is manual admin moderation.
