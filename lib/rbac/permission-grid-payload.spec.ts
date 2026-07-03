import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  leafPathsOfModule,
  isRegistryModule,
  buildOverridesPayload,
  buildRolePayload,
} from './permission-grid-payload';
import type { PermissionModuleDef } from '@/types/rbac-registry';

const TEAM: PermissionModuleDef = {
  module: 'team',
  labelKey: 'rbac.module.team',
  features: [
    { key: 'directory', labelKey: 'k', actions: [{ action: 'view', scoped: true }] },
    {
      key: 'profile',
      labelKey: 'k',
      children: [
        {
          key: 'personal',
          labelKey: 'k',
          actions: [
            { action: 'view', scoped: true },
            { action: 'edit', scoped: true },
          ],
        },
        {
          key: 'bank',
          labelKey: 'k',
          sensitive: true,
          actions: [
            { action: 'view', scoped: true },
            { action: 'edit', scoped: true },
          ],
        },
      ],
    },
  ],
};

describe('isRegistryModule', () => {
  it('returns true for a module present in the registry', () => {
    assert.equal(isRegistryModule('team', [TEAM]), true);
  });
  it('returns false for a module absent from the registry (legacy)', () => {
    assert.equal(isRegistryModule('attendance', [TEAM]), false);
  });
});

describe('leafPathsOfModule', () => {
  it('walks the tree and emits one leaf row per (path, action)', () => {
    const leaves = leafPathsOfModule(TEAM);
    const paths = leaves.map((l) => l.path).sort();
    assert.deepEqual(paths, [
      'team.directory.view',
      'team.profile.bank.edit',
      'team.profile.bank.view',
      'team.profile.personal.edit',
      'team.profile.personal.view',
    ]);
    const bankRow = leaves.find((l) => l.path === 'team.profile.bank.edit');
    assert.equal(bankRow?.sensitive, true);
    assert.equal(bankRow?.scoped, true);
  });

  it('builds labelKeyChain with one entry per ancestor (no double-counting)', () => {
    const leaves = leafPathsOfModule(TEAM);
    const directoryView = leaves.find((l) => l.path === 'team.directory.view');
    // top-level feature → chain is just the feature's labelKey
    assert.deepEqual(directoryView?.labelKeyChain, ['k']);
    const bankEdit = leaves.find((l) => l.path === 'team.profile.bank.edit');
    // nested leaf → chain is feature + sub-feature labelKeys (no duplicates)
    assert.deepEqual(bankEdit?.labelKeyChain, ['k', 'k']);
  });

  it('inherits sensitive: true from an ancestor (not just the leaf node)', () => {
    const PARENT_SENSITIVE: PermissionModuleDef = {
      module: 'finance',
      labelKey: 'rbac.module.finance',
      features: [
        {
          key: 'invoices',
          labelKey: 'rbac.finance.invoices',
          sensitive: true,
          children: [
            // child is NOT marked sensitive - inheritance must come from parent
            { key: 'export', labelKey: 'k', actions: [{ action: 'view', scoped: false }] },
          ],
        },
      ],
    };
    const leaves = leafPathsOfModule(PARENT_SENSITIVE);
    const exportView = leaves.find((l) => l.path === 'finance.invoices.export.view');
    assert.equal(exportView?.sensitive, true);
  });
});

describe('buildOverridesPayload', () => {
  it('partitions draft state into flat overrides (legacy modules) and path overrides (registry modules)', () => {
    const out = buildOverridesPayload({
      draft: {
        flatByCell: { 'attendance.view': { allowed: true, scope: 'all' } },
        pathByCell: {
          'team.profile.bank.edit': { allowed: true, scope: 'all' },
          'team.directory.view': { allowed: false },
        },
      },
    });
    assert.deepEqual(out.overrides, [
      { module: 'attendance', action: 'view', allowed: true, scope: 'all' },
    ]);
    assert.deepEqual(
      out.pathOverrides.sort((a, b) => a.path.localeCompare(b.path)),
      [
        { path: 'team.directory.view', allowed: false },
        { path: 'team.profile.bank.edit', allowed: true, scope: 'all' },
      ],
    );
  });

  it('drops inherit-state cells (cells with no explicit draft entry)', () => {
    const out = buildOverridesPayload({
      draft: { flatByCell: {}, pathByCell: {} },
    });
    assert.deepEqual(out.overrides, []);
    assert.deepEqual(out.pathOverrides, []);
  });

  it('Team registry module emits empty flat overrides + populated pathOverrides (T14 guard)', () => {
    // When all changed cells are Team (registry) paths, flatByCell is empty.
    // buildOverridesPayload must emit overrides: [] (satisfies BE required field)
    // and the full pathOverrides array. This is the canonical T14 invariant.
    const out = buildOverridesPayload({
      draft: {
        flatByCell: {},
        pathByCell: { 'team.directory.view': { allowed: true, scope: 'all' } },
      },
    });
    assert.deepEqual(out.overrides, []);
    assert.deepEqual(out.pathOverrides, [
      { path: 'team.directory.view', allowed: true, scope: 'all' },
    ]);
  });
});

describe('buildRolePayload', () => {
  it('builds flat permissions (legacy modules) and permissionPaths (registry modules)', () => {
    const out = buildRolePayload({
      draft: {
        flatByCell: {
          'attendance.view': { allowed: true, scope: 'all' },
          'attendance.edit': { allowed: true, scope: 'self' },
        },
        pathByCell: {
          'team.profile.bank.edit': { allowed: true, scope: 'all' },
        },
      },
    });
    assert.deepEqual(out.permissions, [
      { module: 'attendance', actions: ['view', 'edit'], actionScopes: ['all', 'self'] },
    ]);
    assert.deepEqual(out.permissionPaths, [{ path: 'team.profile.bank.edit', scope: 'all' }]);
  });

  it('defaults a scope-less allow cell to scope: self (least-privilege)', () => {
    const out = buildRolePayload({
      draft: {
        flatByCell: { 'attendance.view': { allowed: true } }, // no scope
        pathByCell: { 'team.profile.bank.edit': { allowed: true } }, // no scope
      },
    });
    assert.deepEqual(out.permissions[0].actionScopes, ['self']);
    assert.deepEqual(out.permissionPaths, [{ path: 'team.profile.bank.edit', scope: 'self' }]);
  });
});
