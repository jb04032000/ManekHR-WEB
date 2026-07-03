'use client';
import React from 'react';
import { Tag, Typography } from 'antd';
import DsTable from '@/components/ui/DsTable';
import type { PartyLedgerRow } from '@/types';

interface Props {
  rows: PartyLedgerRow[];
}

export default function PartyLedgerTable({ rows }: Props) {
  const fmt = (p: number) =>
    `₹${Math.abs(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const columns = [
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'date',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
      sorter: (a: PartyLedgerRow, b: PartyLedgerRow) =>
        new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime(),
    },
    {
      title: 'Voucher #',
      dataIndex: 'sourceVoucherNumber',
      key: 'voucher',
    },
    {
      title: 'Type',
      dataIndex: 'entryType',
      key: 'type',
      render: (t: string) => <Tag>{t.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Narration',
      dataIndex: 'narration',
      key: 'narration',
      ellipsis: true,
    },
    {
      title: 'Dr (₹)',
      dataIndex: 'debit',
      key: 'debit',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmt(v) : '-'),
    },
    {
      title: 'Cr (₹)',
      dataIndex: 'credit',
      key: 'credit',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmt(v) : '-'),
    },
    {
      title: 'Balance (₹)',
      dataIndex: 'runningBalance',
      key: 'balance',
      align: 'right' as const,
      render: (bal: number) => {
        if (bal === 0) return <Typography.Text type="success">{fmt(0)}</Typography.Text>;
        if (bal < 0) return <Typography.Text type="warning">{fmt(bal)} (Cr)</Typography.Text>;
        return <Typography.Text strong>{fmt(bal)}</Typography.Text>;
      },
    },
  ];

  return (
    <DsTable
      dataSource={rows}
      rowKey={(r: PartyLedgerRow, i?: number) => `${r.sourceVoucherNumber}-${i ?? 0}`}
      columns={columns}
      pagination={{ pageSize: 50 }}
      scrollX={900}
      sticky
      locale={{ emptyText: 'No ledger entries found for this party.' }}
      size="small"
    />
  );
}
