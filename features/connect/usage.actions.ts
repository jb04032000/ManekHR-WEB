'use server';

/**
 * Server action for the Connect usage roll-up. Wraps GET /me/connect/usage
 * (JwtAuthGuard; the person is resolved server-side from the JWT). Read-only;
 * powers the owner-facing UsageMeter on the stores / pages / jobs / products
 * surfaces. See backend ConnectUsageController.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { extractErrorMessage } from '@/lib/format/http-errors';
import type { ActionResult } from './profile.types';
import type { ConnectUsageRow } from './usage.types';

export async function getConnectUsage(): Promise<ActionResult<ConnectUsageRow[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/connect/usage');
    return { ok: true, data: unwrapServer<ConnectUsageRow[]>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}
