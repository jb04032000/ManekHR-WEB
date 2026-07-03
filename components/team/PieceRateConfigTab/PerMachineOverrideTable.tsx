'use client';
import { Button, Select, Table } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { PerMachineRateOverride } from '@/types';
import { RateInput } from './RateInput';

type Machine = { _id: string; machineCode: string };

export function PerMachineOverrideTable({
  rows,
  onChange,
  machines,
  max = 50,
  disabled,
}: {
  rows: PerMachineRateOverride[];
  onChange: (next: PerMachineRateOverride[]) => void;
  machines: Machine[];
  max?: number;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const usedIds = new Set(rows.map((r) => r.machineId));
  const availableMachines = machines.filter((m) => !usedIds.has(m._id));

  const updateRow = (idx: number, patch: Partial<PerMachineRateOverride>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) =>
    onChange(rows.filter((_, i) => i !== idx));
  const addRow = () => {
    if (rows.length >= max) return;
    onChange([...rows, { machineId: '', rate: 0 }]);
  };

  return (
    <div>
      <Table
        dataSource={rows.map((r, i) => ({ ...r, key: i }))}
        pagination={false}
        size="small"
        locale={{
          emptyText: t('salary.piece_rate.config.perMachineOverrides.empty'),
        }}
        columns={[
          {
            title: t('salary.piece_rate.config.perMachineOverrides.machine'),
            dataIndex: 'machineId',
            render: (_: unknown, row: PerMachineRateOverride, idx: number) => (
              <Select
                value={row.machineId || undefined}
                onChange={(v) => updateRow(idx, { machineId: v })}
                disabled={disabled}
                style={{ width: '100%' }}
                options={[
                  ...(row.machineId
                    ? machines
                        .filter((m) => m._id === row.machineId)
                        .map((m) => ({
                          value: m._id,
                          label: m.machineCode,
                        }))
                    : []),
                  ...availableMachines.map((m) => ({
                    value: m._id,
                    label: m.machineCode,
                  })),
                ]}
              />
            ),
          },
          {
            title: t('salary.piece_rate.config.perMachineOverrides.rate'),
            dataIndex: 'rate',
            render: (_: unknown, row: PerMachineRateOverride, idx: number) => (
              <RateInput
                value={row.rate}
                onChange={(v) => updateRow(idx, { rate: v ?? 0 })}
                disabled={disabled}
              />
            ),
          },
          {
            title: <span className="sr-only">Delete</span>,
            width: 60,
            render: (_: unknown, __: PerMachineRateOverride, idx: number) => (
              <Button
                type="text"
                icon={<DeleteOutlined />}
                onClick={() => removeRow(idx)}
                disabled={disabled}
              />
            ),
          },
        ]}
      />
      <Button
        icon={<PlusOutlined />}
        onClick={addRow}
        disabled={disabled || rows.length >= max}
        style={{ marginTop: 8 }}
      >
        {t('salary.piece_rate.config.perMachineOverrides.add')}
      </Button>
      {rows.length >= max && (
        <div style={{ color: 'var(--cr-warning-500)', marginTop: 4 }}>
          {t('salary.piece_rate.config.perMachineOverrides.maxReached')}
        </div>
      )}
    </div>
  );
}
