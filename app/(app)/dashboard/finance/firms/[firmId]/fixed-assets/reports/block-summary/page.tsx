'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Select, Typography, Skeleton, Spin, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import BlockSummaryReport from '@/components/finance/fixed-assets/reports/BlockSummaryReport';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { usePersistedState } from '@/hooks/usePersistedState';

const { Title } = Typography;

const FY_OPTIONS = [
  { value: '2022-23', label: '2022-23' },
  { value: '2023-24', label: '2023-24' },
  { value: '2024-25', label: '2024-25' },
  { value: '2025-26', label: '2025-26' },
  { value: '2026-27', label: '2026-27' },
];

export default function BlockSummaryPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.fixedAssets.reports');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const currentFy = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed; April = 3
    return m >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  })();

  // Per-firm saved primary filter (platform bar): the financial-year filter persists across
  // reloads. Cross-link: hooks/usePersistedState.ts.
  const [financialYear, setFinancialYear] = usePersistedState<string>(
    `finance:fixedAssets:reportBlockSummary:fy:${firmId}`,
    currentFy,
  );

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
          {t('hub.cards.blockSummary.title')}
        </Title>
      </div>

      <Space wrap style={{ marginBottom: 20 }}>
        <Select
          aria-label={t('filters.fyAria')}
          placeholder={t('filters.fyPlaceholder')}
          style={{ width: 160 }}
          value={financialYear}
          options={FY_OPTIONS}
          onChange={(v) => setFinancialYear(v)}
        />
      </Space>

      <BlockSummaryReport firmId={firmId} financialYear={financialYear} />
    </div>
  );
}
