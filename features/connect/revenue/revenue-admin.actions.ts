'use server';

/**
 * Platform-admin server action for the Connect revenue dashboard (M3.3).
 *
 * Wraps `GET /admin/connect/revenue` (subscription revenue). Boost / ad spend is
 * read separately via the existing `getAdRevenue` action in ads-admin.actions.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type { ConnectRevenueSummary } from './revenue.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

export async function getConnectRevenue(): Promise<ActionResult<ConnectRevenueSummary>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/revenue');
    return { ok: true, data: unwrapServer<ConnectRevenueSummary>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
