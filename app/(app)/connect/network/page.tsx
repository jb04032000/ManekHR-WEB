import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  getNetworkCounts,
  getSuggestions,
  listConnections,
  listFollowers,
  listFollowing,
  listInvitations,
} from '@/features/connect/network.actions';
import { hydratePeople, toConnectPerson } from '@/features/connect/network/hydrate';
import { getCompanyPageRefs } from '@/features/connect/entities/company-page.actions';
import { decideProfileAd } from '@/features/connect/ads/ads.actions';
import NetworkScreen, {
  type NetworkScreenData,
  type NetworkPromotedProfile,
  type NetworkTabKey,
} from '@/features/connect/network/NetworkScreen';

/**
 * `/connect/network` - the Connect "My Network" screen.
 *
 * A Server Component (ENGINEERING-STANDARDS #7). It reads `?tab=`, loads ONLY
 * the active tab's data (plus a `getPeople` batch hydration of the raw user
 * ids the list endpoints return), and hands it to `NetworkScreen`. The Connect
 * shell lives in the route-group layout, so a `?tab=` change re-runs this page
 * but never remounts the shell (ENGINEERING-STANDARDS #8).
 *
 * Tabs: `invitations` (default), `connections`, `following`, `suggestions`.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.network');
  return { title: t('metaTitle') };
}

/** The live tab keys. */
const TAB_KEYS: NetworkTabKey[] = [
  'invitations',
  'connections',
  'following',
  'followers',
  'suggestions',
];

/** Resolve the `?tab=` param to a known tab, defaulting to `invitations`. */
function resolveTab(raw: string | string[] | undefined): NetworkTabKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TAB_KEYS.find((key) => key === value) ?? 'invitations';
}

interface NetworkPageProps {
  searchParams: Promise<{ tab?: string | string[] }>;
}

/**
 * BOOST-UI (owner 2026-06-19): resolve ONE promoted profile (open-to-work /
 * hiring boost) for the network/people surface. A promoted profile previously
 * served only in the feed; this brings it to the people page too (all viewports,
 * incl. mobile). Leak-safe: `decideProfileAd` narrows the generalized decide
 * response to ONLY a promoted_open_to_work / promoted_hiring win (any other kind
 * resolves to null), and the auction itself never serves a viewer their own boost
 * or a blocked / suppressed / mis-targeted campaign. Best-effort + guarded so the
 * ads path can never error the network page.
 *
 * Placement: there is no network-specific placement seeded; profile boosts bind
 * to `feed_sponsored` on the backend (boost.service.ts open-to-work/hiring), and
 * the seeded `feed_promoted_profile` slot is no longer bound to any campaign. So
 * we reuse `feed_sponsored` here. NOTE (owner): for a network-targeted auction
 * separate from the feed, seed + bind a dedicated `network_promoted_profile`
 * placement on the backend and swap the key below.
 * Cross-module: PromotedProfileAdCard renders it + fires the MRC beacons.
 */
async function resolvePromotedProfile(): Promise<NetworkPromotedProfile | null> {
  try {
    const res = await decideProfileAd('feed_sponsored').catch(() => null);
    const decision = res && res.ok ? res.data : null;
    if (!decision) return null;
    const people = await hydratePeople([decision.profileRef]);
    // CN-ADS-10 (feed harden Bucket 8): NO-FILL when the advertiser's profile
    // cannot be resolved (deleted / hidden) rather than rendering a fabricated
    // placeholder-name promoted card. See the feed page's hydrateSponsoredCard.
    if (!people[decision.profileRef]) return null;
    const tPerson = await getTranslations('connect.network.person');
    const person = toConnectPerson(decision.profileRef, people, tPerson('fallbackName'));
    return {
      person,
      impressionToken: decision.impressionToken,
      campaignId: decision.campaignId,
      kind: decision.creativeKind === 'promoted_hiring' ? 'hiring' : 'open_to_work',
    };
  } catch {
    return null;
  }
}

export default async function ConnectNetworkPage({ searchParams }: NetworkPageProps) {
  const { tab } = await searchParams;
  const activeTab = resolveTab(tab);

  // Counts drive the tab badges + the nav badge. A counts failure is not fatal
  // to the screen, so it degrades to zeroes rather than erroring the page. The
  // promoted profile (BOOST-UI) joins in parallel so it adds no serial latency;
  // it is independently guarded so a miss simply hides the slot.
  const [countsRes, promotedProfile] = await Promise.all([
    getNetworkCounts(),
    resolvePromotedProfile(),
  ]);
  const counts = countsRes.ok
    ? countsRes.data
    : { pendingRequests: 0, connections: 0, following: 0, followers: 0 };

  // Load ONLY the active tab. Each list endpoint returns raw user ids, so the
  // ids are collected and resolved to people cards in one `getPeople` batch.
  let data: NetworkScreenData;

  if (activeTab === 'connections') {
    const res = await listConnections();
    if (!res.ok) {
      data = { tab: 'connections', error: res.error };
    } else {
      const people = await hydratePeople(res.data.map((c) => c.userId));
      data = { tab: 'connections', connections: res.data, people };
    }
  } else if (activeTab === 'following') {
    const res = await listFollowing();
    if (!res.ok) {
      data = { tab: 'following', error: res.error };
    } else {
      // Follows can be people OR workshops (company pages); hydrate each kind so
      // both render (a company follow was previously counted but never shown).
      const userIds = res.data.filter((f) => f.followeeType === 'user').map((f) => f.followeeId);
      const companyIds = res.data
        .filter((f) => f.followeeType === 'companyPage')
        .map((f) => f.followeeId);
      const [people, companyRes] = await Promise.all([
        hydratePeople(userIds),
        getCompanyPageRefs(companyIds),
      ]);
      const companyPages = companyRes.ok ? companyRes.data : [];
      data = { tab: 'following', follows: res.data, people, companyPages };
    }
  } else if (activeTab === 'followers') {
    const res = await listFollowers();
    if (!res.ok) {
      data = { tab: 'followers', error: res.error };
    } else {
      const userIds = res.data.filter((f) => f.followeeType === 'user').map((f) => f.followerId);
      // Resolve the viewer's relationship to each follower so an already-
      // connected / followed-back follower renders the correct control (a
      // "Connected" / "Following" state) instead of a bare Connect that 409s.
      // Both lists are cheap; a failure degrades to the optimistic default.
      const [people, connRes, followingRes] = await Promise.all([
        hydratePeople(userIds),
        listConnections(),
        listFollowing(),
      ]);
      const connectedIds = connRes.ok ? connRes.data.map((c) => c.userId) : [];
      const followingIds = followingRes.ok
        ? followingRes.data.filter((f) => f.followeeType === 'user').map((f) => f.followeeId)
        : [];
      data = { tab: 'followers', followers: res.data, people, connectedIds, followingIds };
    }
  } else if (activeTab === 'suggestions') {
    const res = await getSuggestions();
    if (!res.ok) {
      data = { tab: 'suggestions', error: res.error };
    } else {
      const people = await hydratePeople(res.data.map((s) => s.userId));
      data = { tab: 'suggestions', suggestions: res.data, people };
    }
  } else {
    // `invitations` - the Server Component loads the default `received` box;
    // the tab swaps the Sent / Archive boxes client-side on demand.
    const res = await listInvitations('received');
    if (!res.ok) {
      data = { tab: 'invitations', error: res.error };
    } else {
      const people = await hydratePeople(res.data.map((r) => r.fromUserId));
      data = { tab: 'invitations', requests: res.data, people };
    }
  }

  return <NetworkScreen counts={counts} data={data} promotedProfile={promotedProfile} />;
}
