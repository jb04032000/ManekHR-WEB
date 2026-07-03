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
  Alert,
  Typography,
  Space,
} from 'antd';
import { useRouter } from 'next/navigation';
import { createLoan, type CreateLoanInput } from '@/lib/actions/finance-loans.actions';
import { listBankAccounts } from '@/lib/actions/finance-bank-accounts.actions';
import type { FinanceBankAccount } from '@/types';
import AmortisationPreviewCard from './AmortisationPreviewCard';
import dayjs from 'dayjs';

const { Text } = Typography;

interface LoanFormProps {
  wsId: string;
  firmId: string;
  mode?: 'create';
}

export default function LoanForm({ wsId, firmId }: LoanFormProps) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();
  const [loanType, setLoanType] = useState<'term_loan' | 'overdraft' | 'cash_credit'>('term_loan');
  const [bankAccounts, setBankAccounts] = useState<FinanceBankAccount[]>([]);

  // Live preview state - updated on form value changes
  const [previewSanctioned, setPreviewSanctioned] = useState<number | null>(null);
  const [previewRate, setPreviewRate] = useState<number | null>(null);
  const [previewTenure, setPreviewTenure] = useState<number | null>(null);
  const [previewStartDate, setPreviewStartDate] = useState<string | null>(null);

  useEffect(() => {
    if (!wsId || !firmId) return;
    listBankAccounts(wsId, firmId)
      .then((res) => setBankAccounts(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [wsId, firmId]);

  const handleValuesChange = (changed: Record<string, unknown>, all: Record<string, unknown>) => {
    if (loanType === 'term_loan') {
      const s = all.sanctionedAmountPaise as number | undefined;
      const r = all.interestRateAnnual as number | undefined;
      const t = all.tenureMonths as number | undefined;
      const d = all.repaymentStartDate as ReturnType<typeof dayjs> | undefined;
      setPreviewSanctioned(s ? Math.round(s * 100) : null);
      setPreviewRate(r ?? null);
      setPreviewTenure(t ?? null);
      setPreviewStartDate(d ? d.format('YYYY-MM-DD') : null);
    }
  };

  const handleFinish = (values: Record<string, unknown>) => {
    startTransition(async () => {
      const disbursedPaise = Math.round(
        ((values.disbursedAmountPaise as number) ?? (values.sanctionedAmountPaise as number)) * 100,
      );
      const dto: CreateLoanInput = {
        name: values.name as string,
        lenderName: values.lenderName as string,
        loanType: values.loanType as CreateLoanInput['loanType'],
        sanctionedAmountPaise: Math.round(((values.sanctionedAmountPaise as number) ?? 0) * 100),
        disbursedAmountPaise: disbursedPaise,
        disbursementDate: (values.disbursementDate as ReturnType<typeof dayjs>).format(
          'YYYY-MM-DD',
        ),
        interestRateAnnual: (values.interestRateAnnual as number) ?? 0,
        tenureMonths: (values.tenureMonths as number) ?? 0,
        repaymentStartDate: values.repaymentStartDate
          ? (values.repaymentStartDate as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
          : dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD'),
        processingFeePaise: values.processingFeePaise
          ? Math.round((values.processingFeePaise as number) * 100)
          : undefined,
        // These are required by backend - caller must create CoA account first.
        // For now we pass the lender bank code as a placeholder; the full CoA flow
        // will be wired in a dedicated finance-setup pass.
        coaLiabilityAccountId: (values.coaLiabilityAccountId as string) ?? '',
        coaLiabilityAccountCode: (values.coaLiabilityAccountCode as string) ?? '2017',
      };
      try {
        const loan = await createLoan(wsId, firmId, dto);
        router.push(`/dashboard/finance/loans/${loan._id}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to create loan';
        form.setFields([{ name: 'name', errors: [msg] }]);
      }
    });
  };

  const isTermLoan = loanType === 'term_loan';
  const isOdCc = loanType === 'overdraft' || loanType === 'cash_credit';

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      onValuesChange={handleValuesChange}
      initialValues={{
        loanType: 'term_loan',
        disbursementDate: dayjs(),
        repaymentStartDate: dayjs().add(1, 'month').startOf('month'),
        interestRateAnnual: 12,
        tenureMonths: 36,
      }}
    >
      <Form.Item name="loanType" label="Loan Type" rules={[{ required: true }]}>
        <Segmented
          options={[
            { label: 'Term Loan', value: 'term_loan' },
            { label: 'Overdraft (OD)', value: 'overdraft' },
            { label: 'Cash Credit (CC)', value: 'cash_credit' },
          ]}
          onChange={(v) => setLoanType(v as typeof loanType)}
          block
        />
      </Form.Item>

      <Form.Item name="name" label="Loan Name" rules={[{ required: true, message: 'Required' }]}>
        <Input placeholder="e.g. HDFC Equipment Loan" />
      </Form.Item>

      <Form.Item
        name="lenderName"
        label="Lender Name"
        rules={[{ required: true, message: 'Required' }]}
      >
        <Input placeholder="e.g. HDFC Bank" />
      </Form.Item>

      <Space style={{ width: '100%' }} size="middle">
        <Form.Item
          name="sanctionedAmountPaise"
          label="Sanctioned Amount (₹)"
          style={{ flex: 1 }}
          rules={[{ required: true }]}
        >
          <InputNumber
            min={1}
            precision={2}
            prefix="₹"
            style={{ width: '100%' }}
            placeholder="10,00,000"
          />
        </Form.Item>

        <Form.Item name="disbursedAmountPaise" label="Disbursed Amount (₹)" style={{ flex: 1 }}>
          <InputNumber
            min={1}
            precision={2}
            prefix="₹"
            style={{ width: '100%' }}
            placeholder="Same as sanctioned"
          />
        </Form.Item>
      </Space>

      <Space style={{ width: '100%' }} size="middle">
        <Form.Item
          name="disbursementDate"
          label="Disbursement Date"
          style={{ flex: 1 }}
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
        </Form.Item>

        <Form.Item
          name="interestRateAnnual"
          label="Interest Rate (% p.a.)"
          style={{ flex: 1 }}
          rules={[{ required: true }]}
        >
          <InputNumber min={0} max={50} precision={2} suffix="%" style={{ width: '100%' }} />
        </Form.Item>
      </Space>

      {isTermLoan && (
        <>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              name="tenureMonths"
              label="Tenure (months)"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={360} style={{ width: '100%' }} placeholder="36" />
            </Form.Item>
            <Form.Item name="repaymentStartDate" label="Repayment Start Date" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Space>

          <AmortisationPreviewCard
            wsId={wsId}
            firmId={firmId}
            sanctionedAmountPaise={previewSanctioned}
            interestRateAnnual={previewRate}
            tenureMonths={previewTenure}
            repaymentStartDate={previewStartDate}
          />
        </>
      )}

      {isOdCc && (
        <Alert
          type="info"
          showIcon
          title="Overdraft / Cash Credit"
          description="An OD/CC bank account will be auto-created under CoA 2018-XX. The sanctioned limit is tracked; balance is updated transactionally as the facility is drawn."
          style={{ marginBottom: 16 }}
        />
      )}

      <Form.Item name="disbursementBankAccountId" label="Disbursement Bank Account">
        <Select placeholder="Bank to credit disbursement to" allowClear>
          {bankAccounts.map((a) => (
            <Select.Option key={a._id} value={a._id}>
              {a.name} ({a.accountNumber ?? '-'})
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="processingFeePaise" label="Processing Fee (₹, optional)">
        <InputNumber min={0} precision={2} prefix="₹" style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item name="coaLiabilityAccountCode" label="CoA Liability Account Code">
        <Input placeholder="2017 (default: Loan from Bank)" defaultValue="2017" />
      </Form.Item>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => router.push('/dashboard/finance/loans')}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={isPending}>
          Create Loan
        </Button>
      </div>
    </Form>
  );
}
