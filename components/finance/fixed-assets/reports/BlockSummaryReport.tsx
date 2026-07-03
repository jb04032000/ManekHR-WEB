'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Typography, Skeleton, Alert, Tooltip, Tag, Table } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { blockSummaryReport } from '@/lib/actions/finance-fixed-assets.actions';
import DsTable from '@/components/ui/DsTable';
import DsCard from '@/components/ui/DsCard';
import { ExportButton } from '@/components/export/ExportButton';
import { BLOCK_SUMMARY_FIELDS, type BlockSummaryRow } from '@/lib/exportFields/blockSummaryFields';
import { formatCurrencyFull } from '@/lib/utils';

const { Title, Text } = Typography;

const formatPaise = (v: number) => formatCurrencyFull(v / 100);
const fmtRate = (r: number) => `${(r * 100).toFixed(1)}%`;

interface BlockSummaryReportProps {
  firmId: string;
  financialYear: string;
}

interface BlockSummaryResult {
  financialYear: string;
  blocks: BlockSummaryRow[];
  grandTotals: {
    openingWdvPaise: number;
    additionsPaise: number;
    disposalsPaise: number;
    depreciationPaise: number;
    closingWdvPaise: number;
  };
}

export default function BlockSummaryReport({ firmId, financialYear }: BlockSummaryReportProps) {
  const t = useTranslations('finance.fixedAssets.reports.blockSummary');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const COLUMNS = [
    {
      title: t('columns.block'),
      dataIndex: 'block',
      key: 'block',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: (
        <Tooltip title={t('wdvRateTooltip')}>
          <span>
            {t('columns.wdvRate')}{' '}
            <InfoCircleOutlined style={{ fontSize: 12, color: 'var(--cr-text-3)' }} />
          </span>
        </Tooltip>
      ),
      dataIndex: 'itActRate',
      key: 'itActRate',
      width: 110,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{fmtRate(v)}</Tag>,
    },
    {
      title: t('columns.openingWdv'),
      dataIndex: 'openingWdvPaise',
      key: 'openingWdvPaise',
      align: 'right' as const,
      width: 140,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('columns.additions'),
      dataIndex: 'additionsPaise',
      key: 'additionsPaise',
      align: 'right' as const,
      width: 130,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('columns.disposals'),
      dataIndex: 'disposalsPaise',
      key: 'disposalsPaise',
      align: 'right' as const,
      width: 130,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('columns.depreciation'),
      dataIndex: 'depreciationPaise',
      key: 'depreciationPaise',
      align: 'right' as const,
      width: 140,
      render: (v: number) => (
        <Text style={{ color: 'var(--cr-danger-700)' }}>{formatPaise(v)}</Text>
      ),
    },
    {
      title: t('columns.closingWdv'),
      dataIndex: 'closingWdvPaise',
      key: 'closingWdvPaise',
      align: 'right' as const,
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: 'var(--cr-success-700)' }}>
          {formatPaise(v)}
        </Text>
      ),
    },
  ];

  const [data, setData] = useState<BlockSummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wsId || !isHydrated || !financialYear) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    blockSummaryReport(wsId, firmId, financialYear)
      .then((res) => setData(res as BlockSummaryResult))
      .catch((e) => setError(e?.message ?? 'Failed to load block summary'))
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, financialYear]);

  if (!isHydrated) return <Skeleton active />;
  if (!financialYear) return <Alert type="info" title={t('selectFy')} />;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={5} style={{ margin: 0 }}>
            {t('title')}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('subtitle', { fy: financialYear })}
          </Text>
        </div>
        {data && (
          <ExportButton
            fields={BLOCK_SUMMARY_FIELDS}
            getExportData={async () => data.blocks}
            title={`Block Summary FY ${financialYear}`}
            filename={`block_summary_${financialYear}`}
            disabled={loading || (data?.blocks.length ?? 0) === 0}
            module="finance"
          />
        )}
      </div>

      {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}
      {loading && <Skeleton active />}

      {!loading && data && (
        <>
          <DsTable
            dataSource={data.blocks}
            columns={COLUMNS}
            rowKey="block"
            pagination={false}
            size="small"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-neutral-100)' }}>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    {t('grandTotal')}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    {formatPaise(data.grandTotals.openingWdvPaise)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    {formatPaise(data.grandTotals.additionsPaise)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    {formatPaise(data.grandTotals.disposalsPaise)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text style={{ color: 'var(--cr-danger-700)', fontWeight: 700 }}>
                      {formatPaise(data.grandTotals.depreciationPaise)}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong style={{ color: 'var(--cr-success-700)' }}>
                      {formatPaise(data.grandTotals.closingWdvPaise)}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />

          {/* Grand totals summary card */}
          <DsCard
            style={{
              marginTop: 16,
              background: 'var(--cr-warning-50)',
              border: '1px solid var(--cr-warning-50)',
            }}
          >
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('totals.openingWdv')}
                </Text>
                <div style={{ fontWeight: 700 }}>
                  {formatPaise(data.grandTotals.openingWdvPaise)}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('totals.additions')}
                </Text>
                <div style={{ fontWeight: 700 }}>
                  {formatPaise(data.grandTotals.additionsPaise)}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('totals.disposals')}
                </Text>
                <div style={{ fontWeight: 700 }}>
                  {formatPaise(data.grandTotals.disposalsPaise)}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('totals.depreciation')}
                </Text>
                <div style={{ fontWeight: 700, color: 'var(--cr-danger-700)' }}>
                  {formatPaise(data.grandTotals.depreciationPaise)}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('totals.closingWdv')}
                </Text>
                <div style={{ fontWeight: 700, color: 'var(--cr-success-700)' }}>
                  {formatPaise(data.grandTotals.closingWdvPaise)}
                </div>
              </div>
            </div>
          </DsCard>

          {data.blocks.length === 0 && (
            <Alert type="info" title={t('noAssets')} style={{ marginTop: 12 }} />
          )}
        </>
      )}
    </div>
  );
}
