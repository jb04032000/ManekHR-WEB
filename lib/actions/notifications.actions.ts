'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { Notification } from '@/types';

const E = ApiEndpoints.notifications;
const ME = ApiEndpoints.me;

export async function listNotifications(wsId: string, unreadOnly = false) {
  const http = await serverHttp();
  return http.get(E.list(wsId), { params: { unreadOnly } }).then(unwrapServer<Notification[]>);
}

export async function markNotificationRead(wsId: string, id: string) {
  const http = await serverHttp();
  return http.patch(E.markRead(wsId, id)).then(unwrapServer<Notification>);
}

export async function markAllNotificationsRead(wsId: string) {
  const http = await serverHttp();
  return http.patch(E.markAllRead(wsId)).then(unwrapServer<{ message: string }>);
}

export async function deleteNotification(wsId: string, id: string) {
  const http = await serverHttp();
  return http.delete(E.delete(wsId, id)).then(unwrapServer<{ message: string }>);
}

// ── P2.0 (2026-05-15) - cross-workspace, user-scoped surface ──────────────
// Powers the bell + /dashboard/invitations notification reads. Scoped by
// JWT only on the BE (MeNotificationsController), so they reach invite
// notifications fired for workspaces the caller hasn't joined yet.

export async function listMyNotifications(
  opts: { unreadOnly?: boolean; category?: string; limit?: number } = {},
) {
  const http = await serverHttp();
  return http
    .get(ME.notifications, {
      params: {
        unreadOnly: opts.unreadOnly ? 'true' : undefined,
        category: opts.category,
        limit: opts.limit,
      },
    })
    .then(unwrapServer<Notification[]>);
}

export async function getMyUnreadNotificationCount(category?: string) {
  const http = await serverHttp();
  return http
    .get(ME.notificationsUnreadCount, {
      params: category ? { category } : undefined,
    })
    .then(unwrapServer<{ count: number }>);
}

export async function markMyNotificationRead(id: string) {
  const http = await serverHttp();
  return http.patch(ME.notificationMarkRead(id)).then(unwrapServer<Notification>);
}

export async function markAllMyNotificationsRead(category?: string) {
  const http = await serverHttp();
  return http
    .patch(ME.notificationsMarkAllRead, undefined, {
      params: category ? { category } : undefined,
    })
    .then(unwrapServer<{ message: string }>);
}
