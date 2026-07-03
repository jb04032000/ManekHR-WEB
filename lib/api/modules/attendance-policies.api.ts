import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  AttendancePolicy,
  CreateAttendancePolicyPayload,
  UpdateAttendancePolicyPayload,
  AttendancePolicyDryRunPayload,
  AttendancePolicyDryRunResult,
} from '@/types';

const E = ApiEndpoints.attendancePolicies;

export const attendancePoliciesApi = {
  list: (wsId: string) => http.get(E.list(wsId)).then(unwrap<AttendancePolicy[]>),

  get: (wsId: string, id: string) => http.get(E.get(wsId, id)).then(unwrap<AttendancePolicy>),

  create: (wsId: string, data: CreateAttendancePolicyPayload) =>
    http.post(E.create(wsId), data).then(unwrap<AttendancePolicy>),

  update: (wsId: string, id: string, data: UpdateAttendancePolicyPayload) =>
    http.patch(E.update(wsId, id), data).then(unwrap<AttendancePolicy>),

  delete: (wsId: string, id: string) => http.delete(E.delete(wsId, id)).then(unwrap<void>),

  dryRun: (wsId: string, id: string, data: AttendancePolicyDryRunPayload) =>
    http.post(E.dryRun(wsId, id), data).then(unwrap<AttendancePolicyDryRunResult>),
};
