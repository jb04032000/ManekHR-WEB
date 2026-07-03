'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsPageHeader } from '@/components/ui';
import { DevicesPanel } from '@/components/dashboard/attendance/devices/DevicesPanel';
import KioskSetupClient from '@/components/dashboard/attendance/devices/KioskSetupClient';

const VALID_TABS = ['devices', 'kiosk'] as const;
type TabKey = (typeof VALID_TABS)[number];

function isValidTab(key: string | null): key is TabKey {
  return VALID_TABS.includes(key as TabKey);
}

/**
 * Unified attendance devices page - consolidates Biometric Devices and
 * Kiosk Setup into a single tabbed surface.
 *
 * Deep-linking: ?tab=devices | kiosk
 */
export default function AttendanceDevicesPage() {
  const t = useTranslations('attendance.devicesPage');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active tab is local state (seeded once from the ?tab= deep-link param).
  // Local state - not a value derived from useSearchParams - drives the
  // controlled <Tabs>: a query-only router.replace does not reliably
  // re-render this client component, which would leave the tab stuck.
  // onTabChange updates the state (instant switch) AND the URL (deep-link).
  const rawTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabKey>(isValidTab(rawTab) ? rawTab : 'devices');

  const onTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    router.replace(`/dashboard/attendance/devices?tab=${key}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<ApiOutlined />} />

      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        items={[
          {
            key: 'devices',
            label: t('tabDevices'),
            children: <DevicesPanel />,
          },
          {
            key: 'kiosk',
            label: t('tabKiosk'),
            children: <KioskSetupClient />,
          },
        ]}
      />
    </div>
  );
}
