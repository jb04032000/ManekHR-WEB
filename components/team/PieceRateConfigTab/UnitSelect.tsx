'use client';
import { Select } from 'antd';
import { useTranslations } from 'next-intl';
import type { PieceRateUnit } from '@/types';

const PIECE_RATE_UNITS: PieceRateUnit[] = [
  'per_piece',
  'per_thousand_stitches',
  'per_design_completed',
  'blended',
];

export function UnitSelect({
  value,
  onChange,
  disabled,
}: {
  value?: PieceRateUnit;
  onChange: (v: PieceRateUnit) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{ width: '100%' }}
      options={PIECE_RATE_UNITS.map((u) => ({
        value: u,
        label: t(`salary.piece_rate.unit.${u}`),
      }))}
    />
  );
}
