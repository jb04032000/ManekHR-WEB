'use server';

/**
 * Platform-admin server actions for Connect promotions (M3.2).
 *
 * Wraps the BE `/admin/connect/promotions/*` endpoints (JwtAuthGuard +
 * IsAdminGuard; the admin id is the JWT subject, never the body). Mirrors the
 * ActionResult shape used by `ads-admin.actions.ts`. Coupon CRUD is NOT here:
 * it reuses the existing `admin-billing.actions.ts` coupon actions.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type { CreditDrop, CreateCreditDropInput } from './promotions.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

/** Recent credit-drop campaigns, newest first. */
export async function listCreditDrops(): Promise<ActionResult<CreditDrop[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/promotions/credit-drops');
    return { ok: true, data: unwrapServer<CreditDrop[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Run a credit drop: grant free boost credits to the targeted sellers. */
export async function createCreditDrop(
  input: CreateCreditDropInput,
): Promise<ActionResult<CreditDrop>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/admin/connect/promotions/credit-drops', input);
    return { ok: true, data: unwrapServer<CreditDrop>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
