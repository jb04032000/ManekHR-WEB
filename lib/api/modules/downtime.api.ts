import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  DowntimeEntry,
  ListDowntimeParams,
  ListDowntimeResponse,
  WorkspaceDowntimeReasonConfig,
} from '@/types';

const E = ApiEndpoints.machines.downtime;

function buildParams(p: ListDowntimeParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.from) out.from = p.from;
  if (p.to) out.to = p.to;
  if (p.machineId) out.machineId = p.machineId;
  if (p.reasonCodeId) out.reasonCodeId = p.reasonCodeId;
  if (p.status) out.status = p.status;
  if (p.includeDeleted) out.includeDeleted = 'true';
  if (p.limit !== undefined) out.limit = String(p.limit);
  if (p.offset !== undefined) out.offset = String(p.offset);
  return out;
}

export const downtimeApi = {
  listForMachine(
    wsId: string,
    machineId: string,
    params: ListDowntimeParams = {},
  ): Promise<ListDowntimeResponse> {
    return http
      .get(E.list(wsId, machineId), { params: buildParams(params) })
      .then(unwrap<ListDowntimeResponse>);
  },

  listWorkspace(
    wsId: string,
    params: ListDowntimeParams = {},
  ): Promise<ListDowntimeResponse> {
    return http
      .get(E.listWorkspace(wsId), { params: buildParams(params) })
      .then(unwrap<ListDowntimeResponse>);
  },

  getActive(wsId: string, machineId: string): Promise<DowntimeEntry | null> {
    return http
      .get(E.active(wsId, machineId))
      .then(unwrap<DowntimeEntry | null>);
  },

  getReasons(wsId: string): Promise<WorkspaceDowntimeReasonConfig> {
    return http
      .get(E.reasons(wsId))
      .then(unwrap<WorkspaceDowntimeReasonConfig>);
  },
};
