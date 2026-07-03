'use client';

/**
 * PartsTable - controlled list of ServicePartPayload rows for ServiceLogDrawer.
 *
 * - Per-row toggle: "Item link" vs "Free text" (D-02 ServicePart contract).
 * - Item-link mode stores `itemId` (entered as plain ID for v1 - the inventory
 *   Item search requires firmId context which the maintenance flow does not
 *   carry; future enhancement can wire a firm-aware async select).
 * - Free-text mode stores `freeTextName` (≤120 chars per D-02).
 * - Cap at 30 rows per D-02 + DoS guard.
 * - Cost shown in INR (×100 → paise on submit by parent).
 */

import { Input, InputNumber, Switch, Button, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

import { DsButton } from '@/components/ui';
import type { ServicePartPayload } from '@/types';

interface PartsTableProps {
  value: ServicePartPayload[];
  onChange: (next: ServicePartPayload[]) => void;
  wsId: string;
  max?: number;
}

const DEFAULT_MAX = 30;
const FREE_TEXT_MAX = 120;
const NOTES_MAX = 200;

export function PartsTable({
  value,
  onChange,
  // wsId currently unused - kept in contract for future inventory item search.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  wsId,
  max = DEFAULT_MAX,
}: PartsTableProps) {
  const t = useTranslations('machines-maintenance');

  const setRow = (idx: number, patch: Partial<ServicePartPayload>) => {
    const copy = [...value];
    copy[idx] = { ...copy[idx], ...patch };
    onChange(copy);
  };

  const removeRow = (idx: number) => {
    const copy = [...value];
    copy.splice(idx, 1);
    onChange(copy);
  };

  const addRow = () => {
    if (value.length >= max) return;
    onChange([
      ...value,
      {
        // Default to free-text mode - matches the 80% case (workshop entry).
        freeTextName: '',
        quantity: 1,
      },
    ]);
  };

  const toggleMode = (idx: number, useItemLink: boolean) => {
    // Switching modes clears the other path so backend validator
    // (SERVICE_PART_REQUIRES_ITEM_OR_TEXT) is happy.
    if (useItemLink) {
      setRow(idx, { itemId: '', freeTextName: undefined });
    } else {
      setRow(idx, { freeTextName: '', itemId: undefined });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.length === 0 && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--cr-text-3, var(--cr-text-5))',
            padding: '8px 0',
          }}
        >
          {t('serviceLog.partsReplaced')}
        </div>
      )}
      {value.map((row, idx) => {
        const isItemLink = row.itemId !== undefined;
        return (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 90px 110px 1fr 32px',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title={isItemLink ? t('serviceLog.partItem') : t('serviceLog.partFreeText')}
            >
              <Switch
                size="small"
                checked={isItemLink}
                onChange={(checked) => toggleMode(idx, checked)}
              />
              <span style={{ fontSize: 11 }}>
                {isItemLink ? t('serviceLog.partItem') : t('serviceLog.partFreeText')}
              </span>
            </div>
            {isItemLink ? (
              <Input
                value={row.itemId ?? ''}
                placeholder={t('serviceLog.partItem')}
                onChange={(e) => setRow(idx, { itemId: e.target.value })}
              />
            ) : (
              <Input
                value={row.freeTextName ?? ''}
                maxLength={FREE_TEXT_MAX}
                placeholder={t('serviceLog.partFreeText')}
                onChange={(e) => setRow(idx, { freeTextName: e.target.value })}
              />
            )}
            <InputNumber
              min={0}
              value={row.quantity}
              onChange={(v) => setRow(idx, { quantity: Number(v ?? 0) })}
              placeholder={t('serviceLog.partQuantity')}
              style={{ width: '100%' }}
            />
            <InputNumber
              min={0}
              step={0.01}
              value={row.unitCostPaise === undefined ? undefined : row.unitCostPaise / 100}
              onChange={(v) =>
                setRow(idx, {
                  unitCostPaise:
                    v === null || v === undefined ? undefined : Math.round(Number(v) * 100),
                })
              }
              placeholder={t('serviceLog.partUnitCost')}
              style={{ width: '100%' }}
            />
            <Input
              value={row.notes ?? ''}
              maxLength={NOTES_MAX}
              placeholder={t('serviceLog.notes')}
              onChange={(e) => setRow(idx, { notes: e.target.value })}
            />
            <Tooltip title="Remove part">
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeRow(idx)}
                style={{ color: 'var(--cr-error)' }}
                aria-label="Remove part"
              />
            </Tooltip>
          </div>
        );
      })}
      <div>
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          icon={<PlusOutlined />}
          disabled={value.length >= max}
          onClick={addRow}
        >
          {t('serviceLog.partsReplaced')}
          {value.length >= max ? ` (${max})` : ''}
        </DsButton>
      </div>
    </div>
  );
}

export default PartsTable;
