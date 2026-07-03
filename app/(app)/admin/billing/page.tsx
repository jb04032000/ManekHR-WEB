'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Statistic, Button, Spin, Empty } from 'antd';
import {
  RollbackOutlined,
  TagOutlined,
  LinkOutlined,
  SafetyOutlined,
  FileSearchOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import {
  adminListPendingRefunds,
  adminListPaymentLinks,
  adminListCoupons,
  adminQueryAuditLog,
} from '@/lib/actions';
import { AuditLogTable } from '@/components/admin/billing/AuditLogTable';

export default function AdminBillingOverviewPage() {
  const [counts, setCounts] = useState<{
    pendingRefunds: number;
    openPaymentLinks: number;
    activeCoupons: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adminListPendingRefunds({ limit: 1 }).catch(() => []),
      adminListPaymentLinks({ status: 'created', limit: 1 }).catch(() => null),
      adminListCoupons({ isActive: true, limit: 1 }).catch(() => null),
      // Pre-warm audit query so the embedded table renders quickly.
      adminQueryAuditLog({ limit: 1 }).catch(() => null),
    ])
      .then(([refunds, links, coupons]) => {
        if (cancelled) return;
        setCounts({
          pendingRefunds: Array.isArray(refunds) ? refunds.length : 0,
          openPaymentLinks: links?.total ?? 0,
          activeCoupons: coupons?.total ?? 0,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <Statistic
            title="Pending refund requests"
            value={counts?.pendingRefunds ?? 0}
            prefix={<RollbackOutlined className="mr-1 text-orange-700" />}
          />
          <Link href="/admin/billing/refunds">
            <Button type="link" className="mt-2 px-0">
              Open queue →
            </Button>
          </Link>
        </Card>

        <Card className="rounded-2xl">
          <Statistic
            title="Open payment links"
            value={counts?.openPaymentLinks ?? 0}
            prefix={<LinkOutlined className="mr-1 text-blue-700" />}
          />
          <Link href="/admin/billing/payment-links">
            <Button type="link" className="mt-2 px-0">
              Manage links →
            </Button>
          </Link>
        </Card>

        <Card className="rounded-2xl">
          <Statistic
            title="Active coupons"
            value={counts?.activeCoupons ?? 0}
            prefix={<TagOutlined className="mr-1 text-green-700" />}
          />
          <Link href="/admin/billing/coupons">
            <Button type="link" className="mt-2 px-0">
              Manage coupons →
            </Button>
          </Link>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickLink
          icon={<SafetyOutlined />}
          title="Policies"
          desc="Edit billing + refund policies."
          href="/admin/billing/policy"
        />
        <QuickLink
          icon={<CreditCardOutlined />}
          title="Payments"
          desc="Browse every payment across users."
          href="/admin/billing/payments"
        />
        <QuickLink
          icon={<FileSearchOutlined />}
          title="Audit log"
          desc="Filter every state change."
          href="/admin/billing/audit"
        />
      </div>

      {/* Recent audit feed */}
      <div>
        <h2 className="m-0 mb-2 font-display text-lg font-bold text-heading">Recent activity</h2>
        {counts === null ? <Empty /> : <AuditLogTable />}
      </div>
    </div>
  );
}

function QuickLink({
  icon,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card hoverable className="h-full rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">
            {icon}
          </div>
          <div>
            <p className="m-0 mb-1 font-semibold text-heading">{title}</p>
            <p className="m-0 text-xs text-muted">{desc}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
