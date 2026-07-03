'use client';

import { Form, InputNumber, Select, Button, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

export type EntitlementsFormMode = 'input' | 'select';

export interface EntitlementsFormFieldsProps {
  mode?: EntitlementsFormMode;
  namePrefix?: string | string[];
  min?: number;
  showUnlimitedButton?: boolean;
  disabled?: boolean;
}

const SELECT_OPTIONS = {
  maxWorkspaces: [
    { value: 1, label: '1' },
    { value: 3, label: '3' },
    { value: 10, label: '10' },
    { value: -1, label: 'Unlimited' },
  ],
  maxMembersPerWorkspace: [
    { value: 5, label: '5' },
    { value: 20, label: '20' },
    { value: 100, label: '100' },
    { value: -1, label: 'Unlimited' },
  ],
  maxTotalMembers: [
    { value: 5, label: '5' },
    { value: 50, label: '50' },
    { value: 500, label: '500' },
    { value: -1, label: 'Unlimited' },
  ],
};

function getFieldName(prefix: string | string[] | undefined, field: string): string | string[] {
  if (!prefix) return field;
  if (Array.isArray(prefix)) return [...prefix, field];
  return [prefix, field];
}

export function EntitlementsFormFields({
  mode = 'input',
  namePrefix,
  min = -1,
  showUnlimitedButton = false,
  disabled = false,
}: EntitlementsFormFieldsProps) {
  const form = Form.useFormInstance();

  // Set a single (possibly nested) cap to -1 = unlimited. Uses setFieldValue,
  // which accepts a NamePath array, so nested fields like
  // ['entitlements','maxWorkspaces'] set just that leaf -- the old
  // setFieldsValue({ [fieldName[0]]: -1 }) clobbered the whole nested
  // `entitlements` object to -1 when namePrefix was set (admin Plans page).
  const handleSetUnlimited = (fieldName: string | string[]) => {
    form?.setFieldValue(fieldName, -1);
  };

  const renderInput = (field: string, label: string, fieldNames: string | string[]) => (
    <Form.Item name={fieldNames} label={label} rules={[{ required: true }]}>
      <InputNumber
        className="w-full"
        min={min}
        placeholder={min === -1 ? '-1 = unlimited' : `Min: ${min}`}
        disabled={disabled}
      />
    </Form.Item>
  );

  const renderSelect = (field: string, label: string, fieldNames: string | string[]) => (
    <Form.Item name={fieldNames} label={label} rules={[{ required: true }]}>
      <Select disabled={disabled}>
        {SELECT_OPTIONS[field as keyof typeof SELECT_OPTIONS]?.map((opt) => (
          <Select.Option key={opt.value} value={opt.value}>
            {opt.label}
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  );

  const renderField = (field: string, label: string) => {
    const fieldNames = getFieldName(namePrefix, field);
    const fieldKey = Array.isArray(fieldNames) ? fieldNames.join('.') : fieldNames;

    return (
      <div className="flex items-start">
        <div className="flex-1">
          {mode === 'select'
            ? renderSelect(field, label, fieldNames)
            : renderInput(field, label, fieldNames)}
        </div>
        {showUnlimitedButton && mode === 'input' && min === -1 && (
          <Tooltip title="Set to Unlimited (-1)">
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() =>
                handleSetUnlimited(Array.isArray(fieldNames) ? fieldNames : [fieldNames])
              }
              className="mt-1 ml-2"
              disabled={disabled}
            />
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {renderField('maxWorkspaces', 'Max Workspaces')}
      {renderField('maxMembersPerWorkspace', 'Max Members/Workspace')}
      {renderField('maxTotalMembers', 'Max Total Members')}
    </div>
  );
}
