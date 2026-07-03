'use client';
import { useMemo } from 'react';
import { Checkbox, Typography } from 'antd';
import type { ExportField } from '@/lib/exportFields/types';

interface FieldSelectorProps<T = Record<string, unknown>> {
  fields: ExportField<T>[];
  value: string[];
  onChange: (keys: string[]) => void;
}

export function FieldSelector<T>({
  fields,
  value,
  onChange,
}: FieldSelectorProps<T>) {
  const handleChange = (checkedValues: (string | number | boolean)[]) => {
    onChange(checkedValues as string[]);
  };

  return (
    <div>
      <Checkbox.Group value={value} onChange={handleChange} className="w-full">
        {/* 2-column grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
          {fields.map((field) => (
            <Checkbox key={field.key} value={field.key}>
              <span className="text-sm text-gray-700">{field.label}</span>
            </Checkbox>
          ))}
        </div>
      </Checkbox.Group>

      {/* Validation warning when user unchecks everything */}
      {value.length === 0 && (
        <Typography.Text type="warning" className="text-xs mt-3 block">
          Select at least one field to export.
        </Typography.Text>
      )}
    </div>
  );
}