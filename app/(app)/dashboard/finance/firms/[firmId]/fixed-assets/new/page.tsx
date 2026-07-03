'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Skeleton, Spin, Typography, message } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import {
  createFixedAsset,
  prefillFromPurchaseBill,
} from '@/lib/actions/finance-fixed-assets.actions';
import FixedAssetForm from '@/components/finance/fixed-assets/FixedAssetForm';
import type { FixedAsset } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function NewFixedAssetPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.fixedAssets.form');
  const searchParams = useSearchParams();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const [initialValues, setInitialValues] = useState<Partial<FixedAsset> | undefined>(undefined);
  const [prefilling, setPrefilling] = useState(false);

  // Handle ?fromPurchaseBill=<id>&line=<n> prefill
  useEffect(() => {
    if (!wsId || !isHydrated || financeAccess.isLocked) return;
    const billId = searchParams.get('fromPurchaseBill');
    const line = parseInt(searchParams.get('line') ?? '0', 10);
    if (!billId) return;

    startTransition(() => {
      setPrefilling(true);
    });
    prefillFromPurchaseBill(wsId, firmId, billId, line)
      .then((prefilled) => setInitialValues(prefilled as Partial<FixedAsset>))
      .catch(() => message.warning(t('prefillFailed')))
      .finally(() => setPrefilling(false));
  }, [wsId, isHydrated, firmId, searchParams, financeAccess.isLocked, t]);

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
  if (!isHydrated || prefilling) return <Skeleton active style={{ padding: 24 }} />;

  const handleSubmit = async (values: Partial<FixedAsset>) => {
    const asset = await createFixedAsset(wsId, firmId, values);
    message.success(t('createdToast', { code: (asset as FixedAsset).assetCode }));
    router.push(`/dashboard/finance/firms/${firmId}/fixed-assets`);
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={1} style={{ marginBottom: 20, fontSize: 22 }}>
        {t('newTitle')}
      </Typography.Title>
      <FixedAssetForm
        mode="create"
        firmId={firmId}
        initialValues={initialValues}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
