'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { Table, Button, Select, Input, InputNumber, Tooltip, Tag, Space, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ExpenseVoucherLine, ItcEligibility, Account } from '@/types';

const { Text } = Typography;

const GST_RATES = [0, 5, 12, 18, 28] as const;

const ITC_OPTIONS: { value: ItcEligibility; label: string; color: string }[] = [
  { value: 'full', label: 'Eligible', color: 'green' },
  { value: 'blocked', label: 'Blocked', color: 'red' },
  { value: 'nil_rated', label: 'N/A', color: 'default' },
];

export interface ExpenseLineRow {
  key: string;
  expenseAccountId: string;
  expenseAccountCode: string;
  expenseAccountName: string;
  description: string;
  amountPaise: number;
  gstRate: number;
  itcEligibility: ItcEligibility;
  lineTotalPaise: number;
  costCentre: string;
  serverItcOverridden?: boolean;
}

interface ExpenseLineTableProps {
  value?: ExpenseLineRow[];
  onChange?: (rows: ExpenseLineRow[]) => void;
  accounts?: Account[];
  readOnly?: boolean;
}

function computeLineTotal(amountPaise: number, gstRate: number): number {
  return Math.round(amountPaise * (1 + gstRate / 100));
}

let keyCounter = 1;
function newRow(): ExpenseLineRow {
  return {
    key: `line-${keyCounter++}`,
    expenseAccountId: '',
    expenseAccountCode: '',
    expenseAccountName: '',
    description: '',
    amountPaise: 0,
    gstRate: 18,
    itcEligibility: 'full',
    lineTotalPaise: 0,
    costCentre: '',
  };
}

export function ExpenseLineTable({
  value = [],
  onChange,
  accounts = [],
  readOnly = false,
}: ExpenseLineTableProps) {
  const [rows, setRows] = useState<ExpenseLineRow[]>(value.length > 0 ? value : [newRow()]);

  useEffect(() => {
    if (value.length > 0 && JSON.stringify(value) !== JSON.stringify(rows)) {
      startTransition(() => {
        setRows(value);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const fireChange = useCallback(
    (updated: ExpenseLineRow[]) => {
      setRows(updated);
      onChange?.(updated);
    },
    [onChange],
  );

  function addLine() {
    fireChange([...rows, newRow()]);
  }

  function removeLine(key: string) {
    fireChange(rows.filter((r) => r.key !== key));
  }

  function updateRow(key: string, patch: Partial<ExpenseLineRow>) {
    const updated = rows.map((r) => {
      if (r.key !== key) return r;
      const merged = { ...r, ...patch };
      merged.lineTotalPaise = computeLineTotal(merged.amountPaise, merged.gstRate);
      return merged;
    });
    fireChange(updated);
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (readOnly) return;
    function handler(e: KeyboardEvent) {
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        addLine();
      }
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        if (rows.length > 1) {
          fireChange(rows.slice(0, -1));
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, readOnly]);

  const accountOptions = accounts.map((a) => ({
    value: a._id,
    label: `${a.code} - ${a.name}`,
    code: a.code,
    name: a.name,
  }));

  const columns: ColumnsType<ExpenseLineRow> = [
    {
      title: 'Account',
      dataIndex: 'expenseAccountId',
      width: 220,
      render: (val, record) =>
        readOnly ? (
          <Text>
            {record.expenseAccountCode} - {record.expenseAccountName}
          </Text>
        ) : (
          <Select
            showSearch
            size="small"
            style={{ width: '100%' }}
            placeholder="Search expense account…"
            value={val || undefined}
            options={accountOptions}
            filterOption={(input, opt) =>
              String(opt?.label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            onChange={(v, opt: any) =>
              updateRow(record.key, {
                expenseAccountId: v,
                expenseAccountCode: opt.code ?? '',
                expenseAccountName: opt.name ?? '',
              })
            }
          />
        ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      width: 180,
      render: (val, record) =>
        readOnly ? (
          <Text>{val}</Text>
        ) : (
          <Input
            size="small"
            value={val}
            onChange={(e) => updateRow(record.key, { description: e.target.value })}
          />
        ),
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'amountPaise',
      width: 120,
      align: 'right',
      render: (val, record) =>
        readOnly ? (
          <Text>{(val / 100).toLocaleString('en-IN')}</Text>
        ) : (
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            min={0}
            precision={2}
            value={val / 100}
            onChange={(v) => updateRow(record.key, { amountPaise: Math.round((v ?? 0) * 100) })}
          />
        ),
    },
    {
      title: 'GST%',
      dataIndex: 'gstRate',
      width: 80,
      render: (val, record) =>
        readOnly ? (
          <Text>{val}%</Text>
        ) : (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={val}
            options={GST_RATES.map((r) => ({ value: r, label: `${r}%` }))}
            onChange={(v) => updateRow(record.key, { gstRate: v })}
          />
        ),
    },
    {
      title: 'ITC',
      dataIndex: 'itcEligibility',
      width: 120,
      render: (val, record) => {
        const opt = ITC_OPTIONS.find((o) => o.value === val);
        if (readOnly || record.serverItcOverridden) {
          return (
            <Tooltip
              title={
                record.serverItcOverridden
                  ? 'ITC eligibility was overridden by the server based on Section 17(5)'
                  : undefined
              }
            >
              <Tag color={opt?.color}>
                {opt?.label ?? val}
                {record.serverItcOverridden && (
                  <WarningOutlined style={{ marginLeft: 4, color: 'var(--cr-warning-500)' }} />
                )}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={val}
            options={ITC_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => updateRow(record.key, { itcEligibility: v as ItcEligibility })}
          />
        );
      },
    },
    {
      title: 'Line Total (₹)',
      dataIndex: 'lineTotalPaise',
      width: 120,
      align: 'right',
      render: (val) => (
        <Text strong>{(val / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
      ),
    },
    ...(!readOnly
      ? [
          {
            title: <span className="sr-only">Delete</span>,
            key: 'del',
            width: 40,
            render: (_: unknown, record: ExpenseLineRow) => (
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={rows.length === 1}
                onClick={() => removeLine(record.key)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <Table
        dataSource={rows}
        columns={columns}
        rowKey="key"
        pagination={false}
        size="small"
        style={{ marginBottom: 8 }}
      />
      {!readOnly && (
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={addLine}>
            Add Line{' '}
            <Text type="secondary" style={{ fontSize: 11 }}>
              (Alt+L)
            </Text>
          </Button>
          {rows.length > 1 && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => fireChange(rows.slice(0, -1))}
            >
              Delete Last{' '}
              <Text type="secondary" style={{ fontSize: 11 }}>
                (Alt+D)
              </Text>
            </Button>
          )}
        </Space>
      )}
    </div>
  );
}
