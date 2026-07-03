'use client';

import { Space, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface ComingSoonPromptProps {
  module?: string;
  subFeature?: string;
  compact?: boolean;
  /** Heading level for the title. Default `h2` (embedded). Pass `h1` when this prompt is the page-level fallback (no other H1 on the route). */
  as?: 'h1' | 'h2';
}

/**
 * Locked-module card for modules the platform flags "Coming Soon"
 * (admin-set via /admin/settings -> subscription store comingSoonModules).
 * Rendered by FeatureGate/ModuleGate INSTEAD of UpgradePrompt when
 * useFeatureAccess reports isComingSoon - same card anatomy as UpgradePrompt
 * (keep the two visually in sync), but no lock icon and no upgrade CTA:
 * the module is not for sale yet, so we must not point users at plans.
 */
export function ComingSoonPrompt({
  module,
  subFeature,
  compact = false,
  as = 'h2',
}: ComingSoonPromptProps) {
  const t = useTranslations('subscription.comingSoonPrompt');

  if (compact) {
    return (
      <Space size={4}>
        <ClockCircleOutlined className="text-faint" />
        <Text type="secondary" className="text-xs">
          {t('compact')}
        </Text>
      </Space>
    );
  }

  // Same feature-name derivation as UpgradePrompt (keep in sync).
  const formatModule = (m?: string) => (m ? `${m.charAt(0).toUpperCase()}${m.slice(1)}` : '');
  const cleanSubFeature = (sf: string, m?: string) => {
    const prefix = m ? `${m}_` : '';
    return (prefix && sf.startsWith(prefix) ? sf.slice(prefix.length) : sf).replace(/_/g, ' ');
  };

  const featureName = subFeature
    ? `${formatModule(module)} ${cleanSubFeature(subFeature, module)}`.trim()
    : module
      ? formatModule(module)
      : t('thisFeature');

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
          background: 'var(--cr-primary-light)',
          border: '1px solid var(--cr-primary)',
        }}
      >
        <ClockCircleOutlined style={{ color: 'var(--cr-primary)', fontSize: 16 }} />
      </div>
      <Heading
        className="m-0 mb-1 font-display text-[14px] font-semibold"
        style={{ color: 'var(--cr-text)' }}
      >
        {t('title', { feature: featureName })}
      </Heading>
      <p
        className="m-0 mb-4 text-[12px] leading-snug"
        style={{ color: 'var(--cr-text-4)', maxWidth: '20rem' }}
      >
        {t('description')}
      </p>
    </div>
  );
}
