import type { AccountDeletionMarker, User } from '@/types';
import type { DeletionScope } from './DangerDeleteModal';

/**
 * Pure helpers for the admin pending-deletions support view (plan §7). Derive
 * which scopes a user has scheduled and the soonest recover-by date so support
 * can prioritize accounts whose 30-day window is closing.
 */
export interface ScopedMarker {
  scope: DeletionScope;
  marker: AccountDeletionMarker;
}

type DeletionMarkers = Pick<User, 'connectDeletion' | 'erpDeletion' | 'accountDeletion'>;

export function pendingDeletionScopes(user: DeletionMarkers): ScopedMarker[] {
  const out: ScopedMarker[] = [];
  if (user.connectDeletion?.state === 'pending')
    out.push({ scope: 'connect', marker: user.connectDeletion });
  if (user.erpDeletion?.state === 'pending') out.push({ scope: 'erp', marker: user.erpDeletion });
  if (user.accountDeletion?.state === 'pending')
    out.push({ scope: 'account', marker: user.accountDeletion });
  return out;
}

/** Soonest `purgeAfter` (ISO) across the given pending scopes, or null if none. */
export function earliestPurgeAfter(scopes: ScopedMarker[]): string | null {
  if (scopes.length === 0) return null;
  return scopes.map((s) => s.marker.purgeAfter).sort()[0];
}
