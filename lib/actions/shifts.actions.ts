'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { extractErrorMessage } from '@/lib/format/http-errors';
import type { Shift, CreateShiftPayload, UpdateShiftPayload } from '@/types';

const E = ApiEndpoints.shifts;

export async function listShifts(wsId: string): Promise<Shift[]> {
  try {
    const http = await serverHttp();
    return await http.get(E.list(wsId)).then(unwrapServer<Shift[]>);
  } catch {
    // Treat 403 (module locked) and other failures as empty to avoid
    // surfacing 500 errors in the Next.js Server Action layer. Callers
    // already handle the empty case (the page upgrade-gates on the
    // subscription separately, so this never crashes the UI).
    return [];
  }
}

export async function createShift(wsId: string, data: CreateShiftPayload, token?: string) {
  try {
    const http = await serverHttp(token);
    return await http.post(E.create(wsId), data).then(unwrapServer<Shift>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not create the shift. Please try again.'));
  }
}

export async function updateShift(
  wsId: string,
  shiftId: string,
  data: UpdateShiftPayload,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    return await http.patch(E.update(wsId, shiftId), data).then(unwrapServer<Shift>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not update the shift. Please try again.'));
  }
}

export async function deleteShift(wsId: string, shiftId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    return await http.delete(E.delete(wsId, shiftId)).then(unwrapServer<{ message: string }>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not delete the shift. Please try again.'));
  }
}
