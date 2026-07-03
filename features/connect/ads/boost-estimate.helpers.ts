/**
 * boost-estimate.helpers.ts - pure delivery-estimate math for the Boost
 * configurator.
 *
 * No I/O, no React, no AntD. Safe to import in tests and in server code.
 *
 * The audience size that feeds this helper is REAL: it comes from the backend
 * `/connect/ads/audience/estimate` endpoint (the count of members who match the
 * targeting). What this helper produces - reach and inquiries - are clearly
 * labelled ESTIMATES in the UI: forecasts derived from the budget, the run
 * length, and two documented planning constants below. They are not promises.
 *
 * MONEY UNIT: `budget` here is the DAILY budget in whole credits (rupees). The
 * composer stores a TOTAL budget for the backend contract; it divides by the
 * run length to get a daily figure before calling this helper, so `budget *
 * days` reconstructs the total spend that buys impressions.
 */

/**
 * Planning CPM: assumed cost in credits to buy 1000 impressions on Connect.
 *
 * Used to turn a credit spend into an impression count:
 *   impressions = spend / ASSUMED_CPM * 1000
 *
 * This is a forecasting assumption for the pre-launch estimate only. The live
 * auction floor CPM per placement (see `AdPlacementView.floorCpm`) governs
 * actual delivery; we never charge more than the booked total.
 */
export const ASSUMED_CPM = 35;

/**
 * Planning inquiry rate: assumed share of reached members who take an action
 * (message / quote / apply). Applied to reach to forecast inquiries:
 *   inquiries = reach * ASSUMED_INQUIRY_RATE
 *
 * A deliberately conservative single rate (1.2%) drawn from typical promoted
 * response on the network. Surfaced as an estimate, never a guarantee.
 */
export const ASSUMED_INQUIRY_RATE = 0.012;

/**
 * The +/- spread applied to the point estimate to express it as a range. A
 * point forecast reads as false precision; a band ("4,800 - 9,200") is honest
 * about the uncertainty. 30% each side.
 */
const RANGE_SPREAD = 0.3;

export interface BoostEstimateInput {
  /** Real count of members matching the targeting (from estimateAudience). */
  audienceSize: number;
  /** Daily budget in whole credits. */
  budget: number;
  /** Number of days the boost runs. */
  days: number;
}

export interface BoostEstimate {
  /** Low end of the forecast people-reached band (whole people). */
  reachLow: number;
  /** High end of the forecast people-reached band (whole people). */
  reachHigh: number;
  /** Low end of the forecast inquiries band (whole inquiries). */
  inquiriesLow: number;
  /** High end of the forecast inquiries band (whole inquiries). */
  inquiriesHigh: number;
}

const ZERO: BoostEstimate = {
  reachLow: 0,
  reachHigh: 0,
  inquiriesLow: 0,
  inquiriesHigh: 0,
};

/**
 * Forecast the reach + inquiry bands for a boost.
 *
 * Reach: total spend (`budget * days`) buys impressions at ASSUMED_CPM
 * (`spend / ASSUMED_CPM * 1000`); the point reach is that impression count
 * bounded by the real audience (you cannot reach more people than exist), then
 * widened by +/- RANGE_SPREAD into a band that is itself clamped to the
 * audience.
 *
 * Inquiries: the high reach times ASSUMED_INQUIRY_RATE is the anchor, widened
 * by the same spread, floored at 0.
 *
 * Returns an all-zero band for any non-positive input (no spend, no days, or no
 * audience) so the UI renders a clean "nothing yet" state rather than NaN.
 */
export function buildBoostEstimate({
  audienceSize,
  budget,
  days,
}: BoostEstimateInput): BoostEstimate {
  if (budget <= 0 || days <= 0 || audienceSize <= 0) return ZERO;

  const spend = budget * days;
  const impressions = (spend / ASSUMED_CPM) * 1000;

  // You can never reach more distinct people than the matching audience.
  const pointReach = Math.min(impressions, audienceSize);

  const reachLow = Math.min(Math.round(pointReach * (1 - RANGE_SPREAD)), audienceSize);
  const reachHigh = Math.min(Math.round(pointReach * (1 + RANGE_SPREAD)), audienceSize);

  // Inquiries are anchored on the high reach so the band reads as an upside
  // forecast, then spread the same way and floored at 0.
  const inquiryAnchor = reachHigh * ASSUMED_INQUIRY_RATE;
  const inquiriesLow = Math.max(0, Math.round(inquiryAnchor * (1 - RANGE_SPREAD)));
  const inquiriesHigh = Math.max(inquiriesLow, Math.round(inquiryAnchor * (1 + RANGE_SPREAD)));

  return { reachLow, reachHigh, inquiriesLow, inquiriesHigh };
}
