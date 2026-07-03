'use client';

/**
 * DowntimeReasonsSettings - owner-only catalogue editor for downtime reason
 * codes (Plan 22-11 / D-02 / D-14 / MACH-P2-02a).
 *
 * Shows the 7 system codes (locked: key + category) plus any custom codes.
 * Owners can:
 *   - Rename labels (system + custom)
 *   - Toggle `isDisabled` (system + custom)
 *   - Reorder via up/down buttons (no react-dnd dep - see RESEARCH §17 A9)
 *   - Add new custom codes via AddReasonModal (key auto-generated server-side)
 *
 * R-3 mitigation (RESEARCH §17): NO Delete button anywhere - custom codes
 * may only be Disabled in v1 to keep historical entries intact (snapshot
 * fields on `DowntimeEntry` already preserve display labels).
 *
 * Save issues a single PATCH with the full catalogue payload.
 */

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input, Select, Switch, Table, message, Spin } from 'antd';
import { PlusOutlined, LockOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getDowntimeReasonCatalogue,
  updateDowntimeReasonCatalogue,
} from '@/lib/actions/machines.actions';
import { DsButton, DsCard, DsPageHeader, DsTag } from '@/components/ui';
import { AddReasonModal } from './AddReasonModal';
import type {
  DowntimeReasonCode,
  DowntimeReasonCodeUpdate,
  ReasonCategory,
  WorkspaceDowntimeReasonConfig,
} from '@/types';

interface DowntimeReasonsSettingsProps {
  wsId: string;
}

/**
 * Local row type - same shape as `DowntimeReasonCode` but `_id` is optional
 * so we can append newly-added (not yet persisted) custom rows. Backend
 * treats rows without `_id` as new on PATCH.
 */
type EditableCode = Omit<DowntimeReasonCode, '_id' | 'key'> & {
  _id?: string;
  key: string; // empty string for unsaved new rows
};

function rowKey(row: EditableCode): string {
  return row._id ?? `new::${row.key || row.label}::${row.sortOrder}`;
}

export function DowntimeReasonsSettings({ wsId }: DowntimeReasonsSettingsProps) {
  const t = useTranslations('machines-downtime');

  const [serverCatalogue, setServerCatalogue] = useState<WorkspaceDowntimeReasonConfig | null>(
    null,
  );
  const [localCodes, setLocalCodes] = useState<EditableCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  // Load catalogue on mount / wsId change
  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
    });
    getDowntimeReasonCatalogue(wsId)
      .then((cat) => {
        if (cancelled) return;
        setServerCatalogue(cat);
        setLocalCodes([...cat.codes].sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch((e) => {
        if (cancelled) return;
        msgApi.error((e as Error).message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, msgApi]);

  const dirty = useMemo(() => {
    if (!serverCatalogue) return false;
    const a = JSON.stringify(
      serverCatalogue.codes
        .slice()
        .sort((x, y) => x.sortOrder - y.sortOrder)
        .map((c) => ({
          _id: c._id,
          label: c.label,
          category: c.category,
          isDisabled: c.isDisabled,
          sortOrder: c.sortOrder,
        })),
    );
    const b = JSON.stringify(
      localCodes.map((c) => ({
        _id: c._id,
        label: c.label,
        category: c.category,
        isDisabled: c.isDisabled,
        sortOrder: c.sortOrder,
      })),
    );
    return a !== b;
  }, [serverCatalogue, localCodes]);

  // ---- mutators ----
  const updateRow = (key: string, patch: Partial<EditableCode>) => {
    setLocalCodes((prev) => prev.map((c) => (rowKey(c) === key ? { ...c, ...patch } : c)));
  };

  const moveRow = (key: string, direction: -1 | 1) => {
    setLocalCodes((prev) => {
      const idx = prev.findIndex((c) => rowKey(c) === key);
      if (idx < 0) return prev;
      const swap = idx + direction;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      const [a, b] = [next[idx], next[swap]];
      // swap their sortOrder values to keep persistence semantics intact
      const aOrder = a.sortOrder;
      const bOrder = b.sortOrder;
      next[idx] = { ...b, sortOrder: aOrder };
      next[swap] = { ...a, sortOrder: bOrder };
      // re-sort by sortOrder so the table reflects the new order
      next.sort((x, y) => x.sortOrder - y.sortOrder);
      return next;
    });
  };

  const handleAdd = ({ label, category }: { label: string; category: ReasonCategory }) => {
    setLocalCodes((prev) => {
      const nextOrder = (prev.length === 0 ? 0 : Math.max(...prev.map((c) => c.sortOrder))) + 10;
      const newRow: EditableCode = {
        key: '', // backend generates kebab key from label on save
        label,
        category,
        isSystem: false,
        isDisabled: false,
        sortOrder: nextOrder,
      };
      return [...prev, newRow];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: { codes: DowntimeReasonCodeUpdate[] } = {
        codes: localCodes.map((c) => ({
          _id: c._id,
          label: c.label,
          category: c.category,
          isDisabled: c.isDisabled,
          sortOrder: c.sortOrder,
        })),
      };
      const updated = await updateDowntimeReasonCatalogue(wsId, payload);
      setServerCatalogue(updated);
      setLocalCodes([...updated.codes].sort((a, b) => a.sortOrder - b.sortOrder));
      msgApi.success(t('settings.toast.saved'));
    } catch (e) {
      msgApi.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ---- columns ----
  const columns: ColumnsType<EditableCode> = [
    {
      title: t('settings.col.sort'),
      key: 'sort',
      width: 96,
      render: (_v, row, index) => (
        <div className="flex items-center gap-1">
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => moveRow(rowKey(row), -1)}
            aria-label="Move up"
          />
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            icon={<ArrowDownOutlined />}
            disabled={index === localCodes.length - 1}
            onClick={() => moveRow(rowKey(row), 1)}
            aria-label="Move down"
          />
        </div>
      ),
    },
    {
      title: t('settings.col.label'),
      key: 'label',
      render: (_v, row) => {
        const translatedSystemLabel =
          row.isSystem && row.key
            ? (() => {
                try {
                  const k = `reasons.seed.${row.key}` as never;
                  const tr = t(k);
                  return tr && tr !== `reasons.seed.${row.key}` ? tr : row.label;
                } catch {
                  return row.label;
                }
              })()
            : row.label;
        return (
          <div className="flex w-full items-center gap-2">
            {row.isSystem && (
              <LockOutlined
                style={{ fontSize: 12, color: 'var(--cr-text-3)' }}
                aria-label={t('settings.col.system')}
              />
            )}
            <Input
              value={row.label}
              maxLength={120}
              onChange={(e) => updateRow(rowKey(row), { label: e.target.value })}
              placeholder={translatedSystemLabel}
              size="middle"
              style={{ flex: 1 }}
            />
          </div>
        );
      },
    },
    {
      title: t('settings.col.key'),
      key: 'key',
      width: 200,
      render: (_v, row) =>
        row.key ? (
          <code className="text-xs text-secondary">{row.key}</code>
        ) : (
          <span className="text-xs text-muted italic">auto</span>
        ),
    },
    {
      title: t('settings.col.category'),
      key: 'category',
      width: 180,
      render: (_v, row) => {
        if (row.isSystem) {
          return (
            <DsTag color={row.category === 'mechanical' ? 'orange' : 'default'}>
              {t(`reasons.category.${row.category}` as never)}
            </DsTag>
          );
        }
        return (
          <Select
            value={row.category}
            onChange={(v: ReasonCategory) => updateRow(rowKey(row), { category: v })}
            options={[
              { value: 'mechanical', label: t('reasons.category.mechanical') },
              { value: 'operational', label: t('reasons.category.operational') },
            ]}
            style={{ width: '100%' }}
          />
        );
      },
    },
    {
      title: t('settings.col.disabled'),
      key: 'disabled',
      width: 110,
      render: (_v, row) => (
        <Switch
          checked={row.isDisabled}
          onChange={(v) => updateRow(rowKey(row), { isDisabled: v })}
        />
      ),
    },
    {
      title: t('settings.col.system'),
      key: 'system',
      width: 110,
      render: (_v, row) => (row.isSystem ? <DsTag>{t('settings.col.system')}</DsTag> : null),
    },
  ];

  return (
    <>
      {ctx}
      <DsPageHeader title={t('settings.title')} sub={t('settings.subhead')} />

      <DsCard>
        <div className="mb-4 flex items-center justify-between">
          <DsButton
            dsVariant="secondary"
            icon={<PlusOutlined />}
            onClick={() => setAddOpen(true)}
            disabled={loading}
          >
            {t('settings.addCta')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            loading={saving}
            disabled={!dirty || loading}
            onClick={save}
          >
            {t('settings.saveCta')}
          </DsButton>
        </div>

        <Spin spinning={loading}>
          <Table<EditableCode>
            dataSource={localCodes}
            pagination={false}
            rowKey={(r) => rowKey(r)}
            columns={columns}
            size="middle"
          />
        </Spin>

        <div className="mt-4 flex flex-col gap-1 text-xs text-secondary">
          <div>{t('settings.lockedHints.system')}</div>
          <div>{t('settings.lockedHints.key')}</div>
        </div>
      </DsCard>

      <AddReasonModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
    </>
  );
}

export default DowntimeReasonsSettings;
