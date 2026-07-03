'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Select, DatePicker, Space, Typography, Skeleton, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import AssetRegisterReport from '@/components/finance/fixed-assets/reports/AssetRegisterReport';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { usePersistedState } from '@/hooks/usePersistedState';

const { Title } = Typography;

const FY_OPTIONS = [
  { value: '2023-24', label: '2023-24' },
  { value: '2024-25', label: '2024-25' },
  { value: '2025-26', label: '2025-26' },
  { value: '2026-27', label: '2026-27' },
];

export default function AssetRegisterPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.fixedAssets.reports');
  const tStatus = useTranslations('finance.fixedAssets.status');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const STATUS_OPTIONS = [
    { value: 'active', label: tStatus('active') },
    { value: 'disposed', label: tStatus('disposed') },
    { value: 'scrapped', label: tStatus('scrapped') },
    { value: 'transferred', label: tStatus('transferred') },
    { value: 'all', label: t('filters.allStatuses') },
  ];

  // Per-firm saved primary filter (platform bar): the status filter persists across reloads.
  // Cross-link: hooks/usePersistedState.ts. FY/date stay session-only.
  const [statusFilter, setStatusFilter] = usePersistedState<string>(
    `finance:fixedAssets:reportAssetRegister:status:${firmId}`,
    'active',
  );

  const [filters, setFilters] = useState<{
    financialYear?: string;
    categoryId?: string;
    asOfDate?: string;
  }>({});

  // The report consumes status alongside the session-only filters; status comes from the
  // persisted value so it survives reloads while FY/date reset.
  const reportFilters = { ...filters, status: statusFilter };

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
      {/* Header */}
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
          {t('assetRegister.title')}
        </Title>
      </div>

      {/* Filters */}
      <Space wrap style={{ marginBottom: 20 }}>
        <Select
          aria-label={t('filters.fyAria')}
          placeholder={t('filters.fyPlaceholder')}
          style={{ width: 140 }}
          allowClear
          options={FY_OPTIONS}
          onChange={(v) => setFilters((f) => ({ ...f, financialYear: v }))}
        />
        <Select
          aria-label={t('filters.statusAria')}
          placeholder={t('filters.statusPlaceholder')}
          style={{ width: 160 }}
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => setStatusFilter(v)}
        />
        <DatePicker
          aria-label={t('filters.asOfAria')}
          placeholder={t('filters.asOfPlaceholder')}
          style={{ width: 160 }}
          onChange={(d) =>
            setFilters((f) => ({
              ...f,
              asOfDate: d ? dayjs(d).format('YYYY-MM-DD') : undefined,
            }))
          }
        />
      </Space>

      <AssetRegisterReport firmId={firmId} filters={reportFilters} />
    </div>
  );
}
