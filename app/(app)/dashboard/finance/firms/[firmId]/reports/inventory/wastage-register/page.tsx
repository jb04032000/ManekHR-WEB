'use client';
// Wastage Register report (reason-wise wastage with value). i18n via finance.reports
// (shared common.* + inventory.wastageRegister.*). Cross-link: header/filters from
// ReportToolbar + ReportFilterBar. Watch: reason values are API data; "Unknown" fallback is translated.
import { useState } from 'react';
import { Alert, Skeleton, Table, Tag, Statistic } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { WastageRegisterRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function WastageRegisterPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<WastageRegisterRow[]>([]);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.wastageRegister(ws._id, firmId, dateFrom, dateTo);
      setRows(data.rows);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const totalQty = rows.reduce((s, r) => s + r.qtyWasted, 0);
  const totalValue = rows.reduce((s, r) => s + r.costPaise, 0);

  // Group by reason for summary tiles
  const byReason = rows.reduce<Record<string, { qty: number; value: number }>>((acc, r) => {
    const k = r.reason || 'Unknown';
    if (!acc[k]) acc[k] = { qty: 0, value: 0 };
    acc[k].qty += r.qtyWasted;
    acc[k].value += r.costPaise;
    return acc;
  }, {});

  const columns = [
    {
      title: t('common.date'),
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    { title: t('common.voucherNo'), dataIndex: 'voucherNumber', key: 'voucherNo' },
    { title: t('common.itemName'), dataIndex: 'itemName', key: 'itemName' },
    {
      title: t('inventory.wastageRegister.qtyWasted'),
      dataIndex: 'qtyWasted',
      key: 'qty',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('inventory.wastageRegister.reason'),
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => (
        <Tag color="orange">{v || t('inventory.wastageRegister.unknown')}</Tag>
      ),
    },
    {
      title: t('inventory.wastageRegister.value'),
      dataIndex: 'costPaise',
      key: 'value',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
  ];

  const tableSummary = () => (
    <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-surface-2)' }}>
      <Table.Summary.Cell index={0} colSpan={3}>
        {t('common.total')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={3} align="right">
        {totalQty.toLocaleString('en-IN')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4} />
      <Table.Summary.Cell index={5} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalValue)}</span>
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('inventory.wastageRegister.title')}
        category={t('inventory.wastageRegister.category')}
        categoryPath="inventory"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && (
          <>
            <ReportTable<WastageRegisterRow>
              dataSource={rows}
              columns={columns}
              rowKey={(_, i) => String(i)}
              summary={tableSummary}
            />
            {/* Reason summary tiles */}
            {Object.keys(byReason).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--cr-text-3)',
                    marginBottom: 12,
                  }}
                >
                  {t('inventory.wastageRegister.byReason')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {Object.entries(byReason).map(([reason, data]) => (
                    <div
                      key={reason}
                      style={{
                        padding: '12px 16px',
                        background: 'var(--cr-surface)',
                        border: '1px solid var(--cr-border)',
                        borderRadius: 'var(--cr-radius-md)',
                        minWidth: 160,
                      }}
                    >
                      <Tag color="orange" style={{ marginBottom: 8 }}>
                        {reason}
                      </Tag>
                      <Statistic
                        title={t('inventory.wastageRegister.tileQty')}
                        value={data.qty.toLocaleString('en-IN')}
                        styles={{ content: { fontSize: 18 } }}
                      />
                      <Statistic
                        title={t('inventory.wastageRegister.tileValue')}
                        value={fmtPaise(data.value)}
                        styles={{ content: { fontSize: 14 } }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('inventory.wastageRegister.error')} />}
      </div>
    </div>
  );
}
