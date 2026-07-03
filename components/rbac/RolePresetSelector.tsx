'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Select, Button, Tag, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useRolePresets } from '@/hooks/useRolePresets';
import { normaliseGridDraft } from '@/lib/rbac/grid-normalise';
import type { GridDraft, CellDraft } from '@/lib/rbac/permission-grid-payload';
import type { PermissionModuleDef } from '@/types/rbac-registry';

interface Props {
  registry: PermissionModuleDef[];
  value: GridDraft;
  onChange: (next: GridDraft) => void;
  disabled?: boolean;
}

/**
 * One-click fill of `<PermissionGrid>` from a server-defined preset
 * (`GET /workspaces/:id/rbac/presets`). The grid draft is normalised through
 * coherence + dep-resolution after applying a preset so the result is always
 * coherent.
 *
 * Once the user mutates any cell after applying a preset, a "(Modified)" badge
 * appears next to the active preset name. "Reset to preset" restores the
 * snapshot taken at apply-time.
 *
 * Phase 1d T12 - companion to `<PermissionGrid>` mount sites:
 * - `PermissionOverridesMatrix` (member-level overrides)
 * - `app/dashboard/roles/page.tsx` (role-editor drawer)
 */
export function RolePresetSelector({ registry, value, onChange, disabled }: Props) {
  const t = useTranslations();
  const { presets, loading } = useRolePresets();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // JSON snapshot of the pathByCell at the moment the preset was applied -
  // used to detect user drift without deep-equality on the full GridDraft.
  const [snapshotJson, setSnapshotJson] = useState<string | null>(null);

  // Detect drift: compare current sorted pathByCell against the apply-time snapshot.
  const modified = useMemo(() => {
    if (!activeKey || !snapshotJson) return false;
    return JSON.stringify(sortedPathByCell(value)) !== snapshotJson;
  }, [value, activeKey, snapshotJson]);

  /**
   * Apply the named preset:
   * 1. Map preset.paths → pathByCell CellDraft entries.
   * 2. Normalise (coherence + deps).
   * 3. Emit via onChange.
   * 4. Capture snapshot for drift detection.
   */
  const applyPreset = (key: string) => {
    const preset = presets.find((p) => p.key === key);
    if (!preset) return;

    const pathByCell: Record<string, CellDraft> = {};
    for (const g of preset.paths) {
      pathByCell[g.path] = { allowed: true, scope: g.scope };
    }
    const candidate: GridDraft = { ...value, pathByCell };
    const { draft } = normaliseGridDraft(candidate, registry);
    onChange(draft);
    setActiveKey(key);
    setSnapshotJson(JSON.stringify(sortedPathByCell(draft)));
  };

  return (
    <Space size="small" className="mb-3 flex-wrap">
      <Select
        placeholder={t('rbac.preset.placeholder')}
        loading={loading}
        disabled={disabled || loading}
        style={{ minWidth: 220 }}
        value={activeKey}
        onChange={applyPreset}
        options={presets.map((p) => ({
          value: p.key,
          label: t(p.labelKey as never),
          title: t(p.descriptionKey as never),
        }))}
      />
      {activeKey && modified ? <Tag color="orange">{t('rbac.preset.modified')}</Tag> : null}
      {activeKey && modified ? (
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => applyPreset(activeKey)}
          disabled={disabled}
        >
          {t('rbac.preset.reset')}
        </Button>
      ) : null}
    </Space>
  );
}

/**
 * Stable sort of pathByCell entries for snapshot comparison.
 * Ensures insert-order variance doesn't produce false "modified" positives.
 */
function sortedPathByCell(draft: GridDraft): Array<[string, CellDraft]> {
  return Object.entries(draft.pathByCell).sort(([a], [b]) => a.localeCompare(b));
}
