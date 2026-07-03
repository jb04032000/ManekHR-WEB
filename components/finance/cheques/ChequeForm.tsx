'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Segmented,
  Select,
  Tag,
  Typography,
} from 'antd';
import { createCheque, type CreateChequeInput } from '@/lib/actions/finance-cheques.actions';
import { listBankAccounts } from '@/lib/actions/finance-bank-accounts.actions';
import type { FinanceBankAccount } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;

const CHEQUE_NUMBER_REGEX = /^\d{6}$/;

interface ChequeFormProps {
  wsId: string;
  firmId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ChequeForm({ wsId, firmId, onSuccess, onCancel }: ChequeFormProps) {
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();
  const [bankAccounts, setBankAccounts] = useState<FinanceBankAccount[]>([]);
  const [chequeDate, setChequeDate] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    if (!wsId || !firmId) return;
    listBankAccounts(wsId, firmId)
      .then((res) => setBankAccounts(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [wsId, firmId]);

  const isPostDated = chequeDate ? chequeDate.isAfter(dayjs(), 'day') : false;

  const handleFinish = (values: Record<string, unknown>) => {
    startTransition(async () => {
      const dto: CreateChequeInput = {
        chequeType: values.chequeType as 'issued' | 'received',
        chequeNumber: values.chequeNumber as string,
        chequeDate: (values.chequeDate as ReturnType<typeof dayjs>).format('YYYY-MM-DD'),
        bankAccountId: values.bankAccountId as string,
        amount: Math.round(((values.amount as number) ?? 0) * 100),
        partyName: (values.partyName as string) || undefined,
        sourceVoucherId: (values.sourceVoucherId as string) || undefined,
        narration: (values.narration as string) || undefined,
      };
      try {
        await createCheque(wsId, firmId, dto);
        onSuccess();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to create cheque';
        form.setFields([{ name: 'chequeNumber', errors: [msg] }]);
      }
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ chequeType: 'received' }}
    >
      <Form.Item name="chequeType" label="Cheque Type" rules={[{ required: true }]}>
        <Segmented
          options={[
            { label: 'Received', value: 'received' },
            { label: 'Issued', value: 'issued' },
          ]}
          block
        />
      </Form.Item>

      <Form.Item
        name="chequeNumber"
        label="Cheque Number"
        rules={[
          { required: true, message: 'Required' },
          { pattern: CHEQUE_NUMBER_REGEX, message: 'Must be exactly 6 digits' },
        ]}
      >
        <Input placeholder="123456" maxLength={6} />
      </Form.Item>

      <Form.Item
        name="chequeDate"
        label="Cheque Date"
        rules={[{ required: true, message: 'Required' }]}
      >
        <DatePicker
          style={{ width: '100%' }}
          format="DD MMM YYYY"
          onChange={(d) => setChequeDate(d)}
          renderExtraFooter={() =>
            isPostDated ? (
              <Tag color="warning" style={{ margin: 4 }}>
                POST-DATED
              </Tag>
            ) : null
          }
        />
      </Form.Item>

      {isPostDated && (
        <div style={{ marginTop: -16, marginBottom: 12 }}>
          <Tag color="warning">POST-DATED</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {' '}
            Cheque date is in the future
          </Text>
        </div>
      )}

      <Form.Item
        name="bankAccountId"
        label="Bank Account"
        rules={[{ required: true, message: 'Required' }]}
      >
        <Select placeholder="Select bank account">
          {bankAccounts.map((a) => (
            <Select.Option key={a._id} value={a._id}>
              {a.name} ({a.accountNumber ?? '-'})
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true, message: 'Required' }]}>
        <InputNumber
          min={0.01}
          precision={2}
          prefix="₹"
          style={{ width: '100%' }}
          placeholder="0.00"
        />
      </Form.Item>

      <Form.Item name="partyName" label="Party Name (optional)">
        <Input placeholder="Vendor / Customer name" />
      </Form.Item>

      <Form.Item name="sourceVoucherId" label="Source Voucher ID (optional)">
        <Input placeholder="Voucher ID to link" />
      </Form.Item>

      <Form.Item name="narration" label="Narration (optional)">
        <Input.TextArea rows={2} />
      </Form.Item>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={isPending}>
          Create Cheque
        </Button>
      </div>
    </Form>
  );
}
