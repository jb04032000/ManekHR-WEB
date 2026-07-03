'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { DatePicker, Typography, Skeleton, Spin, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import AdditionsDisposalsReport from '@/components/finance/fixed-assets/reports/AdditionsDisposalsReport';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const { Title } = Typography;

export default function AdditionsDisposalsPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.fixedAssets.reports');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  // Default to current Indian FY: April 1 → March 31
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;
  const defaultTo = `${fyStartYear + 1}-03-31`;

  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);

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
          {t('additionsDisposals.title')}
        </Title>
      </div>

      <Space wrap style={{ marginBottom: 20 }}>
        <DatePicker
          aria-label={t('filters.fromDateAria')}
          placeholder={t('filters.fromDatePlaceholder')}
          style={{ width: 160 }}
          value={fromDate ? dayjs(fromDate) : null}
          onChange={(d) => d && setFromDate(d.format('YYYY-MM-DD'))}
        />
        <DatePicker
          aria-label={t('filters.toDateAria')}
          placeholder={t('filters.toDatePlaceholder')}
          style={{ width: 160 }}
          value={toDate ? dayjs(toDate) : null}
          onChange={(d) => d && setToDate(d.format('YYYY-MM-DD'))}
        />
      </Space>

      <AdditionsDisposalsReport firmId={firmId} fromDate={fromDate} toDate={toDate} />
    </div>
  );
}
