'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
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
  Table,
  Alert,
  Divider,
  message,
  Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { JournalVoucher, Account } from '@/types';
import {
  createJournalVoucher,
  postJournalVoucher,
  type JournalVoucherLineInput,
} from '@/lib/actions/finance-journal.actions';

const { Title, Text } = Typography;

// ── Saved templates ──────────────────────────────────────────────────────────
const JOURNAL_TEMPLATES: Record<string, { label: string; lines: Partial<JvLineRow>[] }> = {
  'GST Set-off': {
    label: 'GST Set-off',
    lines: [
      {
        accountCode: '1101',
        accountName: 'CGST Input Credit',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Dr CGST',
      },
      {
        accountCode: '1102',
        accountName: 'SGST Input Credit',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Dr SGST',
      },
      {
        accountCode: '2007',
        accountName: 'CGST Output Payable',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Cr CGST',
      },
      {
        accountCode: '2008',
        accountName: 'SGST Output Payable',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Cr SGST',
      },
    ],
  },
  'Salary Accrual': {
    label: 'Salary Accrual',
    lines: [
      {
        accountCode: '5003',
        accountName: 'Salary Expense',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Dr Salary',
      },
      {
        accountCode: '2010',
        accountName: 'Salary Payable',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Cr Payable',
      },
    ],
  },
  'TDS Remittance': {
    label: 'TDS Remittance',
    lines: [
      {
        accountCode: '2011',
        accountName: 'TDS Payable 194C',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Dr TDS 194C',
      },
      {
        accountCode: '2012',
        accountName: 'TDS Payable 194H',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Dr TDS 194H',
      },
      {
        accountCode: '2013',
        accountName: 'TDS Payable 194J',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Dr TDS 194J',
      },
      {
        accountCode: '1002',
        accountName: 'Bank A/c',
        debitPaise: 0,
        creditPaise: 0,
        note: 'Cr Bank',
      },
    ],
  },
};

export interface JvLineRow {
  key: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debitPaise: number;
  creditPaise: number;
  partyId: string;
  costCentre: string;
  note: string;
}

let lineKey = 1;
function newLine(): JvLineRow {
  return {
    key: `jv-${lineKey++}`,
    accountId: '',
    accountCode: '',
    accountName: '',
    debitPaise: 0,
    creditPaise: 0,
    partyId: '',
    costCentre: '',
    note: '',
  };
}

interface JournalVoucherFormProps {
  wsId: string;
  firmId: string;
  accounts?: Account[];
  initialData?: JournalVoucher;
  mode?: 'create' | 'view';
}

export function JournalVoucherForm({
  wsId,
  firmId,
  accounts = [],
  initialData,
  mode = 'create',
}: JournalVoucherFormProps) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<JvLineRow[]>([newLine(), newLine()]);
  const [savedVoucher, setSavedVoucher] = useState<JournalVoucher | undefined>(initialData);

  const isReadOnly =
    mode === 'view' || initialData?.state === 'posted' || initialData?.state === 'cancelled';

  const totalDebitPaise = lines.reduce((s, l) => s + (l.debitPaise ?? 0), 0);
  const totalCreditPaise = lines.reduce((s, l) => s + (l.creditPaise ?? 0), 0);
  const diffPaise = totalDebitPaise - totalCreditPaise;
  const isBalanced = diffPaise === 0 && totalDebitPaise > 0;

  const formatRs = (p: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(p / 100);

  function updateLine(key: string, patch: Partial<JvLineRow>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const merged = { ...l, ...patch };
        // Mutually exclusive - set one clears the other
        if ('debitPaise' in patch && patch.debitPaise! > 0) merged.creditPaise = 0;
        if ('creditPaise' in patch && patch.creditPaise! > 0) merged.debitPaise = 0;
        return merged;
      }),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function applyTemplate(templateName: string) {
    const tmpl = JOURNAL_TEMPLATES[templateName];
    if (!tmpl) return;
    setLines(
      tmpl.lines.map((l) => ({
        ...newLine(),
        accountCode: l.accountCode ?? '',
        accountName: l.accountName ?? '',
        note: l.note ?? '',
      })),
    );
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (isReadOnly) return;
    function handler(e: KeyboardEvent) {
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        addLine();
      }
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        if (lines.length > 2) setLines((prev) => prev.slice(0, -1));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handlePost();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, isReadOnly]);

  const accountOptions = accounts.map((a) => ({
    value: a._id,
    label: `${a.code} - ${a.name}`,
    code: a.code,
    name: a.name,
  }));

  async function saveDraft() {
    const values = await form.validateFields();
    const dto = {
      voucherDate: values.voucherDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
      narration: values.narration,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debitPaise: l.debitPaise,
        creditPaise: l.creditPaise,
        partyId: l.partyId || undefined,
        costCentre: l.costCentre || undefined,
      })),
    };
    startTransition(async () => {
      try {
        const result = await createJournalVoucher(wsId, firmId, dto);
        setSavedVoucher(result);
        message.success('Journal voucher saved as draft');
        router.push(`/dashboard/finance/journal-vouchers`);
      } catch (e: any) {
        message.error(e?.message ?? 'Failed to save journal voucher');
      }
    });
  }

  async function handlePost() {
    if (!isBalanced) {
      message.error('Journal is not balanced - Debit must equal Credit before posting');
      return;
    }
    const values = await form.validateFields();
    startTransition(async () => {
      try {
        let jv = savedVoucher;
        if (!jv) {
          const dto = {
            voucherDate: values.voucherDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
            narration: values.narration,
            lines: lines.map((l) => ({
              accountId: l.accountId,
              debitPaise: l.debitPaise,
              creditPaise: l.creditPaise,
              partyId: l.partyId || undefined,
              costCentre: l.costCentre || undefined,
            })),
          };
          jv = await createJournalVoucher(wsId, firmId, dto);
        }
        const posted = await postJournalVoucher(wsId, firmId, jv._id);
        message.success(`Journal Voucher ${posted.voucherNumber} posted`);
        router.push(`/dashboard/finance/journal-vouchers`);
      } catch (e: any) {
        message.error(e?.message ?? 'Failed to post journal voucher');
      }
    });
  }

  const columns: ColumnsType<JvLineRow> = [
    {
      title: 'Account',
      dataIndex: 'accountId',
      width: 220,
      render: (val, record) => (
        <Select
          showSearch
          size="small"
          style={{ width: '100%' }}
          placeholder="Search account…"
          value={val || undefined}
          options={accountOptions}
          filterOption={(inp, opt) =>
            String(opt?.label ?? '')
              .toLowerCase()
              .includes(inp.toLowerCase())
          }
          onChange={(v, opt: any) =>
            updateLine(record.key, {
              accountId: v,
              accountCode: opt.code ?? '',
              accountName: opt.name ?? '',
            })
          }
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: 'Debit (₹)',
      dataIndex: 'debitPaise',
      width: 120,
      align: 'right',
      render: (val, record) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          precision={2}
          value={val / 100}
          onChange={(v) => updateLine(record.key, { debitPaise: Math.round((v ?? 0) * 100) })}
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: 'Credit (₹)',
      dataIndex: 'creditPaise',
      width: 120,
      align: 'right',
      render: (val, record) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          precision={2}
          value={val / 100}
          onChange={(v) => updateLine(record.key, { creditPaise: Math.round((v ?? 0) * 100) })}
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: 'Note',
      dataIndex: 'note',
      width: 140,
      render: (val, record) => (
        <Input
          size="small"
          value={val}
          onChange={(e) => updateLine(record.key, { note: e.target.value })}
          disabled={isReadOnly}
        />
      ),
    },
    ...(!isReadOnly
      ? [
          {
            title: <span className="sr-only">Delete</span>,
            key: 'del',
            width: 40,
            render: (_: unknown, record: JvLineRow) => (
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={lines.length <= 2}
                onClick={() => removeLine(record.key)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={1} style={{ margin: 0, fontSize: 22 }}>
          {mode === 'create' ? 'New Journal Voucher' : 'Journal Voucher'}
        </Title>
        {!isReadOnly && (
          <Select
            placeholder="Load template…"
            style={{ width: 200 }}
            options={Object.keys(JOURNAL_TEMPLATES).map((k) => ({ value: k, label: k }))}
            onChange={applyTemplate}
            allowClear
          />
        )}
      </div>

      <Form form={form} layout="vertical" disabled={isReadOnly}>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Form.Item
              label="Date"
              name="voucherDate"
              style={{ marginBottom: 0, minWidth: 180 }}
              initialValue={dayjs()}
            >
              <DatePicker style={{ width: '100%' }} disabled={isReadOnly} />
            </Form.Item>
            <Form.Item
              label="Narration"
              name="narration"
              style={{ marginBottom: 0, minWidth: 340 }}
              rules={[
                { required: true, message: 'Narration is required' },
                { min: 5, message: 'Narration must be at least 5 characters' },
              ]}
            >
              <Input
                placeholder="Describe the journal entry (min 5 chars)"
                showCount
                minLength={5}
              />
            </Form.Item>
          </Space>
        </Card>

        <Card size="small" style={{ marginBottom: 16 }} title="Journal Lines">
          <Table
            dataSource={lines}
            columns={columns}
            rowKey="key"
            pagination={false}
            size="small"
            style={{ marginBottom: 8 }}
          />
          {!isReadOnly && (
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={addLine}>
                Add Line{' '}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  (Alt+L)
                </Text>
              </Button>
            </Space>
          )}
        </Card>

        {/* Live balance indicator */}
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderColor: isBalanced
              ? 'var(--cr-success-500)'
              : totalDebitPaise > 0
                ? 'var(--cr-danger-500)'
                : 'var(--cr-neutral-300)',
          }}
        >
          <Space size="large">
            <span>
              <Text type="secondary">Total Debit: </Text>
              <Text strong>{formatRs(totalDebitPaise)}</Text>
            </span>
            <span>
              <Text type="secondary">Total Credit: </Text>
              <Text strong>{formatRs(totalCreditPaise)}</Text>
            </span>
            <span>
              <Text type="secondary">Difference: </Text>
              <Text
                strong
                style={{ color: isBalanced ? 'var(--cr-success-500)' : 'var(--cr-danger-500)' }}
              >
                {formatRs(Math.abs(diffPaise))}
                {isBalanced && ' ✓ Balanced'}
                {!isBalanced && totalDebitPaise > 0 && ' - Unbalanced'}
              </Text>
            </span>
          </Space>
        </Card>

        {!isReadOnly && (
          <Space>
            <Button icon={<SaveOutlined />} onClick={saveDraft} loading={isPending}>
              Save Draft
            </Button>
            <Tooltip
              title={
                !isBalanced
                  ? 'Balance the journal before posting'
                  : 'Post Journal Voucher (Ctrl+Enter)'
              }
            >
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handlePost}
                loading={isPending}
                disabled={!isBalanced}
              >
                Post
              </Button>
            </Tooltip>
          </Space>
        )}
      </Form>
    </div>
  );
}
