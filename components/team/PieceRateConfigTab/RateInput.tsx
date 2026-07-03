'use client';
import { InputNumber } from 'antd';

export function RateInput({
  value,
  onChange,
  min = 0,
  step = 0.5,
  disabled,
}: {
  value?: number;
  onChange: (v: number | null) => void;
  min?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <InputNumber
      value={value}
      onChange={onChange}
      min={min}
      step={step}
      precision={2}
      disabled={disabled}
      style={{ width: '100%' }}
    />
  );
}
