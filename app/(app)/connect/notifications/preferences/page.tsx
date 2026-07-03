import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getNotificationPreferences } from '@/features/connect/notifications/notifications.actions';
import PreferencesForm from '@/features/connect/notifications/PreferencesForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.notifications');
  return { title: t('preferencesMetaTitle') };
}

/**
 * `/connect/notifications/preferences` - full notification settings: per-module
 * mutes, delivery channels, and smart-delivery (batching + quiet hours).
 *
 * Server Component loads the current settings envelope (creating defaults
 * lazily). The client form PATCHes each toggle back to the BE with a 500 ms
 * debounce so a quick on-off-on collapses to one write. On a failed load it
 * renders sane defaults so the page still type-checks and works.
 */
export default async function NotificationPreferencesPage() {
  const res = await getNotificationPreferences();
  const initial = res.ok
    ? res.data
    : {
        prefs: {},
        channels: { inApp: true, browserPush: false, whatsapp: false, email: false, sms: false },
        delivery: {
          smartBatching: true,
          quietHours: { enabled: false, start: '22:00', end: '07:00', tz: 'Asia/Kolkata' },
        },
      };
  return <PreferencesForm initial={initial} />;
}
