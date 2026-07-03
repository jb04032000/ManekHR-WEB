# Connect reference-vs-implementation gap report

Date: 2026-06-02
Purpose: Map every page/flow in the Claude-Design handoff bundle against what is
actually implemented, so the remaining work is explicit and decision-ready. Built
from a read-only audit of all `connect-*.jsx` reference files + the live web app.

Legend: ✅ implemented · 🟡 partial · ⬜ missing.
Classification of gaps: **[BUILDABLE-NOW]** = real data/route exists, just UI ·
**[NET-NEW-DATA]** = needs a new backend field/model/endpoint/integration ·
**[OWNER-DECISION]** = deliberately disabled or a product/credentials call.

## Already implemented (reference page -> our surface)

| Reference file                                 | Our surface                                           | State                                           |
| ---------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| connect-feed.jsx                               | `/connect/feed` (FeedScreen)                          | ✅                                              |
| connect-network.jsx                            | `/connect/network`                                    | ✅ (5 tabs + sub-tabs + filters)                |
| connect-profile.jsx                            | `/connect/profile`, `/u/[slug]`                       | ✅                                              |
| connect-empty.jsx                              | ProfileView empty state                               | ✅                                              |
| connect-company.jsx                            | `/company/[slug]` (CompanyPageView)                   | ✅ + tabs/Products (this initiative)            |
| connect-entity-admin.jsx                       | `/connect/pages` + `/connect/stores`                  | ✅ + console tabs (this initiative)             |
| connect-jobs.jsx                               | `/connect/jobs` (+ detail)                            | ✅ + Find redesign + pipeline (this initiative) |
| connect-marketplace.jsx                        | `/connect/marketplace`                                | ✅ (redesign epic)                              |
| connect-inbox.jsx                              | `/connect/inbox`                                      | ✅                                              |
| connect-leads-rfq.jsx (RFQ board/detail/quote) | `/connect/rfq` (+ `[id]`)                             | ✅                                              |
| connect-composer.jsx                           | `components/connect/Composer` + listing/job composers | ✅                                              |
| connect-onboarding.jsx                         | `features/connect/onboarding/OnboardingClient`        | 🟡 route disabled (OWNER-DECISION)              |
| connect-subtabs.jsx                            | Segmented pattern across modules                      | ✅                                              |
| connect-shell.jsx                              | Connect app shell / nav                               | ✅                                              |
| connect-modules.jsx                            | `/connect/home` -> redirects to feed                  | ✅ (feed IS home, by design)                    |
| connect-settings.jsx                           | `/connect/notifications/preferences`                  | 🟡 (only notif prefs exist)                     |
| connect-verify-onboarding.jsx                  | ERP-linked badge derive only                          | ⬜ verification flows missing                   |
| connect-mobile\*.jsx                           | mobile app (separate repo)                            | out of scope (web polish)                       |

## Done in THIS initiative (the buildable-now gaps)

- Notifications: topic filter chips (Network/Posts/Inquiries/Jobs) + job-tag fix.
- Jobs: 3-column Find (filter rail + wage-strip card) + My-applications status
  pipeline stepper on the seeker's views.
- Companies: public-page tab bar + Products tab (linked-storefront products,
  new `GET /connect/marketplace/public/company-page/:id/listings`); directory
  card hover-cohesion.
- Pages: hub stat-cards + the manage console tab bar (Overview/Posts/Jobs/Settings)
  with a real Overview (open-jobs, visibility, public address, ERP-link state).
- Feed: left-rail quick links completed (My RFQs, Jobs, My shops -> real routes).

## Remaining gaps, by bucket

### A. NET-NEW-DATA / integrations (cannot be faked - need backend or your call)

These are real reference features, but building them without the data/integration
would mean fabricated UI (against the no-stub rule). Each needs a green light +
the noted dependency.

1. **Business verification flows** (connect-verify-onboarding) - GST + Udyam +
   ERP-link request/confirm. Needs: GSTIN verification API, Udyam API, and an
   ERP-link approval workflow (workspace admin confirms). The GST _self-declared_
   capture is already specced in the marketplace epic Phase B; full verification
   is a later integration. Dependency: third-party API credentials.
2. **Leads / deal pipeline (kanban)** (connect-leads-rfq) - a seller "Lead
   Manager" with New/Quoted/Negotiating/Won/Lost. Needs a Lead/Deal model with
   stage + transaction signal. RFQ + quote already exist; the _pipeline_ is net-new.
3. **Reviews + ratings + moderation** (connect-deeper-flows-2) - review model,
   reviews-after-deal, admin moderation queue. = marketplace epic Phase C.
4. **Pinned case studies** on company pages - case-study entity + delivery
   metrics + buyer endorsement. Net-new model.
5. **Caller-ID telephony** (connect-deeper-flows) - cloud-call routing with intent
   context. Needs a telephony provider + anti-abuse. Large; likely far-future.
6. **WhatsApp handoff modal** (connect-leads-rfq) - editable pre-filled WhatsApp
   message. Needs a stored phone field + WhatsApp deep-link policy. (Today all
   "WhatsApp-first" CTAs route to the in-app inbox - the correct interim.)
7. **Voice-note auto-transcription** (connect-composer) - Gu/Hi/En transcription
   service. Recording already works; transcription is the net-new piece.
8. **Quote PDF export** (connect-deeper-flows-2) - the Quote entity exists; a
   PDF/GST-formatted document generator is net-new.
9. **Profile engagement stats + "people also viewed"** (connect-profile) - 30-day
   views/impressions/inquiries + a viewed-together graph. Needs impression
   tracking + aggregates.
10. **Skill endorsements** (connect-profile) - "+ Endorse" action + counts. Needs
    an endorsement model.
11. **Block / mute user + remove-connection action sheet** (connect-deeper-flows)
    - report exists (inbox `ReportDialog`); block/mute/remove are net-new actions.
12. **Full Connect settings system** (connect-settings) - privacy toggles,
    blocked list, quiet hours, channel columns (push/WhatsApp/SMS), data-rights
    (export/delete/consent log). The notification-preferences page already exists
    and is correctly grouped with the one live channel; the rest needs new
    preference fields + DPDP export/delete flows.

### B. OWNER-DECISION (deliberately parked - your call to revive)

- **Onboarding intent route** (`/connect/onboarding`) is intentionally redirected
  to the feed (disabled 2026-05-23: "intent flow didn't capture all fields, data
  not consumed downstream"). Reviving it + adding step-2 (profile setup) and
  step-3 (follow-3) is a product decision, not a silent gap. The
  `OnboardingClient` component is intact and ready if you want it back.
- **Contact-preference selector** on the profile is PAUSED until Phase-7 DM (the
  field exists; the UI is hidden by an explicit 2026-05-20 note).

### C. Minor BUILDABLE-NOW polish (small, safe, not yet done)

- Network: render the inviter's personal note on invitation cards; add the 4th
  PYMK filter ("in your area") - both use fields that already exist.
- Feed: a "Trending designs" rail card is a placeholder; it needs a trending
  ranking query (borderline NET-NEW) so it stays a placeholder for now.

## Recommendation

The reference is ~90% implemented. Everything left is either (A) gated on new
backend/data/credentials - so it should be scheduled as its own slice with the
dependency secured, not faked - or (B) a parked product decision. The marketplace
epic spec already sequences the biggest ones (GST verify = Phase B, reviews =
Phase C). Suggested next real slices, in order of value/cost:

1. Reviews + ratings (Phase C) - unlocks trust signals across company/profile/marketplace.
2. Leads/deal pipeline - turns RFQ + inquiry into a sellable CRM surface.
3. Profile engagement stats + endorsements - cheap-ish, high perceived value.
4. Verification (GST/Udyam/ERP-link) - once API credentials are in hand.
