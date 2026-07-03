'use client';

import { useEffect, useState } from 'react';
import { Card, Spin, Statistic, Empty, Tag, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { adminCouponAttribution } from '@/lib/actions';
import { Money } from '@/lib/money';
import type { CouponAttribution } from '@/types';

interface Props {
  couponId: string;
}

export function CouponAttributionCard({ couponId }: Props) {
  const [data, setData] = useState<CouponAttribution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminCouponAttribution(couponId)
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [couponId]);

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <div className="flex justify-center py-6"><Spin /></div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="rounded-2xl">
        <Empty description="No attribution data yet" />
      </Card>
    );
  }

  const cycles = Object.entries(data.perCycleBreakdown ?? {});

  return (
    <Card
      className="rounded-2xl"
      title={
        <div className="flex items-center gap-2">
          Revenue Attribution
          <Tooltip title="Joins coupon redemptions to captured payments. Net = gross − refunded.">
            <InfoCircleOutlined className="text-muted" />
          </Tooltip>
        </div>
      }
      extra={
        data.campaignKey ? (
          <Tag color="blue" className="font-mono">{data.campaignKey}</Tag>
        ) : null
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Statistic
          title="Gross revenue"
          value={Money.fromPaise(data.grossRevenuePaise).format()}
          styles={{ content: { color: 'var(--cr-success-700)', fontSize: 20 } }}
        />
        <Statistic
          title="Discount given"
          value={Money.fromPaise(data.discountGivenPaise).format()}
          styles={{ content: { color: 'var(--cr-info-700)', fontSize: 20 } }}
        />
        <Statistic
          title="Refunded"
          value={Money.fromPaise(data.refundedPaise).format()}
          styles={{ content: { color: 'var(--cr-warning-700)', fontSize: 20 } }}
        />
        <Statistic
          title="Net revenue"
          value={Money.fromPaise(data.netRevenuePaise).format()}
          styles={{ content: { fontSize: 20, fontWeight: 700 } }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="px-3 py-2.5 bg-gray-50 rounded-lg">
          <p className="text-xs text-subtle m-0 mb-1">Paid conversions</p>
          <p className="text-2xl font-bold text-heading m-0">
            {data.paidConversions}
          </p>
          <p className="text-xs text-subtle m-0">
            captured SubscriptionPayment rows linked to this coupon
          </p>
        </div>

        <div className="px-3 py-2.5 bg-gray-50 rounded-lg">
          <p className="text-xs text-subtle m-0 mb-1">Per-cycle breakdown</p>
          {cycles.length === 0 ? (
            <p className="text-sm text-muted m-0">No paid conversions yet</p>
          ) : (
            <div className="flex flex-col gap-1.5 mt-1">
              {cycles.map(([cycle, stats]) => (
                <div key={cycle} className="flex items-center justify-between text-sm">
                  <span className="capitalize">
                    {cycle} <Tag>{stats.count}</Tag>
                  </span>
                  <span className="font-medium">
                    {Money.fromPaise(stats.revenuePaise).format()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
