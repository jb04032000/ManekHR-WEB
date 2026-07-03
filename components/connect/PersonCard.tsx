'use client';

/**
 * PersonCard - a person across discovery surfaces (Network suggestions,
 * people-also-viewed, candidate lists). Avatar + name + headline + trust
 * badges + (degree · mutual) signal + a caller-supplied action.
 *
 * `row` is the compact rail variant; `card` is the grid variant.
 *
 * Network-proximity signal:
 *   - `degree` - 1/2/3 → renders "1st" / "2nd" / "3rd+" next to name.
 *     Conveys whether the person is a direct connection, a friend-of-friend,
 *     or further removed. Mirrors LinkedIn's degree pattern.
 *   - `mutualCount` - number of shared connections. Rendered alongside
 *     degree when > 0. Caller computes (we don't reach into the network
 *     graph from this primitive). Both optional; both hidden when absent.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import ConnectAvatar from '@/components/connect/ConnectAvatar';
import TrustBadgeRow, { type TrustBadgeKind } from './TrustBadgeRow';
// Per-item "Sample" disclosure pill on a seeded demo person (person.isDemo). This
// single card covers suggestions / network / people-search automatically.
import SampleBadge from './SampleBadge';
// Message -> inbox `startInboxDm`. Shown only for people open to work, so an
// employer can reach an available karigar straight from the card.
// Self-hides when the inbox module is off.
import StartConversationButton from '@/features/connect/inbox/StartConversationButton';

export interface ConnectPerson {
  userId: string;
  name: string;
  headline?: string;
  avatarUrl?: string;
  badges?: TrustBadgeKind[];
  /**
   * Connection degree from the viewer. 1 = direct connection, 2 = friend
   * of a friend, 3 = further or unknown. Optional - only present when the
   * caller has resolved relationships (e.g. via `getRelationship` or the
   * Suggestions service). Hidden when absent.
   */
  degree?: 1 | 2 | 3;
  /**
   * Number of mutual connections between the viewer and this person.
   * Optional - caller computes. Hidden when absent / zero.
   */
  mutualCount?: number;
  /**
   * The person's "open to" signal -> drives the ConnectAvatar floating ring.
   * Optional + nullable: null/absent renders a bare avatar (today's look).
   * Real value flows from the backend `getPeopleByIds` people-card path
   * (network lists + federated search both hydrate through it).
   */
  openStatus?: 'work' | 'hiring' | null;
  /**
   * True for a seeded sample person (User.isDemo), threaded in from PersonRef via
   * hydrate.toConnectPerson -> lets the card render a SampleBadge. Optional; absent
   * = real member. Keep `isDemo` in sync with PersonRef + every Connect mirror.
   * (Render is wired in a later card-component pass; the field is carried now.)
   */
  isDemo?: boolean;
}

interface PersonCardProps {
  person: ConnectPerson;
  /** Caller-supplied action(s) - e.g. a Connect / Invite / Message button. */
  action?: ReactNode;
  variant?: 'row' | 'card';
}

/** Render the "1st"/"2nd"/"3rd+" label for a `degree` value. */
function useDegreeLabel(): (degree: 1 | 2 | 3) => string {
  const t = useTranslations('connect.network.person');
  return (degree) => t(`degree.${degree}` as Parameters<typeof t>[0]);
}

export default function PersonCard({ person, action, variant = 'row' }: PersonCardProps) {
  const isCard = variant === 'card';
  // In-app person links target the authenticated profile mirror (`/connect/u`)
  // - a signed-in member tapping a card stays inside the Connect shell instead
  // of bouncing to the logged-out public `/u/<id>` marketing surface. The
  // public profile route renders its own people (it does not use PersonCard).
  const profileHref = `/connect/u/${person.userId}`;
  const t = useTranslations('connect.network.person');
  const degreeLabel = useDegreeLabel();

  const hasDegree = typeof person.degree === 'number';
  const hasMutual = typeof person.mutualCount === 'number' && person.mutualCount > 0;
  const showProximity = hasDegree || hasMutual;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isCard ? 'column' : 'row',
        alignItems: 'center',
        textAlign: isCard ? 'center' : 'left',
        gap: 'var(--cr-space-sm)',
        padding: isCard ? 'var(--cr-space-md)' : undefined,
        border: isCard ? '1px solid var(--cr-border)' : undefined,
        borderRadius: isCard ? 'var(--cr-radius-lg)' : undefined,
        background: isCard ? 'var(--cr-surface)' : undefined,
      }}
    >
      <Link href={profileHref} aria-label={person.name} className="no-underline">
        {/* ConnectAvatar carries the "open to" ring; status flows from the
            person ref (network + federated search hydrate via getPeopleByIds). */}
        <ConnectAvatar
          name={person.name}
          src={person.avatarUrl}
          size={isCard ? 56 : 40}
          status={person.openStatus ?? null}
        />
      </Link>

      <div style={{ minWidth: 0, flex: isCard ? undefined : 1 }}>
        <Link
          href={profileHref}
          className="no-underline"
          style={{
            display: 'block',
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--cr-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {person.name}
        </Link>
        {person.headline && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--cr-text-4)',
              marginTop: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: isCard ? 'normal' : 'nowrap',
            }}
          >
            {person.headline}
          </div>
        )}
        {showProximity && (
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              color: 'var(--cr-text-4)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: isCard ? 'center' : 'flex-start',
              gap: 6,
            }}
          >
            {hasDegree && (
              <span style={{ fontWeight: 600, color: 'var(--cr-text-3)' }}>
                {degreeLabel(person.degree as 1 | 2 | 3)}
              </span>
            )}
            {hasDegree && hasMutual && <span aria-hidden>·</span>}
            {hasMutual && <span>{t('mutual', { count: person.mutualCount as number })}</span>}
          </div>
        )}
        {person.badges && person.badges.length > 0 && (
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              justifyContent: isCard ? 'center' : 'flex-start',
            }}
          >
            <TrustBadgeRow badges={person.badges} max={isCard ? 3 : 2} size="sm" />
          </div>
        )}
        {/* Sample disclosure for a seeded demo person -- own block so it shows even
            when the person has no trust badges. */}
        {person.isDemo && (
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              justifyContent: isCard ? 'center' : 'flex-start',
            }}
          >
            <SampleBadge size="sm" />
          </div>
        )}
      </div>

      {/* "Open to work" people get a compact Message control next to any
          caller-supplied action. Skipped for `hiring`/null so we only nudge a
          DM where it makes sense (reaching an available worker). */}
      {(person.openStatus === 'work' || action) && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--cr-space-xs)',
          }}
        >
          {person.openStatus === 'work' && (
            <StartConversationButton
              recipientUserId={person.userId}
              partyName={person.name}
              iconOnly
              dsVariant="ghost"
              dsSize="sm"
            />
          )}
          {action}
        </div>
      )}
    </div>
  );
}
