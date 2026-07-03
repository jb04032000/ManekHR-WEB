/**
 * Phase 25 Plan 10 - client-side API wrapper for the Production Utilisation
 * Dashboard. Mirrors the maintenance.api.ts pattern: thin Axios callers that
 * route through the shared `http` instance and unwrap the backend envelope.
 *
 * For server-rendered pages and Server Components, prefer the matching
 * Server Actions in `lib/actions/utilisation.actions.ts`.
 */
import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  KpiResponse,
  TrendResponse,
  HeatmapResponse,
  UtilisationExportRow,
  UtilisationFilterQuery,
} from '@/types';

const E = ApiEndpoints.utilisation;

function buildFilterParams(q: UtilisationFilterQuery): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (q.from) out.from = q.from;
  if (q.to) out.to = q.to;
  if (q.machineIds && q.machineIds.length > 0) out.machineIds = q.machineIds;
  if (q.locationIds && q.locationIds.length > 0) out.locationIds = q.locationIds;
  if (q.shiftIds && q.shiftIds.length > 0) out.shiftIds = q.shiftIds;
  return out;
}

export const utilisationApi = {
  getKpis(wsId: string, q: UtilisationFilterQuery = {}): Promise<KpiResponse> {
    return http.get(E.kpis(wsId), { params: buildFilterParams(q) }).then(unwrap<KpiResponse>);
  },

  getTrend(
    wsId: string,
    machineId: string,
    q: { from?: string; to?: string; shiftIds?: string[] } = {},
  ): Promise<TrendResponse> {
    const params: Record<string, string | string[]> = {};
    if (q.from) params.from = q.from;
    if (q.to) params.to = q.to;
    if (q.shiftIds && q.shiftIds.length > 0) params.shiftIds = q.shiftIds;
    return http.get(E.trend(wsId, machineId), { params }).then(unwrap<TrendResponse>);
  },

  getHeatmap(
    wsId: string,
    locationId: string,
    month: string,
    shiftIds?: string[],
  ): Promise<HeatmapResponse> {
    const params: Record<string, string | string[]> = { locationId, month };
    if (shiftIds && shiftIds.length > 0) params.shiftIds = shiftIds;
    return http.get(E.heatmap(wsId), { params }).then(unwrap<HeatmapResponse>);
  },

  getExportRows(
    wsId: string,
    q: UtilisationFilterQuery & { format?: 'raw' | 'pdf' | 'excel' } = {},
  ): Promise<UtilisationExportRow[]> {
    const params = {
      ...buildFilterParams(q),
      format: q.format ?? 'raw',
    };
    return http.get(E.export(wsId), { params }).then(unwrap<UtilisationExportRow[]>);
  },
};

// Named exports for ergonomics (mirrors maintenance.api.ts convention).
export const getUtilisationKpis = utilisationApi.getKpis;
export const getUtilisationTrend = utilisationApi.getTrend;
export const getUtilisationHeatmap = utilisationApi.getHeatmap;
export const getUtilisationExportRows = utilisationApi.getExportRows;
