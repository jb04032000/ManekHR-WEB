'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { extractErrorMessage } from '@/lib/format/http-errors';
import type {
  Holiday,
  CreateHolidayPayload,
  UpdateHolidayPayload,
  BulkCreateHolidaysResult,
} from '@/types';

const E = ApiEndpoints.holidays;

// Server actions serialize thrown errors across the RSC boundary, stripping the
// axios `response` object - so the client would otherwise see a bare "Request
// failed with status code 403". Resolve a friendly sentence here (where
// `response` still exists) via `extractErrorMessage` so the client receives an
// already-friendly message [Playbook P10].

export async function listHolidays(wsId: string) {
  const http = await serverHttp();
  try {
    return await http.get(E.list(wsId)).then(unwrapServer<Holiday[]>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not load holidays. Please try again.'));
  }
}

export async function listHolidaysByYear(wsId: string, year: number) {
  const http = await serverHttp();
  try {
    return await http.get(E.byYear(wsId, year)).then(unwrapServer<Holiday[]>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not load holidays. Please try again.'));
  }
}

export async function createHoliday(wsId: string, data: CreateHolidayPayload, token?: string) {
  const http = await serverHttp(token);
  try {
    return await http.post(E.create(wsId), data).then(unwrapServer<Holiday>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not create the holiday. Please try again.'));
  }
}

// Bulk create — posts an array of holidays; the backend uses insertMany(ordered:false)
// so existing-date rows are reported as `skipped` rather than failing the batch.
export async function createHolidaysBulk(
  wsId: string,
  holidays: CreateHolidayPayload[],
  token?: string,
) {
  const http = await serverHttp(token);
  try {
    return await http.post(E.bulk(wsId), { holidays }).then(unwrapServer<BulkCreateHolidaysResult>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not add the holidays. Please try again.'));
  }
}

export async function updateHoliday(
  wsId: string,
  holidayId: string,
  data: UpdateHolidayPayload,
  token?: string,
) {
  const http = await serverHttp(token);
  try {
    return await http.patch(E.update(wsId, holidayId), data).then(unwrapServer<Holiday>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not update the holiday. Please try again.'));
  }
}

export async function deleteHoliday(wsId: string, holidayId: string, token?: string) {
  const http = await serverHttp(token);
  try {
    return await http.delete(E.delete(wsId, holidayId)).then(unwrapServer<{ message: string }>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not delete the holiday. Please try again.'));
  }
}

export async function checkHoliday(wsId: string, date: string) {
  const http = await serverHttp();
  try {
    return await http.get(E.checkDate(wsId, date)).then(unwrapServer<Holiday | null>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not check the holiday. Please try again.'));
  }
}
