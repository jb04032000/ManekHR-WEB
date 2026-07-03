'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  Machine,
  CreateMachinePayload,
  UpdateMachinePayload,
  MachineStatusCounts,
  MachineShiftAssignment,
  CreateMachineAssignmentPayload,
  UpdateMachineAssignmentPayload,
  DowntimeEntry,
  CreateDowntimePayload,
  UpdateDowntimePayload,
  CloseDowntimePayload,
  ListDowntimeParams,
  ListDowntimeResponse,
  WorkspaceDowntimeReasonConfig,
  DowntimeReasonCatalogueUpdate,
  MaintenanceSchedule,
  CreateMaintenanceSchedulePayload,
  UpdateMaintenanceSchedulePayload,
  ServiceLog,
  CreateServiceLogPayload,
  UpdateServiceLogPayload,
  ListServiceLogsParams,
  ListServiceLogsResponse,
  ListMaintenanceDueResponse,
} from '@/types';

const E = ApiEndpoints.machines;
const DT = ApiEndpoints.machines.downtime;
const MT = ApiEndpoints.machines.maintenance;

/**
 * Server actions run across a process boundary - axios-error details
 * (response.data.message) get stripped by Next.js serialization, leaving
 * the client only "Request failed with status code 409". Extract the
 * backend message server-side and rethrow as a plain Error.message so
 * parseApiError / msgApi.error surface the real reason.
 */
async function run<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: any) {
    const backend = e?.response?.data;
    // Backend may wrap errors as either:
    //   { statusCode, message, error }               (Nest default)
    //   { success: false, message, code }            (project envelope, flat)
    //   { success: false, error: { code, message } } (project envelope, nested)
    // Check the nested shape first - its message is the most specific.
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

export async function listMachines(
  wsId: string,
  params?: { locationId?: string; status?: string; search?: string },
) {
  const http = await serverHttp();
  return http.get(E.list(wsId), { params }).then(unwrapServer<Machine[]>);
}

export async function getMachine(wsId: string, id: string) {
  const http = await serverHttp();
  return http.get(E.get(wsId, id)).then(unwrapServer<Machine>);
}

export async function createMachine(wsId: string, data: CreateMachinePayload, token?: string) {
  return run(async () => {
    const http = await serverHttp(token);
    return http.post(E.create(wsId), data).then(unwrapServer<Machine>);
  });
}

export async function updateMachine(
  wsId: string,
  id: string,
  data: UpdateMachinePayload,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http.patch(E.update(wsId, id), data).then(unwrapServer<Machine>);
  });
}

export async function deleteMachine(wsId: string, id: string, token?: string) {
  return run(async () => {
    const http = await serverHttp(token);
    return http.delete(E.delete(wsId, id)).then(unwrapServer<{ success: boolean }>);
  });
}

export async function getMachineStatusCounts(wsId: string) {
  const http = await serverHttp();
  return http.get(E.statusCounts(wsId)).then(unwrapServer<MachineStatusCounts>);
}

export async function peekNextMachineCode(wsId: string) {
  const http = await serverHttp();
  return http.get(E.peekCode(wsId)).then(unwrapServer<{ nextCode: string }>);
}

export async function listMachinesForMember(wsId: string, memberId: string) {
  const http = await serverHttp();
  return http.get(E.byMember(wsId, memberId)).then(unwrapServer<MachineShiftAssignment[]>);
}

export async function listMachineAssignments(
  wsId: string,
  machineId: string,
  params?: { activeOnly?: boolean },
) {
  const http = await serverHttp();
  return http
    .get(E.assignments(wsId, machineId), {
      params: params?.activeOnly ? { activeOnly: 'true' } : {},
    })
    .then(unwrapServer<MachineShiftAssignment[]>);
}

export async function createMachineAssignment(
  wsId: string,
  machineId: string,
  data: CreateMachineAssignmentPayload,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http
      .post(E.assignments(wsId, machineId), data)
      .then(unwrapServer<MachineShiftAssignment>);
  });
}

export async function updateMachineAssignment(
  wsId: string,
  machineId: string,
  assignmentId: string,
  data: UpdateMachineAssignmentPayload,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http
      .patch(E.assignment(wsId, machineId, assignmentId), data)
      .then(unwrapServer<MachineShiftAssignment>);
  });
}

export async function deleteMachineAssignment(
  wsId: string,
  machineId: string,
  assignmentId: string,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http
      .delete(E.assignment(wsId, machineId, assignmentId))
      .then(unwrapServer<{ success: boolean }>);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 22 - Downtime Logging (D-16)
// All downtime read+write goes through Server Actions for consistent envelope
// + backend-error-message extraction across the Server-Action serialization
// boundary (see run() helper above). Backend error codes (DOWNTIME_OVERLAP,
// DOWNTIME_EDIT_WINDOW_EXPIRED, etc.) survive as `error.message` strings.
// ─────────────────────────────────────────────────────────────────────────────

function buildDowntimeParams(p?: ListDowntimeParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (!p) return out;
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

export async function listDowntimeForMachine(
  wsId: string,
  machineId: string,
  params?: ListDowntimeParams,
): Promise<ListDowntimeResponse> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .get(DT.list(wsId, machineId), { params: buildDowntimeParams(params) })
      .then(unwrapServer<ListDowntimeResponse>);
  });
}

export async function listDowntimeForWorkspace(
  wsId: string,
  params?: ListDowntimeParams,
): Promise<ListDowntimeResponse> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .get(DT.listWorkspace(wsId), { params: buildDowntimeParams(params) })
      .then(unwrapServer<ListDowntimeResponse>);
  });
}

export async function getActiveDowntime(
  wsId: string,
  machineId: string,
): Promise<DowntimeEntry | null> {
  return run(async () => {
    const http = await serverHttp();
    return http.get(DT.active(wsId, machineId)).then(unwrapServer<DowntimeEntry | null>);
  });
}

export async function createDowntime(
  wsId: string,
  machineId: string,
  payload: CreateDowntimePayload,
): Promise<DowntimeEntry> {
  return run(async () => {
    const http = await serverHttp();
    return http.post(DT.create(wsId, machineId), payload).then(unwrapServer<DowntimeEntry>);
  });
}

export async function closeDowntime(
  wsId: string,
  machineId: string,
  entryId: string,
  payload: CloseDowntimePayload,
): Promise<DowntimeEntry> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .patch(DT.close(wsId, machineId, entryId), payload)
      .then(unwrapServer<DowntimeEntry>);
  });
}

export async function updateDowntime(
  wsId: string,
  machineId: string,
  entryId: string,
  payload: UpdateDowntimePayload,
): Promise<DowntimeEntry> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .patch(DT.update(wsId, machineId, entryId), payload)
      .then(unwrapServer<DowntimeEntry>);
  });
}

export async function deleteDowntime(
  wsId: string,
  machineId: string,
  entryId: string,
): Promise<{ deleted: true; downtimeCode: string }> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .delete(DT.delete(wsId, machineId, entryId))
      .then(unwrapServer<{ deleted: true; downtimeCode: string }>);
  });
}

export async function peekNextDowntimeCode(wsId: string): Promise<{ nextCode: string }> {
  return run(async () => {
    const http = await serverHttp();
    return http.get(DT.peekCode(wsId)).then(unwrapServer<{ nextCode: string }>);
  });
}

export async function getDowntimeReasonCatalogue(
  wsId: string,
): Promise<WorkspaceDowntimeReasonConfig> {
  return run(async () => {
    const http = await serverHttp();
    return http.get(DT.reasons(wsId)).then(unwrapServer<WorkspaceDowntimeReasonConfig>);
  });
}

export async function updateDowntimeReasonCatalogue(
  wsId: string,
  payload: DowntimeReasonCatalogueUpdate,
): Promise<WorkspaceDowntimeReasonConfig> {
  return run(async () => {
    const http = await serverHttp();
    return http.patch(DT.reasons(wsId), payload).then(unwrapServer<WorkspaceDowntimeReasonConfig>);
  });
}

// ===== Phase 24: Maintenance Server Actions =====

export async function listMaintenanceSchedulesAction(
  wsId: string,
  machineId: string,
): Promise<MaintenanceSchedule[]> {
  return run(async () => {
    const http = await serverHttp();
    return http.get(MT.schedules.list(wsId, machineId)).then(unwrapServer<MaintenanceSchedule[]>);
  });
}

export async function createMaintenanceScheduleAction(
  wsId: string,
  machineId: string,
  payload: CreateMaintenanceSchedulePayload,
): Promise<MaintenanceSchedule> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .post(MT.schedules.create(wsId, machineId), payload)
      .then(unwrapServer<MaintenanceSchedule>);
  });
}

export async function updateMaintenanceScheduleAction(
  wsId: string,
  machineId: string,
  id: string,
  payload: UpdateMaintenanceSchedulePayload,
): Promise<MaintenanceSchedule> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .patch(MT.schedules.update(wsId, machineId, id), payload)
      .then(unwrapServer<MaintenanceSchedule>);
  });
}

export async function pauseMaintenanceScheduleAction(
  wsId: string,
  machineId: string,
  id: string,
  isActive: boolean,
): Promise<MaintenanceSchedule> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .patch(MT.schedules.pause(wsId, machineId, id), { isActive })
      .then(unwrapServer<MaintenanceSchedule>);
  });
}

export async function deleteMaintenanceScheduleAction(
  wsId: string,
  machineId: string,
  id: string,
): Promise<{ deleted: true; scheduleCode: string }> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .delete(MT.schedules.delete(wsId, machineId, id))
      .then(unwrapServer<{ deleted: true; scheduleCode: string }>);
  });
}

export async function listServiceLogsAction(
  wsId: string,
  machineId: string,
  params: ListServiceLogsParams = {},
): Promise<ListServiceLogsResponse> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .get(MT.serviceLogs.list(wsId, machineId), { params })
      .then(unwrapServer<ListServiceLogsResponse>);
  });
}

export async function createServiceLogAction(
  wsId: string,
  machineId: string,
  payload: CreateServiceLogPayload,
): Promise<ServiceLog> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .post(MT.serviceLogs.create(wsId, machineId), payload)
      .then(unwrapServer<ServiceLog>);
  });
}

export async function updateServiceLogAction(
  wsId: string,
  machineId: string,
  id: string,
  payload: UpdateServiceLogPayload,
): Promise<ServiceLog> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .patch(MT.serviceLogs.update(wsId, machineId, id), payload)
      .then(unwrapServer<ServiceLog>);
  });
}

export async function listMaintenanceDueAction(
  wsId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<ListMaintenanceDueResponse> {
  return run(async () => {
    const http = await serverHttp();
    return http.get(MT.due(wsId), { params }).then(unwrapServer<ListMaintenanceDueResponse>);
  });
}

export async function getMaintenanceLeadTimeAction(
  wsId: string,
): Promise<{ leadTimeDays: number }> {
  return run(async () => {
    const http = await serverHttp();
    return http.get(MT.leadTime(wsId)).then(unwrapServer<{ leadTimeDays: number }>);
  });
}

export async function setMaintenanceLeadTimeAction(
  wsId: string,
  leadTimeDays: number,
): Promise<{ leadTimeDays: number }> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .patch(MT.leadTime(wsId), { leadTimeDays })
      .then(unwrapServer<{ leadTimeDays: number }>);
  });
}
