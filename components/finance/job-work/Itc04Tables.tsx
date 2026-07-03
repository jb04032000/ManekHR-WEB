'use client';

import { Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Itc04Report, Itc04ReportRow } from '@/types';
import dayjs from 'dayjs';

interface Props {
  report: Itc04Report;
}

// ── Table 4A columns ─────────────────────────────────────────────────────────
const table4aColumns: ColumnsType<Itc04ReportRow> = [
  {
    title: 'Sl.',
    dataIndex: 'sno',
    width: 50,
    render: (v: number) => <span style={{ fontSize: 14 }}>{v}</span>,
  },
  {
    title: 'Challan No.',
    dataIndex: 'challanNo',
    render: (v: string) => (
      <span style={{ fontSize: 14, color: 'var(--cr-primary)', fontWeight: 600 }}>{v}</span>
    ),
  },
  {
    title: 'Date',
    dataIndex: 'challanDate',
    width: 120,
    render: (v: string) => <span style={{ fontSize: 14 }}>{dayjs(v).format('DD MMM YYYY')}</span>,
  },
  {
    title: 'Principal GSTIN',
    dataIndex: 'principalGstin',
    width: 160,
    render: (v: string) => (
      <span style={{ fontSize: 13, color: v ? undefined : 'var(--cr-text-3)' }}>{v ?? '-'}</span>
    ),
  },
  {
    title: 'Principal Name',
    dataIndex: 'principalName',
    render: (v: string) => <span style={{ fontSize: 14, fontWeight: 600 }}>{v ?? '-'}</span>,
  },
  {
    title: 'Description',
    dataIndex: 'description',
    render: (v: string) => <span style={{ fontSize: 14 }}>{v}</span>,
  },
  {
    title: 'UQC',
    dataIndex: 'uqc',
    width: 70,
    render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
  },
  {
    title: 'Qty Sent',
    dataIndex: 'qtySent',
    width: 90,
    align: 'right',
    render: (v: number) => <span style={{ fontSize: 14 }}>{v ?? 0}</span>,
  },
  {
    title: 'Value (₹)',
    dataIndex: 'valuePaise',
    width: 120,
    align: 'right',
    render: (v: number) => <span style={{ fontSize: 14 }}>₹{((v ?? 0) / 100).toFixed(2)}</span>,
  },
];

// ── Table 4B columns ─────────────────────────────────────────────────────────
function makeTable4bColumns(quarter: string, fy: string): ColumnsType<Itc04ReportRow> {
  return [
    {
      title: 'Sl.',
      dataIndex: 'sno',
      width: 50,
      render: (v: number) => <span style={{ fontSize: 14 }}>{v}</span>,
    },
    {
      title: 'Challan No.',
      dataIndex: 'challanNo',
      render: (v: string) => (
        <span style={{ fontSize: 14, color: 'var(--cr-primary)', fontWeight: 600 }}>{v}</span>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'challanDate',
      width: 120,
      render: (v: string) => <span style={{ fontSize: 14 }}>{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Lot No.',
      dataIndex: 'lotNo',
      width: 160,
      render: (v: string) => <span style={{ fontSize: 14 }}>{v ?? '-'}</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (v: string) => <span style={{ fontSize: 14 }}>{v}</span>,
    },
    {
      title: 'UQC',
      dataIndex: 'uqc',
      width: 70,
      render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'Qty Received',
      dataIndex: 'qtyReceived',
      width: 110,
      align: 'right',
      render: (v: number) => <span style={{ fontSize: 14 }}>{v ?? 0}</span>,
    },
    {
      title: 'Qty Pending',
      dataIndex: 'qtyPending',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontSize: 14, color: (v ?? 0) > 0 ? 'var(--cr-warning)' : undefined }}>
          {v ?? 0}
        </span>
      ),
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      width: 180,
      render: (v: string, row: Itc04ReportRow) => {
        // Check if deemed supply from remarks or derived from row data
        const isDeemed = v === 'DEEMED_SUPPLY' || (v ?? '').includes('deemed');
        if (isDeemed) {
          return (
            <Tooltip
              title="Section 143 CGST: Input not returned within 1 year - treated as deemed supply"
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
        return <span style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>{v ?? '-'}</span>;
      },
    },
  ];
}

export default function Itc04Tables({ report }: Props) {
  const { table4a, table4b, period } = report;
  const quarterLabel = period?.quarter ?? 'Q?';
  const fyLabel = period?.fy ?? '';
  const table4bColumns = makeTable4bColumns(quarterLabel, fyLabel);

  return (
    <div>
      {/* ── Table 4A ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Tag
            style={{
              background: 'var(--cr-warning-50)',
              color: 'var(--cr-warning-700)',
              border: '1px solid var(--cr-warning-50)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Table 4A
          </Tag>
          <span style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            Table 4A: Material Sent to Job Worker
          </span>
        </div>

        {table4a.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 8,
              textAlign: 'center',
              color: 'var(--cr-text-3)',
              fontSize: 14,
            }}
          >
            No inward challans posted in {quarterLabel} {fyLabel}
          </div>
        ) : (
          <Table<Itc04ReportRow>
            dataSource={table4a}
            columns={table4aColumns}
            rowKey={(r, i) => `4a-${i}`}
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
          />
        )}
      </div>

      {/* Separator */}
      <hr
        style={{ border: 'none', borderTop: '1px solid var(--cr-border)', margin: '0 0 24px 0' }}
      />

      {/* ── Table 4B ─────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Tag
            style={{
              background: 'var(--cr-info-50)',
              color: 'var(--cr-info-700)',
              border: '1px solid var(--cr-info-50)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Table 4B
          </Tag>
          <span style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            Table 4B: Material Received Back
          </span>
        </div>

        {table4b.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 8,
              textAlign: 'center',
              color: 'var(--cr-text-3)',
              fontSize: 14,
            }}
          >
            No outward challans posted in {quarterLabel} {fyLabel}
          </div>
        ) : (
          <Table<Itc04ReportRow>
            dataSource={table4b}
            columns={table4bColumns}
            rowKey={(r, i) => `4b-${i}`}
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
            rowClassName={(row) => {
              const isDeemed =
                row.remarks === 'DEEMED_SUPPLY' || (row.remarks ?? '').includes('deemed');
              return isDeemed ? 'jw-itc04-deemed-row' : '';
            }}
          />
        )}
      </div>

      <style>{`
        .jw-itc04-deemed-row td { background: var(--cr-error-bg) !important; }
      `}</style>
    </div>
  );
}
