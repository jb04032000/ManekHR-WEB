'use client';

import { useEffect, useState } from 'react';
import { Card, Spin, Statistic, Empty } from 'antd';
import dayjs from 'dayjs';
import { adminCouponStats } from '@/lib/actions';
import { Money } from '@/lib/money';
import type { CouponRedemptionStats } from '@/types';

interface Props {
  couponId: string;
}

export function CouponRedemptionStatsCard({ couponId }: Props) {
  const [stats, setStats] = useState<CouponRedemptionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminCouponStats(couponId)
      .then((res) => !cancelled && setStats(res))
      .catch(() => !cancelled && setStats(null))
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

  if (!stats) {
    return (
      <Card className="rounded-2xl">
        <Empty description="No redemption stats available" />
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl" title="Redemption stats">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Statistic
          title="Total redemptions"
          value={stats.totalRedemptions ?? 0}
        />
        <Statistic
          title="Total discount"
          value={Money.fromPaise(stats.totalDiscountPaise ?? 0).format()}
        />
        <Statistic title="Unique users" value={stats.uniqueUsers ?? 0} />
      </div>
      {stats.lastRedeemedAt && (
        <p className="text-xs text-subtle mt-3 mb-0">
          Last redeemed {dayjs(stats.lastRedeemedAt).fromNow?.() ?? dayjs(stats.lastRedeemedAt).format('DD MMM YYYY')}
        </p>
      )}
    </Card>
  );
}
