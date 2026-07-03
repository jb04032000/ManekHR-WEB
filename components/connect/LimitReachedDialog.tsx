'use client';

/**
 * Shared "you have hit your plan limit" prompt, shown when a create is blocked by
 * the typed `CONNECT_LIMIT_REACHED` 403 from the backend. Wired into all four
 * Connect create flows (listing / storefront / company page / job) so a blocked
 * create gets this friendly upgrade prompt instead of a generic toast.
 *
 * There is now a real plan page to send people to (/account/subscription, the
 * product-neutral one reachable by Connect-only users), so the dialog leads with
 * a "View plans" CTA. Copy stays honest ("view your plans", not a fake instant
 * buy); "Got it" remains as the secondary/dismiss.
 *
 * Links: features/connect/connect-limit.ts (the typed info), lib/analytics-events
 * ConnectEvents.limitReached (the upsell-demand event fired on open). The CTA
 * target /account/subscription is kept in sync with the UsageMeter at-cap
 * popover + ConnectLimitsCard.
 */

import { useEffect } from 'react';
import { Button } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import type { ConnectLimitInfo } from '@/features/connect/connect-limit';

export interface LimitReachedDialogProps {
  open: boolean;
  /** The blocked-create detail, or null when there is nothing to show. */
  info: ConnectLimitInfo | null;
  onClose: () => void;
}

export function LimitReachedDialog({ open, info, onClose }: LimitReachedDialogProps) {
  const t = useTranslations('connect.limits');
  const router = useRouter();

  // Fire the upsell-demand event each time the dialog opens with info. This is
  // the whole point of the feature before pricing launches: measure how often
  // each cap is hit so prices can be set with data. kind + limit only (no PII).
  useEffect(() => {
    if (open && info) {
      trackEvent(ConnectEvents.limitReached, { kind: info.kind, limit: info.limit });
    }
  }, [open, info]);

  if (!info) return null;

  // Localized resource noun ("products" / "storefronts" / ...), interpolated into
  // the body. Keys live under connect.limits.kind.* in all four locale files.
  const kindLabel = t(`kind.${info.kind}`);

  return (
    <DsModal
      open={open}
      onCancel={onClose}
      title={t('title')}
      scrollable={false}
      width={460}
      footer={[
        // Secondary/dismiss.
        <Button key="ok" onClick={onClose}>
          {t('gotIt')}
        </Button>,
        // Primary: honest path to the plan page (not a fake instant-buy). Routes
        // to the product-neutral /account/subscription so Connect-only users
        // reach it; closes the dialog first so a back-nav lands cleanly.
        <Button
          key="plans"
          type="primary"
          onClick={() => {
            onClose();
            router.push('/account/subscription');
          }}
        >
          {t('viewPlans')}
        </Button>,
      ]}
    >
      <p className="mb-3 text-heading">
        {t('body', { used: info.used, limit: info.limit, kind: kindLabel })}
      </p>
      <p className="m-0 text-sm text-muted">{t('comingSoon')}</p>
    </DsModal>
  );
}
