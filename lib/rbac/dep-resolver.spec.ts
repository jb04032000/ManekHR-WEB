import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertDepsResolved, resolveImplicitDeps } from './dep-resolver';
import type { PermissionModuleDef } from '@/types/rbac-registry';

// Minimal fixture: a `team` module with `directory.view` + `member.create/delete`
// where `member` declares requires: [team.directory.view@all]; and `appAccess.manage`
// with two requires.
const REGISTRY: PermissionModuleDef[] = [
  {
    module: 'team',
    labelKey: 'rbac.module.team',
    features: [
      {
        key: 'directory',
        labelKey: 'rbac.team.directory',
        actions: [{ action: 'view', scoped: true }],
      },
      {
        key: 'member',
        labelKey: 'rbac.team.member',
        requires: ['team.directory.view@all'],
        actions: [
          { action: 'create', scoped: false },
          { action: 'delete', scoped: false },
        ],
      },
      {
        key: 'profile',
        labelKey: 'rbac.team.profileGroup',
        children: [
          {
            key: 'org',
            labelKey: 'rbac.team.profile.org',
            actions: [
              { action: 'view', scoped: true },
              { action: 'edit', scoped: true },
            ],
          },
          {
            key: 'personal',
            labelKey: 'rbac.team.profile.personal',
            actions: [{ action: 'view', scoped: true }],
          },
        ],
      },
      {
        key: 'appAccess',
        labelKey: 'rbac.team.appAccess',
        requires: ['team.directory.view@all', 'team.profile.org.view@all'],
        actions: [{ action: 'manage', scoped: false }],
      },
    ],
  },
];

describe('assertDepsResolved', () => {
  it('passes when deps satisfied', () => {
    assert.doesNotThrow(() =>
      assertDepsResolved(
        [
          { path: 'team.directory.view', scope: 'all' },
          { path: 'team.member.create', scope: 'all' },
        ],
        REGISTRY,
      ),
    );
  });

  it('rejects when dep missing', () => {
    assert.throws(() =>
      assertDepsResolved([{ path: 'team.member.create', scope: 'all' }], REGISTRY),
    );
  });

  it('rejects when dep scope insufficient', () => {
    assert.throws(
      () =>
        assertDepsResolved(
          [
            { path: 'team.directory.view', scope: 'self' },
            { path: 'team.member.delete', scope: 'all' },
          ],
          REGISTRY,
        ),
      /scope/i,
    );
  });

  it('passes for leaves without requires[]', () => {
    assert.doesNotThrow(() =>
      assertDepsResolved([{ path: 'team.profile.personal.view', scope: 'self' }], REGISTRY),
    );
  });

  it('accepts when ALL of multiple required deps are satisfied (appAccess)', () => {
    assert.doesNotThrow(() =>
      assertDepsResolved(
        [
          { path: 'team.directory.view', scope: 'all' },
          { path: 'team.profile.org.view', scope: 'all' },
          { path: 'team.appAccess.manage', scope: 'all' },
        ],
        REGISTRY,
      ),
    );
  });

  it('rejects when ONE of multiple required deps is missing (appAccess)', () => {
    assert.throws(
      () =>
        assertDepsResolved(
          [
            { path: 'team.directory.view', scope: 'all' },
            { path: 'team.appAccess.manage', scope: 'all' },
          ],
          REGISTRY,
        ),
      /team\.profile\.org\.view/,
    );
  });
});

describe('resolveImplicitDeps', () => {
  it('adds missing dep grants at required scope', () => {
    const out = resolveImplicitDeps([{ path: 'team.member.create', scope: 'all' }], REGISTRY);
    const dep = out.find((g) => g.path === 'team.directory.view');
    assert.deepEqual(dep, { path: 'team.directory.view', scope: 'all' });
  });

  it('upgrades insufficient-scope deps', () => {
    const out = resolveImplicitDeps(
      [
        { path: 'team.directory.view', scope: 'self' },
        { path: 'team.member.delete', scope: 'all' },
      ],
      REGISTRY,
    );
    const dep = out.find((g) => g.path === 'team.directory.view');
    assert.equal(dep?.scope, 'all');
  });

  it('is pure (input untouched)', () => {
    const input = [{ path: 'team.member.create', scope: 'all' as const }];
    resolveImplicitDeps(input, REGISTRY);
    assert.deepEqual(input, [{ path: 'team.member.create', scope: 'all' }]);
  });
});
