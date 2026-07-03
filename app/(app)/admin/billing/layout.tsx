'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs } from 'antd';
import {
  DashboardOutlined,
  RollbackOutlined,
  TagOutlined,
  LinkOutlined,
  SafetyOutlined,
  FileSearchOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';

const TABS = [
  { key: '', label: 'Overview', icon: <DashboardOutlined /> },
  { key: 'refunds', label: 'Refund Queue', icon: <RollbackOutlined /> },
  { key: 'coupons', label: 'Coupons', icon: <TagOutlined /> },
  { key: 'payment-links', label: 'Payment Links', icon: <LinkOutlined /> },
  { key: 'payments', label: 'Payments', icon: <CreditCardOutlined /> },
  { key: 'policy', label: 'Policies', icon: <SafetyOutlined /> },
  { key: 'audit', label: 'Audit Log', icon: <FileSearchOutlined /> },
];

const BASE = '/admin/billing';

export default function AdminBillingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? BASE;
  const trimmed = pathname.replace(BASE, '').replace(/^\//, '');
  const firstSeg = trimmed.split('/')[0];
  const active = TABS.find((t) => t.key === firstSeg)?.key ?? '';

  return (
    <div>
      <div className="mb-5">
        <h2 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
          Billing Operations
        </h2>
        <p className="m-0 text-sm text-muted">
          Refunds, coupons, payment links, policies, and the full billing audit log.
        </p>
      </div>

      <Tabs
        activeKey={active}
        onChange={(key) => router.push(key ? `${BASE}/${key}` : BASE)}
        items={TABS.map((t) => ({
          key: t.key,
          label: (
            <span className="px-1">
              {t.icon}
              <span className="ml-2">{t.label}</span>
            </span>
          ),
        }))}
        className="mb-4"
        tabBarStyle={{ marginBottom: 0 }}
      />

      <div className="animate-fade-in">{children}</div>
    </div>
  );
}
