'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsPageHeader } from '@/components/ui';
import { OvertimePanel } from '@/components/dashboard/attendance/reports/OvertimePanel';
import { CompliancePanel } from '@/components/dashboard/attendance/reports/CompliancePanel';
import { PatternsPanel } from '@/components/dashboard/attendance/reports/PatternsPanel';

const VALID_TABS = ['overtime', 'compliance', 'patterns'] as const;
type TabKey = (typeof VALID_TABS)[number];

function isValidTab(key: string | null): key is TabKey {
  return VALID_TABS.includes(key as TabKey);
}

/**
 * Unified attendance Reports page - consolidates overtime analytics,
 * compliance report, and absence patterns into a single tabbed surface.
 *
 * Deep-linking: ?tab=overtime | compliance | patterns
 */
export default function AttendanceReportsPage() {
  const t = useTranslations('attendance.reportsPage');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active tab is local state (seeded once from the ?tab= deep-link param).
  // Local state - not a value derived from useSearchParams - drives the
  // controlled <Tabs>: a query-only router.replace does not reliably
  // re-render this client component, which would leave the tab stuck.
  // onTabChange updates the state (instant switch) AND the URL (deep-link).
  const rawTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabKey>(isValidTab(rawTab) ? rawTab : 'overtime');

  const onTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    router.replace(`/dashboard/attendance/reports?tab=${key}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<LineChartOutlined />} />

      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        items={[
          {
            key: 'overtime',
            label: t('tabOvertime'),
            children: <OvertimePanel />,
          },
          {
            key: 'compliance',
            label: t('tabCompliance'),
            children: <CompliancePanel />,
          },
          {
            key: 'patterns',
            label: t('tabPatterns'),
            children: <PatternsPanel />,
          },
        ]}
      />
    </div>
  );
}
