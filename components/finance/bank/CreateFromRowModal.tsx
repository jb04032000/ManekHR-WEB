'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Modal, Form, Input, Select, Button, Space, Typography, message } from 'antd';
import { Segmented } from 'antd';
import dayjs from 'dayjs';
import type { BankStatementRow } from '@/types';
import { financeBankReconciliationApi } from '@/lib/api/modules/finance-bank-reconciliation.api';
import { listAccounts } from '@/lib/actions/finance.actions';
import type { Account } from '@/types';

const { Text } = Typography;

// Client-side narration rules - mirrors backend narration-rules.ts
const NARRATION_RULES = [
  {
    patterns: [
      /bank.?charge/i,
      /sms.?charg/i,
      /service.?charg/i,
      /annual.?fee/i,
      /minimum.?balance/i,
    ],
    accountCode: '5008',
    accountName: 'Bank Charges',
    entryType: 'expense' as const,
  },
  {
    patterns: [/int.?cr/i, /interest.?cr/i, /saving.?interest/i, /int\.pd/i],
    accountCode: '4003',
    accountName: 'Interest Income',
    entryType: 'journal' as const,
  },
  {
    patterns: [/neft.?return/i, /imps.?return/i, /bounce/i, /dishon/i, /cheque.?return/i],
    accountCode: '5014',
    accountName: 'Cheque Bounce Charges',
    entryType: 'expense' as const,
  },
  {
    patterns: [/^gst/i, /tax.?deduct/i, /^tds/i],
    accountCode: '2014',
    accountName: 'TDS Receivable',
    entryType: 'journal' as const,
  },
  {
    patterns: [/upi.*charges/i, /imps.*charges/i, /neft.*charges/i, /rtgs.*charges/i],
    accountCode: '5008',
    accountName: 'Bank Charges',
    entryType: 'expense' as const,
  },
];

function suggestCategory(
  narration: string,
): { accountCode: string; accountName: string; entryType: 'expense' | 'journal' } | null {
  const lower = narration.toLowerCase();
  for (const rule of NARRATION_RULES) {
    if (rule.patterns.some((p) => p.test(lower))) {
      return {
        accountCode: rule.accountCode,
        accountName: rule.accountName,
        entryType: rule.entryType,
      };
    }
  }
  return null;
}

const GST_RATE_OPTIONS = [
  { label: 'None', value: '' },
  { label: '0%', value: '0' },
  { label: '5%', value: '5' },
  { label: '12%', value: '12' },
  { label: '18%', value: '18' },
  { label: '28%', value: '28' },
];

interface CreateFromRowModalProps {
  open: boolean;
  row: BankStatementRow;
  wsId: string;
  firmId: string;
  bankAccountId: string;
  sessionId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateFromRowModal({
  open,
  row,
  wsId,
  firmId,
  bankAccountId,
  sessionId,
  onClose,
  onCreated,
}: CreateFromRowModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountSearch, setAccountSearch] = useState('');

  const isDebit = row.debitPaise > 0;
  const absAmount = (isDebit ? row.debitPaise : row.creditPaise) / 100;
  const direction = isDebit ? 'Dr' : 'Cr';

  // Suggest category from narration
  const suggestion = suggestCategory(row.narration);

  // Load accounts
  useEffect(() => {
    if (!open || !wsId || !firmId) return;
    listAccounts(wsId, firmId)
      .then((data) => setAccounts(data ?? []))
      .catch(() => {});
  }, [open, wsId, firmId]);

  // Set initial form values when modal opens
  useEffect(() => {
    if (!open) return;
    const defaultEntryType = suggestion?.entryType ?? (isDebit ? 'expense' : 'journal');
    const defaultAccountCode = suggestion?.accountCode;
    const defaultAccount = accounts.find((a) => a.code === defaultAccountCode);

    form.setFieldsValue({
      entryType: defaultEntryType,
      coaAccountId: defaultAccount?._id ?? undefined,
      gstRatePercent: '',
      narration: row.narration,
    });
  }, [open, accounts, row, suggestion, isDebit, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setError(null);

      await financeBankReconciliationApi.createVoucher(
        wsId,
        firmId,
        bankAccountId,
        sessionId,
        row._id,
        {
          entryType: values.entryType,
          coaAccountId: values.coaAccountId,
          gstRatePercent: values.gstRatePercent ? Number(values.gstRatePercent) : undefined,
          narration: values.narration,
        },
      );

      message.success('Entry created and matched');
      form.resetFields();
      onCreated();
    } catch (e: unknown) {
      const err = e as { errorFields?: unknown[]; response?: { data?: { message?: string } } };
      if (err?.errorFields) return; // form validation error
      setError(
        err?.response?.data?.message ??
          'Could not create entry. Check all required fields and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((a) => {
    if (!accountSearch) return true;
    const q = accountSearch.toLowerCase();
    return a.name?.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q);
  });

  const accountOptions = filteredAccounts.map((a) => ({
    label: `${a.code} - ${a.name}`,
    value: a._id,
  }));

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnHidden
      width={560}
      title="Create Entry from Bank Row"
      footer={
        <Space>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            Create and Match
          </Button>
        </Space>
      }
    >
      {/* Pre-filled read-only row info */}
      <div
        style={{
          background: 'var(--cr-surface-2)',
          borderRadius: 'var(--cr-radius-md)',
          padding: 16,
          marginBottom: 16,
        }}
      >
        <Text strong>
          {dayjs(row.txnDate).format('DD MMM YYYY')} - ₹
          {absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {direction}
        </Text>
        {row.refNumber && (
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
            {row.refNumber}
          </Text>
        )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--cr-danger-50)',
            border: '1px solid var(--cr-danger-50)',
            borderRadius: 4,
          }}
        >
          <Text type="danger">{error}</Text>
        </div>
      )}

      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label="Entry Type" name="entryType">
          <Segmented
            options={[
              { label: 'Expense', value: 'expense' },
              { label: 'Journal', value: 'journal' },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="Account"
          name="coaAccountId"
          rules={[{ required: true, message: 'Please select an account' }]}
        >
          <Select
            showSearch
            placeholder="Search by name or code"
            filterOption={false}
            onSearch={setAccountSearch}
            options={accountOptions}
            notFoundContent={accounts.length === 0 ? 'Loading accounts...' : 'No accounts found'}
          />
        </Form.Item>

        <Form.Item label="GST Rate" name="gstRatePercent">
          <Select options={GST_RATE_OPTIONS} placeholder="None" />
        </Form.Item>

        <Form.Item label="Narration" name="narration">
          <Input placeholder="Enter narration" maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
