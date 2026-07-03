'use server';

/**
 * Server actions for the notifications surface.
 *
 * Wraps the BE `/me/notifications` endpoints - list, mark-read, mark-all-read,
 * preferences GET/PATCH, socket-ticket mint. All actions return the discriminated
 * `ActionResult<T>` shape used by every Connect server action.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '@/lib/types/action-result';

export interface NotificationItem {
  _id: string;
  recipientId: string;
  actorId?: string | null;
  /** Distinct actors folded into this row by batching (§12.3); the latest is `actorId`. */
  actorIds?: string[];
  /** Distinct-actor tally for a batched row (mirrors `actorIds.length`); 1 = singleton. */
  aggregatedCount?: number;
  /** Product stamp set by the backend ("one engine, two inboxes"): which app this
   *  notification belongs to. Null on legacy rows; the UI falls back to a category
   *  heuristic when absent. */
  product?: 'connect' | 'erp' | null;
  category?: string | null;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  /** Two-state model: `seenAt` null = unseen (drives the red bell badge);
   *  `isRead` false = unread (drives per-row bold). */
  seenAt?: string | null;
  isRead: boolean;
  entityType?: string | null;
  entityId?: string | null;
  deliveredChannels?: string[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChannelPrefs {
  inPlatform: boolean;
  mobilePush: boolean;
  browserPush: boolean;
}

export type NotificationPrefs = Record<string, ChannelPrefs>;

/** Global delivery channels (mirrors BE `GlobalChannelPrefs`). Only `inApp` is
 *  honoured today; the rest are structure-only and render "coming soon". */
export interface GlobalChannelPrefs {
  inApp: boolean;
  browserPush: boolean;
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // 'HH:mm'
  end: string;
  tz: string;
}

export interface DeliverySettings {
  smartBatching: boolean;
  quietHours: QuietHours;
}

/** Full settings envelope from `GET /me/notifications/preferences`. */
export interface NotificationSettings {
  prefs: NotificationPrefs;
  channels: GlobalChannelPrefs;
  delivery: DeliverySettings;
}

interface ListOpts {
  unreadOnly?: boolean;
  category?: string;
  limit?: number;
  /** Keyset cursor: the `createdAt` of the last row already shown. Returns the
   *  next strictly-older page (powers the centre's "load older"). */
  before?: string;
  /** Shell scope ("one engine, two inboxes"): the Connect centre passes
   *  `'connect'` so its "load older" pages never surface ERP rows. */
  product?: 'connect' | 'erp';
}

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

export async function listMyNotifications(
  opts: ListOpts = {},
): Promise<ActionResult<NotificationItem[]>> {
  try {
    const http = await serverHttp();
    const params = new URLSearchParams();
    if (opts.unreadOnly) params.set('unreadOnly', 'true');
    if (opts.category) params.set('category', opts.category);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.before) params.set('before', opts.before);
    if (opts.product) params.set('product', opts.product);
    const qs = params.toString();
    const res = await http.get(`/me/notifications${qs ? `?${qs}` : ''}`);
    return { ok: true, data: unwrapServer<NotificationItem[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function getMyUnreadCount(
  category?: string,
): Promise<ActionResult<{ count: number }>> {
  try {
    const http = await serverHttp();
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    const res = await http.get(`/me/notifications/unread-count${qs}`);
    return { ok: true, data: unwrapServer<{ count: number }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ActionResult<NotificationItem>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(`/me/notifications/${notificationId}/read`, {});
    return { ok: true, data: unwrapServer<NotificationItem>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function markAllNotificationsRead(
  category?: string,
  product?: 'connect' | 'erp',
): Promise<ActionResult<{ message: string }>> {
  try {
    const http = await serverHttp();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (product) params.set('product', product);
    const qs = params.toString();
    const res = await http.patch(`/me/notifications/mark-all-read${qs ? `?${qs}` : ''}`, {});
    return { ok: true, data: unwrapServer<{ message: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Mark notifications SEEN (clears the red bell badge; rows stay bold until
 *  clicked). No `category` → all (bell dropdown / center open). With a
 *  `category` → just that slice (e.g. visiting /connect/network clears
 *  `connect.connection_accepted` so the network nav badge drops). */
export async function markAllNotificationsSeen(
  category?: string,
  product?: 'connect' | 'erp',
): Promise<ActionResult<{ message: string }>> {
  try {
    const http = await serverHttp();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (product) params.set('product', product);
    const qs = params.toString();
    const res = await http.patch(`/me/notifications/mark-all-seen${qs ? `?${qs}` : ''}`, {});
    return { ok: true, data: unwrapServer<{ message: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Delete ONE notification (the per-row trash button). Recipient-scoped on the
 *  backend, so a user can only ever delete their own rows. */
export async function deleteNotification(
  notificationId: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`/me/notifications/${notificationId}`);
    return { ok: true, data: unwrapServer<{ message: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Clear all of the caller's notifications. Optional `product` scopes the wipe
 *  to one inbox ("one engine, two inboxes") so a Connect "clear all" leaves the
 *  ERP bell untouched. */
export async function clearAllNotifications(
  product?: 'connect' | 'erp',
): Promise<ActionResult<{ message: string; deletedCount: number }>> {
  try {
    const http = await serverHttp();
    const qs = product ? `?product=${product}` : '';
    const res = await http.delete(`/me/notifications${qs}`);
    return { ok: true, data: unwrapServer<{ message: string; deletedCount: number }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function getNotificationPreferences(): Promise<ActionResult<NotificationSettings>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/notifications/preferences');
    return { ok: true, data: unwrapServer<NotificationSettings>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function updateNotificationPreferences(patch: {
  prefs?: Partial<Record<string, Partial<ChannelPrefs>>>;
  channels?: Partial<GlobalChannelPrefs>;
  delivery?: Partial<DeliverySettings>;
}): Promise<ActionResult<NotificationSettings>> {
  try {
    const http = await serverHttp();
    const res = await http.patch('/me/notifications/preferences', patch);
    return { ok: true, data: unwrapServer<NotificationSettings>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function mintNotificationSocketTicket(): Promise<ActionResult<{ ticket: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/me/notifications/socket-ticket', {});
    return { ok: true, data: unwrapServer<{ ticket: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
