import type {
  GrantedPath,
  PathOverride,
  PermissionModuleDef,
  PermissionNode,
  PermissionScope,
} from '@/types/rbac-registry';

/**
 * One row's worth of metadata for a registry leaf path (a
 * `{module}.{...path}.{action}` tuple). The `<PermissionGrid>` renders one
 * row per leaf.
 */
export interface LeafPathRow {
  path: string; // e.g. 'team.profile.bank.edit'
  module: string; // 'team'
  feature: string; // 'profile' (top-level child key under the module)
  subFeature?: string; // 'bank' (when a feature has children; undefined for one-level features)
  action: string; // 'view' | 'edit' | ...
  scoped: boolean; // whether the action carries a self/all scope
  sensitive?: boolean; // true when ANY ancestor node is sensitive
  sodOwnerOnlyOnSelf?: boolean; // Phase 1d: industry SoD - owner bypass on own record
  labelKeyChain: string[]; // node labelKeys in order, for i18n composition
}

/** True when `module` is a top-level entry in the registry. Else legacy/flat. */
export function isRegistryModule(module: string, registry: PermissionModuleDef[]): boolean {
  return registry.some((m) => m.module === module);
}

/**
 * Walk a registry module's feature tree and emit one row per leaf
 * `(path, action)` combination. The walk is depth-first; the resulting
 * order is the natural display order.
 */
export function leafPathsOfModule(mod: PermissionModuleDef): LeafPathRow[] {
  const out: LeafPathRow[] = [];

  const walk = (
    node: PermissionNode,
    prefix: string,
    feature: string,
    subFeature: string | undefined,
    sensitive: boolean,
    labelKeyChain: string[],
  ): void => {
    const nodePath = `${prefix}.${node.key}`;
    const inheritedSensitive = sensitive || !!node.sensitive;
    const chain = [...labelKeyChain, node.labelKey];

    for (const a of node.actions ?? []) {
      out.push({
        path: `${nodePath}.${a.action}`,
        module: mod.module,
        feature,
        subFeature,
        action: a.action,
        scoped: a.scoped,
        sensitive: inheritedSensitive,
        sodOwnerOnlyOnSelf: node.sodOwnerOnlyOnSelf, // Phase 1d
        labelKeyChain: chain,
      });
    }

    for (const child of node.children ?? []) {
      walk(child, nodePath, feature, node.key, inheritedSensitive, chain);
    }
  };

  for (const feature of mod.features) {
    walk(feature, mod.module, feature.key, undefined, !!feature.sensitive, []);
  }

  return out;
}

/**
 * Single cell's draft state. Discriminated union ensures a deny cell (`allowed:
 * false`) can never carry a `scope` - that combination is semantically
 * incoherent and TypeScript will reject it at compile time.
 */
export type CellDraft = { allowed: true; scope?: PermissionScope } | { allowed: false };

/**
 * The grid's draft, keyed by a stable cell-id. `flatByCell` keys are
 * `${module}.${action}`; `pathByCell` keys are the registry leaf path.
 */
export interface GridDraft {
  flatByCell: Record<string, CellDraft>;
  pathByCell: Record<string, CellDraft>;
}

export interface FlatOverride {
  module: string;
  action: string;
  allowed: boolean;
  scope?: PermissionScope;
}

export interface FlatPermissionRow {
  module: string;
  actions: string[];
  actionScopes?: PermissionScope[];
}

export interface OverridesPayload {
  overrides: FlatOverride[];
  pathOverrides: PathOverride[];
}

/**
 * Build the override-mode payload from the grid's draft. Legacy modules
 * emit flat `FlatOverride[]`; registry modules emit `PathOverride[]`. Cells
 * not in the draft (inherit state) are not emitted - the backend treats a
 * missing entry as "inherit the role".
 *
 * Callers are responsible for pre-partitioning cells: use
 * `isRegistryModule(module, registry)` to decide whether a cell belongs in
 * `draft.flatByCell` (legacy) or `draft.pathByCell` (registry). This function
 * does not need - and does not accept - the registry itself.
 */
export function buildOverridesPayload(args: { draft: GridDraft }): OverridesPayload {
  const { draft } = args;

  const overrides: FlatOverride[] = Object.entries(draft.flatByCell).map(([key, cell]) => {
    const [module, action] = key.split('.', 2);
    return cell.allowed
      ? { module, action, allowed: true, scope: cell.scope }
      : { module, action, allowed: false };
  });

  const pathOverrides: PathOverride[] = Object.entries(draft.pathByCell).map(([path, cell]) =>
    cell.allowed ? { path, allowed: true, scope: cell.scope } : { path, allowed: false },
  );

  return { overrides, pathOverrides };
}

/**
 * Convert a saved Role's grants into a GridDraft for `<PermissionGrid
 * mode="role">`. Flat `permissions[]` rows land in `flatByCell`
 * (`${module}.${action}` keys); `permissionPaths[]` land in `pathByCell`.
 * Shared by the roles list drawer and the role detail page so the two
 * editors can never drift (roles -> team app-access parity).
 */
export function roleToDraft(role: {
  permissions: Array<{ module: string; actions: string[]; actionScopes?: PermissionScope[] }>;
  permissionPaths?: GrantedPath[];
}): GridDraft {
  const flatByCell: Record<string, CellDraft> = {};
  for (const row of role.permissions) {
    row.actions.forEach((action, i) => {
      flatByCell[`${row.module}.${action}`] = {
        allowed: true,
        scope: row.actionScopes?.[i] ?? 'self',
      };
    });
  }
  const pathByCell: Record<string, CellDraft> = {};
  for (const g of role.permissionPaths ?? []) {
    pathByCell[g.path] = { allowed: true, scope: g.scope };
  }
  return { flatByCell, pathByCell };
}

export interface RolePayload {
  permissions: FlatPermissionRow[];
  permissionPaths: GrantedPath[];
}

/**
 * Build the role-edit-mode payload. Legacy modules collapse into
 * `FlatPermissionRow` (one row per module, parallel actions + actionScopes).
 * Registry modules emit `GrantedPath[]`. Only allowed:true cells are
 * emitted (a role grants positively; there is no "force deny" on a role -
 * use a per-member override for that).
 *
 * Callers are responsible for pre-partitioning cells: use
 * `isRegistryModule(module, registry)` to decide whether a cell belongs in
 * `draft.flatByCell` (legacy) or `draft.pathByCell` (registry). This function
 * does not need - and does not accept - the registry itself.
 */
export function buildRolePayload(args: { draft: GridDraft }): RolePayload {
  const { draft } = args;

  const flatByModule = new Map<string, { actions: string[]; actionScopes: PermissionScope[] }>();
  for (const [key, cell] of Object.entries(draft.flatByCell)) {
    if (!cell.allowed) continue;
    const [module, action] = key.split('.', 2);
    if (!flatByModule.has(module)) flatByModule.set(module, { actions: [], actionScopes: [] });
    const row = flatByModule.get(module)!;
    row.actions.push(action);
    row.actionScopes.push(cell.scope ?? 'self');
  }

  const permissions: FlatPermissionRow[] = [...flatByModule.entries()].map(([module, row]) => ({
    module,
    actions: row.actions,
    actionScopes: row.actionScopes,
  }));

  const permissionPaths: GrantedPath[] = Object.entries(draft.pathByCell)
    .filter(
      (entry): entry is [string, { allowed: true; scope?: PermissionScope }] => entry[1].allowed,
    )
    .map(([path, cell]) => ({ path, scope: cell.scope ?? 'self' }));

  return { permissions, permissionPaths };
}
