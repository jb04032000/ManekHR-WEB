import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertViewEditCoherent, normaliseViewEditCoherent } from './coherence';

describe('assertViewEditCoherent', () => {
  it('accepts view-only grants', () => {
    assert.doesNotThrow(() =>
      assertViewEditCoherent([{ path: 'team.profile.bank.view', scope: 'self' }]),
    );
  });

  it('accepts view-all + edit-self', () => {
    assert.doesNotThrow(() =>
      assertViewEditCoherent([
        { path: 'team.profile.bank.view', scope: 'all' },
        { path: 'team.profile.bank.edit', scope: 'self' },
      ]),
    );
  });

  it('accepts view-all + edit-all', () => {
    assert.doesNotThrow(() =>
      assertViewEditCoherent([
        { path: 'team.profile.bank.view', scope: 'all' },
        { path: 'team.profile.bank.edit', scope: 'all' },
      ]),
    );
  });

  it('rejects view-self + edit-all', () => {
    assert.throws(() =>
      assertViewEditCoherent([
        { path: 'team.profile.bank.view', scope: 'self' },
        { path: 'team.profile.bank.edit', scope: 'all' },
      ]),
    );
  });

  it('rejects edit-only (no view grant)', () => {
    assert.throws(() => assertViewEditCoherent([{ path: 'team.profile.bank.edit', scope: 'all' }]));
  });

  it('validates per-leaf independently', () => {
    assert.throws(
      () =>
        assertViewEditCoherent([
          { path: 'team.profile.bank.view', scope: 'all' },
          { path: 'team.profile.bank.edit', scope: 'all' },
          { path: 'team.profile.pay.view', scope: 'self' },
          { path: 'team.profile.pay.edit', scope: 'all' },
        ]),
      /team\.profile\.pay/,
    );
  });
});

describe('normaliseViewEditCoherent', () => {
  it('promotes view to satisfy edit', () => {
    const out = normaliseViewEditCoherent([
      { path: 'team.profile.bank.view', scope: 'self' },
      { path: 'team.profile.bank.edit', scope: 'all' },
    ]);
    const view = out.find((g) => g.path === 'team.profile.bank.view');
    assert.equal(view?.scope, 'all');
  });

  it('adds missing view grant for an edit', () => {
    const out = normaliseViewEditCoherent([{ path: 'team.profile.bank.edit', scope: 'self' }]);
    const view = out.find((g) => g.path === 'team.profile.bank.view');
    assert.deepEqual(view, { path: 'team.profile.bank.view', scope: 'self' });
  });

  it('is pure (input untouched)', () => {
    const input = [{ path: 'team.profile.bank.edit', scope: 'self' as const }];
    normaliseViewEditCoherent(input);
    assert.deepEqual(input, [{ path: 'team.profile.bank.edit', scope: 'self' }]);
  });
});
