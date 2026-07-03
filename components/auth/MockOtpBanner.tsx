'use client';

import { Alert } from 'antd';
import { useTranslations } from 'next-intl';
import { env } from '@/lib/env';
import { OTP_MOCK_UI_ALLOWED } from './otp-mock';

interface MockOtpBannerProps {
  /**
   * Force-show even when `NEXT_PUBLIC_AUTH_OTP_MOCK` is unset. Pass `true`
   * when the most recent /auth/send-otp response had `mockMode: true` (BE
   * runtime signal) - keeps FE honest if env vars drift between BE+FE.
   */
  force?: boolean;
  className?: string;
}

/**
 * Visible banner shown on /auth/* and /dashboard/settings/security/* whenever
 * SMS-OTP is in mock mode. Production deployments must NOT show this - the
 * triple-lock in BE main.ts refuses to boot if mock is on without the
 * explicit override.
 */
export function MockOtpBanner({ force, className }: MockOtpBannerProps) {
  const t = useTranslations('auth.mockBanner');
  // Extra go-live lock: the test-mode banner is impossible in a real production
  // build, regardless of the env flag OR the backend runtime `force` signal.
  // See components/auth/otp-mock.ts (mirrors the BE main.ts boot-guard).
  if (!OTP_MOCK_UI_ALLOWED) return null;
  if (!force && !env.authOtpMockEnabled) return null;
  return (
    <Alert
      type="warning"
      showIcon
      className={`mb-4 rounded-[10px] ${className ?? ''}`}
      title={t('title')}
      description={t('description')}
    />
  );
}
