'use client';

/**
 * preferences-sections - the three notification-settings sections (By module /
 * Channels / Smart delivery) shared by the drawer and the full preferences page.
 * Controlled: the parent owns state + persistence (debounced PATCH). Module
 * toggles fan out to per-category inPlatform; channels + delivery are global.
 * Only In-app + module mutes are live today; other channels + quiet hours render
 * disabled "coming soon" but still persist. Cross-links: notifications.actions.ts
 * (NotificationSettings), BE notification-categories.ts.
 */

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Switch, TimePicker } from 'antd';
import dayjs from 'dayjs';
import {
  Bell,
  Briefcase,
  Globe,
  Mail,
  MessageSquare,
  Network,
  Newspaper,
  Phone,
  ShieldCheck,
  Smartphone,
  Store,
} from 'lucide-react';
import type { NotificationSettings, GlobalChannelPrefs } from './notifications.actions';

/** Module -> its backing categories (mirrors the BE category groups). */
export const PREF_MODULES = [
  {
    key: 'feed',
    icon: Newspaper,
    categories: [
      'connect.post_reacted',
      'connect.post_commented',
      'connect.post_reposted',
      'connect.post_replied',
    ],
  },
  {
    key: 'network',
    icon: Network,
    categories: [
      'connect.connection_requested',
      'connect.connection_accepted',
      'connect.followed',
      'connect.page_followed',
    ],
  },
  {
    key: 'jobs',
    icon: Briefcase,
    categories: [
      'connect.job_application_received',
      'connect.job_application_accepted',
      'connect.job_application_declined',
    ],
  },
  { key: 'marketplace', icon: Store, categories: ['connect.inquiry_received'] },
  { key: 'messages', icon: MessageSquare, categories: ['connect.message_received'] },
  { key: 'system', icon: ShieldCheck, categories: [] as string[] }, // operational; no toggleable categories yet
] as const;

const CHANNELS: Array<{ key: keyof GlobalChannelPrefs; icon: typeof Bell; live: boolean }> = [
  { key: 'inApp', icon: Bell, live: true },
  { key: 'browserPush', icon: Globe, live: true },
  { key: 'whatsapp', icon: Smartphone, live: false },
  { key: 'email', icon: Mail, live: false },
  { key: 'sms', icon: Phone, live: false },
];

interface Props {
  settings: NotificationSettings;
  onModuleToggle: (categories: string[], next: boolean) => void;
  onChannelToggle: (channel: keyof GlobalChannelPrefs, next: boolean) => void;
  onBatchingToggle: (next: boolean) => void;
  onQuietToggle: (next: boolean) => void;
  onQuietTime: (which: 'start' | 'end', value: string) => void;
}

/** One settings line: icon + title + description + a trailing control. Declared
 *  at module scope (not inside the component) so it is a stable component type. */
function Row({
  icon: Icon,
  title,
  desc,
  control,
  muted,
}: {
  icon: typeof Bell;
  title: string;
  desc: string;
  control: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-1 py-2.5" style={{ opacity: muted ? 0.6 : 1 }}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' }}
        aria-hidden
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13.5px] font-semibold text-heading">{title}</p>
        <p className="m-0 mt-0.5 text-[12px] text-muted">{desc}</p>
      </div>
      {control}
    </div>
  );
}

/** Small section heading. Module scope keeps it a stable component type. */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-4 mb-1 text-[11px] font-bold tracking-[0.04em] text-subtle uppercase">
      {children}
    </h3>
  );
}

export default function PreferencesSections({
  settings,
  onModuleToggle,
  onChannelToggle,
  onBatchingToggle,
  onQuietToggle,
  onQuietTime,
}: Props) {
  const t = useTranslations('connect.notifications');

  // A module is ON when every backing category has inPlatform true.
  // `readonly` because PREF_MODULES is declared `as const`; callers spread to a
  // mutable array before handing categories to the (mutable) toggle callback.
  const moduleOn = (categories: readonly string[]) =>
    categories.length === 0 || categories.every((c) => settings.prefs[c]?.inPlatform !== false);

  return (
    <div className="flex flex-col">
      <SectionTitle>{t('prefSections.byModule')}</SectionTitle>
      {PREF_MODULES.map((m) => {
        const Icon = m.icon;
        return (
          <Row
            key={m.key}
            icon={Icon}
            title={t(`modules.${m.key}.title` as Parameters<typeof t>[0])}
            desc={t(`modules.${m.key}.desc` as Parameters<typeof t>[0])}
            control={
              <Switch
                checked={moduleOn(m.categories)}
                disabled={m.categories.length === 0}
                onChange={(next) => onModuleToggle([...m.categories], next)}
                aria-label={t(`modules.${m.key}.title` as Parameters<typeof t>[0])}
              />
            }
            muted={m.categories.length === 0}
          />
        );
      })}

      <SectionTitle>{t('prefSections.channels')}</SectionTitle>
      {CHANNELS.map((ch) => {
        const Icon = ch.icon;
        return (
          <Row
            key={ch.key}
            icon={Icon}
            title={t(`channels.${ch.key}.title` as Parameters<typeof t>[0])}
            desc={ch.live ? t(`channels.${ch.key}.desc` as Parameters<typeof t>[0]) : t('soon')}
            control={
              <Switch
                checked={ch.key === 'inApp' ? true : settings.channels[ch.key]}
                disabled={!ch.live}
                onChange={(next) => onChannelToggle(ch.key, next)}
                aria-label={t(`channels.${ch.key}.title` as Parameters<typeof t>[0])}
              />
            }
            muted={!ch.live}
          />
        );
      })}

      <SectionTitle>{t('prefSections.smart')}</SectionTitle>
      <Row
        icon={Bell}
        title={t('smart.batching.title')}
        desc={t('smart.batching.desc')}
        control={
          <Switch
            checked={settings.delivery.smartBatching}
            onChange={onBatchingToggle}
            aria-label={t('smart.batching.title')}
          />
        }
      />
      <Row
        icon={Bell}
        title={t('smart.quiet.title')}
        desc={t('soon')}
        muted
        control={
          <Switch
            checked={settings.delivery.quietHours.enabled}
            onChange={onQuietToggle}
            aria-label={t('smart.quiet.title')}
          />
        }
      />
      {settings.delivery.quietHours.enabled && (
        <div className="flex items-center gap-2 px-1 py-2" style={{ opacity: 0.6 }}>
          <TimePicker
            format="hh:mm A"
            value={dayjs(settings.delivery.quietHours.start, 'HH:mm')}
            onChange={(v) => v && onQuietTime('start', v.format('HH:mm'))}
            aria-label={t('smart.quiet.start')}
          />
          <span className="text-[12px] text-muted">{t('smart.quiet.to')}</span>
          <TimePicker
            format="hh:mm A"
            value={dayjs(settings.delivery.quietHours.end, 'HH:mm')}
            onChange={(v) => v && onQuietTime('end', v.format('HH:mm'))}
            aria-label={t('smart.quiet.end')}
          />
          <span className="text-[12px] text-subtle">{settings.delivery.quietHours.tz}</span>
        </div>
      )}
    </div>
  );
}
