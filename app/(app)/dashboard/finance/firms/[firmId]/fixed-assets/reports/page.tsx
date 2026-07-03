'use client';
import React from 'react';
import { useWorkspaceStore } from '@/lib/store';
import { Skeleton, Spin } from 'antd';
import ReportsHubGrid from '@/components/finance/fixed-assets/reports/ReportsHubGrid';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function FixedAssetsReportsPage() {
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
  return <ReportsHubGrid />;
}
