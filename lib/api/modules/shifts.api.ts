import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { Shift, CreateShiftPayload, UpdateShiftPayload } from '@/types';

const E = ApiEndpoints.shifts;

export const shiftsApi = {
  list: (wsId: string) => http.get(E.list(wsId)).then(unwrap<Shift[]>),
  create: (wsId: string, data: CreateShiftPayload) =>
    http.post(E.create(wsId), data).then(unwrap<Shift>),
  update: (wsId: string, shiftId: string, data: UpdateShiftPayload) =>
    http.patch(E.update(wsId, shiftId), data).then(unwrap<Shift>),
  delete: (wsId: string, shiftId: string) =>
    http.delete(E.delete(wsId, shiftId)).then(unwrap<{ message: string }>),
};
