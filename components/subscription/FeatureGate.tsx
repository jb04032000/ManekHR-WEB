'use client';

import { ReactNode } from 'react';
import { Skeleton } from 'antd';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';

interface FeatureGateProps {
  module: string;
  subFeature?: string;
  fallback?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  showLimitedIndicator?: boolean;
  onLimitedAction?: () => void;
  /** Heading level for the locked-state UpgradePrompt. Default `h2` (embedded gate). Pass `h1` when FeatureGate wraps the entire route. */
  as?: 'h1' | 'h2';
}

export function FeatureGate({
  module,
  subFeature,
  fallback,
  children,
  compact = false,
  showLimitedIndicator = false,
  onLimitedAction,
  as,
}: FeatureGateProps) {
  const { hasAccess, isLoading, isLimited, isLocked } = useFeatureAccess(
    module,
    subFeature,
  );

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 1 }} className="w-full" />;
  }

  if (isLocked) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <UpgradePrompt
        module={module}
        subFeature={subFeature}
        compact={compact}
        as={as}
      />
    );
  }

  if (isLimited && !showLimitedIndicator) {
    if (onLimitedAction) {
      onLimitedAction();
    }
    return <>{children}</>;
  }

  return <>{children}</>;
}

interface ModuleGateProps {
  module: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ModuleGate({ module, children, fallback }: ModuleGateProps) {
  const { hasAccess, isLoading } = useModuleAccess(module);

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 3 }} className="w-full" />;
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <UpgradePrompt
        module={module}
        compact={false}
      />
    );
  }

  return <>{children}</>;
}

function useModuleAccess(module: string) {
  return useFeatureAccess(module);
}
