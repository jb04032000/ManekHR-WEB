'use client';

import { useCallback } from 'react';
import { App as AntApp, Alert, Tag } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { env } from '@/lib/env';

/**
 * Coming-soon gate for self-serve PAID actions in the account Subscription hub.
 *
 * Online payments are not live yet (`env.paymentsEnabled` is false by default;
 * plans/credits are assigned by an admin). This hook wraps any buy/upgrade/
 * top-up handler so that, while payments are off, the click shows a friendly
 * "online payments coming soon - contact your admin" notice instead of opening
 * a dead checkout. When `NEXT_PUBLIC_PAYMENTS_ENABLED=true`, `guard(proceed)`
 * just runs `proceed()` so the real checkout lights up with no other change.
 *
 * Usage in a page:
 *   const { paymentsEnabled, guard } = usePaymentsGate();
 *   <Button onClick={() => guard(() => openCheckout())}>Upgrade</Button>
 *
 * Cross-module links: gates the subscription/credits/add-ons checkout flows
 * (CheckoutView, MandateManager, purchaseCreditPack, purchaseAddOn).
 * Mirrors the backend reality (no gateway) - keep `env.paymentsEnabled` in sync
 * with the live gateway config.
 */
export function usePaymentsGate() {
  const { modal } = AntApp.useApp();
  const t = useTranslations('profile');
  const paymentsEnabled = env.paymentsEnabled;

  const guard = useCallback(
    (proceed: () => void) => {
      if (paymentsEnabled) {
        proceed();
        return;
      }
      modal.info({
        title: t('subscription.comingSoon.title'),
        content: t('subscription.comingSoon.body'),
        okText: t('subscription.comingSoon.ok'),
        centered: true,
      });
    },
    [paymentsEnabled, modal, t],
  );

  return { paymentsEnabled, guard };
}

/**
 * Small inline "Coming soon" pill to put next to a gated buy CTA so the state is
 * visible, not just discovered on click. Renders nothing once payments are live.
 */
export function PaymentsComingSoonTag({ className }: { className?: string }) {
  const t = useTranslations('profile');
  if (env.paymentsEnabled) return null;
  return (
    <Tag icon={<ClockCircleOutlined />} color="default" className={className}>
      {t('subscription.comingSoon.tag')}
    </Tag>
  );
}

/**
 * Page-top banner that explains buying isn't self-serve yet. Put it at the top of
 * any tab with buy/upgrade/top-up CTAs (Plans / Credits / Add-Ons / Payment
 * Method). Renders nothing once `env.paymentsEnabled` is true.
 */
export function PaymentsComingSoonAlert({ className }: { className?: string }) {
  const t = useTranslations('profile');
  if (env.paymentsEnabled) return null;
  return (
    <Alert
      type="info"
      showIcon
      icon={<ClockCircleOutlined />}
      title={t('subscription.comingSoon.title')}
      description={t('subscription.comingSoon.body')}
      className={className}
    />
  );
}
