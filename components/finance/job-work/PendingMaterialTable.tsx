'use client';

import { useState } from 'react';
import { Table, Tag, Tooltip, Drawer, Progress, Button } from 'antd';
import { WarningOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getJwLot } from '@/lib/actions/finance/job-work.actions';
import type { JobWorkLot } from '@/types';
import dayjs from 'dayjs';

interface Props {
  wsId: string;
  firmId: string;
  lots: JobWorkLot[];
  onRowClick?: (lot: JobWorkLot) => void;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'var(--cr-warning-bg)', color: 'var(--cr-warning)' },
  partial: { bg: 'var(--cr-orange-bg)', color: 'var(--cr-orange)' },
  closed: { bg: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' },
  deemed_supply: { bg: 'var(--cr-error-bg)', color: 'var(--cr-error)' },
};

function daysRemaining(dueReturnDate: string): number {
  return dayjs(dueReturnDate).diff(dayjs().startOf('day'), 'day');
}

export default function PendingMaterialTable({ wsId, firmId, lots, onRowClick }: Props) {
  const [drawerLot, setDrawerLot] = useState<JobWorkLot | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<JobWorkLot | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  function openDrawer(lot: JobWorkLot) {
    setDrawerLot(lot);
    setDrawerDetail(null);
    setDrawerLoading(true);
    getJwLot(wsId, firmId, lot._id)
      .then(setDrawerDetail)
      .catch(() => setDrawerDetail(lot))
      .finally(() => setDrawerLoading(false));
  }

  function rowClassName(lot: JobWorkLot): string {
    const days = daysRemaining(lot.dueReturnDate);
    if (days <= 0 || lot.status === 'deemed_supply') return 'jw-row-danger';
    if (days <= 30) return 'jw-row-warning';
    return '';
  }

  const columns: ColumnsType<JobWorkLot> = [
    {
      title: 'Lot No',
      dataIndex: 'lotNo',
      width: 160,
      render: (v: string, row: JobWorkLot) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontWeight: 600, fontSize: 14 }}
          onClick={() => openDrawer(row)}
        >
          {v}
        </Button>
      ),
    },
    {
      title: 'Principal',
      dataIndex: 'principalPartyId',
      render: (v: unknown) => {
        const p = v as { name?: string; gstin?: string } | string;
        if (typeof p === 'object' && p !== null) {
          return (
            <div>
              <div style={{ fontSize: 14 }}>{p.name}</div>
              {p.gstin && <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>{p.gstin}</div>}
            </div>
          );
        }
        return <span style={{ fontSize: 14, color: 'var(--cr-text-3)' }}>{String(p)}</span>;
      },
    },
    {
      title: 'Item Description',
      dataIndex: 'itemDescription',
      render: (v: string) => <span style={{ fontSize: 14 }}>{v}</span>,
    },
    {
      title: 'Qty Remaining',
      dataIndex: 'qtyRemaining',
      width: 120,
      align: 'right',
      render: (v: number, row: JobWorkLot) => (
        <span style={{ fontSize: 14 }}>
          {v} {row.unit}
        </span>
      ),
    },
    {
      title: 'Inward Date',
      dataIndex: 'inwardDate',
      width: 120,
      render: (v: string) => <span style={{ fontSize: 14 }}>{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Due Return Date',
      dataIndex: 'dueReturnDate',
      width: 130,
      render: (v: string) => {
        const isPast = dayjs(v).isBefore(dayjs().startOf('day'));
        return (
          <span style={{ fontSize: 14, color: isPast ? 'var(--cr-error)' : undefined }}>
            {dayjs(v).format('DD MMM YYYY')}
          </span>
        );
      },
    },
    {
      title: 'Days Remaining',
      dataIndex: 'dueReturnDate',
      width: 130,
      render: (v: string, row: JobWorkLot) => {
        const days = daysRemaining(v);
        if (days <= 0 || row.status === 'deemed_supply') {
          return (
            <span
              style={{
                color: 'var(--cr-error)',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ExclamationCircleOutlined />
              {days <= 0 ? 'Overdue' : `${days}d`}
            </span>
          );
        }
        if (days <= 7) {
          return (
            <span
              style={{
                color: 'var(--cr-warning)',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <WarningOutlined />
              {days} days - urgent
            </span>
          );
        }
        if (days <= 30) {
          return (
            <span
              style={{
                color: 'var(--cr-warning)',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <WarningOutlined />
              {days} days left
            </span>
          );
        }
        return <span style={{ fontSize: 14 }}>{days} days</span>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (v: string, row: JobWorkLot) => {
        const days = daysRemaining(row.dueReturnDate);
        const isDeemed = v === 'deemed_supply' || days <= 0;
        if (isDeemed) {
          return (
            <Tooltip
              title="Section 143 CGST: Material not returned within 1 year from inward date. This is now treated as a taxable deemed supply. Contact your CA immediately."
              mouseEnterDelay={0.3}
            >
              <Tag
                style={{
                  background: 'var(--cr-error-bg)',
                  color: 'var(--cr-error)',
                  border: 'none',
                  cursor: 'help',
                }}
              >
                DEEMED SUPPLY
              </Tag>
            </Tooltip>
          );
        }
        const c = STATUS_COLOR[v] ?? { bg: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' };
        return (
          <Tag style={{ background: c.bg, color: c.color, border: 'none' }}>{v?.toUpperCase()}</Tag>
        );
      },
    },
  ];

  const displayLot = drawerDetail ?? drawerLot;
  const inwardPct = displayLot
    ? Math.round((displayLot.qtyReturnedGood / displayLot.qtyInward) * 100)
    : 0;
  const wastePct = displayLot ? Math.round((displayLot.qtyWasted / displayLot.qtyInward) * 100) : 0;

  return (
    <>
      <style>{`
        .jw-row-warning td { background: var(--cr-warning-bg) !important; }
        .jw-row-danger td { background: var(--cr-error-bg) !important; }
      `}</style>

      <Table<JobWorkLot>
        dataSource={lots}
        columns={columns}
        rowKey="_id"
        size="middle"
        rowClassName={rowClassName}
        pagination={{ pageSize: 25, pageSizeOptions: ['25', '50'] }}
        onRow={(row) => ({
          style: { cursor: onRowClick ? 'pointer' : undefined },
          onClick: () => {
            if (onRowClick) onRowClick(row);
            openDrawer(row);
          },
        })}
        expandable={{
          expandedRowRender: (row) => (
            <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--cr-text-3)' }}>
              <span>Challan: </span>
              <a
                href={`/dashboard/finance/firms/${row.firmId}/job-work/inward-challans/${row.inwardChallanId}`}
                style={{ color: 'var(--cr-primary)' }}
              >
                {row.inwardChallanId}
              </a>
              <span style={{ marginLeft: 16 }}>
                Inward: {row.qtyInward} {row.unit}
              </span>
              <span style={{ marginLeft: 16 }}>
                Returned: {row.qtyReturnedGood} {row.unit}
              </span>
              <span style={{ marginLeft: 16 }}>
                Wasted: {row.qtyWasted} {row.unit}
              </span>
            </div>
          ),
        }}
      />

      {/* Lot detail drawer */}
      <Drawer
        open={!!drawerLot}
        onClose={() => setDrawerLot(null)}
        width={480}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              {drawerLot?.lotNo}
            </span>
            {drawerLot && (
              <Tag
                style={{
                  background: STATUS_COLOR[drawerLot.status]?.bg ?? 'var(--cr-surface-2)',
                  color: STATUS_COLOR[drawerLot.status]?.color ?? 'var(--cr-text-3)',
                  border: 'none',
                }}
              >
                {drawerLot.status?.toUpperCase()}
              </Tag>
            )}
          </div>
        }
        loading={drawerLoading}
      >
        {displayLot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Principal */}
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--cr-text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                Principal
              </div>
              <div style={{ fontSize: 14 }}>
                {typeof displayLot.principalPartyId === 'object'
                  ? ((displayLot.principalPartyId as { name?: string }).name ??
                    String(displayLot.principalPartyId))
                  : String(displayLot.principalPartyId)}
              </div>
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize: 13, color: 'var(--cr-text-3)', marginBottom: 4 }}>
                Item Description
              </div>
              <div style={{ fontSize: 14 }}>{displayLot.itemDescription}</div>
            </div>

            {/* Qty progress bar */}
            <div>
              <div style={{ fontSize: 13, color: 'var(--cr-text-3)', marginBottom: 8 }}>
                Qty Lifecycle ({displayLot.qtyInward} {displayLot.unit} inward)
              </div>
              <div style={{ marginBottom: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: 'var(--cr-success)' }}>
                    Returned: {displayLot.qtyReturnedGood}
                  </span>
                  <span style={{ color: 'var(--cr-error)' }}>Wasted: {displayLot.qtyWasted}</span>
                  <span>Remaining: {displayLot.qtyRemaining}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    height: 16,
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'var(--cr-border)',
                  }}
                >
                  <div
                    style={{
                      width: `${inwardPct}%`,
                      background: 'var(--cr-success)',
                      transition: 'width 0.3s',
                    }}
                  />
                  <div
                    style={{
                      width: `${wastePct}%`,
                      background: 'var(--cr-error)',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div style={{ fontSize: 13, color: 'var(--cr-text-3)', marginBottom: 8 }}>
                Timeline
              </div>
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>Inward: {dayjs(displayLot.inwardDate).format('DD MMM YYYY')}</div>
                <div
                  style={{
                    color:
                      daysRemaining(displayLot.dueReturnDate) <= 0 ? 'var(--cr-error)' : undefined,
                  }}
                >
                  Due Return: {dayjs(displayLot.dueReturnDate).format('DD MMM YYYY')} (
                  {daysRemaining(displayLot.dueReturnDate)} days remaining)
                </div>
              </div>
            </div>

            {/* Qty progress component */}
            <Progress
              percent={inwardPct + wastePct}
              success={{ percent: inwardPct }}
              trailColor="var(--cr-border)"
              status={displayLot.status === 'deemed_supply' ? 'exception' : undefined}
              format={() => `${displayLot.qtyRemaining} ${displayLot.unit} left`}
            />
          </div>
        )}
      </Drawer>
    </>
  );
}
