'use client';

import { useTransition } from 'react';
import {
  Form,
  Select,
  DatePicker,
  Input,
  InputNumber,
  Button,
  Card,
  Space,
  Typography,
  message,
} from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import type { Account } from '@/types';
import { createContra } from '@/lib/actions/finance-journal.actions';

const { Title, Text } = Typography;

// Cash/bank account group prefix patterns (codes starting with 1001 or 1002)
const CASH_BANK_PREFIXES = ['1001', '1002'];

function isCashBankAccount(account: Account): boolean {
  return CASH_BANK_PREFIXES.some((prefix) => account.code?.startsWith(prefix));
}

interface ContraVoucherFormProps {
  wsId: string;
  firmId: string;
  accounts?: Account[];
}

export function ContraVoucherForm({ wsId, firmId, accounts = [] }: ContraVoucherFormProps) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();

  const cashBankAccounts = accounts.filter(isCashBankAccount);
  const accountOptions = cashBankAccounts.map((a) => ({
    value: a._id,
    label: `${a.code} - ${a.name}`,
    code: a.code,
    name: a.name,
  }));

  async function handleSubmit() {
    const values = await form.validateFields();
    const dto = {
      voucherDate: values.voucherDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      amountPaise: Math.round((values.amountRupees ?? 0) * 100),
      fromCashRegisterId: values.fromCashRegisterId,
      toCashRegisterId: values.toCashRegisterId,
      narration: values.narration,
    };

    startTransition(async () => {
      try {
        const jv = await createContra(wsId, firmId, dto);
        message.success(`Contra voucher ${jv.voucherNumber ?? ''} posted successfully`);
        router.push('/dashboard/finance/journal-vouchers');
      } catch (e: any) {
        message.error(e?.message ?? 'Failed to create contra voucher');
      }
    });
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <Title level={1} style={{ marginBottom: 24, fontSize: 22 }}>
        New Contra Entry
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Contra entries transfer funds between cash and bank accounts. Both accounts must be cash or
        bank type.
      </Text>

      <Form form={form} layout="vertical">
        <Card size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            label="Date"
            name="voucherDate"
            initialValue={dayjs()}
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="From Account (Cash / Bank)"
            name="fromAccountId"
            rules={[{ required: true, message: 'Select source account' }]}
          >
            <Select
              showSearch
              placeholder="Select source account…"
              options={accountOptions}
              filterOption={(inp, opt) =>
                String(opt?.label ?? '')
                  .toLowerCase()
                  .includes(inp.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="To Account (Cash / Bank)"
            name="toAccountId"
            rules={[{ required: true, message: 'Select destination account' }]}
          >
            <Select
              showSearch
              placeholder="Select destination account…"
              options={accountOptions}
              filterOption={(inp, opt) =>
                String(opt?.label ?? '')
                  .toLowerCase()
                  .includes(inp.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="Amount (₹)"
            name="amountRupees"
            rules={[
              { required: true, message: 'Enter amount' },
              { type: 'number', min: 0.01, message: 'Amount must be positive' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              prefix="₹"
              placeholder="0.00"
            />
          </Form.Item>

          <Form.Item
            label="Narration"
            name="narration"
            rules={[
              { required: true, message: 'Narration is required' },
              { min: 5, message: 'Narration must be at least 5 characters' },
            ]}
          >
            <Input placeholder="Describe the transfer (min 5 chars)" />
          </Form.Item>
        </Card>

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={isPending}
          block
        >
          Create &amp; Post Contra
        </Button>
      </Form>
    </div>
  );
}
