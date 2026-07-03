import type {
  GrantedPath,
  PermissionModuleDef,
  PermissionNode,
  PermissionScope,
} from '@/types/rbac-registry';

const SCOPE_RANK: Record<PermissionScope, number> = { self: 0, all: 1 };

function findNodeByPath(
  registry: PermissionModuleDef[],
  nodePath: string,
): PermissionNode | undefined {
  const [modKey, ...rest] = nodePath.split('.');
  const mod = registry.find((m) => m.module === modKey);
  if (!mod || rest.length === 0) return undefined;
  let cur: PermissionNode | undefined = mod.features.find((f) => f.key === rest[0]);
  for (const seg of rest.slice(1)) cur = cur?.children?.find((c) => c.key === seg);
  return cur;
}

function nodeForActionPath(
  registry: PermissionModuleDef[],
  actionPath: string,
): PermissionNode | undefined {
  const segs = actionPath.split('.');
  for (let cut = segs.length - 1; cut >= 1; cut--) {
    const nodePath = segs.slice(0, cut).join('.');
    const action = segs.slice(cut).join('.');
    const node = findNodeByPath(registry, nodePath);
    if (node?.actions?.some((a) => a.action === action)) return node;
  }
  return undefined;
}

/**
 * Combined per-action + per-node prerequisites for an action path. Twin of
 * the BE helper - actions can declare their own `requires` separate from
 * the shared node-level `requires`.
 */
function requiresForActionPath(registry: PermissionModuleDef[], actionPath: string): string[] {
  const node = nodeForActionPath(registry, actionPath);
  if (!node) return [];
  const actionDef = node.actions?.find((a) => actionPath.endsWith(`.${a.action}`));
  return [...(node.requires ?? []), ...(actionDef?.requires ?? [])];
}

function parseRequire(req: string): { path: string; scope?: PermissionScope } {
  const [path, scope] = req.split('@');
  return { path, scope: scope as PermissionScope | undefined };
}

/**
 * Twin of the backend `assertDepsResolved`. Each grant's registry node may
 * declare `requires: [...]` - every prerequisite path must be present at
 * sufficient scope. Throws `Error` (UI catches + toasts).
 */
export function assertDepsResolved(grants: GrantedPath[], registry: PermissionModuleDef[]): void {
  const have = new Map(grants.map((g) => [g.path, g.scope]));
  for (const g of grants) {
    for (const req of requiresForActionPath(registry, g.path)) {
      const { path: reqPath, scope: reqScope } = parseRequire(req);
      const held = have.get(reqPath);
      if (!held) throw new Error(`${g.path} requires ${reqPath}.`);
      if (reqScope && SCOPE_RANK[held] < SCOPE_RANK[reqScope]) {
        throw new Error(
          `${g.path} requires ${reqPath} at scope '${reqScope}' or wider (held '${held}').`,
        );
      }
    }
  }
}

/**
 * Auto-add or upgrade missing dependency grants. Pure. Single-level only -
 * see the BE twin's caveat. Consumed by the matrix when toggling a leaf with
 * declared `requires`.
 */
export function resolveImplicitDeps(
  grants: GrantedPath[],
  registry: PermissionModuleDef[],
): GrantedPath[] {
  const out: GrantedPath[] = [...grants];
  const have = (path: string): GrantedPath | undefined => out.find((g) => g.path === path);
  for (const g of grants) {
    for (const req of requiresForActionPath(registry, g.path)) {
      const { path: reqPath, scope: reqScope } = parseRequire(req);
      const existing = have(reqPath);
      const target: PermissionScope = reqScope ?? 'self';
      if (!existing) {
        out.push({ path: reqPath, scope: target });
      } else if (reqScope && SCOPE_RANK[existing.scope] < SCOPE_RANK[reqScope]) {
        const idx = out.indexOf(existing);
        out[idx] = { path: reqPath, scope: reqScope };
      }
    }
  }
  return out;
}
