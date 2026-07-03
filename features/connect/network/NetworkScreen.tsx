'use client';

/**
 * NetworkScreen - the interactive shell for `/connect/network`.
 *
 * The Server Component (`page.tsx`) loads the active tab's data and hands it
 * down. This client island renders the screen header, the URL-synced
 * `ModuleTabs` bar (with live count badges), and the active tab panel. A tab's
 * load failure degrades to a recoverable in-panel error rather than blanking
 * the screen; an unexpected render failure is caught by `ConnectErrorBoundary`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, UserPlus, Users } from 'lucide-react';
import {
  ConnectErrorBoundary,
  ConnectPage,
  ModuleTabs,
  Rail,
  RailPanel,
  type ModuleTab,
} from '@/components/connect';
import type {
  ConnectionRequest,
  ConnectionSummary,
  Follow,
  NetworkCounts,
  Suggestion,
} from '../network.types';
import { getNetworkCounts } from '../network.actions';
import { NETWORK_CHANGED_EVENT } from './useNetworkBadge';
import { useNotificationEvent, useNotifications } from '@/lib/connect/NotificationProvider';
import type { CompanyPageRef } from '../feed.types';
import type { ConnectPerson } from '@/components/connect';
import PromotedProfileAdCard from '../ads/PromotedProfileAdCard';
// Google (AdSense) rail slots - reuses the shared connect.right.* placements +
// AdSlot seam (same as ConnectRightRail). Renders nothing until AdSense is wired,
// so it adds no box today; the first-party promoted profile card is untouched.
import AdSlot from '@/components/connect/AdSlot';
// Mobile inline ad (Google-only here): the promoted profile already serves on
// all widths; this surfaces the Google connect.right.top slot (which lives in the
// xl rail) for phone/tablet without duplicating the boost.
import MobileAdInline from '../ads/MobileAdInline';
import type { PeopleIndex } from './hydrate';
import InvitationsTab from './InvitationsTab';
import ConnectionsTab from './ConnectionsTab';
import FollowingTab from './FollowingTab';
import FollowersTab from './FollowersTab';
import SuggestionsTab from './SuggestionsTab';
import { NetworkTabError } from './NetworkTabStates';

/** The Network screen's live tabs. */
export type NetworkTabKey =
  | 'invitations'
  | 'connections'
  | 'following'
  | 'followers'
  | 'suggestions';

/**
 * The active tab's pre-loaded payload. A discriminated union so each tab gets
 * exactly its own data shape, and a per-tab `error` is representable.
 */
export type NetworkScreenData =
  | { tab: 'invitations'; requests: ConnectionRequest[]; people: PeopleIndex }
  | { tab: 'invitations'; error: string }
  | { tab: 'connections'; connections: ConnectionSummary[]; people: PeopleIndex }
  | { tab: 'connections'; error: string }
  | { tab: 'following'; follows: Follow[]; people: PeopleIndex; companyPages: CompanyPageRef[] }
  | { tab: 'following'; error: string }
  | {
      tab: 'followers';
      followers: Follow[];
      people: PeopleIndex;
      /** Follower ids the viewer is already connected to / following - so each
       *  row renders the right control instead of a bare Connect. */
      connectedIds: string[];
      followingIds: string[];
    }
  | { tab: 'followers'; error: string }
  | { tab: 'suggestions'; suggestions: Suggestion[]; people: PeopleIndex }
  | { tab: 'suggestions'; error: string };

/**
 * BOOST-UI (owner 2026-06-19): one server-resolved promoted profile (open-to-work
 * / hiring boost) for the people page. Mirrors the feed's promoted-profile model
 * so the same `PromotedProfileAdCard` renders it. SSR-resolved + leak-guarded by
 * the page (decideProfileAd narrows to a profile win only); `null` when none.
 */
export interface NetworkPromotedProfile {
  person: ConnectPerson;
  impressionToken: string;
  campaignId: string;
  kind: 'open_to_work' | 'hiring';
}

interface NetworkScreenProps {
  counts: NetworkCounts;
  data: NetworkScreenData;
  /** BOOST-UI: a promoted profile to surface atop the people column, or null. */
  promotedProfile?: NetworkPromotedProfile | null;
}

export default function NetworkScreen({ counts, data, promotedProfile }: NetworkScreenProps) {
  const t = useTranslations('connect.network');
  const router = useRouter();
  const { markCategorySeen, connectionState } = useNotifications();

  // Live tab-badge counts. Derived: an `override` (set by a live event)
  // wins over the server-loaded `counts` prop; until any event fires it is
  // null and the prop shows through (so a route refresh's fresh counts are
  // honoured). Derived-not-synced avoids the setState-in-effect anti-pattern.
  // Without this the Invitations tab badge stayed frozen at its first-paint
  // value when a request arrived while the page was open.
  const [override, setOverride] = useState<NetworkCounts | null>(null);
  const liveCounts = override ?? counts;

  const refetchCounts = useCallback(() => {
    void getNetworkCounts().then((res) => {
      if (res.ok) setOverride(res.data);
    });
  }, []);

  // Clear the two connection categories from the "My Network" nav badge
  // (`useNetworkBadge`). Stable so the effect + event handlers below depend on it
  // without re-subscribing each render. Called on open, on socket (re)connect,
  // AND on any connection activity that happens while already on this page (a
  // self-action or an incoming socket event). The one-shot mount mark-seen alone
  // left the badge stuck lit when a request arrived (or was accepted) AFTER the
  // page was already open. markCategorySeen is idempotent (a no-op when nothing
  // is unseen). Keep the category list in sync with `useNetworkBadge`.
  const clearNetworkBadge = useCallback(() => {
    void markCategorySeen('connect.connection_requested');
    void markCategorySeen('connect.connection_accepted');
  }, [markCategorySeen]);

  // Self-action event bus (send / accept / ignore / withdraw dispatch this).
  // Refresh the tab counts AND clear the nav badge: resolving an invitation that
  // arrived after this page opened must drop its badge - the one-shot mount
  // mark-seen already ran before the invite, so without this the badge stayed
  // stuck lit after Accept (the reported bug).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      refetchCounts();
      clearNetworkBadge();
    };
    window.addEventListener(NETWORK_CHANGED_EVENT, handler);
    return () => window.removeEventListener(NETWORK_CHANGED_EVENT, handler);
  }, [refetchCounts, clearNetworkBadge]);

  // Visiting the Network surface clears the nav badge: it is a "new activity"
  // signal (unseen incoming requests + acceptances), so opening the page marks
  // both categories seen, like every other menu badge in the app. The actual
  // pending invitations still show on the Invitations tab.
  //
  // Resilience - re-arm on reconnect: a transient backend blip can drop this
  // mark-seen (its PATCH times out) along with the realtime socket. Keying the
  // effect on `connectionState` re-runs the clear when the socket (re)connects,
  // so a failed attempt does not leave the badge stuck lit (the 2-min fallback
  // poll otherwise keeps re-raising it from the server). We skip only the
  // 'disconnected' state - a PATCH we know would fail - while still marking on
  // the initial mount (idle/connecting), so a degraded socket never blocks the
  // open-clears-badge behaviour.
  useEffect(() => {
    if (connectionState === 'disconnected') return;
    clearNetworkBadge();
  }, [clearNetworkBadge, connectionState]);

  // Incoming connection socket push (a request received, or a sent request
  // accepted). Refresh the counts AND clear the nav badge: an event that arrives
  // while the user is on the network surface counts as seen (it shows in the
  // Received box), so a post-mount event must re-trigger the clear - otherwise it
  // re-lights the badge and nothing marks it seen again until a navigate.
  useNotificationEvent(
    useCallback(
      (event) => {
        if (event.category.startsWith('connect.connection_')) {
          refetchCounts();
          clearNetworkBadge();
        }
      },
      [refetchCounts, clearNetworkBadge],
    ),
  );

  const tabs = useMemo<ModuleTab[]>(
    () => [
      { key: 'invitations', label: t('tabs.invitations'), count: liveCounts.pendingRequests },
      {
        key: 'connections',
        label: t('tabs.connections'),
        count: liveCounts.connections,
        tooltip: t('tabs.connectionsTooltip'),
      },
      {
        key: 'following',
        label: t('tabs.following'),
        count: liveCounts.following,
        tooltip: t('tabs.followingTooltip'),
      },
      {
        key: 'followers',
        label: t('tabs.followers'),
        count: liveCounts.followers,
        tooltip: t('tabs.followersTooltip'),
      },
      { key: 'suggestions', label: t('tabs.suggestions') },
    ],
    [t, liveCounts],
  );

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        <header style={{ marginBottom: 'var(--cr-space-md)' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
            {t('title')}
          </h1>
        </header>

        {/* BOOST-UI (owner 2026-06-19): promoted profile (open-to-work / hiring
            boost) on the people page. Renders on ALL viewports incl. mobile
            (PromotedProfileAdCard is not house-promo-gated), clearly labelled
            "Promoted", with the shared MRC billing beacons. SSR-resolved by the
            page (leak-safe); hidden when none. Cross-module: decideProfileAd
            (feed_sponsored) -> PromotedProfileAdCard -> /connect/ads/events/*. */}
        {promotedProfile && (
          <div style={{ marginBottom: 'var(--cr-space-lg)' }}>
            <PromotedProfileAdCard
              person={promotedProfile.person}
              impressionToken={promotedProfile.impressionToken}
              campaignId={promotedProfile.campaignId}
              kind={promotedProfile.kind}
            />
          </div>
        )}

        <ModuleTabs tabs={tabs} defaultTab="invitations" ariaLabel={t('tablistAria')} />

        <div role="tabpanel" style={{ paddingTop: 'var(--cr-space-lg)' }}>
          <ConnectErrorBoundary>
            {'error' in data ? (
              <NetworkTabError onRetry={() => router.refresh()} />
            ) : data.tab === 'invitations' ? (
              <InvitationsTab initialRequests={data.requests} initialPeople={data.people} />
            ) : data.tab === 'connections' ? (
              <ConnectionsTab connections={data.connections} people={data.people} />
            ) : data.tab === 'following' ? (
              <FollowingTab
                follows={data.follows}
                people={data.people}
                companyPages={data.companyPages}
              />
            ) : data.tab === 'followers' ? (
              <FollowersTab
                followers={data.followers}
                people={data.people}
                connectedIds={data.connectedIds}
                followingIds={data.followingIds}
              />
            ) : (
              <SuggestionsTab suggestions={data.suggestions} people={data.people} />
            )}
          </ConnectErrorBoundary>
        </div>
        {/* Mobile-only Google unit (the promoted profile already serves on all
            widths, so pass null = Google-only). The rail is hidden below xl. */}
        <MobileAdInline promoted={null} />
      </main>

      {/* Right rail - "Manage my network" quick links + a grow-network nudge.
          Hidden below xl (the main column owns the full width on smaller
          viewports); the slot model means future widgets drop in as another
          RailPanel with no screen rewrite. */}
      <Rail side="right">
        <RailPanel title={t('rail.manageTitle')}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <li>
              <NetworkRailLink
                href="/connect/network?tab=connections"
                icon={<Users size={15} aria-hidden />}
                label={t('tabs.connections')}
                count={liveCounts.connections}
              />
            </li>
            <li>
              <NetworkRailLink
                href="/connect/network?tab=following"
                icon={<UserPlus size={15} aria-hidden />}
                label={t('tabs.following')}
                count={liveCounts.following}
              />
            </li>
          </ul>
        </RailPanel>

        {/* Google AdSense rail slot (third-party fill) between the manage + grow
            panels. Reuses connect.right.top; renders nothing when AdSense is
            unconfigured, so it is shift-free + a no-op today. Links: AdSlot ->
            GoogleAdUnit -> app/connect/layout.tsx loader. */}
        <AdSlot placement="connect.right.top" />

        <RailPanel title={t('rail.growTitle')}>
          <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
            {t('rail.growBody')}
          </p>
          <Link
            href="/connect/network?tab=suggestions"
            className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold no-underline"
            style={{ color: 'var(--cr-primary)' }}
          >
            <Sparkles size={14} aria-hidden />
            {t('rail.growCta')}
          </Link>
        </RailPanel>

        {/* Second Google AdSense rail slot (connect.right.mid) below the grow
            panel - the rail has room for two units, matching ConnectRightRail's
            top+mid pair. No-op until AdSense is wired. */}
        <AdSlot placement="connect.right.mid" />
      </Rail>
    </ConnectPage>
  );
}

/** One quick-link row in the "Manage my network" rail panel - label + count. */
function NetworkRailLink({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium no-underline transition-colors hover:bg-surface-2"
      style={{ color: 'var(--cr-text-2)' }}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-[12px] font-semibold" style={{ color: 'var(--cr-text-4)' }}>
        {count}
      </span>
    </Link>
  );
}
