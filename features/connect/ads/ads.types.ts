/**
 * Shared TypeScript types for the Boost Post / Ads feature.
 *
 * These mirror the backend response shapes exactly:
 *   AdDecision   - POST /connect/ads/decide response
 *   BoostStatus  - GET  /connect/ads/boosts/:id response
 *   WalletView   - GET  /connect/ads/wallet response
 *   ReachEstimate - POST /connect/ads/audience/estimate response
 */

export interface AdDecision {
  impressionToken: string;
  postRef: string;
  campaignId: string;
}

/**
 * The marketplace-rail decision (M2.2). The backend `/connect/ads/decide`
 * response is generalized to carry `creativeKind` + the matching ref; the rail
 * only consumes a promoted_listing win, so this models exactly that. The feed's
 * `AdDecision` above is intentionally left unchanged.
 */
export interface ListingAdDecision {
  impressionToken: string;
  campaignId: string;
  creativeKind: 'promoted_listing';
  listingRef: string;
  /** True when the promoted listing is seeded sample content (denormalized from the
   *  owner's User.isDemo) -> the rail card can show the SampleBadge. Optional; absent
   *  = real. Keep `isDemo` in sync with the BE decide response + every mirror. */
  isDemo?: boolean;
}

/**
 * The feed promoted-profile decision (open-to-work / hiring boosts). The
 * generalized `/connect/ads/decide` response narrowed to a profile win: the feed
 * reads `profileRef` (the advertiser's user id) + `creativeKind` to render the
 * right framing. A no-fill / other win resolves to null.
 */
export interface ProfileAdDecision {
  impressionToken: string;
  campaignId: string;
  creativeKind: 'promoted_open_to_work' | 'promoted_hiring';
  profileRef: string;
  /** True when the promoted profile is a seeded sample person (User.isDemo) -> the
   *  native card can show the SampleBadge. Optional; absent = real advertiser. Keep
   *  `isDemo` in sync with the BE decide response + every Connect mirror. */
  isDemo?: boolean;
}

/**
 * The RFQ-board rail decision (rfq boost). The generalized decide response
 * narrowed to a promoted_rfq win; the board reads `rfqRef` to hydrate the request.
 */
export interface RfqAdDecision {
  impressionToken: string;
  campaignId: string;
  creativeKind: 'promoted_rfq';
  rfqRef: string;
  /** True when the promoted RFQ is seeded sample content (denormalized from the
   *  buyer's User.isDemo) -> the rail card can show the SampleBadge. Optional; absent
   *  = real. Keep `isDemo` in sync with the BE decide response + every mirror. */
  isDemo?: boolean;
}

/**
 * A unified in-feed sponsored decision (Phase 1 "boosts in the feed"). The
 * generalized `/connect/ads/decide` response for the `feed_sponsored` placement,
 * carrying whichever creative kind won + its matching ref. The feed hydrates the
 * ref by kind and renders the matching native card. Any kind can win one feed slot.
 */
export interface SponsoredAdDecision {
  impressionToken: string;
  campaignId: string;
  creativeKind:
    | 'promoted_post'
    | 'promoted_open_to_work'
    | 'promoted_hiring'
    | 'promoted_listing'
    | 'promoted_job'
    | 'promoted_rfq';
  postRef?: string;
  profileRef?: string;
  listingRef?: string;
  jobRef?: string;
  rfqRef?: string;
  /** True when the winning sponsored unit is seeded sample content (denormalized
   *  from the advertiser's User.isDemo) -> the native feed card can show the
   *  SampleBadge. Optional; absent = real. Keep `isDemo` in sync with the BE
   *  feed_sponsored decide response + every Connect mirror. */
  isDemo?: boolean;
}

export interface TargetingInput {
  roles: string[];
  sectors: string[];
  districts: string[];
  companySizes: string[];
  maxConnectionDegree?: number;
}

/**
 * Body for POST /connect/ads/boosts/listing - boost a marketplace listing.
 * Mirrors the backend CreateListingBoostDto: keyed off `listingId`, with only
 * `reach` / `inquiries` objectives (a listing has no profile_visits).
 */
export interface ListingBoostInput {
  listingId: string;
  objective: 'reach' | 'inquiries';
  totalBudget: number;
  days: number;
  targeting: TargetingInput;
  /** Phase 2: optional Spotlight premium upgrade (also serves the premium right-rail). */
  spotlight?: boolean;
}

/**
 * The minimal listing data the listing BoostComposer needs to render a preview of the
 * listing being boosted. Sourced from the seller's own listing (OwnerListing).
 */
export interface ListingBoostTarget {
  _id: string;
  title: string;
  /** Dynamic since sellers may use a custom category (not just the known 8). */
  category: string;
  images: string[];
}

/** Body for POST /connect/ads/boosts/job (Phase 5). */
export interface JobBoostInput {
  jobId: string;
  objective: 'reach' | 'applications';
  totalBudget: number;
  days: number;
  targeting: TargetingInput;
  /** Phase 2: optional Spotlight premium upgrade (also serves the premium right-rail). */
  spotlight?: boolean;
}

/** The minimal job data the BoostComposer needs to preview the boosted job. */
export interface JobBoostTarget {
  _id: string;
  title: string;
  /** Known LISTING_CATEGORIES slug OR a custom term (see categoryLabel). */
  category: string;
}

/**
 * Body for POST /connect/ads/boosts/post - boost a regular feed post.
 * Mirrors the backend CreatePostBoostDto exactly (keyed off `postId`). A post is
 * not commercial, so its objectives are `reach` / `profile_visits` (a post has
 * no inquiries/applications - those belong to listings/jobs). Binds to the LIVE
 * `feed_promoted_post` placement on the backend, so once approved it serves
 * through the EXISTING feed render path (feed page -> AdCard -> PostCard).
 */
export interface PostBoostInput {
  postId: string;
  objective: 'reach' | 'profile_visits';
  totalBudget: number;
  days: number;
  targeting: TargetingInput;
  /** Phase 2: optional Spotlight premium upgrade (also serves the premium right-rail). */
  spotlight?: boolean;
}

/**
 * The minimal post data the BoostComposer needs to preview the boosted post.
 * Sourced from the caller's own public post (getPublicPost). Unlike a listing /
 * job, a post has no category or cover image, so the composer renders a generic
 * "Your post" kicker + a body snippet as the title. `title` is a trimmed snippet
 * of the post body (empty body -> a fallback label supplied by the page).
 */
export interface PostBoostTarget {
  _id: string;
  /** A short snippet of the post body, used in place of a listing/job title. */
  title: string;
}

/**
 * Body for POST /connect/ads/boosts/open-to-work - promote the caller's own
 * profile to employers. No id (the target is the caller's own profile, derived
 * from the JWT). Objectives reach / profile_visits.
 */
export interface OpenToWorkBoostInput {
  objective: 'reach' | 'profile_visits';
  totalBudget: number;
  days: number;
  targeting: TargetingInput;
  /** Phase 2: optional Spotlight premium upgrade (also serves the premium right-rail). */
  spotlight?: boolean;
}

/** Body for POST /connect/ads/boosts/hiring - promote the caller's hiring status. */
export interface HiringBoostInput {
  objective: 'reach' | 'profile_visits';
  totalBudget: number;
  days: number;
  targeting: TargetingInput;
  /** Phase 2: optional Spotlight premium upgrade (also serves the premium right-rail). */
  spotlight?: boolean;
}

/** Body for POST /connect/ads/boosts/rfq - promote a request-for-quote to suppliers. */
export interface RfqBoostInput {
  rfqId: string;
  objective: 'reach' | 'quotes';
  totalBudget: number;
  days: number;
  targeting: TargetingInput;
  /** Phase 2: optional Spotlight premium upgrade (also serves the premium right-rail). */
  spotlight?: boolean;
}

/**
 * Minimal profile data the composer needs to preview an open-to-work / hiring
 * boost. The ad unit is the caller's own profile, so the preview shows the
 * person's name + headline (no listing/job title or cover).
 */
export interface ProfileBoostTarget {
  name: string;
  headline?: string;
}

/** Minimal RFQ data the composer needs to preview an RFQ boost. */
export interface RfqBoostTarget {
  _id: string;
  title: string;
  /** Known LISTING_CATEGORIES slug OR a custom term (see categoryLabel). */
  category: string;
}

export interface BoostStatus {
  status: string;
  objective: string;
  spend: number;
  budgetRemaining: number;
  reach: number;
  views: number;
  clicks: number;
  /**
   * Admin take-down reason (publish-then-moderate). Set when this boost was taken
   * down by an admin; null otherwise. BoostResults shows it as a warning banner.
   * Cross-module: BE getBoost mapper; mirrors BoostListItem.moderationReason.
   */
  moderationReason: string | null;
}

/**
 * Response from creating a boost. Carries the new campaign id so the composer
 * can route to the per-campaign results view. A post is 1:N with campaigns
 * (re-boosting a post creates a new campaign), so results are keyed by the
 * campaign id, not the listing id. The backend returns the campaign document;
 * the createListingBoost action maps it to this shape.
 */
export interface BoostCreated {
  id: string;
  status: string;
  objective: string;
}

export interface WalletView {
  balance: number;
  reserved: number;
  /**
   * Expiring plan-included / admin-granted boost credits, spent BEFORE purchased
   * `balance` (grant-first). CN-ADS-4/CN-ADS-15: the composer's affordability gate
   * reads `balance + grantBalance` as the spendable total so a user whose credits
   * sit in the grant bucket is not falsely told "insufficient balance". Optional
   * for back-compat with any cached/legacy response missing it (treated as 0).
   * Keep in sync with the backend wallet GET view (wallet.controller.ts).
   */
  grantBalance?: number;
}

/**
 * Razorpay order created by the backend for an ads-wallet top-up.
 *
 * Mirrors POST /connect/ads/wallet/topup/order. `amount` is in PAISE (Razorpay
 * charges paise); it is passed straight through to openCheckout as amountPaise.
 * The face value the user picked is whole RUPEES on our side.
 */
export interface WalletTopupOrder {
  keyId: string;
  orderId: string;
  amount: number /* paise */;
  currency: string;
  walletTopupId: string;
}

/**
 * Payload sent to POST /connect/ads/wallet/topup/confirm after the Razorpay
 * checkout sheet captures a payment. The signature is verified server-side.
 */
export interface ConfirmWalletTopupPayload {
  walletTopupId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface ReachEstimate {
  reach: number;
  belowFloor: boolean;
}

// ---------------------------------------------------------------------------
// Boosts manager (the caller's own campaigns - GET /connect/ads/boosts[/stats])
// ---------------------------------------------------------------------------

/** The campaign kinds the manager can render. Mirrors the BE enum. */
export type BoostKind =
  | 'boost_post'
  | 'boost_listing'
  | 'boost_job'
  | 'boost_open_to_work'
  | 'boost_hiring'
  | 'boost_rfq';

/**
 * Lifecycle state of a campaign. Mirrors the BE `AdCampaign.status` enum.
 * The manager maps these to its four tabs (active+paused -> Active,
 * pending_review/future-start -> Scheduled, completed -> Completed,
 * draft+rejected -> Drafts).
 */
export type BoostManagerStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'paused'
  | 'completed'
  | 'rejected';

/**
 * One row in the boosts manager list - mirrors the BE `BoostListItem` from
 * `GET /connect/ads/boosts` exactly. `startAt` / `endAt` are `Date` on the
 * backend and serialize to ISO strings over HTTP.
 *
 * Money fields (`totalBudget`, `budgetSpent`, `spend`, `costPerClick`) are
 * whole RUPEES. `impressions` is the REAL lifetime reach; `spend` is the
 * rollup lifetime spend; `ctr` and `costPerClick` are zero-safe derived
 * ratios. No inquiry / conversion metric exists - it is not attributed.
 */
export interface BoostListItem {
  id: string;
  kind: BoostKind;
  objective: string;
  status: BoostManagerStatus;
  /**
   * Admin take-down reason (publish-then-moderate). Set when a LIVE boost was
   * taken down by an admin (status flips to `rejected`); null otherwise. Shown to
   * the advertiser on the rejected row. Cross-module: BE BoostListItem mapper +
   * admin take-down (reject) path; AdminAdReview "Take down" sets it.
   */
  moderationReason: string | null;
  totalBudget: number;
  budgetSpent: number;
  /** ISO date string (BE `Date`). Scheduled start. */
  startAt: string;
  /** ISO date string (BE `Date`). Campaign auto-completes when this passes. */
  endAt: string;
  /** Source listing id when `kind === 'boost_listing'`, else null. */
  sourceListingId: string | null;
  /** Source job id when `kind === 'boost_job'`, else null. */
  sourceJobId: string | null;
  /** Source post id when `kind === 'boost_post'`, else null. Used to deep-link a
   *  post boost back into its composer from the manager ("Boost again"). */
  sourcePostId: string | null;
  /** Source RFQ id when `kind === 'boost_rfq'`, else null. */
  sourceRfqId: string | null;
  /** Promoted profile owner when `kind` is a profile boost, else null. */
  sourceProfileUserId: string | null;
  /**
   * The boosted item's display name, BE-resolved per kind (listing/job/rfq title,
   * post text snippet, or the profile owner's headline). Null when the source is
   * gone. The manager row shows this as its bold title (falls back to the kind /
   * objective label when null). Cross-module: BE BoostListItem.sourceTitle mapper.
   */
  sourceTitle: string | null;
  /**
   * The boosted item's thumbnail (listing cover, etc.), or null when none. The
   * row shows it in place of the generic kind icon when set. Cross-module: BE
   * BoostListItem.sourceImage mapper.
   */
  sourceImage: string | null;
  /** Lifetime impressions. Labelled "Reach" in the manager UI. */
  impressions: number;
  clicks: number;
  /** Lifetime spend, whole rupees. */
  spend: number;
  /** Click-through rate: clicks / impressions, zero-safe (0..1). */
  ctr: number;
  /** Average cost per click in rupees: spend / clicks, zero-safe. */
  costPerClick: number;
}

/**
 * KPI aggregates for the caller's account - mirrors the BE `BoostStatsView`
 * from `GET /connect/ads/boosts/stats`. All values are REAL; there is no
 * inquiry / conversion KPI (not attributed). `spendThisMonth` is whole rupees.
 */
export interface BoostStatsView {
  /** Campaigns currently in `active` status. */
  activeCount: number;
  /** Sum of impressions over the caller's rollups in the last 30 IST days. */
  reach30d: number;
  /** Sum of clicks over the caller's rollups in the last 30 IST days. */
  clicks30d: number;
  /** Sum of spend over the caller's rollups in the current IST month (rupees). */
  spendThisMonth: number;
}

// ---------------------------------------------------------------------------
// Boosts-hub quick-start (the caller's boostable items + intents)
// GET /connect/ads/boostable
// ---------------------------------------------------------------------------

/**
 * One quick-start "boost something" candidate the caller owns and is eligible to
 * boost right now. Mirrors the BE `BoostableItem`. Eligibility is pre-checked
 * server-side (status gate mirrors the create gates) so the card can always
 * deep-link straight into the matching composer. General feed posts are NOT
 * boostable (owner decision 2026-06-17), so only listing/job kinds appear.
 */
export interface BoostableItem {
  id: string;
  kind: 'boost_listing' | 'boost_job' | 'boost_rfq';
  title: string;
  /** Listing cover image; null for a job / RFQ. */
  image: string | null;
  /** Short secondary label: listing category, or job role/category, or RFQ category. */
  subtitle: string | null;
  /** Lifetime organic views (jobs only); null when the source has no counter. */
  views: number | null;
}

/**
 * The caller's boostable items grouped by type + active profile intents. Mirrors
 * the BE `BoostableSummary` from GET /connect/ads/boostable. `counts` are the
 * total eligible per type (lists are capped) for a "See all (N)" link.
 */
export interface BoostableSummary {
  listings: BoostableItem[];
  jobs: BoostableItem[];
  /** The caller's open RFQs eligible to boost now. */
  rfqs: BoostableItem[];
  counts: { listings: number; jobs: number; rfqs: number };
  intents: { work: boolean; hiring: boolean; deals: boolean; customOrders: boolean };
}

// ---------------------------------------------------------------------------
// Admin review surface (platform-admin only)
// ---------------------------------------------------------------------------

/** Parent-campaign context the review queue carries for each pending creative. */
export interface AdminCampaignContext {
  objective: string;
  totalBudget: number;
  ownerUserId: string;
}

/**
 * A creative awaiting review, enriched with its campaign context. Mirrors the
 * backend `PendingCreativeView`. ObjectId fields serialize to strings over HTTP.
 */
export interface AdminPendingCreative {
  _id: string;
  reviewStatus: string;
  campaignId: string;
  /** Set for a promoted_post creative; null/absent for other kinds. */
  postRef?: string | null;
  /** The boosted listing (promoted_listing). */
  listingRef?: string | null;
  /** The boosted job (promoted_job). */
  jobRef?: string | null;
  /** Advertiser's own profile (promoted_open_to_work / promoted_hiring); = ownerUserId. */
  profileRef?: string | null;
  /** The boosted RFQ (promoted_rfq). */
  rfqRef?: string | null;
  /** Title of the boosted listing / job / RFQ (BE-surfaced per kind); null otherwise. */
  listingTitle?: string | null;
  jobTitle?: string | null;
  rfqTitle?: string | null;
  kind: string;
  createdAt?: string;
  campaign: AdminCampaignContext | null;
}

/** Result of an approve/reject review action. */
export interface ReviewActionResult {
  creativeId: string;
  campaignId: string;
  status: string;
}

/** A placement slot the admin can configure. Mirrors the backend `AdPlacement`. */
export interface AdPlacementView {
  _id: string;
  key: string;
  surface: string;
  /** Floor CPM in credits per 1000 impressions. */
  floorCpm: number;
  enabled: boolean;
}

/** Platform-wide ad revenue rollup. */
export interface AdRevenue {
  revenue: number;
}

/**
 * The admin-tunable pricing levers (boost bid / min budget / durations + wallet
 * top-up min / presets). Mirrors the backend `ConnectPricingView`. Read by the
 * boost composer + wallet panel (public endpoint) and edited in the admin ad
 * console (admin endpoint). Cross-module link: crewroster-backend
 * connect/ads/schemas/connect-pricing-config.schema.ts.
 */
export interface ConnectPricingView {
  boostBidCpm: number;
  boostBidCpc: number;
  /** Premium multiplier applied to the bid for the Spotlight upgrade (Phase 2). */
  spotlightMultiplier: number;
  boostMinBudget: number;
  boostDurations: number[];
  boostBudgetPresets: number[];
  walletTopupMinAmount: number;
  walletTopupPresets: number[];
  /**
   * Credits withheld from the refund when an admin takes a LIVE boost down
   * (publish-then-moderate review fee). The advertiser is refunded the unspent
   * budget MINUS this fee. Admin-tunable, default Rs 25 on the backend. Edited in
   * AdminPricingEditor. Cross-module: BE connect-pricing-config + the take-down
   * (reject-on-live) refund path.
   */
  moderationReviewFee: number;
}

/**
 * One LIVE boost in the admin take-down view (publish-then-moderate). Mirrors the
 * backend `GET /admin/connect/ads/live` item, which reuses the pending-review
 * item shape (campaign/creative ids + per-kind title/ref) for an active or paused
 * campaign, plus a `spotlight` flag. The admin takes one down via the existing
 * reject action (POST review/:creativeId/reject), which on a live boost also
 * withholds the review fee, unlinks, and notifies the advertiser server-side.
 * Cross-module: extends AdminPendingCreative; rendered by AdminAdReview.
 */
export interface AdminLiveBoost extends AdminPendingCreative {
  /** True when this boost carries the Spotlight premium upgrade (Phase 2). */
  spotlight: boolean;
}
