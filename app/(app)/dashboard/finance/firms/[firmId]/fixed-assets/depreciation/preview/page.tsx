'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Skeleton, Spin, Typography, DatePicker, message, Space } from 'antd';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { previewDepreciation, runDepreciation } from '@/lib/actions/finance-fixed-assets.actions';
import DsButton from '@/components/ui/DsButton';
import DepreciationPreviewTable from '@/components/finance/fixed-assets/DepreciationPreviewTable';
import type { DepreciationPreviewLine } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function DepreciationPreviewPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.fixedAssets.depreciation');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const [runMonth, setRunMonth] = useState<dayjs.Dayjs>(dayjs());
  const [lines, setLines] = useState<DepreciationPreviewLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);

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

  const handlePreview = async () => {
    setLoading(true);
    setLines(null);
    try {
      const monthStr = runMonth.format('YYYY-MM');
      const data = await previewDepreciation(wsId, firmId, monthStr);
      setLines(Array.isArray(data) ? data : []);
    } catch {
      message.error(t('toast.previewFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRun = async () => {
    setRunLoading(true);
    try {
      const monthStr = runMonth.format('YYYY-MM');
      const result = await runDepreciation(wsId, firmId, monthStr, 'manual');
      message.success(t('toast.runComplete', { count: result.assetsProcessed }));
      setLines(null);
    } catch {
      message.error(t('toast.runFailed'));
    } finally {
      setRunLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={1} style={{ marginBottom: 20, fontSize: 22 }}>
        {t('previewTitle')}
      </Typography.Title>

      <Space style={{ marginBottom: 20 }}>
        <DatePicker
          picker="month"
          value={runMonth}
          onChange={(d) => {
            if (d) setRunMonth(d);
          }}
          disabledDate={(d) => d > dayjs()}
          format="YYYY-MM"
        />
        <DsButton dsVariant="primary" loading={loading} onClick={handlePreview}>
          {t('previewButton')}
        </DsButton>
      </Space>

      {lines !== null && (
        <DepreciationPreviewTable
          lines={lines}
          onConfirmRun={handleConfirmRun}
          confirmLoading={runLoading}
        />
      )}
    </div>
  );
}
