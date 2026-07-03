'use client';
// Finance polish (manufacturing): i18n via finance.manufacturing.bom; DsPageHeader title +
// New BoM action + InfoTooltip explaining the Bill of Materials. Adds a friendly
// ListErrorState (shared finance.sales.listCommon labels) + Retry on fetch failure so a
// failed load does not read as an empty list. No data/columns logic changed. No status
// dropdown filter or search input on this page, so no persisted filter / search wiring.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin, Tag } from 'antd';
import { BuildOutlined } from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listBoms } from '@/lib/actions/finance/manufacturing.actions';
import { listItems } from '@/lib/actions/finance.actions';
import type { BomDefinition, FinanceItem } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function BomListPage() {
  const params = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.manufacturing');
  const tShared = useTranslations('finance.sales'); // shared listCommon.* labels (error/retry)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const manufacturingAccess = useFeatureAccess('manufacturing');
  const [rows, setRows] = useState<BomDefinition[]>([]);
  const [itemMap, setItemMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  useEffect(() => {
    if (!wsId || manufacturingAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    Promise.all([listBoms(wsId, params.firmId), listItems(wsId, params.firmId)])
      .then(([bomsData, itemsData]: [BomDefinition[], FinanceItem[]]) => {
        setRows(bomsData);
        setItemMap(new Map(itemsData.map((i) => [i._id, i.name])));
      })
      .catch(() => {
        setRows([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, params.firmId, reloadKey, manufacturingAccess.isLocked]);

  if (manufacturingAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (manufacturingAccess.isLocked) {
    return <ModuleLockedPage module="manufacturing" />;
  }

  return (
    <div className="p-6">
      <DsPageHeader
        title={t('bom.title')}
        icon={<BuildOutlined />}
        titleAside={<InfoTooltip text={t('bom.tip')} />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            onClick={() =>
              router.push(`/dashboard/finance/firms/${params.firmId}/manufacturing/bom/new`)
            }
          >
            {t('bom.new')}
          </DsButton>
        }
      />
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <DsTable
          dataSource={rows}
          rowKey="_id"
          loading={loading}
          pagination={{ defaultPageSize: 15, showSizeChanger: true }}
          onRow={(record: BomDefinition) => ({
            onClick: () =>
              router.push(
                `/dashboard/finance/firms/${params.firmId}/manufacturing/bom/${record._id}`,
              ),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('bom.colFinishedItem'),
              dataIndex: 'finishedItemId',
              render: (id: string) => itemMap.get(id) ?? id,
            },
            {
              title: t('bom.colOutputQty'),
              render: (_: unknown, r: BomDefinition) => `${r.outputQty} ${r.outputUnit}`,
            },
            {
              title: t('bom.colYield'),
              dataIndex: 'yieldPct',
              render: (v: number) => `${v}%`,
            },
            {
              title: t('bom.colComponents'),
              render: (_: unknown, r: BomDefinition) => r.components.length,
            },
            {
              title: t('bom.colVersion'),
              dataIndex: 'versionNo',
              render: (v: number) => `v${v}`,
            },
            {
              title: t('bom.colDefault'),
              dataIndex: 'isDefault',
              render: (v: boolean) => (v ? <Tag color="blue">{t('bom.defaultTag')}</Tag> : null),
            },
            {
              title: t('bom.colStatus'),
              dataIndex: 'isActive',
              render: (v: boolean) => (
                <Tag color={v ? 'green' : 'default'}>{v ? t('bom.active') : t('bom.inactive')}</Tag>
              ),
            },
            {
              title: <span className="sr-only">{t('listCommon.actions')}</span>,
              render: (_: unknown, r: BomDefinition) => (
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/dashboard/finance/firms/${params.firmId}/manufacturing/bom/${r._id}`,
                    );
                  }}
                >
                  {t('bom.view')}
                </DsButton>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
