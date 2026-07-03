'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs } from 'antd';
import {
  CrownOutlined,
  // AppstoreOutlined - re-import when the Add-Ons tab below is re-enabled.
  FileTextOutlined,
  // IdcardOutlined - re-import when the Billing Info tab below is re-enabled.
  // CreditCardOutlined - re-import when the Payment Method tab below is re-enabled.
  // RollbackOutlined - re-import when the Refunds tab below is re-enabled
  // (Refunds handled manually for now, owner decision 2026-06-23).
  HistoryOutlined,
  DashboardOutlined,
  // MessageOutlined - re-import when the Credits tab below is re-enabled.
} from '@ant-design/icons';

const BASE = '/account/subscription';

/**
 * Client navigation tab bar for the account Subscription hub.
 * Extracted from the layout so the layout can be a Server Component — avoids
 * the pattern of a `'use client'` layout that can interfere with Next.js 16's
 * server-rendering pipeline and cause the `NextIntlClientProvider` context to
 * be missing during error recovery.
 *
 * Uses `usePathname` to determine the active tab and `useRouter` to push on
 * tab change. `useTranslations('profile')` reads subscription tab labels.
 * Cross-module links: app/account/subscription/layout.tsx (parent),
 * app/account/subscription/* (tab pages).
 */
export function SubscriptionNavTabs() {
  const router = useRouter();
  const pathname = usePathname() ?? BASE;
  const t = useTranslations('profile');

  const tabs = [
    { key: '', label: t('subscription.tabs.overview'), icon: <DashboardOutlined /> },
    { key: 'plans', label: t('subscription.tabs.plans'), icon: <CrownOutlined /> },
    // Add-Ons, Credits, Payment Method and Billing Info tabs hidden for this
    // phase (owner decision 2026-06-25); they will be re-introduced later. The
    // route pages under app/account/subscription/{addons,credits,payment-method,
    // billing-info} are left intact (just unreachable from the nav) so re-enabling
    // is a one-line restore each. Re-import AppstoreOutlined / MessageOutlined /
    // CreditCardOutlined / IdcardOutlined above when restoring.
    // { key: 'addons', label: t('subscription.tabs.addons'), icon: <AppstoreOutlined /> },
    // { key: 'credits', label: t('subscription.tabs.credits'), icon: <MessageOutlined /> },
    { key: 'invoices', label: t('subscription.tabs.invoices'), icon: <FileTextOutlined /> },
    // { key: 'billing-info', label: t('subscription.tabs.billingInfo'), icon: <IdcardOutlined /> },
    // {
    //   key: 'payment-method',
    //   label: t('subscription.tabs.paymentMethod'),
    //   icon: <CreditCardOutlined />,
    // },
    // Refunds handled manually for now (owner decision 2026-06-23); re-enable
    // when self-serve refunds ship. The /account/subscription/refunds route page
    // is left intact (just unreachable from the nav) so re-enabling is a one-line
    // restore. Keep the RollbackOutlined import for that restore.
    // { key: 'refunds', label: t('subscription.tabs.refunds'), icon: <RollbackOutlined /> },
    { key: 'history', label: t('subscription.tabs.history'), icon: <HistoryOutlined /> },
  ];

  const trimmed = pathname.replace(BASE, '').replace(/^\//, '');
  const firstSeg = trimmed.split('/')[0];
  const active = tabs.find((tab) => tab.key === firstSeg)?.key ?? '';

  return (
    <Tabs
      activeKey={active}
      onChange={(key) => router.push(key ? `${BASE}/${key}` : BASE)}
      items={tabs.map((tab) => ({
        key: tab.key,
        label: (
          <span className="px-1">
            {tab.icon}
            <span className="ml-2">{tab.label}</span>
          </span>
        ),
      }))}
      tabBarStyle={{ marginBottom: 0 }}
    />
  );
}
