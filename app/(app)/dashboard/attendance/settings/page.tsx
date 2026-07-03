'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsPageHeader } from '@/components/ui';
import { SelfServiceSettingsPanel } from '@/components/dashboard/attendance/settings/SelfServiceSettingsPanel';
import { RegularizationSettingsPanel } from '@/components/dashboard/attendance/settings/RegularizationSettingsPanel';
import { PoliciesSettingsPanel } from '@/components/dashboard/attendance/settings/PoliciesSettingsPanel';

const VALID_TABS = ['self-service', 'regularization', 'policies'] as const;
type TabKey = (typeof VALID_TABS)[number];

function isValidTab(key: string | null): key is TabKey {
  return VALID_TABS.includes(key as TabKey);
}

/**
 * Unified attendance settings page - consolidates self-service, regularization,
 * and policies settings into a single tabbed surface.
 *
 * Deep-linking: ?tab=self-service | regularization | policies
 */
export default function AttendanceSettingsPage() {
  const t = useTranslations('attendance.settingsPage');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active tab is local state (seeded once from the ?tab= deep-link param).
  // Local state - not a value derived from useSearchParams - drives the
  // controlled <Tabs>: a query-only router.replace does not reliably
  // re-render this client component, which would leave the tab stuck.
  // onTabChange updates the state (instant switch) AND the URL (deep-link).
  const rawTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabKey>(isValidTab(rawTab) ? rawTab : 'self-service');

  const onTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    router.replace(`/dashboard/attendance/settings?tab=${key}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<SettingOutlined />} />

      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        items={[
          {
            key: 'self-service',
            label: t('tabSelfService'),
            children: <SelfServiceSettingsPanel />,
          },
          {
            key: 'regularization',
            label: t('tabRegularization'),
            children: <RegularizationSettingsPanel />,
          },
          {
            key: 'policies',
            label: t('tabPolicies'),
            children: <PoliciesSettingsPanel />,
          },
        ]}
      />
    </div>
  );
}
