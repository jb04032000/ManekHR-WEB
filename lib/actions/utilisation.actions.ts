'use server';

/**
 * Phase 25 Plan 10 - Server Actions for the Production Utilisation Dashboard.
 *
 * Mirrors the machines.actions.ts pattern: `await serverHttp()` (cookie-based
 * JWT, server-only env), `unwrapServer<T>` for the backend envelope, and a
 * shared `run()` helper that surfaces backend error messages across the
 * Server-Action serialization boundary.
 *
 * SECURITY (D-20): the controller server-derives ResourceScope from the JWT
 * via `extractScope(req)` - we never have to pass scope from the client.
 * Filter args (machineIds/locationIds/shiftIds) are advisory and re-validated
 * server-side against the caller's effective scope.
 */
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  KpiResponse,
  TrendResponse,
  HeatmapResponse,
  UtilisationExportRow,
  UtilisationFilterQuery,
} from '@/types';

const E = ApiEndpoints.utilisation;

/**
 * Server-action error normaliser - extracts backend error messages so they
 * survive Next.js serialization (mirrors machines.actions.ts).
 */
async function run<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: any) {
    const backend = e?.response?.data;
    const msg =
      (typeof backend?.error?.message === 'string' && backend.error.message) ||
      (typeof backend?.message === 'string' && backend.message) ||
      (Array.isArray(backend?.message) && backend.message.join(', ')) ||
      (typeof backend?.error === 'string' && backend.error) ||
      e?.message ||
      'Something went wrong';
    throw new Error(msg);
  }
}

function buildFilterParams(q: UtilisationFilterQuery): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (q.from) out.from = q.from;
  if (q.to) out.to = q.to;
  if (q.machineIds && q.machineIds.length > 0) out.machineIds = q.machineIds;
  if (q.locationIds && q.locationIds.length > 0) out.locationIds = q.locationIds;
  if (q.shiftIds && q.shiftIds.length > 0) out.shiftIds = q.shiftIds;
  return out;
}

export async function getUtilisationKpisAction(
  wsId: string,
  q: UtilisationFilterQuery = {},
): Promise<KpiResponse> {
  return run(async () => {
    const http = await serverHttp();
    return http.get(E.kpis(wsId), { params: buildFilterParams(q) }).then(unwrapServer<KpiResponse>);
  });
}

export async function getUtilisationTrendAction(
  wsId: string,
  machineId: string,
  from?: string,
  to?: string,
  shiftIds?: string[],
): Promise<TrendResponse> {
  return run(async () => {
    const http = await serverHttp();
    const params: Record<string, string | string[]> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (shiftIds && shiftIds.length > 0) params.shiftIds = shiftIds;
    return http.get(E.trend(wsId, machineId), { params }).then(unwrapServer<TrendResponse>);
  });
}

export async function getUtilisationHeatmapAction(
  wsId: string,
  locationId: string,
  month: string,
  shiftIds?: string[],
): Promise<HeatmapResponse> {
  return run(async () => {
    const http = await serverHttp();
    const params: Record<string, string | string[]> = { locationId, month };
    if (shiftIds && shiftIds.length > 0) params.shiftIds = shiftIds;
    return http.get(E.heatmap(wsId), { params }).then(unwrapServer<HeatmapResponse>);
  });
}

export async function getUtilisationExportRowsAction(
  wsId: string,
  q: UtilisationFilterQuery = {},
): Promise<UtilisationExportRow[]> {
  return run(async () => {
    const http = await serverHttp();
    const params = { ...buildFilterParams(q), format: 'raw' };
    return http.get(E.export(wsId), { params }).then(unwrapServer<UtilisationExportRow[]>);
  });
}
