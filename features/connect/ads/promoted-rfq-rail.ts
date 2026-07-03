import { decideRfqAd } from './ads.actions';
import { getRfq } from '../rfq/rfq.actions';
import type { RfqDetail } from '../rfq/rfq.types';

/**
 * A fully-resolved promoted RFQ for the RFQ board: run the ad decision for
 * `placementKey`, then hydrate the winning request via the RFQ getter. Any miss
 * (no campaign, decide error, RFQ no longer fetchable) returns null and the board
 * renders no promoted RFQ. Never throws into the page render.
 *
 * Mirrors `resolvePromotedRailListing`. Used by app/connect/rfq/page.tsx with the
 * dedicated `rfq_promoted` placement (distinct from `rfq_board`, which carries the
 * cross-sell promoted listing).
 */
export interface PromotedRfqResolved {
  rfq: RfqDetail;
  impressionToken: string;
  campaignId: string;
}

export async function resolvePromotedRailRfq(
  placementKey: string,
  pageRequestId?: string,
): Promise<PromotedRfqResolved | null> {
  try {
    const decideRes = await decideRfqAd(placementKey, pageRequestId);
    const decision = decideRes.ok ? decideRes.data : null;
    if (!decision) return null;
    const rfqRes = await getRfq(decision.rfqRef);
    if (!rfqRes.ok) return null;
    // Only an open request should be promoted; a closed/awarded one quietly
    // yields no ad (the board's organic content already excludes it).
    if (rfqRes.data.status !== 'open') return null;
    return {
      rfq: rfqRes.data,
      impressionToken: decision.impressionToken,
      campaignId: decision.campaignId,
    };
  } catch {
    return null;
  }
}
