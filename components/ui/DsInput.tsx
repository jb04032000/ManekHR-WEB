/**
 * DsInput / DsPassword / DsTextarea / DsSelect
 * Design system form inputs.
 */
'use client';
import { Input, Select } from 'antd';
import type { InputProps, InputRef } from 'antd';
import type { TextAreaProps } from 'antd/es/input/TextArea';
import type { SelectProps } from 'antd';
import { CSSProperties, forwardRef } from 'react';

const BASE_STYLE: CSSProperties = {
  fontSize: 14,        // override Ant Design large-size default of 16px
  color: 'var(--cr-text)',
};

// ── Text input ──────────────────────────────────────────────
export const DsInput = forwardRef<InputRef, InputProps>(
  ({ style, size = 'large', ...rest }, ref) => (
    <Input
      ref={ref}
      size={size}
      style={{ ...BASE_STYLE, ...style }}
      {...rest}
    />
  )
);
DsInput.displayName = 'DsInput';

// ── Password input ──────────────────────────────────────────
export function DsPassword({ style, size = 'large', ...rest }: InputProps) {
  return (
    <Input.Password
      size={size}
      style={{ ...BASE_STYLE, ...style }}
      {...rest}
    />
  );
}

// ── Textarea ────────────────────────────────────────────────
export function DsTextarea({ style, ...rest }: TextAreaProps) {
  return (
    <Input.TextArea
      style={{ ...BASE_STYLE, resize: 'vertical', ...style } as CSSProperties}
      {...rest}
    />
  );
}

// ── Select ──────────────────────────────────────────────────
export function DsSelect({ style, size = 'large', ...rest }: SelectProps) {
  return (
    <Select
      size={size}
      style={{ width: '100%', ...style }}
      {...rest}
    />
  );
}

export const { Option: DsOption } = Select;
