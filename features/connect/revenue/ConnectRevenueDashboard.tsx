'use client';

import { Card, Table, Tag, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { StatTile } from '@/components/ui/StatTile';
import type { ConnectRevenueSummary, ConnectPlanRevenueRow } from './revenue.types';

interface Props {
  revenue: ConnectRevenueSummary | null;
  /** Boost / ad credits spent (from the ads revenue endpoint). Credits, not rupees. */
  boostCreditsSpent: number;
}

/** Paise -> "₹4,49,500" Indian-format. */
function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function ConnectRevenueDashboard({ revenue, boostCreditsSpent }: Props) {
  const sub = revenue?.subscription ?? {
    grossPaise: 0,
    refundedPaise: 0,
    netPaise: 0,
    payments: 0,
    byPlan: [],
  };

  const columns: ColumnsType<ConnectPlanRevenueRow> = [
    {
      title: 'Plan',
      dataIndex: 'planName',
      key: 'planName',
      render: (name: string, r) => (
        <span>
          {name} <Tag className="ml-1 capitalize">{r.tier}</Tag>
        </span>
      ),
    },
    {
      title: 'Gross',
      dataIndex: 'grossPaise',
      key: 'grossPaise',
      align: 'right',
      render: (v: number) => rupees(v),
    },
    {
      title: 'Refunds',
      dataIndex: 'refundedPaise',
      key: 'refundedPaise',
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <span className="text-danger">-{rupees(v)}</span>
        ) : (
          <span className="text-subtle">-</span>
        ),
    },
    {
      title: 'Net',
      dataIndex: 'netPaise',
      key: 'netPaise',
      align: 'right',
      render: (v: number) => <span className="font-semibold">{rupees(v)}</span>,
    },
    {
      title: 'Payments',
      dataIndex: 'payments',
      key: 'payments',
      align: 'right',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 font-display text-[22px] font-bold text-heading">Connect revenue</h1>
        <p className="m-0 mt-1.5 text-sm text-subtle">
          Subscription revenue from Connect plans and total boost spend. Lead revenue does not apply
          (leads are free).
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gap: 'var(--cr-space-md)',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        <StatTile
          label="Net subscription revenue"
          value={rupees(sub.netPaise)}
          hint="Captured, net of refunds"
        />
        <StatTile label="Gross subscription" value={rupees(sub.grossPaise)} hint="Before refunds" />
        <StatTile label="Refunds" value={rupees(sub.refundedPaise)} hint="Connect / bundle plans" />
        <StatTile
          label="Paid payments"
          value={sub.payments.toLocaleString('en-IN')}
          hint="Captured charges"
        />
        <StatTile
          label="Boost spend"
          value={boostCreditsSpent.toLocaleString('en-IN')}
          valueSuffix=" credits"
          hint="Credits spent on boosts"
        />
      </div>

      <Card title={<span className="font-display font-bold">Subscription revenue by plan</span>}>
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message="Boost spend is counted in credits (some credits are free promotional grants), so it is shown separately from rupee subscription revenue, not added to it."
        />
        <Table
          rowKey="planId"
          size="middle"
          columns={columns}
          dataSource={sub.byPlan}
          pagination={false}
          locale={{ emptyText: 'No Connect subscription revenue yet.' }}
        />
      </Card>
    </div>
  );
}
