import type { Metadata } from 'next';
import {
  listAdReview,
  listLiveBoosts,
  listAdPlacements,
  getAdRevenue,
  getConnectPricing,
} from '@/features/connect/ads/ads-admin.actions';
import { getPublicPost } from '@/features/connect/feed.actions';
import AdminAdReview from '@/features/connect/ads/AdminAdReview';

/**
 * /admin/connect/ads/review - platform-admin ad review console.
 *
 * Guarded by AdminLayout (client isAdmin redirect) + the backend IsAdminGuard.
 * Loads the review queue, live boosts, placements, and revenue in parallel, then
 * hydrates each pending creative's post for an in-context preview (the advertiser
 * is the post author, so the preview also identifies who is advertising). Live
 * boosts (publish-then-moderate) get a Take down action. Any read failure
 * degrades to an empty section; it never errors the page.
 */

export const metadata: Metadata = { title: 'Ads Review' };

export default async function AdminConnectAdsReviewPage() {
  const [reviewRes, liveRes, placementsRes, revenueRes, pricingRes] = await Promise.all([
    listAdReview(),
    listLiveBoosts(),
    listAdPlacements(),
    getAdRevenue(),
    getConnectPricing(),
  ]);

  const creatives = reviewRes.ok ? reviewRes.data : [];
  const liveBoosts = liveRes.ok ? liveRes.data : [];
  const placements = placementsRes.ok ? placementsRes.data : [];
  const revenue = revenueRes.ok ? revenueRes.data.revenue : 0;
  // Null when the read fails; the editor section then hides itself.
  const pricing = pricingRes.ok ? pricingRes.data : null;

  const items = await Promise.all(
    creatives.map(async (creative) => {
      // Only a promoted_post creative has a post to preview; other kinds
      // (listing / job / rfq / profile boosts) carry their own BE-surfaced
      // title/ref and render a per-kind summary in AdminAdReview instead.
      if (creative.kind !== 'promoted_post' || !creative.postRef) {
        return { creative, post: null };
      }
      const postRes = await getPublicPost(creative.postRef);
      return { creative, post: postRes.ok ? postRes.data : null };
    }),
  );

  return (
    <AdminAdReview
      items={items}
      liveBoosts={liveBoosts}
      placements={placements}
      revenue={revenue}
      pricing={pricing}
    />
  );
}
