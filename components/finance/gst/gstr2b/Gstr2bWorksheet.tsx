'use client';

import { useMemo, useState } from 'react';
import { Table, Tabs, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { Gstr2bReconResult, Gstr2bReconRow, Gstr2bReconStatus } from './types';

/**
 * Gstr2bWorksheet - renders the 4-bucket GSTR-2B reconciliation result: summary
 * tiles + a tabbed table (All / Matched / Partial / Missing in books / Missing in 2B).
 * Cross-link: fed by the gstr2b page via reconcileGstr2bData; pure display, no fetch.
 * Watch: money is paise -> rupees here only for display; deltas are 2B minus books.
 */

function inr(paise: number): string {
  return (
    '₹' +
    (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

const tax = (r?: { igstPaise: number; cgstPaise: number; sgstPaise: number }): number =>
  r ? r.igstPaise + r.cgstPaise + r.sgstPaise : 0;

interface FlatRow {
  key: string;
  status: Gstr2bReconStatus;
  supplierGstin: string;
  supplierName: string;
  invNo: string;
  date: string;
  voucherNumber: string;
  twoBTaxable: number | null;
  booksTaxable: number | null;
  twoBTax: number | null;
  booksTax: number | null;
  taxDelta: number | null;
}

function flatten(rows: Gstr2bReconRow[]): FlatRow[] {
  return rows.map((r, i) => ({
    key: String(i),
    status: r.status,
    supplierGstin: r.twoB?.gstin || r.bill?.gstin || '-',
    supplierName: r.bill?.partyName || '-',
    invNo: r.twoB?.invNo || r.bill?.vendorBillNumber || '-',
    date: r.twoB?.invDate || r.bill?.vendorBillDate || '-',
    voucherNumber: r.bill?.voucherNumber || '-',
    twoBTaxable: r.twoB ? r.twoB.taxablePaise : null,
    booksTaxable: r.bill ? r.bill.taxablePaise : null,
    twoBTax: r.twoB ? tax(r.twoB) : null,
    booksTax: r.bill ? tax(r.bill) : null,
    taxDelta: r.deltas ? r.deltas.taxPaise : null,
  }));
}

export default function Gstr2bWorksheet({ result }: { result: Gstr2bReconResult }) {
  const t = useTranslations('finance.gstr2b');
  const [activeTab, setActiveTab] = useState<string>('all');

  const all = useMemo(() => flatten(result.rows), [result.rows]);

  const statusMeta: Record<Gstr2bReconStatus, { color: string; label: string }> = {
    matched: { color: 'green', label: t('status.matched') },
    partial: { color: 'gold', label: t('status.partial') },
    missing_in_books: { color: 'red', label: t('status.missingInBooks') },
    missing_in_2b: { color: 'blue', label: t('status.missingIn2b') },
  };

  const tiles: { key: string; label: string; value: number; tone: string }[] = [
    {
      key: 'matched',
      label: t('summary.matched'),
      value: result.summary.matched,
      tone: 'var(--cr-success, var(--cr-success-700))',
    },
    {
      key: 'partial',
      label: t('summary.partial'),
      value: result.summary.partial,
      tone: 'var(--cr-warning, var(--cr-warning-700))',
    },
    {
      key: 'missingInBooks',
      label: t('summary.missingInBooks'),
      value: result.summary.missingInBooks,
      tone: 'var(--cr-error, var(--cr-danger-700))',
    },
    {
      key: 'missingIn2b',
      label: t('summary.missingIn2b'),
      value: result.summary.missingIn2b,
      tone: 'var(--cr-info, var(--cr-primary-700))',
    },
  ];

  const columns: ColumnsType<FlatRow> = [
    {
      title: t('col.supplier'),
      dataIndex: 'supplierGstin',
      key: 'supplier',
      render: (_v, row) => (
        <div className="flex flex-col">
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
            {row.supplierGstin}
          </span>
          {row.supplierName !== '-' && (
            <span style={{ color: 'var(--cr-text-3)', fontSize: 12 }}>{row.supplierName}</span>
          )}
        </div>
      ),
    },
    {
      title: t('col.invoice'),
      dataIndex: 'invNo',
      key: 'invoice',
      render: (_v, row) => (
        <div className="flex flex-col">
          <span>{row.invNo}</span>
          <span style={{ color: 'var(--cr-text-3)', fontSize: 12 }}>{row.date}</span>
        </div>
      ),
    },
    {
      title: t('col.voucher'),
      dataIndex: 'voucherNumber',
      key: 'voucher',
      render: (v: string) => (
        <span style={{ color: v === '-' ? 'var(--cr-text-4)' : undefined }}>{v}</span>
      ),
    },
    {
      title: t('col.taxable2b'),
      dataIndex: 'twoBTaxable',
      key: 'twoBTaxable',
      align: 'right',
      render: (v: number | null) => (v === null ? '-' : inr(v)),
    },
    {
      title: t('col.taxableBooks'),
      dataIndex: 'booksTaxable',
      key: 'booksTaxable',
      align: 'right',
      render: (v: number | null) => (v === null ? '-' : inr(v)),
    },
    {
      title: t('col.taxDelta'),
      dataIndex: 'taxDelta',
      key: 'taxDelta',
      align: 'right',
      render: (v: number | null, row) => {
        if (v === null) {
          // One-sided row: show the side's full tax as the gap.
          const gap = row.twoBTax ?? row.booksTax ?? 0;
          return <span style={{ color: 'var(--cr-text-4)' }}>{inr(gap)}</span>;
        }
        if (v === 0) return <span style={{ color: 'var(--cr-text-4)' }}>{inr(0)}</span>;
        return (
          <span style={{ color: 'var(--cr-warning, var(--cr-warning-700))', fontWeight: 600 }}>
            {v > 0 ? '+' : ''}
            {inr(v)}
          </span>
        );
      },
    },
    {
      title: t('col.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: Gstr2bReconStatus) => (
        <Tag color={statusMeta[s].color}>{statusMeta[s].label}</Tag>
      ),
    },
  ];

  const filtered = (status?: Gstr2bReconStatus) =>
    status ? all.filter((r) => r.status === status) : all;

  const tabItems = [
    { key: 'all', label: `${t('tabs.all')} (${all.length})` },
    { key: 'matched', label: `${statusMeta.matched.label} (${result.summary.matched})` },
    { key: 'partial', label: `${statusMeta.partial.label} (${result.summary.partial})` },
    {
      key: 'missing_in_books',
      label: `${statusMeta.missing_in_books.label} (${result.summary.missingInBooks})`,
    },
    {
      key: 'missing_in_2b',
      label: `${statusMeta.missing_in_2b.label} (${result.summary.missingIn2b})`,
    },
  ];

  const tableData = activeTab === 'all' ? filtered() : filtered(activeTab as Gstr2bReconStatus);

  return (
    <div>
      {/* Summary tiles */}
      <div className="mb-lg grid grid-cols-2 gap-md md:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="rounded-lg p-md"
            style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
          >
            <div
              className="mb-xs text-[12px] tracking-wide uppercase"
              style={{ color: 'var(--cr-text-3)' }}
            >
              {tile.label}
            </div>
            <div
              className="text-[24px] font-bold"
              style={{ fontFamily: 'var(--font-display)', color: tile.tone }}
            >
              {tile.value}
            </div>
          </div>
        ))}
        <div
          className="rounded-lg p-md"
          style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
        >
          <div
            className="mb-xs flex items-center gap-xs text-[12px] tracking-wide uppercase"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {t('summary.itcAtRisk')}
            <Tooltip title={t('summary.itcAtRiskHint')}>
              <span style={{ cursor: 'help', color: 'var(--cr-text-4)' }}>{'ⓘ'}</span>
            </Tooltip>
          </div>
          <div
            className="text-[24px] font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--cr-text)' }}
          >
            {inr(result.summary.itcAtRiskPaise)}
          </div>
        </div>
      </div>

      <div
        className="rounded-lg p-xs"
        style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="px-sm pt-xs"
        />
        <Table<FlatRow>
          columns={columns}
          dataSource={tableData}
          size="middle"
          pagination={{ pageSize: 25, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: t('emptyBucket') }}
        />
      </div>
    </div>
  );
}
