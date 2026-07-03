'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Switch,
  Button,
  Segmented,
  Space,
  Alert,
} from 'antd';
import type { FinanceBankAccount } from '@/types';
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from '@/lib/actions/finance-bank-accounts.actions';
import dayjs from 'dayjs';

interface BankAccountFormProps {
  initialValues?: FinanceBankAccount | null;
  onSubmit: (values: CreateBankAccountInput | UpdateBankAccountInput) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export default function BankAccountForm({
  initialValues,
  onSubmit,
  onCancel,
  loading,
}: BankAccountFormProps) {
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();
  const [accountType, setAccountType] = useState<string>(initialValues?.accountType ?? 'current');

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        name: initialValues.name,
        bankName: initialValues.bankName,
        accountType: initialValues.accountType,
        ifscCode: initialValues.ifscCode,
        openingBalancePaise: (initialValues.openingBalancePaise ?? 0) / 100,
        openingBalanceDate: initialValues.openingBalanceDate
          ? dayjs(initialValues.openingBalanceDate)
          : null,
        upiId: initialValues.upiId,
        isDefault: initialValues.isDefault ?? false,
      });
      startTransition(() => {
        setAccountType(initialValues.accountType);
      });
    }
  }, [initialValues, form]);

  const handleFinish = (values: Record<string, unknown>) => {
    startTransition(async () => {
      const dto: CreateBankAccountInput = {
        name: values.name as string,
        bankName: values.bankName as string,
        accountType: values.accountType as CreateBankAccountInput['accountType'],
        accountNumber: (values.accountNumber as string) ?? '',
        ifscCode: (values.ifscCode as string) ?? '',
        openingBalancePaise: Math.round(((values.openingBalancePaise as number) ?? 0) * 100),
        openingBalanceDate: values.openingBalanceDate
          ? (values.openingBalanceDate as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
          : new Date().toISOString().split('T')[0],
        upiId: (values.upiId as string) || undefined,
        isDefault: (values.isDefault as boolean) ?? false,
      };
      await onSubmit(initialValues ? (dto as unknown as UpdateBankAccountInput) : dto);
    });
  };

  const isOdCc = accountType === 'overdraft' || accountType === 'cash_credit';

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ accountType: 'current', openingBalancePaise: 0, isDefault: false }}
    >
      <Form.Item name="name" label="Account Name" rules={[{ required: true, message: 'Required' }]}>
        <Input placeholder="e.g. HDFC Current A/C" />
      </Form.Item>

      <Form.Item
        name="bankName"
        label="Bank Name"
        rules={[{ required: true, message: 'Required' }]}
      >
        <Input placeholder="e.g. HDFC Bank" />
      </Form.Item>

      <Form.Item name="accountType" label="Account Type" rules={[{ required: true }]}>
        <Segmented
          options={[
            { label: 'Current', value: 'current' },
            { label: 'Savings', value: 'savings' },
            { label: 'Overdraft (OD)', value: 'overdraft' },
            { label: 'Cash Credit (CC)', value: 'cash_credit' },
          ]}
          onChange={(v) => setAccountType(v as string)}
          block
        />
      </Form.Item>

      {isOdCc && (
        <Alert
          type="info"
          showIcon
          title="OD/CC Account"
          description="OD/CC accounts will be created under Bank Borrowings (CoA 2018-XX) instead of Current Assets."
          style={{ marginBottom: 16 }}
        />
      )}

      {!initialValues && (
        <Form.Item
          name="accountNumber"
          label="Account Number"
          rules={[{ required: true, message: 'Required' }]}
          help="Full account number - stored securely, displayed as last-4 digits after save."
        >
          <Input.Password placeholder="Full account number" visibilityToggle />
        </Form.Item>
      )}

      <Form.Item
        name="ifscCode"
        label="IFSC Code"
        rules={[
          { required: true, message: 'Required' },
          {
            pattern: IFSC_REGEX,
            message: 'Invalid IFSC format (e.g. HDFC0001234)',
          },
        ]}
      >
        <Input placeholder="HDFC0001234" style={{ textTransform: 'uppercase' }} maxLength={11} />
      </Form.Item>

      <Space style={{ width: '100%' }} size="middle">
        <Form.Item name="openingBalancePaise" label="Opening Balance (₹)" style={{ flex: 1 }}>
          <InputNumber
            min={0}
            precision={2}
            style={{ width: '100%' }}
            prefix="₹"
            placeholder="0.00"
          />
        </Form.Item>

        <Form.Item name="openingBalanceDate" label="Opening Balance Date" style={{ flex: 1 }}>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
        </Form.Item>
      </Space>

      <Form.Item name="upiId" label="UPI ID (optional)">
        <Input placeholder="firm@bank" />
      </Form.Item>

      <Form.Item name="isDefault" label="Set as Default" valuePropName="checked">
        <Switch />
      </Form.Item>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={isPending || loading}>
          {initialValues ? 'Update' : 'Create'} Bank Account
        </Button>
      </div>
    </Form>
  );
}
