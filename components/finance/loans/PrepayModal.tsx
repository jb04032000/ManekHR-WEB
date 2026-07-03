'use client';

import { useTransition } from 'react';
import { Modal, Form, DatePicker, Input, InputNumber, Typography, message, Alert } from 'antd';
import { prepayLoan, type PrepayLoanInput } from '@/lib/actions/finance-loans.actions';
import { listBankAccounts } from '@/lib/actions/finance-bank-accounts.actions';
import type { LoanAccount, FinanceBankAccount } from '@/types';
import { Select } from 'antd';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

const { Text } = Typography;

interface PrepayModalProps {
  open: boolean;
  loan: LoanAccount | null;
  wsId: string;
  firmId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PrepayModal({
  open,
  loan,
  wsId,
  firmId,
  onSuccess,
  onCancel,
}: PrepayModalProps) {
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();
  const [bankAccounts, setBankAccounts] = useState<FinanceBankAccount[]>([]);

  useEffect(() => {
    if (!wsId || !firmId) return;
    listBankAccounts(wsId, firmId)
      .then((res) => setBankAccounts(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [wsId, firmId]);

  const maxAmountRupees = loan ? loan.principalOutstandingPaise / 100 : 0;

  const handleOk = () => {
    form.validateFields().then((values) => {
      if (!loan) return;
      startTransition(async () => {
        // Find the coaCode for the selected bank account
        const selectedBank = bankAccounts.find((a) => a._id === values.bankAccountId);
        const dto: PrepayLoanInput = {
          amountPaise: Math.round(((values.amountRupees as number) ?? 0) * 100),
          prepaymentDate: (values.prepaymentDate as ReturnType<typeof dayjs>).format('YYYY-MM-DD'),
          bankCoaCode: selectedBank?.coaAccountCode ?? '1002',
          narration: (values.narration as string) || undefined,
        };
        try {
          await prepayLoan(wsId, firmId, loan._id, dto);
          message.success('Prepayment recorded. Schedule recomputed (tenure shortened).');
          form.resetFields();
          onSuccess();
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : 'Prepayment failed');
        }
      });
    });
  };

  return (
    <Modal
      title="Record Loan Prepayment"
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      okText="Submit Prepayment"
      okButtonProps={{ loading: isPending }}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title="Preserve EMI, shorten tenure"
        description="Prepayment reduces principal outstanding. The monthly EMI amount stays the same; remaining tenure is shortened accordingly."
        style={{ marginBottom: 16 }}
      />

      {loan && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Outstanding Principal:{' '}
          <Text strong>₹{(loan.principalOutstandingPaise / 100).toLocaleString('en-IN')}</Text>
        </Text>
      )}

      <Form form={form} layout="vertical" initialValues={{ prepaymentDate: dayjs() }}>
        <Form.Item
          name="amountRupees"
          label="Prepayment Amount (₹)"
          rules={[
            { required: true, message: 'Required' },
            {
              validator: (_, v) =>
                v > 0 && v <= maxAmountRupees
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        `Must be > 0 and ≤ ₹${maxAmountRupees.toLocaleString('en-IN')} (outstanding)`,
                      ),
                    ),
            },
          ]}
        >
          <InputNumber
            min={0.01}
            max={maxAmountRupees}
            precision={2}
            prefix="₹"
            style={{ width: '100%' }}
            placeholder={`Max ₹${maxAmountRupees.toLocaleString('en-IN')}`}
          />
        </Form.Item>

        <Form.Item
          name="bankAccountId"
          label="Debit Bank Account"
          rules={[{ required: true, message: 'Required' }]}
        >
          <Select placeholder="Select bank to debit">
            {bankAccounts.map((a) => (
              <Select.Option key={a._id} value={a._id}>
                {a.name} ({a.accountNumber ?? '-'})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="prepaymentDate" label="Prepayment Date" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
        </Form.Item>

        <Form.Item
          name="narration"
          label="Narration"
          rules={[{ min: 5, message: 'Must be at least 5 characters' }]}
        >
          <Input.TextArea
            rows={2}
            placeholder="e.g. Bonus prepayment, Annual principal reduction"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
