'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Tag } from 'antd';
import type {
  GrantedPath,
  PermissionModuleDef,
  PermissionNode,
  PermissionScope,
} from '@/types/rbac-registry';
import type { GridDraft } from '@/lib/rbac/permission-grid-payload';

interface Props {
  registry: PermissionModuleDef[];
  value: GridDraft;
  mode: 'role' | 'override';
  roleContext?: { rolePaths: ReadonlyArray<GrantedPath> };
}

/**
 * Live readout of what the draft permission set grants the holder.
 * Renders chips for each capability (green) plus SoD restrict chips
 * (amber). Recomputes on every cell change.
 */
export function PermissionPreview({ registry, value, mode, roleContext }: Props) {
  const t = useTranslations();
  const chips = useMemo(
    () => computeChips(registry, value, mode, roleContext?.rolePaths ?? []),
    [registry, value, mode, roleContext],
  );

  if (chips.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-xs text-neutral-500">{t('rbac.preview.empty')}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-charcoal mb-2 text-xs font-semibold">{t('rbac.preview.title')}</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Tag key={c.key} color={c.kind === 'allow' ? 'green' : 'orange'}>
            {t(c.labelKey as Parameters<typeof t>[0])}
          </Tag>
        ))}
      </div>
    </div>
  );
}

interface ChipDescriptor {
  key: string;
  kind: 'allow' | 'restrict';
  labelKey: string;
}

function computeChips(
  registry: PermissionModuleDef[],
  value: GridDraft,
  mode: 'role' | 'override',
  rolePaths: ReadonlyArray<GrantedPath>,
): ChipDescriptor[] {
  // Step 1 - compute effective grants.
  const effective = effectiveGrants(value, mode, rolePaths);

  // Deduplicate restrict chips - one per SoD-leaf-path, not per scope.
  const seenRestricts = new Set<string>();

  // Step 2 - translate each grant to a chip.
  //
  // 2026-05-22: the preview i18n key carries a `.<scope>` suffix ONLY for
  // SCOPED actions (e.g. rbac.preview.team.directory.view.self). Non-scoped
  // actions like `team.member.create` / `team.member.delete` have a bare key
  // (rbac.preview.team.member.create) because self/all is meaningless for
  // them. The previous code always appended `.${scope}`, producing
  // `...member.create.self` which does not exist -> MISSING_MESSAGE crash in
  // the override matrix the moment a non-scoped grant was effective. We now
  // consult the registry action's `scoped` flag to build the right key.
  // A grant whose registry node/action cannot be resolved is SKIPPED (no chip).
  // This happens while the registry is still loading (`useRbacRegistry` returns
  // [] until the fetch resolves) or for an unknown path. Skipping avoids
  // building a non-existent key like `rbac.preview.team.member.create.self`
  // (create is non-scoped) which throws MISSING_MESSAGE - the scoped vs bare
  // key MUST come from the registry, never a guessed default.
  const allowChips: ChipDescriptor[] = [];
  for (const g of effective) {
    if (!hasPreviewKey(g.path)) continue;
    const segs = g.path.split('.');
    const node = findRegistryNode(registry, segs.slice(0, -1).join('.'));
    const def = node?.actions?.find((a) => a.action === segs[segs.length - 1]);
    if (!def) continue; // registry not loaded yet, or unknown action
    const seg = pathToKeySegment(g.path);
    const labelKey = def.scoped ? `rbac.preview.${seg}.${g.scope}` : `rbac.preview.${seg}`;
    allowChips.push({ key: `${g.path}@${g.scope}`, kind: 'allow', labelKey });
  }

  // Step 3 - for sodOwnerOnlyOnSelf leaves with edit grant at any scope,
  // add a restrict chip (one per unique leaf).
  const restrictChips: ChipDescriptor[] = [];
  for (const g of effective) {
    if (!g.path.endsWith('.edit')) continue;
    const leafPath = g.path.slice(0, -'.edit'.length);
    const node = findRegistryNode(registry, leafPath);
    if (node?.sodOwnerOnlyOnSelf && !seenRestricts.has(leafPath)) {
      seenRestricts.add(leafPath);
      restrictChips.push({
        key: `restrict:${leafPath}`,
        kind: 'restrict',
        labelKey: `rbac.previewRestrict.${pathToKeySegment(leafPath)}`,
      });
    }
  }

  return [...allowChips, ...restrictChips];
}

/**
 * Convert a dot-separated leaf path into a dot-separated i18n key segment.
 * e.g. 'team.profile.bank.edit' → 'team.profile.bank.edit'
 * (identity for now - the registry path IS the key segment).
 */
function pathToKeySegment(path: string): string {
  return path;
}

/**
 * Modules whose leaves carry `rbac.preview.<path>[.<scope>]` chip keys (added
 * across all four locales). Keep this in lock-step with the registry coverage:
 * every module listed here MUST have a full preview-key set in
 * app/messages/*.json, or a granted leaf would build a non-existent key and
 * throw MISSING_MESSAGE. The double safety net in computeChips (`if (!def)
 * continue`) only skips grants the registry can't resolve, NOT grants whose
 * preview key is missing — so this allow-list is the real gate.
 *
 * (RBAC-hardening Pillar 3) extended from team-only to every currently-
 * registered module: attendance, leave, regularization, holidays, shifts,
 * finance. As further modules join the registry, add them here AND ship their
 * preview keys in the same change.
 */
const PREVIEW_KEYED_MODULES = [
  'team',
  'attendance',
  'leave',
  'regularization',
  'holidays',
  'shifts',
  'finance',
] as const;

/**
 * Determines whether the given path's module has known preview translation
 * keys. A path in a module NOT on the allow-list falls through gracefully - it
 * has no chip defined yet, so we skip it rather than emitting a missing-key tag.
 */
function hasPreviewKey(path: string): boolean {
  const modKey = path.split('.', 1)[0];
  return (PREVIEW_KEYED_MODULES as ReadonlyArray<string>).includes(modKey);
}

function effectiveGrants(
  value: GridDraft,
  mode: 'role' | 'override',
  rolePaths: ReadonlyArray<GrantedPath>,
): GrantedPath[] {
  if (mode === 'role') {
    return Object.entries(value.pathByCell)
      .filter(([, c]) => c.allowed)
      .map(([path, c]) => ({
        path,
        scope: (c.allowed ? (c.scope ?? 'self') : 'self') as PermissionScope,
      }));
  }
  // override mode - apply allow / deny overrides on top of rolePaths.
  const map = new Map(rolePaths.map((g) => [g.path, g.scope]));
  for (const [path, cell] of Object.entries(value.pathByCell)) {
    if (cell.allowed) {
      map.set(path, (cell.scope ?? 'self') as PermissionScope);
    } else {
      map.delete(path);
    }
  }
  return Array.from(map, ([path, scope]) => ({ path, scope }));
}

function findRegistryNode(
  registry: PermissionModuleDef[],
  nodePath: string,
): PermissionNode | undefined {
  const [modKey, ...rest] = nodePath.split('.');
  const mod = registry.find((m) => m.module === modKey);
  if (!mod || rest.length === 0) return undefined;
  let cur: PermissionNode | undefined = mod.features.find((f) => f.key === rest[0]);
  for (const seg of rest.slice(1)) {
    cur = cur?.children?.find((c) => c.key === seg);
  }
  return cur;
}
