/**
 * Connect Network - person-hydration helpers.
 *
 * The network list endpoints (`listInvitations` / `listConnections` /
 * `listFollowing`) return RAW user ids. A people card needs name / avatar /
 * headline, so the caller collects every id, resolves them in one
 * `getPeople` batch round-trip, and looks each one up by `userId`.
 */

import { getPeople } from '../network.actions';
import type { ConnectPerson } from '@/components/connect';
import type { PersonRef } from '../network.types';

/** A `userId` -> resolved person index for O(1) row lookup. */
export type PeopleIndex = Record<string, PersonRef>;

/**
 * Resolve a set of user ids to a `userId`-keyed index. Unresolvable ids
 * (deleted users, hidden profiles) are simply absent from the index; callers
 * fall back to a placeholder person. Never throws.
 */
export async function hydratePeople(ids: string[]): Promise<PeopleIndex> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const res = await getPeople(unique);
  if (!res.ok) return {};
  return Object.fromEntries(res.data.map((person) => [person.userId, person]));
}

/**
 * Build a `ConnectPerson` (the `PersonCard` shape) for one user id, using the
 * hydrated index. When the id is missing from the index a safe placeholder is
 * returned so a row always renders something a person can act on.
 */
export function toConnectPerson(
  userId: string,
  index: PeopleIndex,
  fallbackName: string,
): ConnectPerson {
  const ref = index[userId];
  return {
    userId,
    name: ref?.name ?? fallbackName,
    headline: ref?.headline ?? undefined,
    avatarUrl: ref?.avatar ?? undefined,
    // "open to" ring signal - real value from /connect/people getPeopleByIds.
    openStatus: ref?.openStatus ?? null,
    // Sample marker - threads PersonRef.isDemo to the card so it can show the
    // SampleBadge. Absent ref / real member -> false. Keep `isDemo` in sync.
    isDemo: ref?.isDemo ?? false,
  };
}
