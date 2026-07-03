/**
 * Connect analytics event catalog - the single typed source of truth for every
 * product-funnel event Connect emits.
 *
 * What it does: names each event (dot-namespaced, snake-case values, consistent
 * past/-ing tense) and pins the exact property shape it carries, then exposes a
 * type-safe `trackEvent()` wrapper over `lib/analytics.ts > track()`. Surfaces
 * import the name + call `trackEvent(name, props)`; a wrong property shape fails
 * typecheck (see `analytics-events.vitest.ts`).
 *
 * Cross-module links:
 *  - Sink: `lib/analytics.ts` (`track`) fans to PostHog + GA4 and is a no-op when
 *    `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_GA4_MEASUREMENT_ID` are absent, so
 *    everything here is keyless-safe by construction.
 *  - Ads beacons: `features/connect/ads/use-ad-beacons.ts` fires the BILLING
 *    impression/click beacons; the `connect.ad.*` events piggyback those same
 *    triggers (analytics is the sampled/lossy product mirror, never billed from).
 *  - Server mirror: the one server-side event lives in the backend
 *    (`connect.boost.activated`, ads-admin.service) - keep names in the same
 *    `connect.*` family.
 *
 * PII hygiene (binding - see docs/ANALYTICS-EVENTS.md): we deliberately send
 * shapes, not contents. Search sends query LENGTH not the raw string; money
 * sends a BUCKET not the exact amount; ad events carry no viewer identity beyond
 * PostHog's own anonymous/identified id. Do not widen these without updating the
 * doc's PII review note.
 */

import { track } from './analytics';

/* ------------------------------------------------------------------ *
 * Event name constants
 * ------------------------------------------------------------------ */

/**
 * Canonical event names. Use these constants - never a raw string literal at a
 * call site - so renames are one-line and grep is reliable.
 */
export const ConnectEvents = {
  /** A feed post became viewable (>=50% for >=1s); once per post per session. */
  feedPostImpression: 'connect.feed.post_impression',
  /** A feed post was clicked through to one of its targets. */
  feedPostClick: 'connect.feed.post_click',

  /** A promoted unit (boost or adsense) became viewable; mirrors the ad beacon. */
  adImpression: 'connect.ad.impression',
  /** A promoted unit was clicked; mirrors the ad beacon. */
  adClick: 'connect.ad.click',

  /** The "Boost" entry CTA was clicked (before the composer opens). */
  boostCtaClicked: 'connect.boost.cta_clicked',
  /** The boost composer opened (flow started). */
  boostFlowStarted: 'connect.boost.flow_started',
  /** A boost was submitted for review (money about to be committed). */
  boostSubmitted: 'connect.boost.submitted',

  /**
   * A traction-based boost nudge ("X got N views this week -- boost it") was
   * shown / clicked / dismissed. `kind` says which entity type. This funnel
   * measures nudge -> boost conversion against the boost.* flow events above.
   * Links: components/connect/BoostNudgeSlot.tsx (the only emitter), backend
   * me/connect/boost-nudges.
   */
  boostNudgeShown: 'connect.boost.nudge_shown',
  boostNudgeClicked: 'connect.boost.nudge_clicked',
  boostNudgeDismissed: 'connect.boost.nudge_dismissed',

  /** A wallet top-up checkout was opened. */
  walletTopupStarted: 'connect.wallet.topup_started',
  /** A wallet top-up confirmed successfully. */
  walletTopupCompleted: 'connect.wallet.topup_completed',

  /** A marketplace listing detail page was viewed. */
  listingViewed: 'connect.listing.viewed',
  /** The "Contact seller" inquiry composer opened. */
  listingInquiryStarted: 'connect.listing.inquiry_started',
  /** A listing inquiry was sent to the seller. */
  listingInquirySent: 'connect.listing.inquiry_sent',

  /** An RFQ detail page was viewed. */
  rfqViewed: 'connect.rfq.viewed',
  /** The quote composer was opened on an RFQ. */
  rfqQuoteStarted: 'connect.rfq.quote_started',
  /** A quote was submitted to an RFQ. */
  rfqQuoteSubmitted: 'connect.rfq.quote_submitted',

  /** A Connect federated search ran and returned results. */
  searchPerformed: 'connect.search.performed',

  /**
   * A Connect federated search returned ZERO results across every vertical
   * (the dedicated `/connect/search` zero-result state rendered). Fired once per
   * distinct empty search (query length + active vertical) so we can size the
   * "nothing found" funnel and tune synonyms / suggestions. PII RULE: query
   * LENGTH only, never the raw text (mirrors `searchPerformed`).
   * Links: features/connect/search/SearchResultsScreen.tsx (the zero-result
   * branch); pairs with the backend `connect.search_no_results` PostHog event.
   */
  searchNoResults: 'connect.search.no_results',

  /** A Connect video started playing on one of its surfaces. */
  videoPlay: 'connect.video.play',

  /**
   * A reader shaped their feed with a "show me less" control (Phase 7d) - hide /
   * not-interested / mute an author, or hide a sponsored post, plus the undo of
   * each. The `kind` property says which control; `action` says add vs undo.
   * Links: components/connect/PostCard.tsx (the menu), feed.actions
   * addNegativeSignal/removeNegativeSignal, ads hideSponsoredAd.
   */
  feedFeedback: 'connect.feed.feedback',

  /**
   * A creation was blocked because the person hit a plan COUNT limit (listings /
   * storefronts / company pages / open jobs). Fired when the LimitReachedDialog
   * shows. The whole point: measure upsell demand BEFORE pricing launches, so we
   * have data to set prices with. `kind` says which cap, `limit` how high it is.
   * Links: components/connect/LimitReachedDialog.tsx; backend 403
   * `CONNECT_LIMIT_REACHED` from ConnectAllowanceService.
   */
  limitReached: 'connect.limit.reached',
  /**
   * An owner ENTERED the over-limit (grandfathering) state for a kind - i.e. they
   * are now over a count cap. `policy` says what happens next (`freeze` = items
   * stay live, creation blocked; `hide_newest` = newest excess hidden after the
   * grace window). Fired web-side once per episode per session when the client
   * first observes a new over-limit episode (the BE drives the authoritative
   * once-per-episode notification). Links: components/connect/OverLimitBanner.tsx;
   * backend ConnectOverLimitService.
   */
  overLimitEntered: 'connect.limit.over_limit_entered',
  /**
   * An owner is APPROACHING a plan cap for a kind (>= 80% used, the always-on
   * calm counterpart to the over-limit banner). `ratio` is a coarse bucket
   * (0.8 / 0.9 / 1.0) so we can size demand without leaking exact counts.
   * Fired once per surface per session by ConnectUsageMeter / ConnectLimitsCard
   * the first time a meter is observed at or above the near threshold. The
   * point, like limitReached: measure upsell pressure BEFORE pricing launches.
   * Links: components/connect/UsageMeter.tsx (the 80% threshold + nudge),
   * components/connect/ConnectUsageMeter.tsx (the firing), backend
   * ConnectUsageService (GET /me/connect/usage).
   */
  nearLimit: 'connect.limit.near_limit',

  /**
   * A public entity was shared from a ShareButton - listing / store / company /
   * post / job / rfq. `surface` says which entity type, `channel` which path the
   * user took (WhatsApp deep link, the OS native share sheet, or copy-link). The
   * point: see what people share + which channel wins (WhatsApp is the dominant
   * Surat-textile channel) so we invest in the right share affordances.
   * Links: components/connect/ShareButton.tsx (the only emitter); no money, no PII
   * (we send the surface + channel, never the entity id or the recipient).
   */
  share: 'connect.share',

  /**
   * @mention (tag) funnel. `picker_opened` fires when the composer @-dropdown
   * first opens; `added` when a tag is inserted; `clicked` when a rendered tag
   * chip is followed. `surface` = post vs comment; `entity` = which type was
   * tagged. PII: send the entity TYPE + surface only, never the tagged identity
   * or the raw text. Links: components/connect/MentionTextArea.tsx (picker),
   * components/connect/MentionText.tsx (chip click).
   */
  mentionPickerOpened: 'connect.mentions.picker_opened',
  mentionAdded: 'connect.mentions.added',
  mentionClicked: 'connect.mentions.clicked',

  /**
   * Public marketing-site funnel (lead generation). These fire on the unauth
   * landing/product pages (`app/(marketing)/*`), not inside the app. They are
   * the only `marketing.*` events; everything else here is `connect.*`.
   * Links: components/marketing/CtaButton.tsx (cta_clicked),
   * SectionReveal.tsx (page_section_viewed), FaqAccordion.tsx (faq_opened).
   * No PII: we send the page + a position/section/question SLUG, never input.
   */
  marketingCtaClicked: 'marketing.cta_clicked',
  marketingSectionViewed: 'marketing.page_section_viewed',
  marketingFaqOpened: 'marketing.faq_opened',

  /**
   * Pricing plan-interest funnel (sales / marketing signal). Answers "which plan
   * do people actually look at and pick" with NO money or PII on the wire.
   *  - `plan.cta_clicked` fires when a plan card's primary CTA is pressed, on
   *    EITHER the public ERP pricing page (`surface: 'erp_pricing'`) or the
   *    logged-in subscription hub (`surface: 'app_plans'`). Carries the plan
   *    `tier` slug only (e.g. 'free' / 'growth'), never the price.
   *  - `plan.band_selected` fires when a visitor picks a team-size band on the
   *    public ERP recommender; `recommendedTier` is the plan it points them to.
   *    Pure "what size am I / which plan fits me" intent.
   * Links: components/marketing/ErpPricingTable.tsx (both events) +
   * app/account/subscription/plans/page.tsx (cta_clicked, app surface).
   */
  planCtaClicked: 'plan.cta_clicked',
  planBandSelected: 'plan.band_selected',
} as const;

/* ------------------------------------------------------------------ *
 * Shared property value types
 * ------------------------------------------------------------------ */

/** The thing being boosted. Mirrors the backend campaign `kind` (short form). */
export type BoostSubject = 'post' | 'listing' | 'job' | 'open_to_work' | 'hiring' | 'rfq';

/** Where a feed-post click went. */
export type FeedClickTarget = 'media' | 'comments' | 'profile' | 'link';

/** Kind of promoted unit. `boost` = first-party campaign; `adsense` = Google. */
export type AdKind = 'boost' | 'adsense';

/** How the viewer arrived at a listing. */
export type ListingSource = 'feed' | 'search' | 'grid' | 'direct';

/** Surfaces a Connect video can play on. */
export type VideoSurface = 'feed' | 'listing' | 'profile' | 'company' | 'job';

/** The entity type a ShareButton was placed on. */
export type ShareSurface = 'listing' | 'store' | 'company' | 'post' | 'job' | 'rfq' | 'profile';

/** Which share path the user took. `whatsapp` = wa.me deep link; `native` = the
 *  OS share sheet (navigator.share); `copy` = copy-link fallback. */
export type ShareChannel = 'whatsapp' | 'native' | 'copy';

/**
 * A reader feed-feedback control (Phase 7d). The three post-level kinds mirror
 * the backend client kinds; `hide_ad` is the sponsored-post hide (records an
 * ad-side campaign suppression, not a feed negative signal).
 */
export type FeedFeedbackKind = 'hide_post' | 'not_interested' | 'mute_author' | 'hide_ad';

/**
 * The countable Connect resource a creation can be blocked on. Mirrors the
 * backend `ConnectLimitKind` (the `kind` in the `CONNECT_LIMIT_REACHED` 403).
 * Defined here (lib, no feature deps) and imported by the feature limit helper.
 */
export type ConnectLimitKind = 'listing' | 'storefront' | 'company_page' | 'job';

/** A public marketing page that fires the marketing.* funnel events. */
export type MarketingPage = 'home' | 'connect' | 'pricing' | 'erp';

/**
 * Where a plan-interest event fired: the public ERP pricing page or the
 * logged-in subscription hub. Stable slugs, never URLs (no PII). Keep in sync
 * with the `surface` passed at the ErpPricingTable + plans-hub call sites.
 */
export type PlanSurface = 'erp_pricing' | 'app_plans';

/**
 * Coarse money bucket. We never send exact amounts on analytics events (PII /
 * commercial hygiene) - only which band the amount fell into.
 */
export type MoneyBucket =
  | '<100'
  | '100-299'
  | '300-599'
  | '600-999'
  | '1k-2.4k'
  | '2.5k-4.9k'
  | '5k+';

/* ------------------------------------------------------------------ *
 * Per-event property shapes
 * ------------------------------------------------------------------ */

/**
 * The property shape carried by each event. The keys are the literal event
 * names (the values of `ConnectEvents`), so `trackEvent(name, props)` can pin
 * `props` to exactly the right shape and reject anything else at compile time.
 */
export interface ConnectEventProps {
  'connect.feed.post_impression': { postId: string; position: number; tab: string };
  'connect.feed.post_click': { postId: string; target: FeedClickTarget };

  // campaignId omitted for adsense (no first-party campaign) - placement only.
  'connect.ad.impression': { placement: string; kind: AdKind; campaignId?: string };
  'connect.ad.click': { placement: string; kind: AdKind; campaignId?: string };

  'connect.boost.cta_clicked': { subject: BoostSubject };
  'connect.boost.flow_started': { subject: BoostSubject };
  'connect.boost.submitted': { subject: BoostSubject; budgetBucket: MoneyBucket };

  // Traction-nudge funnel. `kind` mirrors the boosted entity type (BoostSubject).
  'connect.boost.nudge_shown': { kind: BoostSubject };
  'connect.boost.nudge_clicked': { kind: BoostSubject };
  'connect.boost.nudge_dismissed': { kind: BoostSubject };

  'connect.wallet.topup_started': { amountBucket: MoneyBucket };
  'connect.wallet.topup_completed': { amountBucket: MoneyBucket };

  'connect.listing.viewed': { listingId: string; source: ListingSource };
  'connect.listing.inquiry_started': { listingId: string };
  'connect.listing.inquiry_sent': { listingId: string };

  'connect.rfq.viewed': { rfqId: string };
  'connect.rfq.quote_started': { rfqId: string };
  'connect.rfq.quote_submitted': { rfqId: string };

  // query LENGTH only, never the raw string - see PII hygiene note above.
  'connect.search.performed': { queryLength: number; vertical: string; resultCount: number };

  // Zero-result search. query LENGTH only (PII hygiene); vertical = the active
  // tab when nothing matched. resultCount is always 0 (kept for shape parity
  // with searchPerformed downstream dashboards).
  'connect.search.no_results': { queryLength: number; vertical: string; resultCount: number };

  'connect.video.play': { surface: VideoSurface };

  'connect.feed.feedback': { kind: FeedFeedbackKind; action: 'add' | 'undo' };

  // limit = the plan cap that was hit; used omitted on purpose (== limit at the
  // gate). No raw amounts/PII - just which cap and how high it is.
  'connect.limit.reached': { kind: ConnectLimitKind; limit: number };

  // Over-limit (grandfathering) entry. `policy` = the plan's over-limit policy
  // for this kind. No raw amounts/PII.
  'connect.limit.over_limit_entered': { kind: ConnectLimitKind; policy: 'freeze' | 'hide_newest' };

  // Approaching a cap. `ratio` is the coarse band (see bucketUsageRatio), never
  // the raw used/limit. `storage` is included alongside the four count kinds
  // because storage pressure is just as useful a demand signal.
  'connect.limit.near_limit': { kind: ConnectLimitKind | 'storage'; ratio: 0.8 | 0.9 | 1 };

  // surface = which entity type; channel = which share path. No entity id / PII.
  'connect.share': { surface: ShareSurface; channel: ShareChannel };

  // @mention funnel. entity = tagged type; surface = post vs comment. No PII
  // (never the tagged identity or the body text).
  'connect.mentions.picker_opened': { surface: 'post' | 'comment' };
  'connect.mentions.added': {
    entity: 'profile' | 'company' | 'storefront';
    surface: 'post' | 'comment';
  };
  'connect.mentions.clicked': { entity: 'profile' | 'company' | 'storefront' };

  // Marketing funnel. position/section/question are stable slugs (e.g. 'hero',
  // 'final', 'modules', 'faq.free'), never user input. page is the page slug.
  'marketing.cta_clicked': { page: MarketingPage; position: string };
  'marketing.page_section_viewed': { page: MarketingPage; section: string };
  'marketing.faq_opened': { page: MarketingPage; question: string };

  // Plan-interest funnel. `tier` is the plan slug (free/starter/growth/business,
  // or any admin-created tier on the in-app hub); `surface` says which pricing
  // surface; `recommended` (marketing only) flags that the clicked card was the
  // live headcount-band recommendation. No price / no PII - slugs only.
  'plan.cta_clicked': { tier: string; surface: PlanSurface; recommended?: boolean };
  // Team-size band picked on the public ERP recommender. Both are stable slugs
  // ('b5'/'b25'/... and the tier they map to); no exact headcount, no PII.
  'plan.band_selected': { band: string; recommendedTier: string };
}

/** Every catalog event name (the literal union). */
export type ConnectEventName = keyof ConnectEventProps;

/* ------------------------------------------------------------------ *
 * Typed emit wrapper
 * ------------------------------------------------------------------ */

/**
 * Type-safe emit for a catalog event. The second argument is constrained to the
 * exact property shape declared for `event`, so a missing/extra/wrong-typed
 * field is a typecheck error. Delegates to `track()`, which is itself a no-op
 * without env keys - so this stays keyless-safe end to end.
 *
 * Prefer this over raw `track()` for any Connect product-funnel event.
 */
export function trackEvent<E extends ConnectEventName>(
  event: E,
  props: ConnectEventProps[E],
): void {
  track(event, props);
}

/* ------------------------------------------------------------------ *
 * Helpers - bucketing + sampling
 * ------------------------------------------------------------------ */

/**
 * Bucket a rupee amount into a coarse band for analytics. Keeps exact spend off
 * the wire while preserving funnel signal (boost budget, wallet top-up size).
 */
export function bucketRupees(amount: number): MoneyBucket {
  const n = Number.isFinite(amount) ? amount : 0;
  if (n < 100) return '<100';
  if (n < 300) return '100-299';
  if (n < 600) return '300-599';
  if (n < 1000) return '600-999';
  if (n < 2500) return '1k-2.4k';
  if (n < 5000) return '2.5k-4.9k';
  return '5k+';
}

/**
 * Bucket a usage ratio (used / limit) into the coarse near-limit band for the
 * connect.limit.near_limit event: 0.8 (80-89%), 0.9 (90-99%), 1.0 (at/over cap).
 * Returns null below the near threshold or when the cap is unlimited (-1) /
 * non-positive, i.e. "no signal". Keeps exact counts off the wire.
 * Used by ConnectUsageMeter / ConnectLimitsCard. Kept in sync with UsageMeter's
 * NEAR_RATIO (0.8) - both describe the same "approaching" threshold.
 */
export function bucketUsageRatio(used: number, limit: number): 0.8 | 0.9 | 1 | null {
  if (limit === -1 || limit <= 0) return null;
  const ratio = used / limit;
  if (ratio >= 1) return 1;
  if (ratio >= 0.9) return 0.9;
  if (ratio >= 0.8) return 0.8;
  return null;
}

/**
 * Client sample rate for high-volume feed post impressions (0..1). 1.0 = emit
 * every viewable post. Dial this down (e.g. 0.25) to reduce event volume later
 * WITHOUT touching the instrumentation - the feed impression path reads it.
 * Ad impressions, clicks, and all funnel events are NOT sampled (they are
 * low-volume and high-value).
 */
export const FEED_IMPRESSION_SAMPLE_RATE = 1.0;

// Session-scoped dedupe for feed impressions. Module-level so it survives the
// PostCard remounts a virtualized feed list causes - "once per post per session"
// means the browser tab's lifetime, not one component mount. Exported reset is
// for tests only.
const firedFeedImpressions = new Set<string>();

/** Test-only: clear the per-session feed-impression dedupe set. */
export function __resetFeedImpressionsForTest(): void {
  firedFeedImpressions.clear();
}

/**
 * Emit `connect.feed.post_impression` at most once per post per session, subject
 * to `FEED_IMPRESSION_SAMPLE_RATE`. Returns true if an event was emitted.
 *
 * `sample` is injectable so tests are deterministic; production passes the
 * default `Math.random`.
 */
export function recordFeedImpression(
  props: ConnectEventProps['connect.feed.post_impression'],
  sample: () => number = Math.random,
): boolean {
  if (firedFeedImpressions.has(props.postId)) return false;
  // Dedupe BEFORE the sample roll so a sampled-out post is not retried on every
  // remount (it stays counted-as-seen for the session).
  firedFeedImpressions.add(props.postId);
  if (FEED_IMPRESSION_SAMPLE_RATE < 1 && sample() >= FEED_IMPRESSION_SAMPLE_RATE) return false;
  trackEvent(ConnectEvents.feedPostImpression, props);
  return true;
}

// Session-scoped dedupe for marketing section views — module-level so a section
// scrolling in and out of view (or a remount) still counts "once per section per
// session". Keyed by `page:section`.
const firedSectionViews = new Set<string>();

/** Test-only: clear the per-session marketing section-view dedupe set. */
export function __resetMarketingSectionViewsForTest(): void {
  firedSectionViews.clear();
}

/**
 * Emit `marketing.page_section_viewed` at most once per section per session.
 * Returns true if an event was emitted. Used by SectionReveal's observer.
 */
export function recordMarketingSectionView(
  props: ConnectEventProps['marketing.page_section_viewed'],
): boolean {
  const key = `${props.page}:${props.section}`;
  if (firedSectionViews.has(key)) return false;
  firedSectionViews.add(key);
  trackEvent(ConnectEvents.marketingSectionViewed, props);
  return true;
}
