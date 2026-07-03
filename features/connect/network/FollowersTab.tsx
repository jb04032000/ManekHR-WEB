'use client';

/**
 * FollowersTab - the Network screen's "Followers" panel: people who follow the
 * viewer (inbound follow edges). A follow is asymmetric, so a follower is not
 * necessarily someone the viewer follows back - each row carries the shared
 * `PersonCardActions` (Connect + Follow) so the viewer can connect or follow
 * back. Phase 2 follows are PEOPLE only (`followeeType === 'user'`).
 *
 * The Server Component pre-loads the follower edges + hydrates each row's
 * `followerId` (the follower) into a people card.
 */

import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { ConnectEmptyState, PersonCard } from '@/components/connect';
import PersonCardActions from './PersonCardActions';
import type { Follow } from '../network.types';
import { toConnectPerson, type PeopleIndex } from './hydrate';

interface FollowersTabProps {
  /** Inbound follow edges (people who follow the viewer), pre-loaded. */
  followers: Follow[];
  /** Hydrated people for the followers, keyed by `userId`. */
  people: PeopleIndex;
  /** Follower ids the viewer is already connected to - render "Connected", not
   *  a bare Connect (which would 409 "already connected"). */
  connectedIds: string[];
  /** Follower ids the viewer already follows back - render "Following". */
  followingIds: string[];
}

export default function FollowersTab({
  followers,
  people,
  connectedIds,
  followingIds,
}: FollowersTabProps) {
  const t = useTranslations('connect.network.followers');
  const tPerson = useTranslations('connect.network.person');

  const connectedSet = new Set(connectedIds);
  const followingSet = new Set(followingIds);

  // Phase 2: person follows only - a `companyPage` follower has no entity to
  // render yet (Phase 6) and is filtered out rather than shown as a broken row.
  const peopleFollowers = followers.filter((f) => f.followeeType === 'user');

  if (peopleFollowers.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<Users size={24} aria-hidden />}
        title={t('empty.title')}
        description={t('empty.body')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--cr-text-4)' }}>
        {t('count', { count: peopleFollowers.length })}
      </span>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {peopleFollowers.map((follow) => {
          const person = toConnectPerson(follow.followerId, people, tPerson('fallbackName'));
          return (
            <li
              key={follow._id}
              style={{ padding: '14px 4px', borderBottom: '1px solid var(--cr-border-light)' }}
            >
              <PersonCard
                person={person}
                action={
                  <PersonCardActions
                    userId={follow.followerId}
                    mode="full"
                    initialConnected={connectedSet.has(follow.followerId)}
                    initialFollowing={followingSet.has(follow.followerId)}
                  />
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
