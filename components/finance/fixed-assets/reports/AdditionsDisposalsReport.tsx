'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Typography, Skeleton, Alert, Tabs, Table } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { additionsDisposalsReport } from '@/lib/actions/finance-fixed-assets.actions';
import DsTable from '@/components/ui/DsTable';
import DsCard from '@/components/ui/DsCard';
import { ExportButton } from '@/components/export/ExportButton';
import type { ExportField } from '@/lib/exportFields/types';
import { formatCurrencyFull } from '@/lib/utils';

const { Title, Text } = Typography;

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

interface AdditionRow {
  assetCode: string;
  name: string;
  categoryName?: string;
  purchaseDate: string;
  costPaise: number;
  partyName?: string;
  purchaseBillNumber?: string;
}

interface DisposalRow {
  assetCode: string;
  name: string;
  disposalDate: string;
  disposalProceedsPaise: number;
  nbvAtDisposalPaise: number;
  gainLossPaise: number;
  status: string;
}

interface AdditionsDisposalsResult {
  fromDate: string;
  toDate: string;
  additions: AdditionRow[];
  disposals: DisposalRow[];
  totals: {
    additionsCount: number;
    additionsCostPaise: number;
    disposalsCount: number;
    disposalsProceedsPaise: number;
    disposalsGainLossPaise: number;
  };
}

// ─── Export fields ────────────────────────────────────────────────────────────

const ADDITION_FIELDS: ExportField<AdditionRow>[] = [
  { key: 'assetCode', label: 'Asset Code', defaultEnabled: true, getValue: (r) => r.assetCode },
  { key: 'name', label: 'Name', defaultEnabled: true, getValue: (r) => r.name },
  {
    key: 'categoryName',
    label: 'Category',
    defaultEnabled: true,
    getValue: (r) => r.categoryName ?? '-',
  },
  {
    key: 'purchaseDate',
    label: 'Purchase Date',
    defaultEnabled: true,
    getValue: (r) => (r.purchaseDate ? new Date(r.purchaseDate).toLocaleDateString('en-IN') : '-'),
  },
  {
    key: 'costPaise',
    label: 'Cost (₹)',
    defaultEnabled: true,
    getValue: (r) => r.costPaise / 100,
    pdfValue: (r) => formatPaise(r.costPaise),
  },
  {
    key: 'partyName',
    label: 'Vendor / Party',
    defaultEnabled: true,
    getValue: (r) => r.partyName ?? '-',
  },
  {
    key: 'purchaseBillNumber',
    label: 'Purchase Bill',
    defaultEnabled: false,
    getValue: (r) => r.purchaseBillNumber ?? '-',
  },
];

const DISPOSAL_FIELDS: ExportField<DisposalRow>[] = [
  { key: 'assetCode', label: 'Asset Code', defaultEnabled: true, getValue: (r) => r.assetCode },
  { key: 'name', label: 'Name', defaultEnabled: true, getValue: (r) => r.name },
  {
    key: 'disposalDate',
    label: 'Disposal Date',
    defaultEnabled: true,
    getValue: (r) => (r.disposalDate ? new Date(r.disposalDate).toLocaleDateString('en-IN') : '-'),
  },
  {
    key: 'disposalProceedsPaise',
    label: 'Proceeds (₹)',
    defaultEnabled: true,
    getValue: (r) => r.disposalProceedsPaise / 100,
    pdfValue: (r) => formatPaise(r.disposalProceedsPaise),
  },
  {
    key: 'nbvAtDisposalPaise',
    label: 'NBV at Disposal (₹)',
    defaultEnabled: true,
    getValue: (r) => r.nbvAtDisposalPaise / 100,
    pdfValue: (r) => formatPaise(r.nbvAtDisposalPaise),
  },
  {
    key: 'gainLossPaise',
    label: 'Gain / Loss (₹)',
    defaultEnabled: true,
    getValue: (r) => r.gainLossPaise / 100,
    pdfValue: (r) => formatPaise(r.gainLossPaise),
  },
  {
    key: 'status',
    label: 'Disposal Type',
    defaultEnabled: true,
    getValue: (r) => (r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '-'),
  },
];

interface AdditionsDisposalsReportProps {
  firmId: string;
  fromDate: string;
  toDate: string;
}

export default function AdditionsDisposalsReport({
  firmId,
  fromDate,
  toDate,
}: AdditionsDisposalsReportProps) {
  const t = useTranslations('finance.fixedAssets.reports.additionsDisposals');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const ADDITION_COLS = [
    { title: t('additionCols.assetCode'), dataIndex: 'assetCode', key: 'assetCode', width: 120 },
    { title: t('additionCols.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('additionCols.category'),
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 160,
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('additionCols.purchaseDate'),
      dataIndex: 'purchaseDate',
      key: 'purchaseDate',
      width: 130,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : '-'),
    },
    {
      title: t('additionCols.cost'),
      dataIndex: 'costPaise',
      key: 'costPaise',
      align: 'right' as const,
      width: 130,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('additionCols.vendor'),
      dataIndex: 'partyName',
      key: 'partyName',
      width: 160,
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('additionCols.billNumber'),
      dataIndex: 'purchaseBillNumber',
      key: 'purchaseBillNumber',
      width: 130,
      render: (v?: string) => v ?? '-',
    },
  ];

  const DISPOSAL_COLS = [
    { title: t('disposalCols.assetCode'), dataIndex: 'assetCode', key: 'assetCode', width: 120 },
    { title: t('disposalCols.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('disposalCols.disposalDate'),
      dataIndex: 'disposalDate',
      key: 'disposalDate',
      width: 130,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : '-'),
    },
    {
      title: t('disposalCols.proceeds'),
      dataIndex: 'disposalProceedsPaise',
      key: 'disposalProceedsPaise',
      align: 'right' as const,
      width: 130,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('disposalCols.nbvAtDisposal'),
      dataIndex: 'nbvAtDisposalPaise',
      key: 'nbvAtDisposalPaise',
      align: 'right' as const,
      width: 140,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('disposalCols.gainLoss'),
      dataIndex: 'gainLossPaise',
      key: 'gainLossPaise',
      align: 'right' as const,
      width: 130,
      render: (v: number) => (
        <Text
          style={{
            color: v >= 0 ? 'var(--cr-success-700)' : 'var(--cr-danger-700)',
            fontWeight: 600,
          }}
        >
          {v >= 0 ? '+' : ''}
          {formatPaise(v)}
        </Text>
      ),
    },
    {
      title: t('disposalCols.type'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '-'),
    },
  ];

  const [data, setData] = useState<AdditionsDisposalsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wsId || !isHydrated || !fromDate || !toDate) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    additionsDisposalsReport(wsId, firmId, fromDate, toDate)
      .then((res) => setData(res as AdditionsDisposalsResult))
      .catch((e) => setError(e?.message ?? 'Failed to load additions/disposals register'))
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, fromDate, toDate]);

  if (!isHydrated) return <Skeleton active />;
  if (!fromDate || !toDate) return <Alert type="info" title={t('selectRange')} />;

  return (
    <div>
      <Title level={5} style={{ margin: '0 0 16px' }}>
        {t('title')}
      </Title>

      {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}
      {loading && <Skeleton active />}

      {!loading && data && (
        <Tabs
          defaultActiveKey="additions"
          items={[
            {
              key: 'additions',
              label: (
                <span>
                  <PlusOutlined /> {t('additionsTab', { count: data.additions.length })}
                </span>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <ExportButton
                      fields={ADDITION_FIELDS}
                      getExportData={async () => data.additions}
                      title="Additions Register"
                      filename={`additions_register_${fromDate}_to_${toDate}`}
                      disabled={data.additions.length === 0}
                      module="finance"
                    />
                  </div>
                  <DsTable
                    dataSource={data.additions}
                    columns={ADDITION_COLS}
                    rowKey="assetCode"
                    pagination={false}
                    size="small"
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row
                          style={{ fontWeight: 600, background: 'var(--cr-neutral-100)' }}
                        >
                          <Table.Summary.Cell index={0} colSpan={4}>
                            {t('additionsTotal', { count: data.totals.additionsCount })}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right">
                            {formatPaise(data.totals.additionsCostPaise)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={5} colSpan={2} />
                        </Table.Summary.Row>
                      </Table.Summary>
                    )}
                  />
                  {data.additions.length === 0 && (
                    <Alert type="info" title={t('noAdditions')} style={{ marginTop: 12 }} />
                  )}
                  {data.additions.length > 0 && (
                    <DsCard
                      style={{
                        marginTop: 12,
                        background: 'var(--cr-success-50)',
                        border: '1px solid var(--cr-success-50)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 40 }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('totalAssetsAdded')}
                          </Text>
                          <div style={{ fontWeight: 700 }}>{data.totals.additionsCount}</div>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('totalCostAdditions')}
                          </Text>
                          <div style={{ fontWeight: 700, color: 'var(--cr-success-700)' }}>
                            {formatPaise(data.totals.additionsCostPaise)}
                          </div>
                        </div>
                      </div>
                    </DsCard>
                  )}
                </div>
              ),
            },
            {
              key: 'disposals',
              label: (
                <span>
                  <MinusCircleOutlined /> {t('disposalsTab', { count: data.disposals.length })}
                </span>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <ExportButton
                      fields={DISPOSAL_FIELDS}
                      getExportData={async () => data.disposals}
                      title="Disposals Register"
                      filename={`disposals_register_${fromDate}_to_${toDate}`}
                      disabled={data.disposals.length === 0}
                      module="finance"
                    />
                  </div>
                  <DsTable
                    dataSource={data.disposals}
                    columns={DISPOSAL_COLS}
                    rowKey="assetCode"
                    pagination={false}
                    size="small"
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row
                          style={{ fontWeight: 600, background: 'var(--cr-neutral-100)' }}
                        >
                          <Table.Summary.Cell index={0} colSpan={3}>
                            {t('disposalsTotal', { count: data.totals.disposalsCount })}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right">
                            {formatPaise(data.totals.disposalsProceedsPaise)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4} />
                          <Table.Summary.Cell index={5} align="right">
                            <Text
                              style={{
                                color:
                                  data.totals.disposalsGainLossPaise >= 0
                                    ? 'var(--cr-success-700)'
                                    : 'var(--cr-danger-700)',
                                fontWeight: 700,
                              }}
                            >
                              {data.totals.disposalsGainLossPaise >= 0 ? '+' : ''}
                              {formatPaise(data.totals.disposalsGainLossPaise)}
                            </Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={6} />
                        </Table.Summary.Row>
                      </Table.Summary>
                    )}
                  />
                  {data.disposals.length === 0 && (
                    <Alert type="info" title={t('noDisposals')} style={{ marginTop: 12 }} />
                  )}
                  {data.disposals.length > 0 && (
                    <DsCard
                      style={{
                        marginTop: 12,
                        background: 'var(--cr-danger-50)',
                        border: '1px solid var(--cr-danger-50)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 40 }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('totalAssetsDisposed')}
                          </Text>
                          <div style={{ fontWeight: 700 }}>{data.totals.disposalsCount}</div>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('totalProceeds')}
                          </Text>
                          <div style={{ fontWeight: 700 }}>
                            {formatPaise(data.totals.disposalsProceedsPaise)}
                          </div>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('netGainLoss')}
                          </Text>
                          <div
                            style={{
                              fontWeight: 700,
                              color:
                                data.totals.disposalsGainLossPaise >= 0
                                  ? 'var(--cr-success-700)'
                                  : 'var(--cr-danger-700)',
                            }}
                          >
                            {data.totals.disposalsGainLossPaise >= 0 ? '+' : ''}
                            {formatPaise(data.totals.disposalsGainLossPaise)}
                          </div>
                        </div>
                      </div>
                    </DsCard>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
