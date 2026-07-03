'use client';
import { Select } from 'antd';
import { useEffect, useState, startTransition } from 'react';
import type { Godown } from '@/types';
import { listGodowns } from '@/lib/actions/inventory.actions';

interface Props {
  firmId: string;
  workspaceId: string;
  value?: string;
  onChange: (godownId: string) => void;
  disabled?: boolean;
  defaultToFirmDefault?: boolean; // pre-select firm's default godown
  placeholder?: string;
}

export function GodownSelector({
  firmId,
  workspaceId,
  value,
  onChange,
  disabled,
  defaultToFirmDefault = true,
  placeholder = 'Select godown',
}: Props) {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setLoading(true);
    });
    listGodowns(workspaceId, firmId)
      .then(setGodowns)
      .finally(() => setLoading(false));
  }, [workspaceId, firmId]);

  useEffect(() => {
    if (defaultToFirmDefault && !value && godowns.length > 0) {
      const def = godowns.find((g) => g.isDefault) ?? godowns[0];
      if (def) onChange(def._id);
    }
  }, [godowns, value, defaultToFirmDefault, onChange]);

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      loading={loading}
      placeholder={placeholder}
      style={{ width: '100%' }}
      options={godowns.map((g) => ({ value: g._id, label: `${g.name} (${g.code})` }))}
    />
  );
}
