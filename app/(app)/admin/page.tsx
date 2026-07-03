'use client';
import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Skeleton } from 'antd';
import {
  TeamOutlined,
  BankOutlined,
  CrownOutlined,
  UserAddOutlined,
  RiseOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { getAdminStats, getTiers } from '@/lib/actions';
import { DsCardTitle } from '@/components/ui';
import { formatCurrencyFull, fmt } from '@/lib/utils';
import type { Tier } from '@/types';
import dayjs from 'dayjs';

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  proSubscriptions: number;
  monthlyRevenue: number;
  newUsersLast7Days: number;
  activeWorkspaces: number;
  recentUsers: { _id: string; name: string; email: string; createdAt: string }[];
  planBreakdown: Record<string, number>;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAdminStats(), getTiers()])
      .then(([statsRes, tiersRes]) => {
        setStats(statsRes as unknown as AdminStats);
        setTiers(tiersRes ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getTierColor = (tierKey: string): string => {
    const tier = tiers.find((t) => t.key === tierKey);
    return tier?.color || 'default';
  };

  const cards = [
    {
      label: 'Total Users',
      val: stats?.totalUsers ?? 0,
      icon: <TeamOutlined />,
      grad: 'grad-blue',
      sub: 'Registered accounts',
    },
    {
      label: 'Total Workspaces',
      val: stats?.totalWorkspaces ?? 0,
      icon: <BankOutlined />,
      grad: 'grad-purple',
      sub: 'Active workspaces',
    },
    {
      label: 'Pro Subscribers',
      val: stats?.proSubscriptions ?? 0,
      icon: <CrownOutlined />,
      grad: 'grad-amber',
      sub: 'Paid plans',
    },
    {
      label: 'Monthly Revenue',
      val: formatCurrencyFull(stats?.monthlyRevenue ?? 0),
      icon: <RupeeOutlined />,
      grad: 'grad-green',
      sub: `${dayjs().format('MMMM YYYY')}`,
    },
  ];

  const secondaryCards = [
    {
      label: 'New Users (7d)',
      val: stats?.newUsersLast7Days ?? 0,
      icon: <UserAddOutlined />,
      grad: 'grad-teal',
      sub: 'Last 7 days',
    },
    {
      label: 'Active Workspaces',
      val: stats?.activeWorkspaces ?? 0,
      icon: <RiseOutlined />,
      grad: 'grad-indigo',
      sub: 'With activity this month',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Top stat cards - 4 per row */}
      <Row gutter={[16, 16]}>
        {cards.map((c, i) => (
          <Col xs={12} md={6} key={i}>
            <div
              className={`${c.grad} card-hover animate-fade-up rounded-2xl px-5 py-4.5`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-[22px] text-surface">
                  {c.icon}
                </div>
                <ArrowRightOutlined className="text-sm text-white/60" />
              </div>
              {loading ? (
                <Skeleton.Input active size="small" className="mb-1.5 bg-white/30" />
              ) : (
                <p className="m-0 mb-1 font-display text-[26px] leading-none font-extrabold text-surface">
                  {c.val}
                </p>
              )}
              <p className="m-0 mb-1 text-[11px] font-bold tracking-wider text-white/70 uppercase">
                {c.label}
              </p>
              <p className="m-0 text-[11px] text-white/55">{c.sub}</p>
            </div>
          </Col>
        ))}
      </Row>

      {/* Secondary stat cards - 2 per row */}
      <Row gutter={[16, 16]}>
        {secondaryCards.map((c, i) => (
          <Col xs={12} md={12} key={i}>
            <div
              className={`${c.grad} card-hover animate-fade-up rounded-2xl px-5 py-4.5`}
              style={{ animationDelay: `${(i + 4) * 0.06}s` }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-[22px] text-surface">
                  {c.icon}
                </div>
                <ArrowRightOutlined className="text-sm text-white/60" />
              </div>
              {loading ? (
                <Skeleton.Input active size="small" className="mb-1.5 bg-white/30" />
              ) : (
                <p className="m-0 mb-1 font-display text-[26px] leading-none font-extrabold text-surface">
                  {c.val}
                </p>
              )}
              <p className="m-0 mb-1 text-[11px] font-bold tracking-wider text-white/70 uppercase">
                {c.label}
              </p>
              <p className="m-0 text-[11px] text-white/55">{c.sub}</p>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<DsCardTitle>Recent Signups</DsCardTitle>} loading={loading}>
            {stats?.recentUsers?.length ? (
              <Table
                size="small"
                dataSource={stats.recentUsers}
                rowKey="_id"
                pagination={false}
                columns={[
                  {
                    title: 'Name',
                    dataIndex: 'name',
                    key: 'name',
                    render: (v) => <span className="text-[13px] font-semibold">{v}</span>,
                  },
                  { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
                  {
                    title: 'Joined',
                    dataIndex: 'createdAt',
                    key: 'joined',
                    render: (v) => fmt(v),
                    width: 110,
                  },
                ]}
              />
            ) : (
              <p className="py-6 text-center text-subtle">No data available</p>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<DsCardTitle>Subscription Breakdown</DsCardTitle>} loading={loading}>
            {stats?.planBreakdown ? (
              <div className="flex flex-col gap-3">
                {Object.entries(stats.planBreakdown).map(([plan, count]) => (
                  <div
                    key={plan}
                    className="bg-background flex items-center justify-between rounded-[10px] px-3.5 py-2.5"
                  >
                    <Tag color={getTierColor(plan)} className="capitalize">
                      {plan}
                    </Tag>
                    <span className="font-display text-lg font-bold">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-subtle">No data available</p>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
