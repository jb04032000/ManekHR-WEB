'use client';
import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import DsTable from '@/components/ui/DsTable';
import type { ReceivablesSummary, AgingPartyRow } from '@/types';

interface Props {
  summary: ReceivablesSummary;
  agingRows: AgingPartyRow[];
}

export default function AgingBuckets({ summary, agingRows }: Props) {
  const fmt = (p: number) =>
    p === 0 ? '-' : `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const columns = [
    {
      title: 'Party',
      dataIndex: 'partyName',
      key: 'party',
      sorter: (a: AgingPartyRow, b: AgingPartyRow) => a.partyName.localeCompare(b.partyName),
    },
    {
      title: 'Current',
      dataIndex: 'current',
      key: 'current',
      align: 'right' as const,
      render: fmt,
    },
    {
      title: '1-30 days',
      dataIndex: 'bucket0_30',
      key: 'b030',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <Typography.Text style={{ color: 'var(--cr-warning-700)' }}>{fmt(v)}</Typography.Text>
        ) : (
          fmt(v)
        ),
    },
    {
      title: '31-60 days',
      dataIndex: 'bucket31_60',
      key: 'b3160',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <Typography.Text style={{ color: 'var(--cr-danger-700)' }}>{fmt(v)}</Typography.Text>
        ) : (
          fmt(v)
        ),
    },
    {
      title: '61-90 days',
      dataIndex: 'bucket61_90',
      key: 'b6190',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <Typography.Text style={{ color: 'var(--cr-danger-700)' }}>{fmt(v)}</Typography.Text>
        ) : (
          fmt(v)
        ),
    },
    {
      title: '90+ days',
      dataIndex: 'bucket90plus',
      key: 'b90plus',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <Typography.Text style={{ color: 'var(--cr-danger-700)' }} strong>
            {fmt(v)}
          </Typography.Text>
        ) : (
          fmt(v)
        ),
    },
    {
      title: 'Total Due',
      dataIndex: 'totalDue',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => <Typography.Text strong>{fmt(v)}</Typography.Text>,
      sorter: (a: AgingPartyRow, b: AgingPartyRow) => a.totalDue - b.totalDue,
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Outstanding"
              value={summary.totalOutstanding / 100}
              prefix="₹"
              precision={0}
              styles={{ content: { color: 'var(--cr-success-700)' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Overdue"
              value={summary.totalOverdue / 100}
              prefix="₹"
              precision={0}
              styles={{ content: { color: 'var(--cr-danger-700)' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Collected This Month"
              value={summary.collectedThisMonth / 100}
              prefix="₹"
              precision={0}
              styles={{ content: { color: 'var(--cr-info-700)' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Avg Collection Days" value="-" />
          </Card>
        </Col>
      </Row>

      <DsTable
        dataSource={agingRows}
        rowKey="partyId"
        columns={columns}
        pagination={{ pageSize: 50 }}
        scrollX={900}
        locale={{ emptyText: 'No outstanding receivables.' }}
        size="small"
      />
    </div>
  );
}
