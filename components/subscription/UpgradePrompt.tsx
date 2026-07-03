'use client';

import { Button, Space, Typography } from 'antd';
import { LockOutlined, CrownOutlined, UpOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useSubscriptionStore } from '@/lib/store';

const { Text } = Typography;

interface UpgradePromptProps {
  module?: string;
  subFeature?: string;
  compact?: boolean;
  /** Heading level for the lock title. Default `h2` (embedded). Pass `h1` when this prompt is the page-level fallback (no other H1 on the route). */
  as?: 'h1' | 'h2';
}

export function UpgradePrompt({
  module,
  subFeature,
  compact = false,
  as = 'h2',
}: UpgradePromptProps) {
  const { plan } = useSubscriptionStore();

  if (compact) {
    return (
      <Space size={4}>
        <LockOutlined className="text-faint" />
        <Text type="secondary" className="text-xs">
          Upgrade to unlock
        </Text>
        <Link href="/account/subscription/plans">
          <Button type="link" size="small" className="h-auto p-0 text-xs">
            <UpOutlined /> Upgrade
          </Button>
        </Link>
      </Space>
    );
  }

  const formatModule = (m?: string) => (m ? `${m.charAt(0).toUpperCase()}${m.slice(1)}` : '');

  // Strip leading "module_" prefix from subFeature key to avoid "Machines machines maintenance"
  const cleanSubFeature = (sf: string, m?: string) => {
    const prefix = m ? `${m}_` : '';
    return (prefix && sf.startsWith(prefix) ? sf.slice(prefix.length) : sf).replace(/_/g, ' ');
  };

  const featureName = subFeature
    ? `${formatModule(module)} ${cleanSubFeature(subFeature, module)}`.trim()
    : module
      ? formatModule(module)
      : 'This feature';

  const description = plan
    ? `Your ${plan.name || plan.tier} plan doesn't include access to this feature.`
    : 'Upgrade your plan to unlock this feature.';

  const Heading = as;

  return (
    <div
      className="flex h-full flex-col items-center rounded-2xl px-5 py-7 text-center"
      style={{
        background: 'var(--cr-surface-2)',
        border: '1px dashed var(--cr-border)',
        minHeight: 220,
      }}
    >
      <div
        className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{
          background: 'var(--cr-gold-100)',
          border: '1px solid var(--cr-gold-400)',
        }}
      >
        <LockOutlined style={{ color: 'var(--cr-gold-700)', fontSize: 16 }} />
      </div>
      <Heading
        className="m-0 mb-1 font-display text-[14px] font-semibold"
        style={{ color: 'var(--cr-text)' }}
      >
        {featureName} is locked
      </Heading>
      <p
        className="m-0 mb-4 text-[12px] leading-snug"
        style={{ color: 'var(--cr-text-4)', maxWidth: '20rem' }}
      >
        {description}
      </p>
      <Link href="/account/subscription/plans">
        <Button type="primary" icon={<CrownOutlined />} className="cr-btn-gold" size="middle">
          Upgrade Plan
        </Button>
      </Link>
    </div>
  );
}
