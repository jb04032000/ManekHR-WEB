'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Select, Typography, Skeleton, Spin, Space, Input } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { listFixedAssets } from '@/lib/actions/finance-fixed-assets.actions';
import DsButton from '@/components/ui/DsButton';
import DepreciationScheduleReport from '@/components/finance/fixed-assets/reports/DepreciationScheduleReport';
import type { FixedAsset } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { ListErrorState } from '@/components/finance/ListErrorState';

const { Title } = Typography;

const MONTH_REGEX = /^\d{4}-\d{2}$/;

export default function DepreciationSchedulePage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.fixedAssets.reports');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [fromMonth, setFromMonth] = useState<string>('');
  const [toMonth, setToMonth] = useState<string>('');
  const [error, setError] = useState(false); // distinguishes a failed asset-list fetch from an empty picker
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  useEffect(() => {
    if (!wsId || !isHydrated || financeAccess.isLocked) return;
    startTransition(() => setError(false));
    listFixedAssets(wsId, firmId, { limit: 200, status: 'active' })
      .then((res) => {
        const r = res as { items: FixedAsset[] };
        setAssets(r.items ?? []);
      })
      .catch(() => {
        setAssets([]);
        setError(true);
      });
  }, [wsId, isHydrated, firmId, financeAccess.isLocked, reloadKey]);

  if (financeAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (financeAccess.isLocked) {
    return <ModuleLockedPage module="finance" />;
  }
  if (!isHydrated) return <Skeleton active style={{ padding: 24 }} />;

  const base = `/dashboard/finance/firms/${firmId}/fixed-assets`;

  const assetOptions = assets.map((a) => ({
    value: a._id,
    label: `${a.assetCode} - ${a.name}`,
  }));

  const validFrom = MONTH_REGEX.test(fromMonth) ? fromMonth : undefined;
  const validTo = MONTH_REGEX.test(toMonth) ? toMonth : undefined;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(`${base}/reports`)}
        >
          {t('back')}
        </DsButton>
        <Title level={1} style={{ margin: 0, fontSize: 22 }}>
          {t('depreciationSchedule.title')}
        </Title>
      </div>

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <>
          <Space wrap style={{ marginBottom: 20 }}>
            <Select
              aria-label={t('filters.selectAssetAria')}
              showSearch
              placeholder={t('filters.selectAssetPlaceholder')}
              style={{ width: 300 }}
              options={assetOptions}
              filterOption={(input, option) =>
                ((option?.label as string) ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={(v) => setSelectedAssetId(v)}
              allowClear
            />
            <Input
              aria-label={t('filters.fromMonthAria')}
              placeholder={t('filters.fromMonthPlaceholder')}
              style={{ width: 180 }}
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              status={fromMonth && !MONTH_REGEX.test(fromMonth) ? 'error' : undefined}
            />
            <Input
              aria-label={t('filters.toMonthAria')}
              placeholder={t('filters.toMonthPlaceholder')}
              style={{ width: 180 }}
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
              status={toMonth && !MONTH_REGEX.test(toMonth) ? 'error' : undefined}
            />
          </Space>

          <DepreciationScheduleReport
            firmId={firmId}
            assetId={selectedAssetId}
            fromMonth={validFrom}
            toMonth={validTo}
          />
        </>
      )}
    </div>
  );
}
