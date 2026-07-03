'use client';

/**
 * Soft-prompt for browser push. Shows only when push is supported + permission
 * is still 'default' + not dismissed this session; clicking Enable fires the
 * native prompt via useBrowserPush. Mounted once by PwaManager. Cross-links:
 * useBrowserPush (lifecycle), push i18n group.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { App as AntApp, Button } from 'antd';
import { Bell, X } from 'lucide-react';
import { useBrowserPush } from '@/lib/push/useBrowserPush';

const DISMISS_KEY = 'z360.push.bannerDismissed';

export default function EnablePushBanner() {
  const t = useTranslations('push');
  const { message } = AntApp.useApp();
  const { supported, permission, enabled, busy, enable } = useBrowserPush();
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  if (!supported || enabled || permission !== 'default' || dismissed) return null;

  const onEnable = async () => {
    const res = await enable();
    if (res.ok) message.success(t('enabled'));
    // Step-specific message (permission/token/register/prefs) so the user
    // knows whether to fix browser settings or just retry. Cross-link:
    // useBrowserPush EnableResult + push.errors.* i18n keys.
    else message.error(t(`errors.${res.reason ?? 'token'}`));
  };

  const onDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label={t('bannerTitle')}
      // Mobile: span the width (minus side margins) and sit ABOVE the fixed
      // Connect bottom tab bar (ConnectMobileTabBar, md:hidden, bottom-0 +
      // safe-area), so the Enable button is never hidden behind the nav.
      // md+: revert to the right-aligned 320px card (no bottom bar there).
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 rounded-lg border bg-white p-4 shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:w-[320px]"
      style={{ borderColor: 'var(--cr-border, #e5e7eb)' }}
    >
      <div className="flex items-start gap-3">
        <Bell size={18} aria-hidden style={{ color: 'var(--cr-primary)' }} />
        <div className="flex-1">
          <p className="m-0 text-[14px] font-semibold">{t('bannerTitle')}</p>
          <p className="m-0 mt-1 text-[12.5px] text-muted">{t('bannerBody')}</p>
          <div className="mt-3 flex gap-2">
            <Button type="primary" size="small" loading={busy} onClick={onEnable}>
              {t('enable')}
            </Button>
            <Button size="small" onClick={onDismiss}>
              {t('dismiss')}
            </Button>
          </div>
        </div>
        <button aria-label={t('dismiss')} onClick={onDismiss} className="text-muted">
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
