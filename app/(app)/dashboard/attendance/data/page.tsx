'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsPageHeader } from '@/components/ui';
import { ImportPanel } from '@/components/dashboard/attendance/data/ImportPanel';
import { StatutoryExportsPanel } from '@/components/dashboard/attendance/data/StatutoryExportsPanel';

const VALID_TABS = ['import', 'statutory'] as const;
type TabKey = (typeof VALID_TABS)[number];

function isValidTab(key: string | null): key is TabKey {
  return VALID_TABS.includes(key as TabKey);
}

/**
 * Unified attendance Data page - consolidates Import and Statutory Exports
 * into a single tabbed surface.
 *
 * Deep-linking: ?tab=import | statutory
 */
export default function AttendanceDataPage() {
  const t = useTranslations('attendance.dataPage');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active tab is local state (seeded once from the ?tab= deep-link param).
  // Local state - not a value derived from useSearchParams - drives the
  // controlled <Tabs>: a query-only router.replace does not reliably
  // re-render this client component, which would leave the tab stuck.
  // onTabChange updates the state (instant switch) AND the URL (deep-link).
  const rawTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabKey>(isValidTab(rawTab) ? rawTab : 'import');

  const onTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    router.replace(`/dashboard/attendance/data?tab=${key}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<UploadOutlined />} />

      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        items={[
          {
            key: 'import',
            label: t('tabImport'),
            children: <ImportPanel />,
          },
          {
            key: 'statutory',
            label: t('tabStatutory'),
            children: <StatutoryExportsPanel />,
          },
        ]}
      />
    </div>
  );
}
