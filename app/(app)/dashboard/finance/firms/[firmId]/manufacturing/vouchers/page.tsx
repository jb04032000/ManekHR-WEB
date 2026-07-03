'use client';
// Finance polish (manufacturing): i18n via finance.manufacturing; loading fallback string
// localised. Title + table live in ManufacturingRegister (also polished). Adds a friendly
// ListErrorState (shared finance.sales.listCommon labels) + Retry on fetch failure so a failed
// load does not read as an empty register. The status filter (tabs) is persisted per-firm inside
// ManufacturingRegister. No data logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin } from 'antd';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listManufacturingVouchers } from '@/lib/actions/finance/manufacturing.actions';
import { listItems } from '@/lib/actions/finance.actions';
import ManufacturingRegister from '@/components/finance/manufacturing/ManufacturingRegister';
import type { ManufacturingVoucher, FinanceItem } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function ManufacturingVouchersPage() {
  const params = useParams<{ firmId: string }>();
  const t = useTranslations('finance.manufacturing');
  const tShared = useTranslations('finance.sales'); // shared listCommon.* labels (error/retry)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const manufacturingAccess = useFeatureAccess('manufacturing');
  const [mvs, setMvs] = useState<ManufacturingVoucher[]>([]);
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
    Promise.all([listManufacturingVouchers(wsId, params.firmId), listItems(wsId, params.firmId)])
      .then(([mvsData, itemsData]: [ManufacturingVoucher[], FinanceItem[]]) => {
        setMvs(mvsData);
        setItemMap(new Map(itemsData.map((i) => [i._id, i.name])));
      })
      .catch(() => {
        setMvs([]);
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

  if (error) {
    return (
      <div className="p-6">
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  if (loading) return <div className="p-6">{t('listCommon.loadingFallback')}</div>;

  return (
    <div className="p-6">
      <ManufacturingRegister
        workspaceId={wsId}
        firmId={params.firmId}
        initialData={mvs}
        itemMap={itemMap}
      />
    </div>
  );
}
