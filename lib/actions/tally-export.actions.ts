'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { tallyExport } from '@/lib/api/endpoints';
import type { TallyValidatorReport, TallyRecentExport } from '@/types';

/**
 * Phase 16 / FIN-15-01 - Tally Export server actions.
 *
 * The XML POST flow is handled client-side via `tallyExportApi.generate`
 * (binary stream + browser download). Server actions cover the read paths
 * (validator-report + recent) that suit SSR + Server Action consumers.
 */

export async function getValidatorReport(
  wsId: string,
  firmId: string,
  fromDate: string,
  toDate: string,
): Promise<TallyValidatorReport> {
  const http = await serverHttp();
  return http
    .get(tallyExport.validator(wsId, firmId, fromDate, toDate))
    .then(unwrapServer<TallyValidatorReport>);
}

export async function getRecentExports(
  wsId: string,
  firmId: string,
  limit = 10,
): Promise<TallyRecentExport[]> {
  const http = await serverHttp();
  const data = await http
    .get(tallyExport.recent(wsId, firmId, limit))
    .then(unwrapServer<{ rows: TallyRecentExport[] }>);
  return data?.rows ?? [];
}
