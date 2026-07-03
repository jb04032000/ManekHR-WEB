import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  AttendanceDevice,
  UnassignedPunchPair,
  AssignDeviceUserPayload,
  RotateIngestTokenPayload,
  IngestTokenResponse,
} from '@/types';

const E = ApiEndpoints.attendanceDevices;
const EA = ApiEndpoints.attendance;

export const attendanceDevicesApi = {
  listDevices: (wsId: string, status?: string) =>
    http.get(E.list(wsId), { params: status ? { status } : {} }).then(unwrap<AttendanceDevice[]>),

  getDevice: (wsId: string, id: string) =>
    http.get(E.get(wsId, id)).then(unwrap<AttendanceDevice>),

  approveDevice: (wsId: string, id: string) =>
    http.patch(E.approve(wsId, id)).then(unwrap<AttendanceDevice>),

  pauseDevice: (wsId: string, id: string) =>
    http.patch(E.pause(wsId, id)).then(unwrap<AttendanceDevice>),

  unpauseDevice: (wsId: string, id: string) =>
    http.patch(E.unpause(wsId, id)).then(unwrap<AttendanceDevice>),

  revokeDevice: (wsId: string, id: string) =>
    http.patch(E.revoke(wsId, id)).then(unwrap<AttendanceDevice>),

  getIngestToken: (wsId: string) =>
    http.get(EA.ingestToken(wsId)).then(unwrap<IngestTokenResponse>),

  rotateIngestToken: (wsId: string, payload: RotateIngestTokenPayload) =>
    http.post(EA.rotateIngestToken(wsId), payload).then(unwrap<IngestTokenResponse>),

  getUnassignedPunches: (wsId: string) =>
    http.get(EA.unassignedPunches(wsId)).then(unwrap<UnassignedPunchPair[]>),

  assignDeviceUser: (wsId: string, payload: AssignDeviceUserPayload) =>
    http.post(EA.assignDeviceUser(wsId), payload).then(unwrap<{ updated: number }>),
};
