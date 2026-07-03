'use client';

/**
 * AdCard -- unified in-feed ad slot renderer (Task 3, Boost Post epic).
 *
 * Accepts a discriminated union:
 *   - type 'promoted': renders the existing PostCard wrapped with a "Promoted"
 *     disclosure tag + fires MRC-compliant viewability + click beacons.
 *   - type 'house': renders the existing FeedAdCard (house promo). No beacon
 *     logic; FeedAdCard owns its own dismiss / CTA behavior.
 *
 * Post-data flow:
 *   The hydrated post is passed as a PROP (not fetched here). The feed SSR
 *   (Task 4) fetches the post by postRef before rendering and passes it down,
 *   so the promoted card is in the initial HTML with zero layout shift and
 *   zero client-side waterfall. This component never issues network requests.
 *
 * Viewability beacon (promoted only):
 *   MRC standard: >=50% in-viewport for >=1 second continuously.
 *   - An IntersectionObserver watches the card root at threshold 0.5.
 *   - When intersectionRatio >= 0.5 a 1-second timer starts.
 *   - If ratio drops below 0.5 before the timer fires, the timer is cleared.
 *   - On timer completion, recordImpression(impressionToken) is called exactly
 *     once (guarded by a fired-ref; observer is disconnected afterwards).
 *   - Errors are swallowed; beacon is fire-and-forget.
 *
 * Click beacon (promoted only):
 *   Wraps the PostCard in a capture-phase click handler. recordClick is called
 *   then the handler returns -- navigation proceeds immediately (non-blocking;
 *   no await). Errors are swallowed.
 *
 * a11y:
 *   - The "Promoted" tag has role="note" and aria-label for screen readers.
 *   - The click wrapper is a <div> with no tabIndex; keyboard interaction
 *     is handled natively by PostCard's own links and buttons -- we do NOT
 *     add a wrapper that competes with the card's tab order.
 *   - The disclosure tag is visually first, matching IAB Native Ad Playbook
 *     and FTC disclosure-above-content guidance.
 */

import { useCallback, useState, type MouseEvent } from 'react';
import { App as AntApp } from 'antd';
import { useTranslations } from 'next-intl';
import PostCard from '@/components/connect/PostCard';
import FeedAdCard from '@/features/connect/feed/FeedAdCard';
import type { HydratedFeedItem } from '@/features/connect/feed.types';
import type { HousePromo, HousePromoId } from '@/features/connect/feed/feed-ads';
import { hideSponsoredAd } from '@/features/connect/ads/ads.actions';
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import { useAdBeacons } from './use-ad-beacons';

// ---------------------------------------------------------------------------
// Prop shapes
// ---------------------------------------------------------------------------

/** Props for the promoted-post variant. The hydrated post is SSR-resolved and
 *  passed as a prop (see module doc). viewerId + onboarded come from the feed
 *  shell and are required by PostCard. */
export interface PromotedAdCardProps {
  type: 'promoted';
  post: HydratedFeedItem;
  impressionToken: string;
  campaignId: string;
  viewerId: string;
  onboarded: boolean;
}

/** Props for the house-promo variant. onDismiss mirrors FeedAdCard's contract. */
export interface HouseAdCardProps {
  type: 'house';
  promo: HousePromo;
  onDismiss: (id: HousePromoId) => void;
}

export type AdCardProps = PromotedAdCardProps | HouseAdCardProps;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdCard(props: AdCardProps) {
  if (props.type === 'house') {
    return <FeedAdCard promo={props.promo} onDismiss={props.onDismiss} />;
  }

  // TypeScript narrows to PromotedAdCardProps here. Destructure to drop `type`
  // before forwarding (PromotedAdCard omits the discriminant from its props).
  const { post, impressionToken, campaignId, viewerId, onboarded } = props;
  return (
    <PromotedAdCard
      post={post}
      impressionToken={impressionToken}
      campaignId={campaignId}
      viewerId={viewerId}
      onboarded={onboarded}
    />
  );
}

// ---------------------------------------------------------------------------
// Internal: promoted card
// ---------------------------------------------------------------------------

function PromotedAdCard({
  post,
  impressionToken,
  campaignId,
  viewerId,
  onboarded,
}: Omit<PromotedAdCardProps, 'type'>) {
  const t = useTranslations('connect.ads');
  const { message } = AntApp.useApp();
  // Analytics descriptor piggybacks the billing beacons: this is a first-party
  // boost unit in the feed, so kind='boost' + campaignId. Mirrors the ad beacon
  // trigger only (no extra emit). Links: lib/analytics-events.ts.
  const { cardRef, onClick } = useAdBeacons(impressionToken, {
    placement: 'feed',
    kind: 'boost',
    campaignId,
  });
  const promotedLabel = t('promotedLabel');

  // Sponsored "Hide" (Phase 7d) - record a per-(viewer, campaign) suppression so
  // this campaign stops serving to the viewer, then remove the card. There is no
  // server cache row for the promoted slot, so we self-remove with local state.
  // Links: PostCard sponsored menu -> here -> ads `hideSponsoredAd`.
  const [hidden, setHidden] = useState(false);
  const onSponsoredHide = useCallback(
    (campaign: string) => {
      setHidden(true);
      trackEvent(ConnectEvents.feedFeedback, { kind: 'hide_ad', action: 'add' });
      void (async () => {
        const res = await hideSponsoredAd(campaign);
        if (res.ok) message.success(t('hidden'));
      })();
    },
    [message, t],
  );
  // CN-ADS-7 (feed harden Bucket 8): the beacon click must fire ONLY on a genuine
  // ad-content click (post body / media), NOT on the PostCard's own action
  // controls (Like, Comment, media lightbox, overflow menu, Hide). Previously the
  // whole PostCard was wrapped in one onClick, so tapping Like or Hide billed a
  // click. PostCard's actions are real <button>/<a>/[role] controls, so we detect
  // a click that originated inside one and skip the beacon for it; a click on the
  // plain content bubbles to here with no interactive ancestor and DOES bill.
  const onContentClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      // An interactive control anywhere between the click target and this wrapper
      // means the click was an ACTION, not an ad-content engagement.
      if (
        target?.closest(
          'button, a, [role="button"], [role="menuitem"], input, textarea, select, [data-ad-noclick]',
        )
      ) {
        return;
      }
      onClick();
    },
    [onClick],
  );

  if (hidden) return null;

  return (
    <div ref={cardRef}>
      {/* Disclosure tag -- sits ABOVE the post card (IAB + FTC guidance).
          role="note" communicates supplemental/advisory content to AT.
          aria-label gives screen readers the full disclosure string. */}
      <div
        aria-label={promotedLabel}
        role="note"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-3)',
          }}
        >
          {promotedLabel}
        </span>
      </div>

      {/* Click-capture wrapper. We use a plain div (no tabIndex) so that the
          PostCard's own interactive elements keep their natural tab order and
          focus behavior. CN-ADS-7: the beacon fires only for a content click,
          NOT for the card's action buttons/menu (see onContentClick). */}
      <div onClick={onContentClick}>
        <PostCard
          post={post}
          viewerId={viewerId}
          onboarded={onboarded}
          // Sponsored card: the overflow menu shows ONLY "Hide" (Phase 7d).
          sponsoredCampaignId={campaignId}
          onSponsoredHide={onSponsoredHide}
        />
      </div>
    </div>
  );
}
