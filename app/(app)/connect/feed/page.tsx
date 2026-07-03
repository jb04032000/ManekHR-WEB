import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  getFeed,
  getPublicPost,
  getTrendingRail,
  type TrendingRailItem,
} from '@/features/connect/feed.actions';
import { getSuggestions } from '@/features/connect/network.actions';
import { getFeedBanners } from '@/features/connect/banners/banner.actions';
import { hydratePeople, toConnectPerson } from '@/features/connect/network/hydrate';
import FeedScreen, { type FeedScreenData } from '@/features/connect/feed/FeedScreen';
import { type FeedSponsoredCard } from '@/features/connect/feed/feed-ads';
import { decideSponsoredAd } from '@/features/connect/ads/ads.actions';
import type { SponsoredAdDecision } from '@/features/connect/ads/ads.types';
import { getPublicListing } from '@/features/connect/marketplace/marketplace.actions';
import { getPublicJob } from '@/features/connect/jobs/jobs.actions';
import { getRfq } from '@/features/connect/rfq/rfq.actions';
import type { FeedTab } from '@/features/connect/feed.types';
import type { ConnectPerson } from '@/components/connect';
import { getMe } from '@/lib/actions/auth.actions';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import {
  browseCompanyPages,
  getMyFollowedCompanyPageIds,
} from '@/features/connect/entities/company-page.actions';
import type { CompanyPageBrowseItem } from '@/features/connect/entities/entities.types';

/**
 * `/connect/feed` - Connect Home, the feed.
 *
 * A Server Component (ENGINEERING-STANDARDS #7). It reads `?tab=`, loads that
 * tab's first feed page + the right-rail suggestions, and hands them to
 * `FeedScreen`. The Connect shell lives in the route-group layout, so a `?tab=`
 * change re-runs this page but never remounts the shell (#8); `FeedList` then
 * owns client-side pagination + the live merge (Wave 5).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.feed');
  return { title: t('metaTitle') };
}

/** The live feed tabs. */
const TAB_KEYS: FeedTab[] = ['foryou', 'following'];

/** Resolve `?tab=` to a known tab, defaulting to `foryou`. */
function resolveTab(raw: string | string[] | undefined): FeedTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TAB_KEYS.find((key) => key === value) ?? 'foryou';
}

/** Max in-feed sponsored cards resolved per page render (keeps density low). */
const MAX_SPONSORED_CARDS = 2;

/**
 * Hydrate one unified `feed_sponsored` decision into a renderable FeedSponsoredCard
 * by its winning kind (post / profile / listing / job / rfq). Any miss (no decision,
 * hydration failure) returns null so the slot quietly opens to the next card / house
 * promo. Never throws into the feed render. Cross-module: the per-entity public
 * getters (post / listing / job / rfq) + the people-hydrate path (profile).
 */
async function hydrateSponsoredCard(
  decision: SponsoredAdDecision | null,
  fallbackName: string,
): Promise<FeedSponsoredCard | null> {
  if (!decision) return null;
  const { impressionToken, campaignId } = decision;
  try {
    switch (decision.creativeKind) {
      case 'promoted_post': {
        const r = await getPublicPost(decision.postRef!);
        return r.ok ? { kind: 'post', impressionToken, campaignId, post: r.data } : null;
      }
      case 'promoted_open_to_work':
      case 'promoted_hiring': {
        const people = await hydratePeople([decision.profileRef!]);
        // CN-ADS-10 (feed harden Bucket 8): NO-FILL when the advertiser's profile
        // cannot be resolved (deleted account / hidden profile). Rendering a
        // fabricated placeholder-name card for a promoted profile is worse than
        // showing nothing (a blank-name paid slot). toConnectPerson's fallback is
        // correct for network rows you follow, but a promoted profile slot must
        // resolve to a real person or not render at all.
        if (!people[decision.profileRef!]) return null;
        const person = toConnectPerson(decision.profileRef!, people, fallbackName);
        return {
          kind: 'profile',
          impressionToken,
          campaignId,
          intent: decision.creativeKind === 'promoted_hiring' ? 'hiring' : 'open_to_work',
          person,
        };
      }
      case 'promoted_listing': {
        const r = await getPublicListing(decision.listingRef!);
        return r.ok ? { kind: 'listing', impressionToken, campaignId, listing: r.data } : null;
      }
      case 'promoted_job': {
        const r = await getPublicJob(decision.jobRef!);
        return r.ok ? { kind: 'job', impressionToken, campaignId, job: r.data } : null;
      }
      case 'promoted_rfq': {
        const r = await getRfq(decision.rfqRef!);
        return r.ok ? { kind: 'rfq', impressionToken, campaignId, rfq: r.data } : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

interface FeedPageProps {
  searchParams: Promise<{ tab?: string | string[] }>;
}

export default async function ConnectFeedPage({ searchParams }: FeedPageProps) {
  const { tab } = await searchParams;
  const activeTab = resolveTab(tab);
  // One per-page id ties the (up to 2) feed_sponsored auction calls together so
  // the per-page dedup gives a DISTINCT campaign each slot (no same ad twice).
  const adPageId = crypto.randomUUID();

  // The FIRST feed_sponsored decision joins the parallel load (no dependency on
  // the other reads), so it doesn't add latency on the hot feed path. It is
  // `.catch`-guarded so an unexpected throw can never reject the whole
  // `Promise.all` and break the feed -- the ads path must never error the feed.
  const [
    feedRes,
    suggestionsRes,
    meRes,
    profileRes,
    sponsoredRes1,
    companiesRes,
    trendingRes,
    followedCompanyIdsRes,
    banners,
  ] = await Promise.all([
    getFeed(activeTab),
    // People-to-follow rail suggestions. Best-effort; the rail stays empty on a
    // miss, so a short 5s `timeout` keeps a slow/cold-start backend from holding
    // the whole feed render for the shared 15s default (other callers -- Network
    // page, profile/post activity -- keep the default). Keep the 5s in sync with
    // the other best-effort rail calls here.
    getSuggestions({ timeout: 5000 }),
    // `getMe()` THROWS on a transient `/me` blip (unlike the ActionResult-safe
    // calls). Left unguarded in this `Promise.all` it would reject the whole
    // load and throw the page to the route error boundary - blanking a perfectly
    // healthy feed (the most likely "empty feed for some users"). Wrap it so a
    // viewer-identity hiccup degrades the chrome, never the feed.
    getMe()
      .then((data) => ({ ok: true as const, data }))
      .catch(() => ({ ok: false as const })),
    getMyConnectProfile(),
    // decideSponsoredAd caps itself at a 5s fail-fast timeout (best-effort,
    // feed-only) so a slow ad decision can't hold this render -- see ads.actions.
    decideSponsoredAd('feed_sponsored', adPageId).catch(() => ({
      ok: false as const,
      error: 'decide failed',
    })),
    // Company suggestions for the right rail - newcomers often follow a mill /
    // brand before a person. We over-fetch (12) so that after dropping the
    // ones the viewer already follows we still have enough to fill the rail.
    // Best-effort; a failure simply hides the panel. The 5s `timeout` keeps a
    // slow/cold-start backend on this non-critical panel from holding the whole
    // feed render for the shared 15s default (the directory's own browse omits
    // it). Keep the 5s in sync with the other best-effort rail calls here.
    browseCompanyPages({ pageSize: 12 }, { timeout: 5000 }),
    // Trending posts for the right rail. Best-effort; the rail hides on empty.
    // (getTrendingRail caps its own 5s timeout internally.)
    getTrendingRail(),
    // Seeds the "Companies to follow" rail's per-card Follow button so an
    // already-followed company reads "Following". One round trip (no N+1
    // follow-state check); returns [] for a logged-out viewer. Best-effort, so a
    // short 5s `timeout` keeps it from holding the feed render.
    getMyFollowedCompanyPageIds({ timeout: 5000 }),
    // Admin-curated feed banners (top-of-feed carousel). Self-guarding: returns
    // [] on any failure, so it joins the parallel load without a .catch and an
    // outage never errors the feed. Short 5s timeout (like the other
    // best-effort rail calls) so a slow/cold backend on this non-critical panel
    // can't hold the feed render for the 15s default. See features/connect/banners.
    getFeedBanners({ timeout: 5000 }),
  ]);
  const me = meRes.ok ? meRes.data : null;

  // In-feed sponsored cards (Phase 1) are hydrated in a dependent step (each needs
  // the decision's ref). The first decision rode the parallel load; the second is
  // a sequential call with the SAME adPageId so the per-page dedup excludes the
  // first winner (a distinct campaign each slot). Each is hydrated by kind; any
  // miss is dropped. Capped at MAX_SPONSORED_CARDS, `.catch`-guarded so the ads
  // path never blocks or errors the feed.
  const sponsoredCards: FeedSponsoredCard[] = [];
  try {
    const tPerson = await getTranslations('connect.network.person');
    const fallbackName = tPerson('fallbackName');
    const decisions: (SponsoredAdDecision | null)[] = [
      sponsoredRes1.ok ? sponsoredRes1.data : null,
    ];
    // Resolve the remaining slots sequentially (dedup needs the prior winner
    // recorded against adPageId before the next call).
    for (let slot = 1; slot < MAX_SPONSORED_CARDS; slot += 1) {
      const res = await decideSponsoredAd('feed_sponsored', adPageId).catch(() => null);
      decisions.push(res && res.ok ? res.data : null);
    }
    for (const decision of decisions) {
      const card = await hydrateSponsoredCard(decision, fallbackName);
      if (card) sponsoredCards.push(card);
    }
  } catch {
    // Defensive: any unexpected throw leaves the feed with no sponsored cards.
    sponsoredCards.length = 0;
  }

  // The premium Spotlight rail card (Phase 2). A SEPARATE auction (spotlight_rail,
  // Spotlight-only campaigns) with NO shared pageRequestId, so a Spotlight boost
  // can appear in BOTH the feed AND the rail on the same page (the premium point).
  // Best-effort + guarded so it never errors the feed; desktop rail only.
  let spotlightCard: FeedSponsoredCard | null = null;
  try {
    const tPerson = await getTranslations('connect.network.person');
    const res = await decideSponsoredAd('spotlight_rail').catch(() => null);
    const decision = res && res.ok ? res.data : null;
    spotlightCard = await hydrateSponsoredCard(decision, tPerson('fallbackName'));
  } catch {
    spotlightCard = null;
  }

  // Connect onboarding step is skipped for now - the `/connect/onboarding`
  // route is disabled (it didn't capture all the relevant fields, e.g.
  // designations, and its data isn't consumed downstream beyond the cross-sell).
  // Treat every viewer as onboarded so the feed write actions proceed directly
  // instead of bouncing to the (now redirecting) onboarding route. Revive by
  // restoring `getConnectEntryState()` + `entryRes.data.onboarded`.
  const onboarded = true;
  // The viewer's own profile drives the dismissible top-of-feed setup card.
  // A load failure simply hides the card; it never errors the feed.
  const profile = profileRes.ok ? profileRes.data : null;

  const data: FeedScreenData = feedRes.ok ? { page: feedRes.data } : { error: feedRes.error };
  // When `/me` was unavailable this render, fall back to the Connect profile for
  // the viewer's id (name/avatar degrade gracefully) so the feed still renders.
  const viewer = me
    ? {
        id: me._id,
        name: me.name,
        avatar: me.profilePicture ?? null,
        // `me.hasWorkspace !== false` so an undefined flag (legacy) reads as
        // owner. Matches the policy used by `DashboardLayout`'s workspace gate.
        hasWorkspace: me.hasWorkspace !== false,
      }
    : {
        id: profile?.userId ?? '',
        name: '',
        avatar: null,
        hasWorkspace: true,
      };

  // Right-rail "people to follow" - the top few suggestions, hydrated to cards.
  // A suggestions failure simply leaves the rail empty; it never errors the page.
  let suggestions: ConnectPerson[] = [];
  if (suggestionsRes.ok && suggestionsRes.data.length > 0) {
    const top = suggestionsRes.data.slice(0, 4);
    const people = await hydratePeople(top.map((s) => s.userId));
    const tPerson = await getTranslations('connect.network.person');
    suggestions = top.map((s) => toConnectPerson(s.userId, people, tPerson('fallbackName')));
  }

  const followedCompanyIds: string[] = followedCompanyIdsRes.ok ? followedCompanyIdsRes.data : [];
  // A "Companies to follow" rail is a suggestion list: drop the pages the viewer
  // already follows (same way "People to follow" never re-suggests existing
  // connections), then cap to 4. Seeds the rail with genuinely-new follows.
  const followedSet = new Set(followedCompanyIds);
  const companySuggestions: CompanyPageBrowseItem[] = companiesRes.ok
    ? companiesRes.data.items.filter((c) => !followedSet.has(c.id)).slice(0, 4)
    : [];
  const trending: TrendingRailItem[] = trendingRes.ok ? trendingRes.data : [];

  return (
    <FeedScreen
      tab={activeTab}
      data={data}
      viewer={viewer}
      suggestions={suggestions}
      companySuggestions={companySuggestions}
      followedCompanyIds={followedCompanyIds}
      trending={trending}
      onboarded={onboarded}
      profile={profile}
      sponsoredCards={sponsoredCards}
      spotlightCard={spotlightCard}
      banners={banners}
    />
  );
}
