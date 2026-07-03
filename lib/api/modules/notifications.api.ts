import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { Notification } from '@/types';

const E = ApiEndpoints.notifications;

export const notificationsApi = {
  list: (wsId: string, unreadOnly = false) =>
    http.get(E.list(wsId), { params: { unreadOnly } }).then(unwrap<Notification[]>),
  markRead: (wsId: string, id: string) =>
    http.patch(E.markRead(wsId, id)).then(unwrap<Notification>),
  markAllRead: (wsId: string) =>
    http.patch(E.markAllRead(wsId)).then(unwrap<{ message: string }>),
  delete: (wsId: string, id: string) =>
    http.delete(E.delete(wsId, id)).then(unwrap<{ message: string }>),
};
