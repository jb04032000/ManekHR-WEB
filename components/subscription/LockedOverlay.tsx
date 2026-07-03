'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { LockOutlined, CrownOutlined } from '@ant-design/icons';
import { Button, Skeleton } from 'antd';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface LockedOverlayProps {
  module: string;
  subFeature?: string;
  children: ReactNode;
  title?: string;
}

export function LockedOverlay({ module, subFeature, children, title }: LockedOverlayProps) {
  const { hasAccess, isLoading, isLocked } = useFeatureAccess(module, subFeature);

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 2 }} className="w-full" />;
  }

  if (!isLocked && hasAccess) return <>{children}</>;

  const label =
    title ??
    (subFeature ? subFeature.replace(/_/g, ' ') : module).replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="relative rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <LockOutlined className="text-amber-700" />
          <span className="truncate text-xs font-medium text-amber-900">
            {label} is locked on your current plan
          </span>
        </div>
        <Link href="/account/subscription" className="shrink-0">
          <Button
            type="primary"
            size="small"
            icon={<CrownOutlined />}
            className="border-amber-600 bg-amber-600 hover:!bg-amber-700"
          >
            Upgrade
          </Button>
        </Link>
      </div>
      <div inert className="pointer-events-none opacity-60 grayscale select-none">
        {children}
      </div>
    </div>
  );
}
