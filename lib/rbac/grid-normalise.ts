import type {
  GrantedPath,
  PermissionModuleDef,
  PermissionNode,
  PermissionScope,
} from '@/types/rbac-registry';
import type { CellDraft, GridDraft } from './permission-grid-payload';
import { normaliseViewEditCoherent } from './coherence';
import { resolveImplicitDeps } from './dep-resolver';

export interface NormaliseResult {
  draft: GridDraft;
  /**
   * Map of path → human-readable reason tag.
   *  - `'view-widened-by-edit'` - view was auto-promoted to satisfy an edit grant on the same leaf.
   *  - `'required-by:<requirer-path>'` - dep auto-added because the requirer path demands it.
   *  - `'auto-denied-by-view-deny:<denied-view>'` - edit auto-denied because user denied its sibling view while role granted edit.
   *  - `'auto-denied-by-dep-deny:<denied-dep>'` - action auto-denied because user denied a prerequisite while role granted the action.
   *  - `'auto'` - normalised for internal consistency (fallback).
   *
   * The grid shows a subtle `auto` badge with a tooltip for every path in this map.
   */
  autoReasons: Map<string, string>;
}

const LEAF_RE = /^(.+)\.(view|edit)$/;

/**
 * Walk the registry to find the `PermissionNode` that owns the given
 * `actionPath` (`module.feature[.subfeature].action`).
 */
function nodeForActionPath(
  registry: PermissionModuleDef[],
  actionPath: string,
): PermissionNode | undefined {
  const segs = actionPath.split('.');
  // Try progressively shorter node prefixes, longest first.
  for (let cut = segs.length - 1; cut >= 1; cut--) {
    const nodePath = segs.slice(0, cut).join('.');
    const action = segs.slice(cut).join('.');
    const [modKey, ...rest] = nodePath.split('.');
    const mod = registry.find((m) => m.module === modKey);
    if (!mod || rest.length === 0) continue;
    let cur: PermissionNode | undefined = mod.features.find((f) => f.key === rest[0]);
    for (const seg of rest.slice(1)) cur = cur?.children?.find((c) => c.key === seg);
    if (cur?.actions?.some((a) => a.action === action)) return cur;
  }
  return undefined;
}

/**
 * Derive a human-readable reason tag for a path that was auto-set (allowed) during
 * normalisation.
 */
function computeAllowReason(
  autoPath: string,
  allGrants: GrantedPath[],
  registry: PermissionModuleDef[],
): string {
  // If autoPath ends in `.view`, check whether a sibling `.edit` grant exists.
  const viewMatch = LEAF_RE.exec(autoPath);
  if (viewMatch && viewMatch[2] === 'view') {
    const stem = viewMatch[1];
    const siblingEdit = allGrants.find((g) => g.path === `${stem}.edit`);
    if (siblingEdit) return 'view-widened-by-edit';
  }

  // Otherwise look for a grant whose node `requires` this path.
  for (const g of allGrants) {
    if (g.path === autoPath) continue;
    const node = nodeForActionPath(registry, g.path);
    for (const req of node?.requires ?? []) {
      const reqPath = req.split('@')[0];
      if (reqPath === autoPath) return `required-by:${g.path}`;
    }
  }

  return 'auto';
}

/**
 * Cascade deny-overrides when the user explicitly denies a path that is
 * depended upon by role-granted paths. Two cascades:
 *
 * 1. `<stem>.view` deny → auto-deny `<stem>.edit` when the role grants it.
 * 2. Dep-prerequisite deny → auto-deny any role-granted path that declares
 *    `requires: [deniedPath]`.
 *
 * Pure - writes results into `autoDenies` and `autoReasons` only.
 */
function cascadeDenies(
  deniedPath: string,
  rolePaths: ReadonlyArray<GrantedPath>,
  registry: PermissionModuleDef[],
  autoDenies: Set<string>,
  autoReasons: Map<string, string>,
): void {
  // 1. Sibling edit cascade.
  const m = LEAF_RE.exec(deniedPath);
  if (m && m[2] === 'view') {
    const stem = m[1];
    const siblingEdit = `${stem}.edit`;
    const roleHasEdit = rolePaths.some((r) => r.path === siblingEdit);
    if (roleHasEdit) {
      autoDenies.add(siblingEdit);
      autoReasons.set(siblingEdit, `auto-denied-by-view-deny:${deniedPath}`);
    }
  }

  // 2. Dep-prerequisite cascade.
  for (const rp of rolePaths) {
    const node = nodeForActionPath(registry, rp.path);
    for (const req of node?.requires ?? []) {
      const [reqPath] = req.split('@');
      if (reqPath === deniedPath) {
        autoDenies.add(rp.path);
        autoReasons.set(rp.path, `auto-denied-by-dep-deny:${deniedPath}`);
      }
    }
  }
}

/**
 * Apply view-edit coherence + dep resolution to the current draft. Pure -
 * returns a **new** draft and a map of paths that were auto-set, keyed by
 * reason tag.
 *
 * Rules:
 * 1. Cells with `allowed === false` (explicit denies) are **never** overridden.
 * 2. Cells that were already allowed at the required scope are left as-is
 *    (no spurious badge).
 *
 * `rolePaths` (optional, used in override mode) brings the role-level grants
 * into scope so the normaliser can:
 *   - AUTO-CASCADE deny-overrides: denying `<leaf>.view` while the role grants
 *     `<leaf>.edit` would leave the effective set incoherent at save time;
 *     auto-add a deny on `<leaf>.edit` to keep the matrix submittable.
 *   - Same for dep-revocation: denying `team.directory.view` while the role
 *     grants `member.delete` would orphan the delete grant; auto-deny.
 *
 * Explicit allow-cells take precedence over auto-cascade denies (a user who
 * explicitly allows a path overrides the cascade).
 */
export function normaliseGridDraft(
  value: GridDraft,
  registry: PermissionModuleDef[],
  rolePaths: ReadonlyArray<GrantedPath> = [],
): NormaliseResult {
  // ── Step 1: build effective allow-set (role + allow-overrides − deny-overrides) ──
  const effectiveMap = new Map<string, PermissionScope>();
  for (const g of rolePaths) effectiveMap.set(g.path, g.scope);
  for (const [path, cell] of Object.entries(value.pathByCell)) {
    if (cell.allowed) {
      effectiveMap.set(
        path,
        ((cell as { allowed: true; scope?: PermissionScope }).scope ?? 'self') as PermissionScope,
      );
    } else {
      effectiveMap.delete(path);
    }
  }

  const allowGrants: GrantedPath[] = Array.from(effectiveMap, ([path, scope]) => ({
    path,
    scope,
  }));

  // ── Step 2: two-pass normalisation on the effective allow-set ──
  const stage1 = normaliseViewEditCoherent(allowGrants);
  const stage2 = resolveImplicitDeps(stage1, registry);

  // ── Step 3: identify allow-side auto-adds / upgrades ──
  // A path is "auto" if it appears in stage2 at a scope the user did NOT explicitly set.
  const originalAllowMap = new Map(
    Object.entries(value.pathByCell)
      .filter(([, c]) => c.allowed)
      .map(([path, c]) => [
        path,
        ((c as { allowed: true; scope?: PermissionScope }).scope ?? 'self') as PermissionScope,
      ]),
  );
  // Phase 1d - suppress sticky overrides of role-granted paths. If a `stage2`
  // grant matches a `rolePath` at the same-or-wider scope, the role already
  // satisfies the dep - adding an override would silently pin the path as a
  // sticky override, surviving future role swaps. Only auto-add when the role
  // does NOT already cover it.
  const ROLE_SCOPE_RANK: Record<PermissionScope, number> = { self: 0, all: 1 };
  const rolePathMap = new Map(rolePaths.map((r) => [r.path, r.scope]));
  const autoReasons = new Map<string, string>();
  const autoAdds = new Map<string, PermissionScope>();

  for (const g of stage2) {
    const before = originalAllowMap.get(g.path);
    if (before === g.scope) continue;
    // Skip paths that have an explicit deny - they won't appear as allows.
    const denyCell = value.pathByCell[g.path];
    if (denyCell && !denyCell.allowed) continue;
    // Phase 1d - skip if the role already grants this path at same-or-wider
    // scope. The dep is satisfied by the role; auto-overriding would create
    // a sticky pin that survives role swaps.
    const roleScope = rolePathMap.get(g.path);
    if (roleScope && ROLE_SCOPE_RANK[roleScope] >= ROLE_SCOPE_RANK[g.scope]) continue;
    autoAdds.set(g.path, g.scope);
    autoReasons.set(g.path, computeAllowReason(g.path, stage2, registry));
  }

  // ── Step 4: identify deny-side auto-cascades (override mode only) ──
  const autoDenies = new Set<string>();
  if (rolePaths.length > 0) {
    for (const [path, cell] of Object.entries(value.pathByCell)) {
      if (!cell.allowed) {
        cascadeDenies(path, rolePaths, registry, autoDenies, autoReasons);
      }
    }
  }

  // ── Step 5: assemble nextPathByCell ──
  // Priority order (high → low):
  //   a) Explicit user denies (from input) - always preserved.
  //   b) Explicit user allows (from input) - override auto-denies.
  //   c) Auto-denies (from cascade) - only applied when user has no explicit allow.
  //   d) Auto-allows (from normalisation) - applied last, honouring all denies.

  const nextPathByCell: Record<string, CellDraft> = {};

  // (a) Preserve explicit denies first.
  for (const [path, cell] of Object.entries(value.pathByCell)) {
    if (!cell.allowed) {
      nextPathByCell[path] = cell;
    }
  }

  // (c) Apply auto-denies - skip if user explicitly denied already (already there)
  //     or if user explicitly allows (handled in (b) below).
  for (const path of autoDenies) {
    if (nextPathByCell[path]?.allowed === false) continue; // already a deny
    if (value.pathByCell[path]?.allowed === true) continue; // user explicit allow wins
    nextPathByCell[path] = { allowed: false };
  }

  // (b) Apply explicit user allows - override auto-denies set in (c).
  for (const [path, cell] of Object.entries(value.pathByCell)) {
    if (!cell.allowed) continue;
    nextPathByCell[path] = cell;
  }

  // (d) Apply auto-allows - skip paths that have any deny (explicit or cascaded).
  for (const [path, scope] of autoAdds) {
    if (nextPathByCell[path]?.allowed === false) continue;
    nextPathByCell[path] = { allowed: true, scope };
  }

  return {
    draft: { ...value, pathByCell: nextPathByCell },
    autoReasons,
  };
}
