'use client';

import { useEffect, useState, startTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Spin, Tag, Button, Descriptions, Empty, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminFetchCoupon } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import { CouponEditor } from '@/components/admin/billing/CouponEditor';
import { CouponRedemptionStatsCard } from '@/components/admin/billing/CouponRedemptionStats';
import { CouponAttributionCard } from '@/components/admin/billing/CouponAttributionCard';
import type { Coupon } from '@/types';

export default function AdminCouponDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  const refresh = async () => {
    if (!id) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await adminFetchCoupon(id);
      startTransition(() => {
        setCoupon(res);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  if (!coupon) {
    return (
      <Card className="rounded-2xl">
        <Empty description="Coupon not found" />
        <div className="mt-4 flex justify-center">
          <Button onClick={() => router.push('/admin/billing/coupons')}>Back to coupons</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {ctx}

      <div className="flex items-center justify-between">
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          className="px-0"
          onClick={() => router.push('/admin/billing/coupons')}
        >
          Back to coupons
        </Button>
        <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>

      <Card className="rounded-2xl">
        <div className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-3">
          <Tag color={coupon.isActive ? 'green' : 'red'}>
            {coupon.isActive ? 'Active' : 'Archived'}
          </Tag>
          <h1 className="m-0 font-mono text-2xl font-bold">{coupon.code}</h1>
        </div>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Discount type">
            <Tag>{coupon.discountType}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Value">
            {coupon.discountType === 'percentage'
              ? `${coupon.valueOrPaise}%`
              : Money.fromPaise(coupon.valueOrPaise).format()}
          </Descriptions.Item>
          <Descriptions.Item label="Valid from">
            {coupon.validFrom ? dayjs(coupon.validFrom).format('DD MMM YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Valid until">
            {coupon.validUntil ? dayjs(coupon.validUntil).format('DD MMM YYYY') : '∞'}
          </Descriptions.Item>
          <Descriptions.Item label="Max redemptions">
            {coupon.maxRedemptions ?? 'Unlimited'}
          </Descriptions.Item>
          <Descriptions.Item label="Per-user cap">
            {coupon.maxRedemptionsPerUser ?? 'Unlimited'}
          </Descriptions.Item>
          <Descriptions.Item label="First-time only">
            {coupon.isFirstTimeOnly ? 'Yes' : 'No'}
          </Descriptions.Item>
          <Descriptions.Item label="Stackable">
            {coupon.isStackable ? 'Yes' : 'No'}
          </Descriptions.Item>
          <Descriptions.Item label="Auto-apply key" span={2}>
            {coupon.autoApplyCampaignKey ? (
              <span className="font-mono">{coupon.autoApplyCampaignKey}</span>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Restrict to plans" span={2}>
            {coupon.applicablePlanIds.length === 0
              ? 'All plans'
              : coupon.applicablePlanIds.map((p) => (
                  <Tag key={p} className="font-mono text-xs">
                    {p.slice(0, 10)}…
                  </Tag>
                ))}
          </Descriptions.Item>
          {coupon.description && (
            <Descriptions.Item label="Description" span={2}>
              {coupon.description}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <CouponRedemptionStatsCard couponId={coupon._id} />

      <CouponAttributionCard couponId={coupon._id} />

      <CouponEditor
        open={editing}
        coupon={coupon}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          setCoupon(saved);
        }}
      />
    </div>
  );
}
