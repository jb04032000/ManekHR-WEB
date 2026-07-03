'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { AttendanceDevice, UnassignedPunchPair } from '@/types';

const E = ApiEndpoints.attendanceDevices;
const EA = ApiEndpoints.attendance;

export async function listDevicesAction(wsId: string) {
  const http = await serverHttp();
  return http.get(E.list(wsId)).then(unwrapServer<AttendanceDevice[]>);
}

export async function getUnassignedPunchesAction(wsId: string) {
  const http = await serverHttp();
  return http.get(EA.unassignedPunches(wsId)).then(unwrapServer<UnassignedPunchPair[]>);
}
