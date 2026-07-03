'use client';
import { ReactNode } from 'react';
import Link from 'next/link';
import { Tooltip } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useSubscriptionStore } from '@/lib/store';
import {
  SALES_FEATURE_ACCESS,
  type SalesFeatureKey,
} from '@/lib/constants/feature-access.registry';

interface Props {
  feature: SalesFeatureKey;
  children: ReactNode;
  fallback?: 'lock' | 'hide' | 'upsell-overlay';
}

export function EntitlementGate({ feature, children, fallback = 'lock' }: Props) {
  const { plan, isHydrated } = useSubscriptionStore();
  if (!isHydrated) return null; // wait for store hydration to avoid flash

  const featureDef = SALES_FEATURE_ACCESS[feature];
  const currentTier = plan?.tier ?? 'Free';
  const allowed = featureDef?.tiers.includes(currentTier as never);
  if (allowed) return <>{children}</>;

  const featureLabel = featureDef?.label ?? String(feature);
  const firstTier = featureDef?.tiers[0] ?? 'Pro';
  const upgradeMessage = `Upgrade to ${firstTier} to enable ${featureLabel}`;

  if (fallback === 'hide') return null;

  if (fallback === 'upsell-overlay') {
    return (
      <div className="relative">
        <div inert className="pointer-events-none opacity-40 select-none">
          {children}
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center rounded-md"
          style={{ background: 'rgba(243,232,255,0.6)' }}
        >
          <div className="px-6 py-4 text-center">
            <LockOutlined style={{ fontSize: 28, color: 'var(--cr-primary)' }} />
            <div className="mt-2 text-sm font-bold" style={{ color: 'var(--cr-text)' }}>
              {upgradeMessage}
            </div>
            <Link
              href="/dashboard/workspace?tab=subscription"
              className="mt-2 inline-block text-xs"
              style={{ color: 'var(--cr-primary)' }}
            >
              View plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 'lock' default - wrap children with tooltip, disable interactions
  return (
    <Tooltip title={upgradeMessage} placement="top">
      <span className="pointer-events-none inline-block cursor-not-allowed opacity-50">
        {children}
      </span>
    </Tooltip>
  );
}
