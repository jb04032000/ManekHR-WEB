'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Typography, Skeleton, Alert, Space, Collapse, Table } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { assetRegisterReport } from '@/lib/actions/finance-fixed-assets.actions';
import DsTable from '@/components/ui/DsTable';
import DsCard from '@/components/ui/DsCard';
import { ExportButton } from '@/components/export/ExportButton';
import { FIXED_ASSET_EXPORT_FIELDS } from '@/lib/exportFields/fixedAssetFields';
import { formatCurrencyFull } from '@/lib/utils';
import type { FixedAsset } from '@/types';

const { Title, Text } = Typography;

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

interface AssetRegisterReportProps {
  firmId: string;
  filters: {
    financialYear?: string;
    categoryId?: string;
    status?: string;
    asOfDate?: string;
  };
}

interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  assets: FixedAsset[];
  totals: { cost: number; accumulated: number; nbv: number };
}

interface RegisterResult {
  groupedByCategory: CategoryGroup[];
  grandTotals: { cost: number; accumulated: number; nbv: number };
  asOfDate: string;
}

export default function AssetRegisterReport({ firmId, filters }: AssetRegisterReportProps) {
  const t = useTranslations('finance.fixedAssets.reports.assetRegister');
  const tStatus = useTranslations('finance.fixedAssets.status');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const COLUMNS = [
    { title: t('columns.assetCode'), dataIndex: 'assetCode', key: 'assetCode', width: 130 },
    { title: t('columns.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('columns.purchaseDate'),
      dataIndex: 'purchaseDate',
      key: 'purchaseDate',
      width: 130,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : '-'),
    },
    {
      title: t('columns.cost'),
      dataIndex: 'costPaise',
      key: 'costPaise',
      width: 130,
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('columns.accDepreciation'),
      dataIndex: 'accumulatedDepreciationPaise',
      key: 'accumulatedDepreciationPaise',
      width: 155,
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('columns.nbv'),
      dataIndex: 'nbvPaise',
      key: 'nbvPaise',
      width: 130,
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (v ? tStatus(v) : '-'),
    },
  ];

  const [data, setData] = useState<RegisterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    assetRegisterReport(wsId, firmId, filters)
      .then((res) => setData(res as RegisterResult))
      .catch((e) => setError(e?.message ?? 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, JSON.stringify(filters)]);

  if (!isHydrated) return <Skeleton active />;

  const flatAssets: FixedAsset[] = data ? data.groupedByCategory.flatMap((g) => g.assets) : [];

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
          {data && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('asOf', { date: new Date(data.asOfDate).toLocaleDateString('en-IN') })}
            </Text>
          )}
        </div>
        <ExportButton
          fields={FIXED_ASSET_EXPORT_FIELDS}
          getExportData={async () => flatAssets}
          title="Fixed Asset Register"
          filename="fixed_asset_register"
          disabled={loading || flatAssets.length === 0}
          module="finance"
        />
      </div>

      {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}
      {loading && <Skeleton active />}

      {!loading && data && (
        <>
          <Collapse
            defaultActiveKey={data.groupedByCategory.map((g) => g.categoryId)}
            style={{ marginBottom: 16 }}
            items={data.groupedByCategory.map((group) => ({
              key: group.categoryId,
              label: (
                <Space>
                  <Text strong>{group.categoryName}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('categoryMeta', {
                      count: group.assets.length,
                      nbv: formatPaise(group.totals.nbv),
                    })}
                  </Text>
                </Space>
              ),
              children: (
                <DsTable
                  dataSource={group.assets}
                  columns={COLUMNS}
                  rowKey="_id"
                  pagination={false}
                  size="small"
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row
                        style={{ fontWeight: 600, background: 'var(--cr-neutral-100)' }}
                      >
                        <Table.Summary.Cell index={0} colSpan={3}>
                          {t('categoryTotal')}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          {formatPaise(group.totals.cost)}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right">
                          {formatPaise(group.totals.accumulated)}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="right">
                          {formatPaise(group.totals.nbv)}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={6} />
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              ),
            }))}
          />

          {/* Grand totals card */}
          <DsCard
            style={{ background: 'var(--cr-success-50)', border: '1px solid var(--cr-success-50)' }}
          >
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('grandTotalCost')}
                </Text>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {formatPaise(data.grandTotals.cost)}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('grandTotalAccDep')}
                </Text>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {formatPaise(data.grandTotals.accumulated)}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('grandTotalNbv')}
                </Text>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--cr-success-700)' }}>
                  {formatPaise(data.grandTotals.nbv)}
                </div>
              </div>
            </div>
          </DsCard>
        </>
      )}

      {!loading && data && flatAssets.length === 0 && <Alert type="info" title={t('noAssets')} />}
    </div>
  );
}
