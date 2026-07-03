'use client';
import { Form } from 'antd';
import type { FormItemProps } from 'antd';
import { CSSProperties, ReactNode } from 'react';

export { useForm } from 'antd/es/form/Form';

export const DsForm = Form;

export function DsFormItem({ style, ...rest }: FormItemProps) {
  return <Form.Item style={{ marginBottom: 16, ...style }} {...rest} />;
}

export function DsFormSection({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ marginBottom: 8, ...style }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--cr-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid var(--cr-border-light)' }}>{title}</p>
      {children}
    </div>
  );
}

export default DsForm;
