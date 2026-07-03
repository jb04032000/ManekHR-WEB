'use client';

import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { env } from '@/lib/env';
import {
  INSTALL_DISMISSED_KEY,
  isIosInstallTarget,
  isRunningStandalone,
  parseDismissedAt,
  shouldShowInstallPrompt,
} from './pwa-utils';

// The iOS "Share" toolbar icon (a box with an up arrow). Inlined next to the
// install hint so the user sees exactly which button to tap, instead of hunting
// for an unlabelled "Share button".
function IosShareGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-primary"
    >
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

// The beforeinstallprompt event (Chromium only) - typed locally because the DOM
// lib doesn't ship a type for it.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Tasteful, dismissible "Install app" banner. Two paths:
//   - Chromium (Android / desktop Chrome/Edge): captures beforeinstallprompt and
//     triggers the native install on click.
//   - iOS Safari: no programmatic prompt exists, so it shows the
//     Share -> Add to Home Screen hint instead.
// Dismissals persist in localStorage and re-show after 30 days (see pwa-utils).
// Mounted app-wide by components/pwa/PwaManager.tsx (inside the antd + intl
// providers, both of which this needs).
export default function InstallPrompt() {
  const t = useTranslations('pwa.install');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!env.pwaEnabled) return;
    if (isRunningStandalone()) return;

    const dismissedAt = parseDismissedAt(
      typeof localStorage !== 'undefined' ? localStorage.getItem(INSTALL_DISMISSED_KEY) : null,
    );
    if (!shouldShowInstallPrompt({ isStandalone: false, dismissedAt, now: Date.now() })) return;

    // iPhone/iPad Safari: no event fires, so show the manual Add-to-Home-Screen
    // hint. Reveal on the next tick (not synchronously in the effect) so it
    // appears after first paint instead of flashing during hydration.
    if (isIosInstallTarget(navigator.userAgent, navigator.maxTouchPoints)) {
      const id = window.setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 0);
      return () => window.clearTimeout(id);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // suppress the browser mini-infobar; we show our own UI
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore storage errors (e.g. private mode)
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setVisible(false);
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t('aria')}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-md rounded-2xl border border-border bg-surface p-md shadow-lg"
    >
      <Image
        src="/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="shrink-0 rounded-xl"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold text-heading">{t('title')}</p>
        {iosHint ? (
          // Pair the instruction with the actual Share glyph so "the Share icon"
          // is unmistakable. Glyph first keeps word order safe across locales.
          <p className="m-0 mt-xs flex items-start gap-xs text-sm text-body">
            <IosShareGlyph />
            <span>{t('bodyIos')}</span>
          </p>
        ) : (
          <p className="m-0 mt-xs text-sm text-body">{t('body')}</p>
        )}
        <div className="mt-sm flex items-center gap-sm">
          {iosHint ? (
            <Button size="small" onClick={dismiss}>
              {t('gotIt')}
            </Button>
          ) : (
            <>
              <Button type="primary" size="small" onClick={install}>
                {t('action')}
              </Button>
              <Button type="text" size="small" onClick={dismiss}>
                {t('dismiss')}
              </Button>
            </>
          )}
        </div>
      </div>
      <Button
        type="text"
        size="small"
        aria-label={t('dismiss')}
        icon={<CloseOutlined />}
        onClick={dismiss}
        className="shrink-0"
      />
    </div>
  );
}
