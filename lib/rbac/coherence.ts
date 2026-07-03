import type { GrantedPath, PermissionScope } from '@/types/rbac-registry';

const SCOPE_RANK: Record<PermissionScope, number> = { self: 0, all: 1 };
const LEAF_RE = /^(.+)\.(view|edit)$/;

interface LeafSlot {
  view?: PermissionScope;
  edit?: PermissionScope;
}

function bucket(grants: GrantedPath[]): Map<string, LeafSlot> {
  const m = new Map<string, LeafSlot>();
  for (const g of grants) {
    const x = LEAF_RE.exec(g.path);
    if (!x) continue;
    const [, stem, action] = x;
    const slot = m.get(stem) ?? {};
    slot[action as 'view' | 'edit'] = g.scope;
    m.set(stem, slot);
  }
  return m;
}

/**
 * Twin of the backend `assertViewEditCoherent` (see
 * `crewroster-backend/src/modules/rbac/coherence.ts`). Throws a plain `Error`
 * - UI consumers catch and toast. Industry rule (Rippling / Bamboo): edit
 * logically requires view.
 */
export function assertViewEditCoherent(grants: GrantedPath[]): void {
  for (const [stem, { view, edit }] of bucket(grants)) {
    if (!edit) continue;
    if (!view) {
      throw new Error(`${stem}.edit requires ${stem}.view (industry edit-implies-view).`);
    }
    if (SCOPE_RANK[view] < SCOPE_RANK[edit]) {
      throw new Error(
        `${stem}.edit@${edit} requires ${stem}.view@${edit} or higher (got @${view}).`,
      );
    }
  }
}

/**
 * Auto-promote `view` to match every `edit` grant's scope. Pure. Consumed by
 * `<PermissionGrid>` cell-toggle handler + role-preset application.
 */
export function normaliseViewEditCoherent(grants: GrantedPath[]): GrantedPath[] {
  const buckets = bucket(grants);
  const out: GrantedPath[] = [...grants];
  for (const [stem, { view, edit }] of buckets) {
    if (!edit) continue;
    if (!view) {
      out.push({ path: `${stem}.view`, scope: edit });
    } else if (SCOPE_RANK[view] < SCOPE_RANK[edit]) {
      const idx = out.findIndex((g) => g.path === `${stem}.view`);
      out[idx] = { path: `${stem}.view`, scope: edit };
    }
  }
  return out;
}
