'use server';

/**
 * Server actions for the browser-push device registry. Wrap the BE
 * `/devices` endpoints (already exist) so the client never holds a session
 * token. Cross-links: api user-devices.controller (register/revoke);
 * useBrowserPush (caller). Returns the shared ActionResult<T> shape.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '@/lib/types/action-result';

export interface RegisteredDevice {
  _id: string;
  platform: string;
  deviceName?: string;
  lastUsedAt: string;
}

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Upsert this browser's FCM token (platform: 'web'). Returns the device row
 *  (its `_id` is stored client-side so disable can revoke exactly this one). */
export async function registerWebPushToken(
  fcmToken: string,
  deviceName?: string,
): Promise<ActionResult<RegisteredDevice>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/devices/register', {
      fcmToken,
      platform: 'web',
      ...(deviceName ? { deviceName } : {}),
    });
    return { ok: true, data: unwrapServer<RegisteredDevice>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Revoke one registered device by id (this browser, on disable). */
export async function unregisterWebPushDevice(
  deviceId: string,
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`/devices/${deviceId}`);
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
