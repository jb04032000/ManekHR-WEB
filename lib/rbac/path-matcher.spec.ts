import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathGrantSatisfies } from './path-matcher';

describe('pathGrantSatisfies', () => {
  const grants = [
    { path: 'team.directory.view', scope: 'all' as const },
    { path: 'team.profile.personal.edit', scope: 'self' as const },
  ];

  it('returns true when the held grant matches and scope is omitted', () => {
    assert.equal(pathGrantSatisfies(grants, { path: 'team.directory.view' }), true);
  });

  it('returns false when the path is not held', () => {
    assert.equal(pathGrantSatisfies(grants, { path: 'team.profile.bank.edit' }), false);
  });

  it('returns true when required self and granted all (all is a superset)', () => {
    assert.equal(pathGrantSatisfies(grants, { path: 'team.directory.view', scope: 'self' }), true);
  });

  it('returns true when required self and granted self', () => {
    assert.equal(
      pathGrantSatisfies(grants, { path: 'team.profile.personal.edit', scope: 'self' }),
      true,
    );
  });

  it('returns false when required all but granted self', () => {
    assert.equal(
      pathGrantSatisfies(grants, { path: 'team.profile.personal.edit', scope: 'all' }),
      false,
    );
  });
});
