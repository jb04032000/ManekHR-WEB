'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton, Spin } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { getFixedAsset } from '@/lib/actions/finance-fixed-assets.actions';
import DisposalWorkflowModal from '@/components/finance/fixed-assets/DisposalWorkflowModal';
import type { FixedAsset } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function DisposalPage() {
  const { firmId, assetId } = useParams<{ firmId: string; assetId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.fixedAssets.detail');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const [asset, setAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !isHydrated || financeAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
    });
    getFixedAsset(wsId, firmId, assetId)
      .then(setAsset)
      .catch(() => setAsset(null))
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, assetId, financeAccess.isLocked]);

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
  if (!isHydrated || loading) return <Skeleton active style={{ padding: 24 }} />;
  if (!asset) return <div style={{ padding: 24 }}>{t('notFound')}</div>;

  return (
    <DisposalWorkflowModal
      asset={asset}
      open={true}
      onClose={() => router.push(`/dashboard/finance/firms/${firmId}/fixed-assets/${assetId}`)}
      onComplete={() => router.push(`/dashboard/finance/firms/${firmId}/fixed-assets`)}
    />
  );
}
