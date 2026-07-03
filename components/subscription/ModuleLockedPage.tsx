'use client';

import { LockOutlined, HomeOutlined, CrownOutlined } from '@ant-design/icons';
import { MODULE_LABELS } from '@/lib/utils';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';

interface ModuleLockedPageProps {
  module: string;
}

export function ModuleLockedPage({ module }: ModuleLockedPageProps) {
  const moduleLabel = MODULE_LABELS[module] || module;

  return (
    <EmptyStateLayout
      icon={<LockOutlined style={{ color: 'var(--cr-text-4)' }} />}
      iconBgColor="bg-neutral-100"
      iconSize="md"
      title={`${moduleLabel} is Not Available`}
      description={`Your current plan doesn't include access to the ${moduleLabel} module. Upgrade your plan to unlock this feature and take your business to the next level.`}
      actions={[
        {
          label: 'Go to Dashboard',
          href: '/dashboard',
          icon: <HomeOutlined />,
        },
        {
          label: 'Upgrade Plan',
          href: '/account/subscription/plans',
          type: 'primary',
          icon: <CrownOutlined />,
          className: 'cr-btn-gold',
        },
      ]}
    />
  );
}
