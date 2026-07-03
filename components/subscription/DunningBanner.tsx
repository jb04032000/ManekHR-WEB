'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from 'antd';
import {
  WarningOutlined,
  CloseOutlined,
  CreditCardOutlined,
  PhoneOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { getDunningStatus } from '@/lib/actions';
import type { DunningStatus } from '@/types';

const POLL_MS = 60_000;
const DISMISS_KEY = 'dunning-banner-dismissed-at';
const DISMISS_TTL_MS = 6 * 60 * 60 * 1000; // 6h

/**
 * Global dunning banner - renders inside dashboard layout. Polls the
 * dunning status every 60s and surfaces grace-period / past-due state
 * with a recovery CTA + sales contact. Dismissed banners stay hidden
 * for 6 hours per browser.
 */
export function DunningBanner() {
  const [status, setStatus] = useState<DunningStatus | null>(null);
  // Lazy initial state - read localStorage during the very first render so we
  // don't trigger a setState-in-effect cascade on mount.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    const ageMs = Date.now() - parseInt(dismissedAt, 10);
    if (ageMs < DISMISS_TTL_MS) return true;
    window.localStorage.removeItem(DISMISS_KEY);
    return false;
  });

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getDunningStatus();
      setStatus(s ?? null);
    } catch {
      // Silent - banner is purely informational.
    }
  }, []);

  useEffect(() => {
    // Polling lifecycle - fire-and-forget initial fetch + periodic refresh.
    // setState happens after the awaited network round-trip, not synchronously,
    // but the lint rule cannot prove that across the useCallback boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStatus();
    const interval = window.setInterval(() => {
      void fetchStatus();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchStatus();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchStatus]);

  if (!status || !status.inDunning || dismissed) return null;

  const isCritical = status.inGracePeriod;

  const handleDismiss = () => {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  return (
    <div
      className={`relative mb-4 rounded-xl border-2 px-4 py-3 ${
        isCritical
          ? 'border-red-300 bg-gradient-to-r from-red-50 to-orange-50'
          : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            isCritical ? 'bg-red-100' : 'bg-amber-100'
          }`}
        >
          <WarningOutlined
            className={`text-xl ${isCritical ? 'text-red-700' : 'text-amber-700'}`}
          />
        </div>

        <div className="flex-1">
          <p
            className={`m-0 mb-1 font-display text-base font-bold ${
              isCritical ? 'text-red-900' : 'text-amber-900'
            }`}
          >
            {isCritical
              ? `Payment failed - ${status.daysRemaining ?? 0} day${status.daysRemaining === 1 ? '' : 's'} until access ends`
              : 'Payment failed - please update your payment method'}
          </p>
          <p className={`m-0 text-sm ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
            {isCritical
              ? `We've tried ${status.failedPaymentAttempts} time${status.failedPaymentAttempts === 1 ? '' : 's'} to charge your saved payment method. ${status.isReadOnly ? 'Your account is in read-only mode - you cannot make changes until billing is restored.' : 'Update it now to keep using ManekHR without interruption.'}`
              : `We couldn't charge your saved payment method (${status.failedPaymentAttempts} failed attempt${status.failedPaymentAttempts === 1 ? '' : 's'}). Update it before we move you into a grace period.`}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Link href="/account/subscription/payment-method">
              <Button type="primary" size="small" icon={<CreditCardOutlined />} danger={isCritical}>
                Update Payment Method
              </Button>
            </Link>

            {status.showContactSalesCta && status.salesContact && (
              <>
                {status.salesContact.email && (
                  <a href={`mailto:${status.salesContact.email}`}>
                    <Button size="small" icon={<MailOutlined />}>
                      Contact Sales
                    </Button>
                  </a>
                )}
                {status.salesContact.phone && (
                  <a href={`tel:${status.salesContact.phone}`}>
                    <Button size="small" icon={<PhoneOutlined />}>
                      {status.salesContact.phone}
                    </Button>
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleDismiss}
          aria-label="Dismiss"
        />
      </div>
    </div>
  );
}
