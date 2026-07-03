import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listMyNotifications } from '@/features/connect/notifications/notifications.actions';
import NotificationsScreen from '@/features/connect/notifications/NotificationsScreen';

/**
 * `/connect/notifications` - the dedicated notifications center.
 *
 * Server Component loads the first page of the viewer's notifications and
 * hands them to the client island. The client island then subscribes to
 * the `/notifications` Socket.IO push for live updates.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.notifications');
  return { title: t('metaTitle') };
}

export default async function ConnectNotificationsPage() {
  const res = await listMyNotifications({ limit: 50 });
  const initial = res.ok ? res.data : [];
  return <NotificationsScreen initial={initial} />;
}
