'use client';

import { useEffect, useState } from 'react';
import { Table, Tag, Typography, DatePicker, Space, Spin, Empty, Statistic, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  getBankStatement,
  type BankStatementRow,
} from '@/lib/actions/finance-bank-accounts.actions';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import type { Firm } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const SOURCE_TYPE_COLORS: Record<string, string> = {
  sale: 'blue',
  purchase: 'orange',
  expense: 'red',
  journal: 'default',
  contra: 'purple',
  pdc: 'gold',
  loan_emi: 'cyan',
  bounce: 'volcano',
  loan_disbursement: 'geekblue',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  expense: 'Expense',
  journal: 'JV',
  contra: 'Contra',
  pdc: 'PDC',
  loan_emi: 'EMI',
  bounce: 'Bounce',
  loan_disbursement: 'Loan',
};

function formatPaise(paise: number): string {
  if (!paise) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

interface BankStatementTableProps {
  bankAccountId: string;
  firmId: string;
}

export default function BankStatementTable({ bankAccountId, firmId }: BankStatementTableProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  // Default date range: current FY (April 1 to today)
  const now = dayjs();
  const fyStart = now.month() >= 3 ? now.year() : now.year() - 1;
  const defaultFrom = `${fyStart}-04-01`;
  const defaultTo = now.format('YYYY-MM-DD');

  const [rows, setRows] = useState<BankStatementRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const load = () => {
    if (!wsId || !firmId || !bankAccountId) return;
    setLoading(true);
    getBankStatement(wsId, firmId, bankAccountId, { fromDate, toDate })
      .then((res) => {
        setRows(res.rows ?? []);
        setOpeningBalance(res.openingBalancePaise ?? 0);
        setClosingBalance(res.closingBalancePaise ?? 0);
      })
      .catch(() => {
        setRows([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data (re)load when the workspace / firm / account / date range changes.
    load();
  }, [wsId, firmId, bankAccountId, fromDate, toDate]); // eslint-disable-line

  const columns: ColumnsType<BankStatementRow> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d) => dayjs(d).format('DD MMM YYYY'),
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 120,
    },
    {
      title: 'Type',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 90,
      render: (t) => (
        <Tag color={SOURCE_TYPE_COLORS[t] ?? 'default'}>{SOURCE_TYPE_LABELS[t] ?? t}</Tag>
      ),
    },
    {
      title: 'Particulars',
      dataIndex: 'particulars',
      key: 'particulars',
      ellipsis: true,
    },
    {
      title: 'Debit',
      dataIndex: 'debitPaise',
      key: 'debitPaise',
      align: 'right',
      width: 130,
      render: (p) =>
        p ? <Text type="danger">{formatPaise(p)}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Credit',
      dataIndex: 'creditPaise',
      key: 'creditPaise',
      align: 'right',
      width: 130,
      render: (p) =>
        p ? <Text type="success">{formatPaise(p)}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Balance',
      dataIndex: 'runningBalancePaise',
      key: 'runningBalancePaise',
      align: 'right',
      width: 140,
      render: (p) => (
        <Text strong style={{ color: p >= 0 ? 'var(--cr-success-500)' : 'var(--cr-danger-500)' }}>
          {formatPaise(Math.abs(p))} {p < 0 ? 'Dr' : 'Cr'}
        </Text>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <Space>
        <Text>Date Range:</Text>
        <RangePicker
          defaultValue={[dayjs(fromDate), dayjs(toDate)]}
          format="DD MMM YYYY"
          onChange={(dates) => {
            if (dates) {
              setFromDate(dates[0]!.format('YYYY-MM-DD'));
              setToDate(dates[1]!.format('YYYY-MM-DD'));
            }
          }}
        />
      </Space>

      {/* Opening / Closing balance summary */}
      <Row gutter={16}>
        <Col xs={12} sm={6}>
          <Statistic
            title="Opening Balance"
            value={openingBalance / 100}
            precision={2}
            prefix="₹"
            formatter={(v) => new Intl.NumberFormat('en-IN').format(Number(v))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="Closing Balance"
            value={closingBalance / 100}
            precision={2}
            prefix="₹"
            styles={{
              content: {
                color: closingBalance >= 0 ? 'var(--cr-success-500)' : 'var(--cr-danger-500)',
              },
            }}
            formatter={(v) => new Intl.NumberFormat('en-IN').format(Number(v))}
          />
        </Col>
      </Row>

      <Spin spinning={loading}>
        {rows.length === 0 && !loading ? (
          <Empty description="No transactions in this date range" />
        ) : (
          <Table
            rowKey={(r, i) => `${r.voucherNo}-${i}`}
            dataSource={rows}
            columns={columns}
            size="small"
            pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['50', '100'] }}
            scroll={{ x: 900 }}
          />
        )}
      </Spin>
    </div>
  );
}
