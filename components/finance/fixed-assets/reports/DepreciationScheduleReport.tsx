'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Typography, Skeleton, Alert, Descriptions, Table } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { depreciationScheduleReport } from '@/lib/actions/finance-fixed-assets.actions';
import DsTable from '@/components/ui/DsTable';
import DsCard from '@/components/ui/DsCard';
import { ExportButton } from '@/components/export/ExportButton';
import {
  DEPRECIATION_SCHEDULE_FIELDS,
  type DepreciationScheduleLine,
} from '@/lib/exportFields/depreciationScheduleFields';
import { formatCurrencyFull } from '@/lib/utils';

const { Title } = Typography;

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

interface DepreciationScheduleReportProps {
  firmId: string;
  assetId: string;
  fromMonth?: string;
  toMonth?: string;
}

interface ScheduleResult {
  assetId: string;
  assetCode: string;
  name: string;
  costPaise: number;
  salvageValuePaise: number;
  openingNbvPaise: number;
  currentAccumulatedPaise: number;
  currentNbvPaise: number;
  depreciationMethod: string;
  lines: DepreciationScheduleLine[];
}

export default function DepreciationScheduleReport({
  firmId,
  assetId,
  fromMonth,
  toMonth,
}: DepreciationScheduleReportProps) {
  const t = useTranslations('finance.fixedAssets.reports.depreciationSchedule');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const COLUMNS = [
    { title: t('columns.runMonth'), dataIndex: 'runMonth', key: 'runMonth', width: 120 },
    {
      title: t('columns.depreciation'),
      dataIndex: 'amountPaise',
      key: 'amountPaise',
      align: 'right' as const,
      width: 150,
      render: (v: number) => formatPaise(v ?? 0),
    },
    {
      title: t('columns.accumulatedAfter'),
      dataIndex: 'accumulatedAfterPaise',
      key: 'accumulatedAfterPaise',
      align: 'right' as const,
      width: 170,
      render: (v: number) => formatPaise(v ?? 0),
    },
    {
      title: t('columns.nbvAfter'),
      dataIndex: 'nbvAfterPaise',
      key: 'nbvAfterPaise',
      align: 'right' as const,
      width: 150,
      render: (v: number) => formatPaise(v ?? 0),
    },
    {
      title: t('columns.postedAt'),
      dataIndex: 'postedAt',
      key: 'postedAt',
      width: 120,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : '-'),
    },
  ];

  const [data, setData] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wsId || !isHydrated || !assetId) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    depreciationScheduleReport(wsId, firmId, assetId, { fromMonth, toMonth })
      .then((res) => setData(res as ScheduleResult))
      .catch((e) => setError(e?.message ?? 'Failed to load depreciation schedule'))
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, assetId, fromMonth, toMonth]);

  if (!isHydrated) return <Skeleton active />;
  if (!assetId) return <Alert type="info" title={t('selectAsset')} />;

  const totalPostedPaise = data?.lines.reduce((s, l) => s + (l.amountPaise ?? 0), 0) ?? 0;

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
        <Title level={5} style={{ margin: 0 }}>
          {t('title')}
        </Title>
        {data && (
          <ExportButton
            fields={DEPRECIATION_SCHEDULE_FIELDS}
            getExportData={async () => data.lines}
            title={`Depreciation Schedule - ${data.assetCode}`}
            filename={`dep_schedule_${data.assetCode}`}
            disabled={loading || (data?.lines.length ?? 0) === 0}
            module="finance"
          />
        )}
      </div>

      {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}
      {loading && <Skeleton active />}

      {!loading && data && (
        <>
          {/* Asset summary header card */}
          <DsCard style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label={t('summary.assetCode')}>{data.assetCode}</Descriptions.Item>
              <Descriptions.Item label={t('summary.name')}>{data.name}</Descriptions.Item>
              <Descriptions.Item label={t('summary.method')}>
                {data.depreciationMethod.toUpperCase()}
              </Descriptions.Item>
              <Descriptions.Item label={t('summary.cost')}>
                {formatPaise(data.costPaise)}
              </Descriptions.Item>
              <Descriptions.Item label={t('summary.salvageValue')}>
                {formatPaise(data.salvageValuePaise)}
              </Descriptions.Item>
              <Descriptions.Item label={t('summary.openingNbv')}>
                {formatPaise(data.openingNbvPaise)}
              </Descriptions.Item>
              <Descriptions.Item label={t('summary.currentAccumulated')}>
                {formatPaise(data.currentAccumulatedPaise)}
              </Descriptions.Item>
              <Descriptions.Item label={t('summary.currentNbv')}>
                {formatPaise(data.currentNbvPaise)}
              </Descriptions.Item>
            </Descriptions>
          </DsCard>

          {/* Schedule table */}
          <DsTable
            dataSource={data.lines}
            columns={COLUMNS}
            rowKey="runMonth"
            pagination={false}
            size="small"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ fontWeight: 600, background: 'var(--cr-neutral-100)' }}>
                  <Table.Summary.Cell index={0}>{t('total')}</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    {formatPaise(totalPostedPaise)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3} />
                  <Table.Summary.Cell index={4} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />

          {data.lines.length === 0 && (
            <Alert type="info" title={t('noEntries')} style={{ marginTop: 12 }} />
          )}
        </>
      )}
    </div>
  );
}
