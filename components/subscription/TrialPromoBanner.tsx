'use client';

import { Alert } from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

/**
 * Slim, on-brand promo banner announcing the free trial that ships with every
 * plan. Presentational only - the caller fetches the admin-controlled config
 * (`getTrialBannerConfig`) and passes the resolved props in.
 *
 * What it does: renders a positive, gold-accented "success" Alert with the
 * trial headline. Text is the admin `headlineOverride` when set, else the
 * localized default (marketing.pages.erpPricing.trialBanner.headline) with the
 * trial length interpolated.
 *
 * Cross-module links: rendered atop both the in-app plans hub
 * (app/account/subscription/plans/page.tsx) AND the public marketing pricing
 * page (app/(marketing)/erp/pricing/page.tsx). Config comes from the public
 * BE endpoint via lib/actions getTrialBannerConfig.
 *
 * Watch: NOT dismissible (admin-controlled promo, not a per-user notice). Hidden
 * entirely when disabled or when days <= 0, so a failed/empty fetch shows nothing
 * rather than a broken banner. The icon is decorative (aria-hidden) - the headline
 * carries the meaning for screen readers.
 */
export function TrialPromoBanner({
  enabled,
  headlineOverride,
  days,
}: {
  enabled: boolean;
  headlineOverride: string;
  days: number;
}) {
  const t = useTranslations('marketing.pages.erpPricing');

  // Render nothing unless the admin enabled it AND we have a real trial length.
  // Keeps the action's fail-soft default ({ enabled:false, days:0 }) invisible.
  if (!enabled || days <= 0) return null;

  // Admin override wins; otherwise the localized default with {days} filled in.
  const text = headlineOverride.trim() ? headlineOverride : t('trialBanner.headline', { days });

  return (
    <Alert
      type="success"
      showIcon
      icon={<GiftOutlined aria-hidden />}
      title={text}
      className="mb-4 border-[var(--cr-gold-400)] bg-[var(--cr-gold-100)]"
      role="note"
    />
  );
}
