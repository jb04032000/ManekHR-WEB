/**
 * Web mirror of the backend permission registry types
 * (`crewroster-backend/src/modules/rbac/permission-registry.ts`). Kept in
 * sync with the BE shapes by hand - the web fetches the catalog via
 * `GET workspaces/:wsId/rbac/registry`.
 */

export type PermissionScope = 'self' | 'all';

export interface PermissionActionDef {
  /** Action segment, e.g. 'view', 'edit'. */
  action: string;
  /** Whether the self/all scope axis applies. */
  scoped: boolean;
  /** Per-action prerequisite grants. Merged with the node-level `requires`
   *  by `dep-resolver` so an action can declare its own deps without
   *  duplicating shared node-level deps. */
  requires?: string[];
}

export interface PermissionNode {
  /** Path segment key, e.g. 'profile', 'bank'. */
  key: string;
  /** i18n key for the matrix UI label. */
  labelKey: string;
  /** HR-sensitive - hidden by default in the matrix until explicitly
   *  revealed via the "Show sensitive" toggle. */
  sensitive?: boolean;
  /** Industry SoD: a non-owner cannot edit this leaf on their OWN record,
   *  even when their grant nominally scopes to `all`. Owner bypass intact. */
  sodOwnerOnlyOnSelf?: boolean;
  /** Cross-leaf prerequisite grants required to use this node's actions.
   *  Each string is `<path>` or `<path>@<scope>`. Validated at grant-save. */
  requires?: string[];
  children?: PermissionNode[];
  actions?: PermissionActionDef[];
}

export interface PermissionModuleDef {
  /** Module key - mirrors `AppModule` enum values. */
  module: string;
  labelKey: string;
  features: PermissionNode[];
}

export interface RegistryResponse {
  registry: PermissionModuleDef[];
}

/** A held / requested registry grant - `{ path, scope }` tuples. */
export interface GrantedPath {
  path: string;
  scope: PermissionScope;
}

/** A force-allow / force-deny override on a registry path. */
export interface PathOverride {
  path: string;
  allowed: boolean;
  scope?: PermissionScope;
}
