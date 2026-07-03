'use client';

/**
 * PreferencesDrawer - right-side settings surface opened from the notifications
 * header gear. Loads the full settings envelope on first open, persists each
 * toggle with a debounced optimistic PATCH (rollback + toast on failure), and
 * links to the full preferences page as a fallback. Cross-links:
 * notifications.actions.ts (get/update), preferences-sections.tsx (UI).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App as AntApp, Drawer, Spin } from 'antd';
import { ArrowRight } from 'lucide-react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type GlobalChannelPrefs,
  type NotificationSettings,
} from './notifications.actions';
import PreferencesSections from './preferences-sections';
import { useBrowserPush } from '@/lib/push/useBrowserPush';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Patch = Parameters<typeof updateNotificationPreferences>[0];

export default function PreferencesDrawer({ open, onClose }: Props) {
  const t = useTranslations('connect.notifications');
  // Step-specific browser-push errors live in the shared `push` group
  // (also used by EnablePushBanner).
  const tPush = useTranslations('push');
  const { message } = AntApp.useApp();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const pendingRef = useRef<Patch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGoodRef = useRef<NotificationSettings | null>(null);
  // Guards the one-shot fetch so the effect never calls setState synchronously
  // in its body (only inside the async resolve). Reset on failure so a reopen
  // retries. The spinner is derived from `settings === null`, not a flag.
  const requestedRef = useRef(false);

  // Load once per open (the async resolve does the only setState).
  useEffect(() => {
    if (!open || settings || requestedRef.current) return;
    requestedRef.current = true;
    void getNotificationPreferences().then((res) => {
      if (res.ok) {
        setSettings(res.data);
        lastGoodRef.current = res.data;
      } else {
        requestedRef.current = false; // allow a retry on next open
        message.error(res.error || t('saveError'));
      }
    });
  }, [open, settings, message, t]);

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
      if (lastGoodRef.current) setSettings(lastGoodRef.current); // rollback
    }
  }, [message, t]);

  const queue = useCallback(
    (patch: Patch, optimistic: (s: NotificationSettings) => NotificationSettings) => {
      setSettings((s) => (s ? optimistic(s) : s));
      // Merge into the pending patch (shallow per top-level key).
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

  const push = useBrowserPush();

  // browserPush is special: flipping it must request permission + register/
  // revoke a device (handled by useBrowserPush), not just persist a flag. The
  // hook itself writes the browserPush prefs, so we DON'T also queue() them.
  // Every other channel keeps the existing optimistic-persist path. Cross-link:
  // useBrowserPush (lib/push) owns the FCM token + device lifecycle.
  const onChannelToggleWrapped = (channel: keyof GlobalChannelPrefs, next: boolean) => {
    if (channel === 'browserPush') {
      if (next) {
        // enable() reports WHICH step failed (permission/token/register/prefs)
        // so we show the matching push.errors.* message instead of a generic
        // one. Cross-link: useBrowserPush EnableResult.
        void push.enable().then((res) => {
          if (!res.ok) message.error(tPush(`errors.${res.reason ?? 'token'}`));
          setSettings((s) => (s ? { ...s, channels: { ...s.channels, browserPush: res.ok } } : s));
        });
      } else {
        void push.disable().then((ok) => {
          setSettings((s) => (s ? { ...s, channels: { ...s.channels, browserPush: !ok } } : s));
        });
      }
      return;
    }
    onChannelToggle(channel, next);
  };

  const onBatchingToggle = (next: boolean) =>
    queue({ delivery: { smartBatching: next } }, (s) => ({
      ...s,
      delivery: { ...s.delivery, smartBatching: next },
    }));

  // Build quiet-hours patches from the CURRENT optimistic `settings` (not the
  // last server-confirmed value), so two edits inside one debounce window do not
  // clobber each other (e.g. enable + change-time -> both survive the flush).
  const onQuietToggle = (next: boolean) =>
    queue(
      { delivery: { quietHours: { ...settings!.delivery.quietHours, enabled: next } } },
      (s) => ({
        ...s,
        delivery: { ...s.delivery, quietHours: { ...s.delivery.quietHours, enabled: next } },
      }),
    );

  const onQuietTime = (which: 'start' | 'end', value: string) =>
    queue(
      { delivery: { quietHours: { ...settings!.delivery.quietHours, [which]: value } } },
      (s) => ({
        ...s,
        delivery: { ...s.delivery, quietHours: { ...s.delivery.quietHours, [which]: value } },
      }),
    );

  return (
    <Drawer
      title={t('preferencesTitle')}
      placement="right"
      size={420}
      open={open}
      onClose={onClose}
      destroyOnHidden={false}
    >
      <p className="m-0 mb-2 text-[12.5px] text-muted">{t('preferencesSubtitle')}</p>
      {!settings ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : (
        <>
          <PreferencesSections
            settings={settings}
            onModuleToggle={onModuleToggle}
            onChannelToggle={onChannelToggleWrapped}
            onBatchingToggle={onBatchingToggle}
            onQuietToggle={onQuietToggle}
            onQuietTime={onQuietTime}
          />
          <Link
            href="/connect/notifications/preferences"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold no-underline"
            style={{ color: 'var(--cr-primary)' }}
          >
            {t('openFullSettings')}
            <ArrowRight size={15} aria-hidden />
          </Link>
        </>
      )}
    </Drawer>
  );
}
