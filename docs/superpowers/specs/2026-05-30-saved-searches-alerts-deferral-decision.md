# Saved searches + alerts - deferral decision (Phase D, piece 2)

Date: 2026-05-30
Status: DECIDED - do not build now. Defer until the trigger below is met.
Decision owner: assistant (owner delegated the call and asked explicitly whether
to build the feature at all).

## The question

Phase D, piece 2 is the §13.4 feature: a member saves a search (query + filters)
with a name and gets alerted on new matches. Two sub-questions were on the table:
should we build it now, and if so, where do saved searches live (server database vs
a device cookie) and how do alerts fire.

## Decision

Do NOT build saved searches + alerts now. Defer the whole feature.

## Why

1. **No liquidity yet, so alerts would fire empty.** Saved-search alerts only pay
   off when there is a steady flow of NEW matching supply (the "catch new listings
   fast" use case). zari360's marketplace just shipped, is unpushed, the marketplace
   menu is not even unlocked (NEXT_PUBLIC_CONNECT_PHASE is still 3), and there is no
   active seller base producing a daily stream of listings. A daily "N new matches"
   alert would almost always be "0 new" - dead weight at launch. Alerts are a scale
   feature, not a launch feature.

2. **The core is unvalidated.** The marketplace and the search redesign have not been
   live-tested or pushed. Build order should validate the core (does search return the
   right things, do listings actually flow) before layering a scale feature on top.
   This is the owner's own standing rule for Phase D: do not build speculatively, wait
   for a real live-tested gap.

3. **It is the heaviest remaining Phase D piece for ~zero current value.** It is a
   logical change: a new SavedSearch collection, a daily cron, a new notification
   category, plus web UI. High cost, near-zero payoff until there is liquidity.

4. **Alert fatigue risk.** Shipping alerts before there is signal-worthy volume trains
   members to ignore the bell, which devalues every other notification.

5. **The cookie route does not rescue the value now.** A device cookie cannot drive
   away-alerts (a server job cannot read a browser cookie), so cookie storage can only
   do "what is new since your last visit" on app open. Pre-liquidity that largely
   duplicates the existing mobile "recent searches" (localStorage), adding little.

## Research note

Saved-search alerts are a flipper / new-supply feature and cause alert fatigue if
fired prematurely or on broad noise; marketplaces must solve the cold-start /
liquidity problem before such features earn their keep. Sources:

- Reforge, "Beat the cold start problem in a marketplace."
- Swoopa, on saved-search alert fatigue ("save a dozen broad searches and your phone
  buzzes nonstop with junk you don't care about").

## Trigger to revisit

Build this when ALL of these hold:

- The marketplace is live and pushed, and the marketplace menu is unlocked
  (NEXT_PUBLIC_CONNECT_PHASE bumped to 4).
- There is real, recurring listing volume (sellers posting regularly).
- There are returning members repeating the same searches (the owner sees the demand
  signal, e.g. via the `connect.search_performed` / `connect.search_no_results`
  PostHog events already emitted by FederatedSearchService).

## Recommended shape WHEN revisited (so the thinking is not lost)

Server-stored, daily-digest, in-app first. NOT a cookie.

- **Storage:** a person-centric `SavedSearch` collection (ownerUserId, name, q,
  filters sub-doc mirroring `SearchConnectAllInput`, type/vertical, alertEnabled,
  lastNotifiedAt, createdAt). Cap ~20 per person (can become a plan perk later).
- **Alert engine:** a daily `@Cron` (the scheduler already runs the trending-tags
  cron). For each alertEnabled saved search, count matches newer than `lastNotifiedAt`
  by querying each targeted vertical's source collection with the saved filters plus
  `createdAt > lastNotifiedAt` (accurate "new since", avoids Meili staleness). If the
  total is > 0, dispatch ONE in-app notification via the existing notifications
  `dispatch()` under a new `connect.saved_search_match` category (mutable in
  preferences like every other category), then set `lastNotifiedAt = now`. Idempotent
  per day. A saved search that errors repeatedly gets its alert auto-paused.
- **Delivery seam:** keep the channel behind an interface so WhatsApp (MSG91 DLT,
  paid, needs a template) or push (FCM/APNs/VAPID, its own epic) can be added later
  without touching the matcher. For a WhatsApp-first audience, WhatsApp away-alerts are
  the real long-term value - which is precisely why a cookie is the wrong base.
- **Web:** a "Save this search" button on the results header (captures current q +
  filters + type) with a name + alert toggle; a "Saved searches" manage page (run,
  toggle alert, rename, delete); the alert notification deep-links to
  `/connect/search` with the saved params. Touches the shared search lane, so do the
  web part only when the concurrent search session is clear.
- **Cleanup / retention:** saved searches persist until the member deletes them,
  bounded by the per-person cap; alert notification rows already carry the 90-day TTL
  from the notifications hardening, so the bell self-prunes; no separate cleanup cron
  is needed.
- **Standards:** feature-flagged, i18n x4, WCAG AA, RED-first tests, audit + PostHog
  on the writes, per the Connect engineering standards.

## Smaller alternative, if a saved-search affordance is wanted before liquidity

Device-stored named bookmarks only (localStorage, no alerts, no backend), reusing the
existing recent-searches store. Cheapest possible. Marginal value over recents today,
so still not recommended now, but it is the minimal first step if the owner wants the
"save" gesture present early.
