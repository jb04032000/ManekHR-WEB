'use client';

import { useEffect, useState, startTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Typography, Space, Spin } from 'antd';
import { useTranslations } from 'next-intl';
import { subscriptionsApi } from '@/lib/api/modules/subscriptions.api';
import type { Plan } from '@/types';

const { Title, Text } = Typography;

export default function PlatformRestrictedClient() {
  const t = useTranslations('platform');
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return_to');
  const planName = searchParams.get('plan');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlans = async () => {
    try {
      const response = await subscriptionsApi.getPlans();
      const allPlans = Array.isArray(response) ? response : [];
      const upgradePlans = allPlans.filter((p) => {
        const access = p.entitlements?.platformAccess;
        return access === 'both' || access === 'web_only';
      });
      startTransition(() => {
        setPlans(upgradePlans);
      });
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleUpgrade = () => {
    router.push('/upgrade/plans');
  };

  const handleContinuePreview = () => {
    const targetUrl = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
    router.push(targetUrl);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--cr-neutral-100)',
      }}
    >
      <Card style={{ maxWidth: 500, width: '100%', borderRadius: 12 }}>
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Title level={1} style={{ margin: 0, textAlign: 'center', fontSize: 24 }}>
            {t('platformRestrictedTitle')}
          </Title>

          <Text>
            {planName
              ? `Your current plan (${planName}) restricts access to this platform.`
              : 'Your current plan restricts access to this platform.'}
          </Text>

          <div>
            <Text strong>You&apos;re missing:</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>Full scheduling capabilities</li>
              <li>Reports and analytics</li>
              <li>Data exports</li>
              <li>Admin panel access</li>
            </ul>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : plans.length > 0 ? (
            <div>
              <Text strong>Upgrade to unlock web access:</Text>
              <Space orientation="vertical" style={{ width: '100%', marginTop: 12 }}>
                {plans.slice(0, 3).map((plan) => (
                  <Card key={plan._id} size="small" style={{ background: 'var(--cr-neutral-100)' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text strong>{plan.name}</Text>
                      <Text>₹{plan.monthlyPrice}/mo</Text>
                    </div>
                  </Card>
                ))}
              </Space>
            </div>
          ) : null}

          <Button type="primary" size="large" block onClick={handleUpgrade}>
            {t('switchPlatform')}
          </Button>

          <Button size="large" block onClick={handleContinuePreview}>
            Continue to Dashboard
          </Button>

          {returnTo && (
            <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
              Return to: {returnTo}
            </Text>
          )}
        </Space>
      </Card>
    </main>
  );
}
