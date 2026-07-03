'use server';

/**
 * Phase 16 / FIN-15-02 - Fiscal Year Close server actions.
 *
 * Read paths suitable for SSR / Server Action consumers. Write paths
 * (close + reopen) are still exposed here so they can be invoked from
 * Server Components / form actions; the client also has fiscalYearApi
 * for interactive flows.
 */
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { fiscalYear } from '@/lib/api/endpoints';
import type { FiscalYearRow, FyHealthChecksReport, CloseFyInput, ReopenFyInput } from '@/types';

export async function listFiscalYears(wsId: string, firmId: string): Promise<FiscalYearRow[]> {
  const http = await serverHttp();
  return http.get(fiscalYear.list(wsId, firmId)).then(unwrapServer<FiscalYearRow[]>);
}

export async function getCurrentFy(wsId: string, firmId: string): Promise<FiscalYearRow> {
  const http = await serverHttp();
  return http.get(fiscalYear.current(wsId, firmId)).then(unwrapServer<FiscalYearRow>);
}

export async function getHealthChecks(
  wsId: string,
  firmId: string,
  fyId: string,
): Promise<FyHealthChecksReport> {
  const http = await serverHttp();
  return http.get(fiscalYear.health(wsId, firmId, fyId)).then(unwrapServer<FyHealthChecksReport>);
}

export async function closeFy(
  wsId: string,
  firmId: string,
  fyId: string,
  dto: CloseFyInput,
): Promise<FiscalYearRow> {
  const http = await serverHttp();
  return http.post(fiscalYear.close(wsId, firmId, fyId), dto).then(unwrapServer<FiscalYearRow>);
}

export async function reopenFy(
  wsId: string,
  firmId: string,
  fyId: string,
  dto: ReopenFyInput,
): Promise<FiscalYearRow> {
  const http = await serverHttp();
  return http.post(fiscalYear.reopen(wsId, firmId, fyId), dto).then(unwrapServer<FiscalYearRow>);
}
