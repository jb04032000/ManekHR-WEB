import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  MaintenanceSchedule,
  ServiceLog,
  ListServiceLogsParams,
  ListServiceLogsResponse,
  ListMaintenanceDueResponse,
} from '@/types';

const E = ApiEndpoints.machines.maintenance;

function buildServiceLogParams(p: ListServiceLogsParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.scheduleId) out.scheduleId = p.scheduleId;
  if (p.technicianId) out.technicianId = p.technicianId;
  if (p.from) out.from = p.from;
  if (p.to) out.to = p.to;
  if (p.limit !== undefined) out.limit = String(p.limit);
  if (p.offset !== undefined) out.offset = String(p.offset);
  return out;
}

export const maintenanceApi = {
  listSchedules(wsId: string, machineId: string): Promise<MaintenanceSchedule[]> {
    return http
      .get(E.schedules.list(wsId, machineId))
      .then(unwrap<MaintenanceSchedule[]>);
  },

  getSchedule(
    wsId: string,
    machineId: string,
    id: string,
  ): Promise<MaintenanceSchedule> {
    return http
      .get(E.schedules.get(wsId, machineId, id))
      .then(unwrap<MaintenanceSchedule>);
  },

  listServiceLogs(
    wsId: string,
    machineId: string,
    params: ListServiceLogsParams = {},
  ): Promise<ListServiceLogsResponse> {
    return http
      .get(E.serviceLogs.list(wsId, machineId), {
        params: buildServiceLogParams(params),
      })
      .then(unwrap<ListServiceLogsResponse>);
  },

  getServiceLog(
    wsId: string,
    machineId: string,
    id: string,
  ): Promise<ServiceLog> {
    return http
      .get(E.serviceLogs.get(wsId, machineId, id))
      .then(unwrap<ServiceLog>);
  },

  listDue(
    wsId: string,
    params: { limit?: number; offset?: number } = {},
  ): Promise<ListMaintenanceDueResponse> {
    const q: Record<string, string> = {};
    if (params.limit !== undefined) q.limit = String(params.limit);
    if (params.offset !== undefined) q.offset = String(params.offset);
    return http.get(E.due(wsId), { params: q }).then(unwrap<ListMaintenanceDueResponse>);
  },

  getLeadTime(wsId: string): Promise<{ leadTimeDays: number }> {
    return http.get(E.leadTime(wsId)).then(unwrap<{ leadTimeDays: number }>);
  },
};

// Named exports for direct import (mirrors style used elsewhere)
export const listMaintenanceSchedules = maintenanceApi.listSchedules;
export const getMaintenanceSchedule = maintenanceApi.getSchedule;
export const listServiceLogs = maintenanceApi.listServiceLogs;
export const getServiceLog = maintenanceApi.getServiceLog;
export const listMaintenanceDue = maintenanceApi.listDue;
export const getMaintenanceLeadTime = maintenanceApi.getLeadTime;
