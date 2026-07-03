'use client';

/**
 * PreferencesForm - the full-page notification settings (fallback / deep-link
 * target from the drawer's "Open full settings"). Mirrors PreferencesDrawer
 * exactly via the shared PreferencesSections; only the chrome differs (page
 * header + rail instead of a drawer). Cross-links: preferences-sections.tsx,
 * notifications.actions.ts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App as AntApp } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { ConnectPage, Rail, RailPanel } from '@/components/connect';
import {
  updateNotificationPreferences,
  type GlobalChannelPrefs,
  type NotificationSettings,
} from './notifications.actions';
import PreferencesSections from './preferences-sections';

type Patch = Parameters<typeof updateNotificationPreferences>[0];

export default function PreferencesForm({ initial }: { initial: NotificationSettings }) {
  const t = useTranslations('connect.notifications');
  const { message } = AntApp.useApp();
  const [settings, setSettings] = useState<NotificationSettings>(initial);
  const pendingRef = useRef<Patch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGoodRef = useRef<NotificationSettings>(initial);

  useEffect(
    () => () => {
      // Cleanup the debounce timer on unmount (block body so the effect's
      // destructor returns void, not the timeout id / null).
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const flush = useCallback(async () => {
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    const res = await updateNotificationPreferences(patch);
    if (res.ok) {
      setSettings(res.data);
      lastGoodRef.current = res.data;
    } else {
      message.error(res.error || t('saveError'));
      setSettings(lastGoodRef.current);
    }
  }, [message, t]);

  const queue = useCallback(
    (patch: Patch, optimistic: (s: NotificationSettings) => NotificationSettings) => {
      setSettings((s) => optimistic(s));
      pendingRef.current = {
        prefs: { ...(pendingRef.current.prefs ?? {}), ...(patch.prefs ?? {}) },
        channels: { ...(pendingRef.current.channels ?? {}), ...(patch.channels ?? {}) },
        delivery: { ...(pendingRef.current.delivery ?? {}), ...(patch.delivery ?? {}) },
      };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), 500);
    },
    [flush],
  );

  const onModuleToggle = (categories: string[], next: boolean) =>
    queue({ prefs: Object.fromEntries(categories.map((c) => [c, { inPlatform: next }])) }, (s) => ({
      ...s,
      prefs: {
        ...s.prefs,
        ...Object.fromEntries(categories.map((c) => [c, { ...s.prefs[c], inPlatform: next }])),
      },
    }));
  const onChannelToggle = (channel: keyof GlobalChannelPrefs, next: boolean) =>
    queue({ channels: { [channel]: next } }, (s) => ({
      ...s,
      channels: { ...s.channels, [channel]: next },
    }));
  const onBatchingToggle = (next: boolean) =>
    queue({ delivery: { smartBatching: next } }, (s) => ({
      ...s,
      delivery: { ...s.delivery, smartBatching: next },
    }));
  // Build quiet-hours patches from the CURRENT optimistic `settings` (not the
  // last server-confirmed value) so two edits within one debounce window do not
  // clobber each other.
  const onQuietToggle = (next: boolean) =>
    queue(
      { delivery: { quietHours: { ...settings.delivery.quietHours, enabled: next } } },
      (s) => ({
        ...s,
        delivery: { ...s.delivery, quietHours: { ...s.delivery.quietHours, enabled: next } },
      }),
    );
  const onQuietTime = (which: 'start' | 'end', value: string) =>
    queue(
      { delivery: { quietHours: { ...settings.delivery.quietHours, [which]: value } } },
      (s) => ({
        ...s,
        delivery: { ...s.delivery, quietHours: { ...s.delivery.quietHours, [which]: value } },
      }),
    );

  return (
    <ConnectPage className="flex justify-center gap-5">
      <main className="w-full" style={{ maxWidth: 'var(--cn-feed-max-w, 600px)' }}>
        <header className="mb-4">
          <Link
            href="/connect/notifications"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted no-underline transition-colors hover:text-body"
          >
            <ArrowLeft size={15} aria-hidden />
            {t('backToCenter')}
          </Link>
          <h1 className="mt-2 mb-1 font-display text-[22px] font-bold text-heading">
            {t('preferencesTitle')}
          </h1>
          <p className="m-0 text-[13px] text-muted">{t('preferencesSubtitle')}</p>
        </header>

        <PreferencesSections
          settings={settings}
          onModuleToggle={onModuleToggle}
          onChannelToggle={onChannelToggle}
          onBatchingToggle={onBatchingToggle}
          onQuietToggle={onQuietToggle}
          onQuietTime={onQuietTime}
        />
        <p className="mt-3 text-[12px] text-muted">{t('futureChannelsNote')}</p>
      </main>

      <Rail side="right">
        <RailPanel title={t('railTitle')}>
          <p className="m-0 text-[12.5px] leading-relaxed text-muted">{t('preferencesRailBody')}</p>
        </RailPanel>
      </Rail>
    </ConnectPage>
  );
}
