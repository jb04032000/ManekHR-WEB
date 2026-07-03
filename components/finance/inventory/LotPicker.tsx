'use client';
import { Select } from 'antd';
import { useEffect, useState, startTransition } from 'react';
import type { Lot } from '@/types';
import { listLots } from '@/lib/actions/inventory.actions';
import { ExpiryBadge } from './ExpiryBadge';

interface Props {
  workspaceId: string;
  firmId: string;
  itemId: string;
  godownId?: string;
  value?: string;
  onChange: (lotId: string) => void;
  disabled?: boolean;
  required?: boolean;
}

export function LotPicker({
  workspaceId,
  firmId,
  itemId,
  godownId,
  value,
  onChange,
  disabled,
  required,
}: Props) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    startTransition(() => {
      setLoading(true);
    });
    listLots(workspaceId, firmId, { itemId, godownId })
      .then((all) =>
        setLots(all.filter((l) => l.qtyRemaining > 0 && (!godownId || l.godownId === godownId))),
      )
      .finally(() => setLoading(false));
  }, [workspaceId, firmId, itemId, godownId]);

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled || !itemId}
      loading={loading}
      placeholder={required ? 'Select lot (required)' : 'Select lot'}
      status={required && !value ? 'warning' : undefined}
      style={{ width: '100%' }}
      optionLabelProp="label"
    >
      {lots.map((l) => (
        <Select.Option key={l._id} value={l._id} label={`${l.lotNo} - ${l.qtyRemaining} remaining`}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>
              {l.lotNo} - {l.qtyRemaining} remaining
            </span>
            <ExpiryBadge expiryDate={l.expiryDate} />
          </div>
        </Select.Option>
      ))}
    </Select>
  );
}
