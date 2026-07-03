'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, Spin, Button, Empty, Alert } from 'antd';
import { CreditCardOutlined, RocketOutlined } from '@ant-design/icons';
import { getMySubscription } from '@/lib/actions';
import { MandateManager } from '@/components/subscription/MandateManager';
import type { Subscription } from '@/types';

export default function PaymentMethodPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const my = await getMySubscription();
    setSub(my?.subscription ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 mb-1 font-display text-xl font-bold text-heading">Payment Method</h2>
        <p className="m-0 text-sm text-muted">
          Manage your auto-renew mandate. Pause, resume, or cancel anytime.
        </p>
      </div>

      {!sub ? (
        <Card className="rounded-2xl">
          <Empty
            image={<CreditCardOutlined className="text-5xl text-muted" />}
            description="No active subscription"
          >
            <Link href="/account/subscription/plans">
              <Button type="primary" icon={<RocketOutlined />}>
                Browse Plans
              </Button>
            </Link>
          </Empty>
        </Card>
      ) : !sub.razorpaySubscriptionId ? (
        <>
          <Alert
            type="info"
            showIcon
            title="One-time payment subscription"
            description="Your current plan was paid once. To switch to auto-renew, change your plan and select Auto-Renew at checkout."
          />
          <Card className="rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="m-0 mb-0.5 font-semibold text-heading">No saved payment method</p>
                <p className="m-0 text-sm text-muted">
                  Switch to auto-renew to save a payment method.
                </p>
              </div>
              <Link href="/account/subscription/plans">
                <Button type="primary">Switch to Auto-Renew</Button>
              </Link>
            </div>
          </Card>
        </>
      ) : (
        <MandateManager subscription={sub} onChanged={refresh} />
      )}
    </div>
  );
}
