'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Skeleton, Spin, Typography } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import DepreciationRunPanel from '@/components/finance/fixed-assets/DepreciationRunPanel';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function DepreciationPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.fixedAssets.depreciation');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

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

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={1} style={{ marginBottom: 20, fontSize: 22 }}>
        {t('runsTitle')}
      </Typography.Title>
      <DepreciationRunPanel firmId={firmId} />
    </div>
  );
}
