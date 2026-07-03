import { describe, it, expect } from 'vitest';
import { pendingDeletionScopes, earliestPurgeAfter } from './pending';

/**
 * Pure helpers behind the admin pending-deletions support view: which scopes a
 * user has scheduled (pending) and the earliest recover-by date across them.
 */

const marker = (purgeAfter: string, state: 'pending' | 'purged' = 'pending') => ({
  state,
  requestedAt: '2026-06-25T00:00:00.000Z',
  purgeAfter,
});

describe('pendingDeletionScopes', () => {
  it('lists only the scopes that are currently pending', () => {
    const scopes = pendingDeletionScopes({
      connectDeletion: marker('2026-07-25T00:00:00.000Z'),
      erpDeletion: null,
      accountDeletion: marker('2026-07-20T00:00:00.000Z'),
    });
    expect(scopes.map((s) => s.scope)).toEqual(['connect', 'account']);
  });

  it('ignores already-purged markers', () => {
    const scopes = pendingDeletionScopes({
      connectDeletion: marker('2026-07-25T00:00:00.000Z', 'purged'),
      erpDeletion: null,
      accountDeletion: null,
    });
    expect(scopes).toHaveLength(0);
  });
});

describe('earliestPurgeAfter', () => {
  it('returns the soonest recover-by date across pending scopes', () => {
    const scopes = pendingDeletionScopes({
      connectDeletion: marker('2026-07-25T00:00:00.000Z'),
      erpDeletion: null,
      accountDeletion: marker('2026-07-20T00:00:00.000Z'),
    });
    expect(earliestPurgeAfter(scopes)).toBe('2026-07-20T00:00:00.000Z');
  });

  it('returns null when nothing is pending', () => {
    expect(earliestPurgeAfter([])).toBeNull();
  });
});
