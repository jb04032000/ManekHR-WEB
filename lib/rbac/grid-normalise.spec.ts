import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseGridDraft } from './grid-normalise';
import type { PermissionModuleDef } from '@/types/rbac-registry';
import type { GridDraft } from './permission-grid-payload';

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
            key: 'bank',
            labelKey: 'rbac.team.profile.bank',
            sensitive: true,
            sodOwnerOnlyOnSelf: true,
            actions: [
              { action: 'view', scoped: true },
              { action: 'edit', scoped: true },
            ],
          },
        ],
      },
    ],
  },
];

const emptyDraft = (): GridDraft => ({ flatByCell: {}, pathByCell: {} });

describe('normaliseGridDraft - view-edit invariant', () => {
  it('auto-promotes view scope when edit is granted at wider scope', () => {
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: {
        'team.profile.bank.view': { allowed: true, scope: 'self' },
        'team.profile.bank.edit': { allowed: true, scope: 'all' },
      },
    };
    const { draft, autoReasons } = normaliseGridDraft(value, REGISTRY);
    const viewCell = draft.pathByCell['team.profile.bank.view'] as {
      allowed: true;
      scope?: string;
    };
    assert.equal(viewCell.scope, 'all');
    assert.equal(autoReasons.get('team.profile.bank.view'), 'view-widened-by-edit');
  });

  it('adds missing view grant when only edit is set', () => {
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: {
        'team.profile.bank.edit': { allowed: true, scope: 'self' },
      },
    };
    const { draft, autoReasons } = normaliseGridDraft(value, REGISTRY);
    assert.deepEqual(draft.pathByCell['team.profile.bank.view'], {
      allowed: true,
      scope: 'self',
    });
    assert.ok(autoReasons.has('team.profile.bank.view'));
  });

  it('preserves explicit deny - does not auto-promote a denied view', () => {
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: {
        'team.profile.bank.view': { allowed: false },
        'team.profile.bank.edit': { allowed: true, scope: 'all' },
      },
    };
    const { draft } = normaliseGridDraft(value, REGISTRY);
    assert.deepEqual(draft.pathByCell['team.profile.bank.view'], { allowed: false });
  });
});

describe('normaliseGridDraft - dep resolution', () => {
  it('auto-adds prerequisite dep at the required scope', () => {
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: { 'team.member.create': { allowed: true, scope: 'all' } },
    };
    const { draft, autoReasons } = normaliseGridDraft(value, REGISTRY);
    assert.deepEqual(draft.pathByCell['team.directory.view'], {
      allowed: true,
      scope: 'all',
    });
    assert.equal(autoReasons.get('team.directory.view'), 'required-by:team.member.create');
  });

  it('upgrades dep scope when held scope is too narrow', () => {
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: {
        'team.directory.view': { allowed: true, scope: 'self' },
        'team.member.delete': { allowed: true, scope: 'all' },
      },
    };
    const { draft } = normaliseGridDraft(value, REGISTRY);
    const dirViewCell = draft.pathByCell['team.directory.view'] as {
      allowed: true;
      scope?: string;
    };
    assert.equal(dirViewCell.scope, 'all');
  });
});

describe('normaliseGridDraft - idempotence', () => {
  it('two passes produce identical output', () => {
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: {
        'team.profile.bank.edit': { allowed: true, scope: 'all' },
        'team.member.delete': { allowed: true, scope: 'all' },
      },
    };
    const first = normaliseGridDraft(value, REGISTRY);
    const second = normaliseGridDraft(first.draft, REGISTRY);
    assert.deepEqual(first.draft, second.draft);
  });
});

describe('normaliseGridDraft - purity', () => {
  it('does not mutate input', () => {
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: { 'team.profile.bank.edit': { allowed: true, scope: 'all' } },
    };
    const before = JSON.stringify(value);
    normaliseGridDraft(value, REGISTRY);
    assert.equal(JSON.stringify(value), before);
  });
});

describe('normaliseGridDraft - deny cascade with rolePaths', () => {
  it('auto-denies sibling edit when role grants it and user denies view', () => {
    const rolePaths = [
      { path: 'team.profile.bank.view', scope: 'all' as const },
      { path: 'team.profile.bank.edit', scope: 'all' as const },
    ];
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: { 'team.profile.bank.view': { allowed: false } },
    };
    const { draft, autoReasons } = normaliseGridDraft(value, REGISTRY, rolePaths);
    assert.deepEqual(draft.pathByCell['team.profile.bank.edit'], { allowed: false });
    assert.match(autoReasons.get('team.profile.bank.edit') ?? '', /^auto-denied-by-view-deny/);
  });

  it('auto-denies dependent action when role grants it and user denies the prerequisite', () => {
    const rolePaths = [
      { path: 'team.directory.view', scope: 'all' as const },
      { path: 'team.member.delete', scope: 'all' as const },
    ];
    const value: GridDraft = {
      ...emptyDraft(),
      pathByCell: { 'team.directory.view': { allowed: false } },
    };
    const { draft, autoReasons } = normaliseGridDraft(value, REGISTRY, rolePaths);
    assert.deepEqual(draft.pathByCell['team.member.delete'], { allowed: false });
    assert.match(autoReasons.get('team.member.delete') ?? '', /^auto-denied-by-dep-deny/);
  });
});
