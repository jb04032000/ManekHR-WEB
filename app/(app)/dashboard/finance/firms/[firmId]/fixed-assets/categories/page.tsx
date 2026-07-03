'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Spin, Typography, Tooltip, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { seedDefaultCategories } from '@/lib/actions/finance-fixed-assets.actions';
import DsButton from '@/components/ui/DsButton';
import AssetCategoryList from '@/components/finance/fixed-assets/AssetCategoryList';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function AssetCategoriesPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.fixedAssets.categories');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');
  const [seeding, setSeeding] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
  if (!isHydrated) return null;

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const result = await seedDefaultCategories(wsId, firmId);
      message.success(t('seededToast', { count: (result as { seeded: number }).seeded ?? 0 }));
      setRefreshKey((k) => k + 1);
    } catch {
      message.error(t('seedFailed'));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Typography.Title level={1} style={{ margin: 0, fontSize: 22 }}>
          {t('pageTitle')}
        </Typography.Title>
        <Tooltip title={t('seedTooltip')}>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            icon={<ReloadOutlined />}
            loading={seeding}
            onClick={handleSeedDefaults}
          >
            {t('seedButton')}
          </DsButton>
        </Tooltip>
      </div>

      <AssetCategoryList key={refreshKey} firmId={firmId} />
    </div>
  );
}
