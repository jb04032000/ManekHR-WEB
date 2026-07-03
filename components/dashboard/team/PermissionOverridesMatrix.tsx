'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button, Switch } from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { Role, TeamMemberPermissionOverride } from '@/types';
import type { PathOverride, GrantedPath, PermissionModuleDef } from '@/types/rbac-registry';
import type { CellDraft, GridDraft } from '@/lib/rbac/permission-grid-payload';
import { buildOverridesPayload } from '@/lib/rbac/permission-grid-payload';
import { normaliseGridDraft } from '@/lib/rbac/grid-normalise';
import PermissionGrid from '@/components/rbac/PermissionGrid';
import { PermissionPreview } from '@/components/rbac/PermissionPreview';

/**
 * Two modes:
 *
 *  - **Standalone** (default - `onSave` provided): the matrix holds its
 *    own draft state internally and ships a Save / Cancel / Reset row.
 *    Used by AppAccessSection ACTIVE / INVITED states.
 *
 *  - **Controlled** (`value` + `onChange` provided, `onSave` omitted):
 *    parent owns the draft. No Save row - the parent typically bundles
 *    the matrix into a larger form (e.g. NONE-state inline grant flow
 *    where overrides ride along with the invite submission).
 */
interface Props {
  role: Role;
  /** Path-classified registry (fetched in the parent, passed in to avoid double-fetching). */
  registry: PermissionModuleDef[];
  /** Current per-member flat overrides (non-Team modules). */
  overrides: TeamMemberPermissionOverride[];
  /** Current per-member path overrides (Team-module paths). */
  pathOverrides: PathOverride[];
  /** Standalone mode: parent handles save. */
  onSave?: (payload: {
    overrides: TeamMemberPermissionOverride[];
    pathOverrides: PathOverride[];
  }) => Promise<void>;
  /** Controlled-mode draft. Pass alongside `onChange`; omit `onSave`. */
  value?: GridDraft;
  /** Controlled-mode change handler. */
  onChange?: (next: GridDraft) => void;
  /** Controlled-mode disable flag (e.g. while parent submission inflight). */
  disabled?: boolean;
  /** When true, render without the outer card wrapper, title row, or
   *  per-card heading - the parent surface owns visual chrome. Used when
   *  the matrix is embedded inside a larger Configure Access form so the
   *  card-in-card visual nesting doesn't read as "two separate concerns". */
  embedded?: boolean;
}

/**
 * Convert flat + path override arrays into a `GridDraft` for use as the
 * internal draft seed or the controlled `value`.
 */
function arraysToDraft(flat: TeamMemberPermissionOverride[], path: PathOverride[]): GridDraft {
  const flatByCell: Record<string, CellDraft> = {};
  for (const o of flat) {
    flatByCell[`${o.module}.${o.action}`] = o.allowed
      ? { allowed: true, scope: o.scope }
      : { allowed: false };
  }
  const pathByCell: Record<string, CellDraft> = {};
  for (const o of path) {
    pathByCell[o.path] = o.allowed ? { allowed: true, scope: o.scope } : { allowed: false };
  }
  return { flatByCell, pathByCell };
}

/**
 * Per-member permission overrides matrix.
 *
 * Renders as registry-driven leaf-path rows (for Team module paths) alongside
 * legacy flat rows (for all other modules). Uses `<PermissionGrid>` as the
 * grid body; the matrix component owns the Save / Cancel / Reset shell and the
 * standalone / controlled dual-mode contract.
 *
 * Save fires the parent's `onSave` with the diffed override payload. The state
 * is local-only until Save - Cancel / Reset wipes pending edits.
 */
export default function PermissionOverridesMatrix({
  role,
  registry,
  overrides,
  pathOverrides,
  onSave,
  value,
  onChange,
  disabled,
  embedded,
}: Props) {
  const t = useTranslations();
  const controlled = value !== undefined;

  // Stable initial draft - used for the dirty-flag diff and Reset.
  // Captured once at mount via useState initializer; subsequent prop changes
  // do not update it (intentional - the matrix is an uncontrolled form for
  // the standalone case, and controlled mode uses `value` directly).
  const [initialDraft] = useState<GridDraft>(() => arraysToDraft(overrides, pathOverrides));

  const [internalDraft, setInternalDraft] = useState<GridDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  const draft: GridDraft = controlled ? (value as GridDraft) : internalDraft;

  const handleDraftChange = useCallback(
    (next: GridDraft) => {
      if (controlled) {
        onChange?.(next);
      } else {
        setInternalDraft(next);
      }
    },
    [controlled, onChange],
  );

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialDraft),
    [draft, initialDraft],
  );

  function handleReset() {
    if (controlled) {
      onChange?.(initialDraft);
    } else {
      setInternalDraft(initialDraft);
    }
  }

  function handleCancel() {
    const seed = arraysToDraft(overrides, pathOverrides);
    if (controlled) {
      onChange?.(seed);
    } else {
      setInternalDraft(seed);
    }
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      // Final coherence guard - normalise before building the payload so the
      // persisted overrides always satisfy the BE invariants (edit-implies-
      // view, dep-resolution) no matter how the draft reached this state
      // (save-without-toggle, a seed predating the invariant, etc). Idempotent:
      // an already-coherent draft passes through unchanged. Without this, the
      // BE rejects with "team.profile.X.edit requires team.profile.X.view".
      const { draft: coherent } = normaliseGridDraft(
        draft,
        registry,
        (role.permissionPaths ?? []) as GrantedPath[],
      );
      const { overrides: nextFlat, pathOverrides: nextPath } = buildOverridesPayload({
        draft: coherent,
      });
      await onSave({
        // FlatOverride and TeamMemberPermissionOverride are structurally identical.
        overrides: nextFlat as TeamMemberPermissionOverride[],
        pathOverrides: nextPath,
      });
    } finally {
      setSaving(false);
    }
  }

  const roleContext = useMemo(
    () => ({
      roleFlat: role.permissions ?? [],
      rolePaths: (role.permissionPaths ?? []) as GrantedPath[],
    }),
    [role],
  );

  const headerRow = (
    <div
      className={
        embedded
          ? 'mb-2 flex flex-wrap items-center justify-between gap-2'
          : 'mb-3 flex flex-wrap items-center justify-between gap-2'
      }
    >
      {!embedded && (
        <div>
          <h3 className="m-0 font-display text-[16px] font-bold text-gray-900">
            {t('team.accessOverridesTitle')}
          </h3>
          <p className="m-0 text-sm text-gray-600">
            {t('team.accessOverridesSubtitle', { role: role.name })}
          </p>
        </div>
      )}
      {embedded && (
        <p className="m-0 text-[12px] text-muted">
          {Object.keys(draft.flatByCell).length === 0 && Object.keys(draft.pathByCell).length === 0
            ? t('team.accessOverridesEmbeddedUsingDefaults', { role: role.name })
            : t('team.accessOverridesEmbeddedCustomized', {
                role: role.name,
                count: Object.keys(draft.flatByCell).length + Object.keys(draft.pathByCell).length,
              })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {/* Show sensitive toggle */}
        <div className="flex items-center gap-1.5">
          <Switch
            size="small"
            checked={showSensitive}
            onChange={setShowSensitive}
            disabled={disabled || saving}
          />
          <span className="text-[12px] text-muted">{t('team.accessOverridesShowSensitive')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size={embedded ? 'small' : 'middle'}
            icon={<ReloadOutlined />}
            onClick={handleReset}
            disabled={(controlled ? disabled : saving) || !dirty}
          >
            {t('team.accessOverridesReset')}
          </Button>
          {/* Save / Cancel only render in standalone mode. Controlled mode
              defers persistence to the parent form (e.g. NONE-state grant
              flow bundles overrides + invite into one submit). */}
          {!controlled && dirty && (
            <Button onClick={handleCancel} disabled={saving}>
              {t('common.cancel')}
            </Button>
          )}
          {!controlled && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!dirty}
              loading={saving}
              onClick={() => void handleSave()}
            >
              {t('team.accessOverridesSave')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const gridBlock = (
    <>
      {/* Preset selector intentionally absent here - overrides are surgical
       *  adjustments on top of an already-assigned role; applying a wholesale
       *  preset would clobber that intent + duplicate the role-pick step in
       *  the add-member wizard. Presets live on the role-editor drawer
       *  (`/dashboard/roles`) where you BUILD a role from a template. */}
      <PermissionGrid
        registry={registry}
        mode="override"
        roleContext={roleContext}
        value={draft}
        onChange={handleDraftChange}
        disabled={disabled || (!controlled && saving)}
        showSensitive={showSensitive}
      />
      <PermissionPreview
        registry={registry}
        value={draft}
        mode="override"
        roleContext={{ rolePaths: roleContext.rolePaths }}
      />
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col gap-1">
        {headerRow}
        {gridBlock}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {headerRow}
      {/* Post-grant standalone usage - surface the immediate-effect
          guarantee so owner knows changes don't wait for a re-invite. */}
      {!controlled && (
        <p className="-mt-1 mb-3 text-[12px] text-muted">
          {t('team.accessOverridesImmediateHint')}
        </p>
      )}
      {gridBlock}
    </div>
  );
}
