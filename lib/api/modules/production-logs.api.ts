import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  ListProductionLogsParams,
  ListProductionLogsResponse,
} from '@/types';

const E = ApiEndpoints.machines.productionLogs;

function buildParams(params: ListProductionLogsParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (params.from) out.from = params.from;
  if (params.to) out.to = params.to;
  if (params.operatorId) out.operatorId = params.operatorId;
  if (params.shiftId) out.shiftId = params.shiftId;
  if (params.machineId) out.machineId = params.machineId;
  if (params.includeDeleted) out.includeDeleted = 'true';
  if (params.limit !== undefined) out.limit = String(params.limit);
  if (params.offset !== undefined) out.offset = String(params.offset);
  return out;
}

export const productionLogsApi = {
  listForMachine(
    wsId: string,
    machineId: string,
    params: ListProductionLogsParams = {},
  ): Promise<ListProductionLogsResponse> {
    return http
      .get(E.list(wsId, machineId), { params: buildParams(params) })
      .then(unwrap<ListProductionLogsResponse>);
  },

  listWorkspace(
    wsId: string,
    params: ListProductionLogsParams = {},
  ): Promise<ListProductionLogsResponse> {
    return http
      .get(E.listWorkspace(wsId), { params: buildParams(params) })
      .then(unwrap<ListProductionLogsResponse>);
  },
};
