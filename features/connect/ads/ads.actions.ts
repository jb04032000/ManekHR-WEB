'use server';

/**
 * Server actions for the Boost Post / Ads surface.
 *
 * Wraps the BE `/connect/ads/*` endpoints. The authenticated Connect user is
 * derived from the JWT on the backend (req.user.sub) - no advertiser id or
 * workspaceId is ever sent in the request body.
 *
 * All actions return the discriminated `ActionResult<T>` shape used by every
 * Connect server action.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type {
  AdDecision,
  ListingAdDecision,
  ProfileAdDecision,
  RfqAdDecision,
  SponsoredAdDecision,
  BoostableSummary,
  BoostCreated,
  BoostListItem,
  BoostStatsView,
  ListingBoostInput,
  JobBoostInput,
  PostBoostInput,
  OpenToWorkBoostInput,
  HiringBoostInput,
  RfqBoostInput,
  BoostStatus,
  ConfirmWalletTopupPayload,
  ReachEstimate,
  TargetingInput,
  WalletTopupOrder,
  WalletView,
  ConnectPricingView,
} from './ads.types';

function toError(e: unknown): string {
  // Surface the BACKEND's real message (e.g. "This listing already has an active
  // boost", "insufficient wallet balance") instead of axios's generic "Request
  // failed with status code 400". Nest sends `{ message }` (string or a
  // class-validator string[]); a global filter may nest it under `error.message`.
  const data = (
    e as { response?: { data?: { error?: { message?: string }; message?: string | string[] } } }
  )?.response?.data;
  if (data) {
    const msg = data.error?.message ?? data.message;
    if (Array.isArray(msg) && msg.length > 0) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim() !== '') return msg;
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

/**
 * Create a new boost campaign for a marketplace listing (M2.1).
 *
 * Posts to /connect/ads/boosts/listing. The backend gates the listing (owner +
 * approved) and reserves the budget from the person wallet (grant credits, which
 * carry a premium plan's included boosts, are spent first). Returns the created
 * campaign mapped to the shared `BoostCreated` shape so the composer routes to
 * the same per-campaign results view used by post boosts.
 */
export async function createListingBoost(
  input: ListingBoostInput,
): Promise<ActionResult<BoostCreated>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/boosts/listing', input);
    const raw = unwrapServer<{ _id?: string; id?: string; status: string; objective: string }>(res);
    return {
      ok: true,
      data: { id: String(raw._id ?? raw.id), status: raw.status, objective: raw.objective },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Create a new boost campaign for a job (Phase 5). Posts to
 * /connect/ads/boosts/job. The backend gates the job (owner + open) and reserves
 * the budget; returns the campaign mapped to the shared `BoostCreated` shape so
 * the composer routes to the same per-campaign results view.
 */
export async function createJobBoost(input: JobBoostInput): Promise<ActionResult<BoostCreated>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/boosts/job', input);
    const raw = unwrapServer<{ _id?: string; id?: string; status: string; objective: string }>(res);
    return {
      ok: true,
      data: { id: String(raw._id ?? raw.id), status: raw.status, objective: raw.objective },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Create a new boost campaign for a regular feed post. Posts to
 * /connect/ads/boosts/post. The backend gates the post (must be the AUTHOR, the
 * post must be `public`, not deleted, not already boosted) and reserves the
 * budget; it binds the boost to the LIVE `feed_promoted_post` placement, so once
 * approved it serves through the EXISTING feed render path (feed page decideAd ->
 * AdCard promoted branch -> PostCard). Returns the campaign mapped to the shared
 * `BoostCreated` shape so the composer routes to the same per-campaign results
 * view used by listing/job boosts. Mirrors createJobBoost exactly.
 */
export async function createPostBoost(input: PostBoostInput): Promise<ActionResult<BoostCreated>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/boosts/post', input);
    const raw = unwrapServer<{ _id?: string; id?: string; status: string; objective: string }>(res);
    return {
      ok: true,
      data: { id: String(raw._id ?? raw.id), status: raw.status, objective: raw.objective },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Create an "open to work" boost on the caller's own profile (reaches employers).
 * Posts to /connect/ads/boosts/open-to-work. The backend gates `openTo.work` on +
 * one-in-flight, reserves the budget, and serves on the feed_promoted_profile
 * slot. Returns the campaign mapped to the shared `BoostCreated` shape.
 */
export async function createOpenToWorkBoost(
  input: OpenToWorkBoostInput,
): Promise<ActionResult<BoostCreated>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/boosts/open-to-work', input);
    const raw = unwrapServer<{ _id?: string; id?: string; status: string; objective: string }>(res);
    return {
      ok: true,
      data: { id: String(raw._id ?? raw.id), status: raw.status, objective: raw.objective },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Create a "hiring" boost on the caller's own profile (reaches workers). Posts to
 * /connect/ads/boosts/hiring. Profile/intent level - no specific job post. The
 * backend gates `openTo.hiring` on + one-in-flight and reserves the budget.
 */
export async function createHiringBoost(
  input: HiringBoostInput,
): Promise<ActionResult<BoostCreated>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/boosts/hiring', input);
    const raw = unwrapServer<{ _id?: string; id?: string; status: string; objective: string }>(res);
    return {
      ok: true,
      data: { id: String(raw._id ?? raw.id), status: raw.status, objective: raw.objective },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Create an RFQ (quotation request) boost (reaches suppliers). Posts to
 * /connect/ads/boosts/rfq. The backend gates the RFQ (owner + open), reserves the
 * budget, and serves on the rfq_board rail placement.
 */
export async function createRfqBoost(input: RfqBoostInput): Promise<ActionResult<BoostCreated>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/boosts/rfq', input);
    const raw = unwrapServer<{ _id?: string; id?: string; status: string; objective: string }>(res);
    return {
      ok: true,
      data: { id: String(raw._id ?? raw.id), status: raw.status, objective: raw.objective },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Hide a sponsored post (Phase 7d). Records a per-(viewer, campaign) suppression
 * so that campaign stops serving to THIS viewer - the ad-side equivalent of feed
 * `not_interested`. The viewer comes from the JWT on the backend; only the
 * campaign id is sent. Idempotent. Links: PostCard sponsored "Hide" -> here ->
 * BE `/connect/ads/hide` -> AdFairnessService.suppressCampaign.
 */
export async function hideSponsoredAd(campaignId: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    await http.post('/connect/ads/hide', { campaignId });
    // The BE returns 204 No Content - no body to unwrap.
    return { ok: true, data: { ok: true } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Fetch the current status and metrics for a boost campaign. */
export async function getBoost(id: string): Promise<ActionResult<BoostStatus>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/ads/boosts/${id}`);
    return { ok: true, data: unwrapServer<BoostStatus>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
// pauseBoost / resumeBoost / cancelBoost let a user stop their own live boost.
// They are disabled so only an admin controls a live boost; the backend also
// disabled the matching routes (boost.controller.ts), so re-enabling here needs
// the BE routes switched back on too. Admin take-down stays on its own path
// (ads-admin.*). Commented out (not deleted) so they can be turned back on as-is.
//
// /** Pause a live boost campaign. Cross-module: BE POST /connect/ads/boosts/:id/pause. */
// export async function pauseBoost(id: string): Promise<ActionResult<BoostStatus>> {
//   try {
//     const http = await serverHttp();
//     const res = await http.post(`/connect/ads/boosts/${id}/pause`, {});
//     return { ok: true, data: unwrapServer<BoostStatus>(res) };
//   } catch (e) {
//     return { ok: false, error: toError(e) };
//   }
// }
//
// /** Resume a paused boost campaign. Cross-module: BE POST /connect/ads/boosts/:id/resume. */
// export async function resumeBoost(id: string): Promise<ActionResult<BoostStatus>> {
//   try {
//     const http = await serverHttp();
//     const res = await http.post(`/connect/ads/boosts/${id}/resume`, {});
//     return { ok: true, data: unwrapServer<BoostStatus>(res) };
//   } catch (e) {
//     return { ok: false, error: toError(e) };
//   }
// }
//
// /** Cancel a boost campaign (BE refunds unused budget). Cross-module: BE POST /connect/ads/boosts/:id/cancel. */
// export async function cancelBoost(id: string): Promise<ActionResult<BoostStatus>> {
//   try {
//     const http = await serverHttp();
//     const res = await http.post(`/connect/ads/boosts/${id}/cancel`, {});
//     return { ok: true, data: unwrapServer<BoostStatus>(res) };
//   } catch (e) {
//     return { ok: false, error: toError(e) };
//   }
// }

/**
 * List every boost campaign owned by the caller (newest first), each carrying
 * REAL lifetime metrics (reach / clicks / spend + zero-safe ctr + costPerClick)
 * from the ad rollups. All lifecycle statuses are returned; the boosts manager
 * tabs them client-side. JWT-scoped on the backend - only the caller's own
 * campaigns are ever returned.
 */
export async function listBoosts(): Promise<ActionResult<BoostListItem[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/ads/boosts');
    return { ok: true, data: unwrapServer<BoostListItem[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * KPI aggregates for the caller's boost account: active campaign count, 30-day
 * reach + clicks, and current-month spend. All values are REAL (no inquiry /
 * conversion KPI - that is not attributed). JWT-scoped on the backend.
 */
export async function getBoostStats(): Promise<ActionResult<BoostStatsView>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/ads/boosts/stats');
    return { ok: true, data: unwrapServer<BoostStatsView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * The caller's quick-start "boost something" candidates: their own listings +
 * jobs eligible to boost now (status gate mirrors the create gates) + active
 * profile intents. Powers the Boosts-hub quick-start. JWT-scoped on the backend.
 * General posts are not boostable, so they never appear. Backend:
 * GET /connect/ads/boosts/boostable.
 */
export async function getBoostable(): Promise<ActionResult<BoostableSummary>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/ads/boosts/boostable');
    return { ok: true, data: unwrapServer<BoostableSummary>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Get the caller's ads wallet balance and reserved amount. */
export async function getWallet(): Promise<ActionResult<WalletView>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/ads/wallet');
    return { ok: true, data: unwrapServer<WalletView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Read the live, admin-tunable pricing levers (boost min budget + allowed
 * durations + suggested budgets, and the wallet top-up min + suggested amounts).
 * The boost composer + wallet panel call this so a price/duration change made in
 * the admin console is reflected without a web deploy; both fall back to their
 * built-in constants if this fails. Backend: GET /connect/ads/pricing (cached).
 */
export async function getConnectPricing(): Promise<ActionResult<ConnectPricingView>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/ads/pricing');
    return { ok: true, data: unwrapServer<ConnectPricingView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Create a Razorpay order to top up the caller's ads wallet.
 *
 * `amount` is whole RUPEES (min 99, enforced by the backend DTO). The returned
 * order carries the keyId + orderId for the Razorpay checkout sheet and the
 * walletTopupId we echo back on confirm. `order.amount` is in PAISE.
 */
export async function createWalletTopupOrder(
  amount: number,
): Promise<ActionResult<WalletTopupOrder>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/wallet/topup/order', { amount });
    return { ok: true, data: unwrapServer<WalletTopupOrder>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Confirm a wallet top-up after the Razorpay sheet captures the payment.
 *
 * The backend verifies the signature, credits the wallet (face amount in
 * rupees), and returns the updated wallet view.
 */
export async function confirmWalletTopup(
  payload: ConfirmWalletTopupPayload,
): Promise<ActionResult<WalletView>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/wallet/topup/confirm', payload);
    return { ok: true, data: unwrapServer<WalletView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Estimate the potential audience size for a given targeting configuration. */
export async function estimateAudience(
  targeting: TargetingInput,
): Promise<ActionResult<ReachEstimate>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/audience/estimate', { targeting });
    return { ok: true, data: unwrapServer<ReachEstimate>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Request an ad decision for a placement slot.
 * Returns null inside the `data` envelope when no eligible campaign is found
 * (the backend returns an empty/null payload), so callers must handle both.
 */
export async function decideAd(
  placementKey: string,
  // Per-page-render id for cross-slot dedupe (fairness C5). Optional; when two
  // slots on one page pass the same id, a campaign wins at most one of them.
  pageRequestId?: string,
): Promise<ActionResult<AdDecision | null>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/decide', { placementKey, pageRequestId });
    const raw = unwrapServer<{
      impressionToken?: string;
      campaignId?: string;
      postRef?: string;
      creativeKind?: string;
    } | null>(res);
    // The decide endpoint is generalized across surfaces; the feed serves ONLY
    // a promoted_post win. Reject a promoted_listing win (or any payload without
    // a postRef) so a listing can never leak into the feed render path. Inverse
    // of the guard in `decideListingAd`.
    if (
      !raw ||
      raw.creativeKind === 'promoted_listing' ||
      !raw.postRef ||
      !raw.impressionToken ||
      !raw.campaignId
    ) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: {
        impressionToken: raw.impressionToken,
        campaignId: raw.campaignId,
        postRef: raw.postRef,
      },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Request a marketplace-rail ad decision (M2.2). Hits the same
 * `/connect/ads/decide` endpoint as the feed, but maps the generalized response
 * to a `ListingAdDecision`: only a `promoted_listing` win with a `listingRef` is
 * returned; a no-fill, a post win, or a malformed payload all resolve to `null`
 * so the rail simply renders nothing. Never throws into the marketplace render.
 */
export async function decideListingAd(
  placementKey: string,
  // Per-page-render id for cross-slot dedupe (fairness C5). The marketplace
  // resolves rail + grid in one render; passing the same id here stops one
  // campaign filling both slots.
  pageRequestId?: string,
): Promise<ActionResult<ListingAdDecision | null>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/decide', { placementKey, pageRequestId });
    const raw = unwrapServer<{
      impressionToken?: string;
      campaignId?: string;
      creativeKind?: string;
      listingRef?: string;
    } | null>(res);
    if (
      !raw ||
      raw.creativeKind !== 'promoted_listing' ||
      !raw.listingRef ||
      !raw.impressionToken ||
      !raw.campaignId
    ) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: {
        impressionToken: raw.impressionToken,
        campaignId: raw.campaignId,
        creativeKind: 'promoted_listing',
        listingRef: raw.listingRef,
      },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Request a feed promoted-profile decision (open-to-work / hiring boosts). Hits
 * the same `/connect/ads/decide` endpoint but maps the generalized response to a
 * `ProfileAdDecision`: only a promoted_open_to_work / promoted_hiring win with a
 * `profileRef` is returned; anything else resolves to null so the feed renders no
 * profile ad. Never throws into the feed render. Inverse of the `decideAd` guard.
 */
export async function decideProfileAd(
  placementKey: string,
  pageRequestId?: string,
): Promise<ActionResult<ProfileAdDecision | null>> {
  try {
    const http = await serverHttp();
    // CN-ADS-8 (feed harden Bucket 8): pass `kinds` so the BE auction only
    // CONSIDERS profile boosts for this promoted-profile slot, instead of running
    // the shared auction and discarding a non-profile winner client-side below
    // (which wasted the slot when a post/listing boost outbid the profile ones).
    // The client-side guard stays as defense-in-depth.
    const res = await http.post('/connect/ads/decide', {
      placementKey,
      pageRequestId,
      kinds: ['promoted_open_to_work', 'promoted_hiring'],
    });
    const raw = unwrapServer<{
      impressionToken?: string;
      campaignId?: string;
      creativeKind?: string;
      profileRef?: string;
    } | null>(res);
    if (
      !raw ||
      (raw.creativeKind !== 'promoted_open_to_work' && raw.creativeKind !== 'promoted_hiring') ||
      !raw.profileRef ||
      !raw.impressionToken ||
      !raw.campaignId
    ) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: {
        impressionToken: raw.impressionToken,
        campaignId: raw.campaignId,
        creativeKind: raw.creativeKind,
        profileRef: raw.profileRef,
      },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Request an RFQ-board rail decision (rfq boost). Maps the generalized decide
 * response to an `RfqAdDecision`: only a promoted_rfq win with an `rfqRef` is
 * returned; anything else resolves to null so the board renders no first-party ad.
 */
export async function decideRfqAd(
  placementKey: string,
  pageRequestId?: string,
): Promise<ActionResult<RfqAdDecision | null>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/ads/decide', { placementKey, pageRequestId });
    const raw = unwrapServer<{
      impressionToken?: string;
      campaignId?: string;
      creativeKind?: string;
      rfqRef?: string;
    } | null>(res);
    if (
      !raw ||
      raw.creativeKind !== 'promoted_rfq' ||
      !raw.rfqRef ||
      !raw.impressionToken ||
      !raw.campaignId
    ) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: {
        impressionToken: raw.impressionToken,
        campaignId: raw.campaignId,
        creativeKind: 'promoted_rfq',
        rfqRef: raw.rfqRef,
      },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Request a unified in-feed sponsored decision (Phase 1). Hits the same
 * `/connect/ads/decide` endpoint for the `feed_sponsored` placement and returns
 * the raw winning decision for ANY boost kind (post / profile / listing / job /
 * rfq) with its matching ref; the feed hydrates by kind and renders the right
 * card. Returns null on a no-fill / malformed payload. Call it once per feed
 * sponsored slot, passing the SAME pageRequestId so the per-page dedup gives a
 * distinct campaign each slot. Never throws into the feed render.
 */
export async function decideSponsoredAd(
  placementKey: string,
  pageRequestId?: string,
): Promise<ActionResult<SponsoredAdDecision | null>> {
  try {
    const http = await serverHttp();
    // Fail-fast timeout (5s) instead of the shared 15s default: this best-effort
    // sponsored decision is awaited inside the feed page's blocking render
    // (app/connect/feed/page.tsx -- the feed_sponsored slots in the Promise.all
    // AND the sequential dedup loop, plus the spotlight_rail card). A slow/cold-
    // start backend on this NON-critical ad call would otherwise hold the whole
    // feed render for the full 15s before it degrades; the feed already drops a
    // no-decision slot, so capping it is safe. Feed-only action, so hardcoded
    // (unlike the reused rail actions, which take an optional timeout). Keep in
    // sync with the best-effort rail timeouts in the feed page + getTrendingRail.
    const res = await http.post(
      '/connect/ads/decide',
      { placementKey, pageRequestId },
      { timeout: 5000 },
    );
    const raw = unwrapServer<{
      impressionToken?: string;
      campaignId?: string;
      creativeKind?: string;
      postRef?: string;
      profileRef?: string;
      listingRef?: string;
      jobRef?: string;
      rfqRef?: string;
    } | null>(res);
    // Validate the winning kind carries the ref the feed needs to hydrate it.
    const refByKind: Record<string, string | undefined> = {
      promoted_post: raw?.postRef,
      promoted_open_to_work: raw?.profileRef,
      promoted_hiring: raw?.profileRef,
      promoted_listing: raw?.listingRef,
      promoted_job: raw?.jobRef,
      promoted_rfq: raw?.rfqRef,
    };
    if (
      !raw ||
      !raw.impressionToken ||
      !raw.campaignId ||
      !raw.creativeKind ||
      !(raw.creativeKind in refByKind) ||
      !refByKind[raw.creativeKind]
    ) {
      return { ok: true, data: null };
    }
    return { ok: true, data: raw as SponsoredAdDecision };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Record that an ad impression occurred (fire-and-forget; errors are swallowed). */
export async function recordImpression(token: string): Promise<void> {
  try {
    const http = await serverHttp();
    await http.post('/connect/ads/events/impression', { impressionToken: token });
  } catch {
    // Impression tracking is best-effort; do not surface failures to the user.
  }
}

/** Record that an ad was clicked (fire-and-forget; errors are swallowed). */
export async function recordClick(token: string): Promise<void> {
  try {
    const http = await serverHttp();
    await http.post('/connect/ads/events/click', { impressionToken: token });
  } catch {
    // Click tracking is best-effort; do not surface failures to the user.
  }
}
